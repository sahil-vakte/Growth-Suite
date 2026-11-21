import { withApiLog } from "@/lib/apiLogging";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pages, sectionTemplates, sections } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import { snapshot } from "@/lib/history";

async function load(
  ctx: { site: { id: string }; member: { role: string; isPlatformAdmin?: boolean } },
  id: string,
) {
  const sec = await siteRow(sections, id, ctx.site.id, "Section");
  const [page] = await db.select().from(pages).where(eq(pages.id, sec.pageId)).limit(1);
  if (
    page?.lastEditedRole === "admin" &&
    ctx.member.role !== "admin" &&
    !ctx.member.isPlatformAdmin
  )
    throw new HttpError(403, "This page is locked for editors.");
  return { sec, page };
}
const stamp = (pageId: string, actor: string, role: string) =>
  db.update(pages).set({ lastEditedBy: actor, lastEditedRole: role }).where(eq(pages.id, pageId));
const audience = z
  .object({
    param: z.string().min(1).max(60),
    op: z.enum(["equals", "contains", "exists"]),
    value: z.string().max(200).optional(),
  })
  .nullable();

export const PATCH = withApiLog(
  "/api/admin/sections/[id]",
  "PATCH",
  adminRoute<{ id: string }>("content", async (ctx, req, p) => {
    const { sec } = await load(ctx, p.id);
    const b = z
      .object({
        content: z.record(z.unknown()).optional(),
        style: z.record(z.unknown()).nullable().optional(),
        name: z.string().max(120).nullable().optional(),
        visible: z.boolean().optional(),
        audienceRule: audience.optional(),
        action: z.enum(["duplicate", "save_template"]).optional(),
        templateName: z.string().max(120).optional(),
      })
      .parse(await readJson(req));
    if (b.action === "duplicate") {
      await db
        .update(sections)
        .set({ position: sql`${sections.position} + 1` })
        .where(and(eq(sections.pageId, sec.pageId), gt(sections.position, sec.position)));
      const [copy] = await db
        .insert(sections)
        .values({
          siteId: sec.siteId,
          pageId: sec.pageId,
          position: sec.position + 1,
          layoutKey: sec.layoutKey,
          name: sec.name,
          content: sec.content,
          style: sec.style,
          visible: sec.visible,
          audienceRule: sec.audienceRule,
        })
        .returning();
      return copy;
    }
    if (b.action === "save_template") {
      const [t] = await db
        .insert(sectionTemplates)
        .values({
          siteId: sec.siteId,
          name: b.templateName || sec.name || sec.layoutKey,
          layoutKey: sec.layoutKey,
          content: sec.content,
          style: sec.style,
        })
        .returning();
      return { ok: true, templateId: t.id };
    }
    await snapshot(ctx.site.id, "sections", sec.id, sec, "update", ctx.actor);
    const { action: _a, templateName: _t, ...data } = b;
    const [u] = await db.update(sections).set(data).where(eq(sections.id, sec.id)).returning();
    await stamp(sec.pageId, ctx.actor, ctx.member.isPlatformAdmin ? "admin" : ctx.member.role);
    return u;
  }),
);

export const DELETE = withApiLog(
  "/api/admin/sections/[id]",
  "DELETE",
  adminRoute<{ id: string }>("content", async (ctx, _req, p) => {
    const { sec } = await load(ctx, p.id);
    await snapshot(ctx.site.id, "sections", sec.id, sec, "delete", ctx.actor);
    await db.delete(sections).where(eq(sections.id, sec.id));
    return { ok: true };
  }),
);
