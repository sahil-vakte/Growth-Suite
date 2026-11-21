import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { siteSchema } from "@/lib/admin/schemas";
import { clearSiteCache } from "@/lib/tenant";

export const PATCH = adminRoute<{ id: string }>(undefined, async (ctx, req, p) => {
  if (!ctx.member.isPlatformAdmin) throw new HttpError(403, "Platform admins only.");
  const b = siteSchema.partial().parse(await readJson(req));
  const [s] = await db.update(sites).set({ ...b, ...(b.domain ? { domain: b.domain.toLowerCase().replace(/^www\./, "") } : {}) }).where(eq(sites.id, p.id)).returning();
  if (!s) throw new HttpError(404, "Site not found.");
  clearSiteCache();
  return s;
});
