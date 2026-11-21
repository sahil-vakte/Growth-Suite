import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pages, sections } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { siteRow } from "@/lib/admin/rows";

export const POST = adminRoute<{ id: string }>("content", async (ctx, req, p) => {
  const page = await siteRow(pages, p.id, ctx.site.id, "Page");
  const { order } = z.object({ order: z.array(z.string()).max(500) }).parse(await readJson(req));
  await db.transaction(async (tx) => { for (let i = 0; i < order.length; i++) await tx.update(sections).set({ position: i }).where(and(eq(sections.id, order[i]), eq(sections.pageId, page.id))); });
  return { ok: true };
});
