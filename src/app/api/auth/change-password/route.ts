import { withApiLog } from "@/lib/apiLogging";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { signSession, SESSION_COOKIE } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { audit } from "@/lib/history";

/** Changes your own password and signs out every other session. */
export const POST = withApiLog(
  "/api/auth/change-password",
  "POST",
  adminRoute(undefined, async (ctx, req) => {
    const b = z
      .object({ current: z.string().max(200), next: z.string().max(200) })
      .parse(await readJson(req));
    if (!(await verifyPassword(b.current, ctx.user.passwordHash)))
      throw new HttpError(403, "Your current password is not correct.");
    const prob = passwordProblems(b.next);
    if (prob) throw new HttpError(422, prob);
    const [u] = await db
      .update(users)
      .set({
        passwordHash: await hashPassword(b.next),
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, ctx.user.id))
      .returning();
    (await cookies()).set(
      SESSION_COOKIE,
      await signSession({ uid: u.id, ver: u.sessionVersion, mfa: ctx.twoFactorVerified }),
      {
        httpOnly: true,
        secure: env.appUrl.startsWith("https"),
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      },
    );
    await audit(null, ctx.actor, "auth.password_change");
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  }),
);
