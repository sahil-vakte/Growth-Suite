import { withApiLog } from "@/lib/apiLogging";
import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pages, sectionTemplates, sections } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import { layoutByKey } from "@/lib/layouts/registry";

const lock = (
  role: string,
  platform: boolean | undefined,
  page: { lastEditedRole: string | null },
) => {
  if (page.lastEditedRole === "admin" && role !== "admin" && !platform)
    throw new HttpError(
      403,
      "An admin last edited this page, so it is locked for editors. Duplicate the page to edit your own copy.",
    );
};

export const GET = withApiLog(
  "/api/admin/pages/[id]/sections",
  "GET",
  adminRoute<{ id: string }>("content", async (ctx, _req, p) => {
    const page = await siteRow(pages, p.id, ctx.site.id, "Page");
    return {
      page,
      sections: await db
        .select()
        .from(sections)
        .where(eq(sections.pageId, page.id))
        .orderBy(asc(sections.position)),
    };
  }),
);

export const POST = withApiLog(
  "/api/admin/pages/[id]/sections",
  "POST",
  adminRoute<{ id: string }>("content", async (ctx, req, p) => {
    const page = await siteRow(pages, p.id, ctx.site.id, "Page");
    lock(ctx.member.role, ctx.member.isPlatformAdmin, page);
    const b = z
      .object({ layoutKey: z.string().optional(), templateId: z.string().optional() })
      .parse(await readJson(req));
    let layoutKey = b.layoutKey ?? "";
    let content: Record<string, unknown> = {};
    let style: Record<string, unknown> | null = null;
    if (b.templateId) {
      const t = await siteRow(sectionTemplates, b.templateId, ctx.site.id, "Template");
      layoutKey = t.layoutKey;
      content = t.content;
      style = (t.style as Record<string, unknown>) ?? null;
    } else {
      const l = layoutByKey(layoutKey);
      if (!l) throw new HttpError(422, "Unknown layout.");
      content = structuredClone(l.defaultContent);
    }
    const [{ n }] = await db
      .select({ n: count() })
      .from(sections)
      .where(eq(sections.pageId, page.id));
    const [sec] = await db
      .insert(sections)
      .values({ siteId: ctx.site.id, pageId: page.id, position: n, layoutKey, content, style })
      .returning();
    await db
      .update(pages)
      .set({
        lastEditedBy: ctx.actor,
        lastEditedRole: ctx.member.isPlatformAdmin ? "admin" : ctx.member.role,
      })
      .where(eq(pages.id, page.id));
    return sec;
  }),
);
