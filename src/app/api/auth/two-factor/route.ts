import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { memberships, sites, users } from "@/db/schema";
import { adminRoute, json, readJson } from "@/lib/api";
import { withApiLog } from "@/lib/apiLogging";
import { HttpError } from "@/lib/auth/current";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { audit } from "@/lib/history";
import { rateLimited } from "@/lib/integrations/rateLimit";
import { beginTwoFactor, confirmTwoFactor, consumeSecondFactor } from "@/lib/services/twoFactor";

export const POST = withApiLog(
  "/api/auth/two-factor",
  "POST",
  adminRoute(
    undefined,
    async (ctx, req) => {
      const b = z
        .object({
          action: z.enum(["begin", "confirm", "disable", "policy"]),
          password: z.string().min(1).max(200),
          code: z.string().max(40).default(""),
          required: z.boolean().optional(),
        })
        .parse(await readJson(req));
      if (await rateLimited(`two-factor:${ctx.user.id}`, 10, 15 * 60_000))
        throw new HttpError(429, "Too many attempts. Please wait 15 minutes.");
      if (!(await verifyPassword(b.password, ctx.user.passwordHash)))
        throw new HttpError(403, "Your password is not correct.");
      let result: Record<string, unknown> = { ok: true };
      let version: number | undefined;
      let mfa = false;
      if (b.action === "begin") {
        const secret = await beginTwoFactor(ctx.user.id, ctx.user.sessionVersion);
        if (!secret)
          throw new HttpError(
            409,
            "Two-factor authentication is already enabled. Refresh the page.",
          );
        result = { secret };
      } else if (b.action === "confirm") {
        const confirmed = await confirmTwoFactor(
          ctx.user.id,
          ctx.user.sessionVersion,
          b.code.trim(),
        );
        if (!confirmed)
          throw new HttpError(
            422,
            "The code is incorrect or setup has expired. Try again or start setup again.",
          );
        result = { codes: confirmed.codes };
        version = confirmed.version;
        mfa = true;
      } else if (b.action === "policy") {
        if (ctx.member.role !== "admin" && !ctx.member.isPlatformAdmin)
          throw new HttpError(403, "Only a site administrator can change this policy.");
        if (!ctx.twoFactorVerified || !ctx.user.totpSecretEnc)
          throw new HttpError(403, "Enable two-factor authentication on your account first.");
        if (b.required === undefined)
          throw new HttpError(422, "Choose whether two-factor authentication is required.");
        await db
          .update(sites)
          .set({ requireAdminTwoFactor: b.required })
          .where(eq(sites.id, ctx.site.id));
      } else {
        const required = ctx.user.isPlatformAdmin
          ? await db
              .select({ id: sites.id })
              .from(sites)
              .where(eq(sites.requireAdminTwoFactor, true))
              .limit(1)
          : await db
              .select({ id: sites.id })
              .from(memberships)
              .innerJoin(sites, eq(sites.id, memberships.siteId))
              .where(
                and(
                  eq(memberships.userId, ctx.user.id),
                  eq(memberships.role, "admin"),
                  eq(sites.requireAdminTwoFactor, true),
                ),
              )
              .limit(1);
        if (required.length)
          throw new HttpError(
            403,
            "A site you administer requires two-factor authentication. Keep it enabled or change that site's policy first.",
          );
        if (!(await consumeSecondFactor(ctx.user.id, ctx.user.sessionVersion, b.code.trim())))
          throw new HttpError(403, "Enter a new authenticator code or unused recovery code.");
        const [updated] = await db
          .update(users)
          .set({
            totpSecretEnc: null,
            totpPendingSecretEnc: null,
            totpPendingExpiresAt: null,
            totpLastStep: -1,
            recoveryCodeHashes: [],
            sessionVersion: ctx.user.sessionVersion + 1,
          })
          .where(and(eq(users.id, ctx.user.id), eq(users.sessionVersion, ctx.user.sessionVersion)))
          .returning({ version: users.sessionVersion });
        if (!updated) throw new HttpError(409, "Your account changed. Sign in again.");
        version = updated.version;
      }
      if (version !== undefined)
        (await cookies()).set(
          SESSION_COOKIE,
          await signSession({ uid: ctx.user.id, ver: version, mfa }),
          {
            httpOnly: true,
            secure: env.appUrl.startsWith("https"),
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          },
        );
      await audit(ctx.site.id, ctx.actor, `auth.two_factor.${b.action}`);
      const response = json(result);
      response.headers.set("Cache-Control", "no-store");
      return response;
    },
    true,
  ),
);
