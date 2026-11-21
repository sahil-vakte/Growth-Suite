import { eq } from "drizzle-orm";
import { db } from "@/db";
import { affiliateTerms } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import { requireModule } from "@/lib/services/modules";

export const POST = adminRoute<{ id: string }>("affiliates", async (ctx, _req, p) => {
  await requireModule(ctx.site.id, "affiliates");
  const t = await siteRow(affiliateTerms, p.id, ctx.site.id, "Terms");
  if (t.publishedAt) throw new HttpError(409, "Already published.");
  await db
    .update(affiliateTerms)
    .set({ publishedAt: new Date() })
    .where(eq(affiliateTerms.id, t.id));
  return { ok: true, message: `Version ${t.version} is now in force for new referrals.` };
});
