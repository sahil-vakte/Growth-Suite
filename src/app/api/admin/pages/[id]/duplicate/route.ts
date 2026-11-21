import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pages, sections } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { siteRow } from "@/lib/admin/rows";
import { audit } from "@/lib/history";

export const POST = adminRoute<{ id: string }>("content", async (ctx, _req, p) => {
  const page = await siteRow(pages, p.id, ctx.site.id, "Page");
  const secs = await db.select().from(sections).where(eq(sections.pageId, page.id)).orderBy(asc(sections.position));
  const copy = await db.transaction(async (tx) => {
    const [np] = await tx.insert(pages).values({ siteId: ctx.site.id, title: `${page.title} (copy)`, slug: `${page.slug}-copy-${Date.now().toString(36)}`, status: "draft", seoTitle: page.seoTitle, seoDescription: page.seoDescription, schemaJson: page.schemaJson, themeId: page.themeId, fontSetId: page.fontSetId, lastEditedBy: ctx.actor, lastEditedRole: ctx.member.role }).returning();
    if (secs.length) await tx.insert(sections).values(secs.map((s) => ({ siteId: ctx.site.id, pageId: np.id, position: s.position, layoutKey: s.layoutKey, name: s.name, content: s.content, style: s.style, visible: s.visible, audienceRule: s.audienceRule })));
    return np;
  });
  await audit(ctx.site.id, ctx.actor, "pages.duplicate", "pages", copy.id, { from: page.id });
  return { ok: true, id: copy.id, message: `Copied as "${copy.title}" (draft).` };
});
