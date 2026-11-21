import { withApiLog } from "@/lib/apiLogging";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { moduleLicenses } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { MODULES, issueLicence, moduleActive } from "@/lib/services/modules";

export const GET = withApiLog(
  "/api/admin/modules",
  "GET",
  adminRoute("modules", async (ctx) => {
    const lic = await db
      .select()
      .from(moduleLicenses)
      .where(eq(moduleLicenses.siteId, ctx.site.id));
    return Promise.all(
      MODULES.map(async (m) => ({
        ...m,
        active: await moduleActive(ctx.site.id, m.key),
        endsAt: lic.find((l) => l.moduleKey === m.key)?.endsAt ?? null,
      })),
    );
  }),
);

/** Platform admins unlock a module for this site until a date. */
export const POST = withApiLog(
  "/api/admin/modules",
  "POST",
  adminRoute("modules", async (ctx, req) => {
    if (!ctx.member.isPlatformAdmin)
      throw new HttpError(403, "Only the platform team can unlock modules.");
    const b = z
      .object({ moduleKey: z.string(), months: z.number().int().min(1).max(36) })
      .parse(await readJson(req));
    await issueLicence(ctx.site.id, b.moduleKey, new Date(Date.now() + b.months * 30 * 86_400_000));
    return { ok: true, message: "Module unlocked." };
  }),
);
