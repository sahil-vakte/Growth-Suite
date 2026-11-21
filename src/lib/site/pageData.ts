import { cookies, headers } from "next/headers";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pages, redirects, sections } from "@/db/schema";
import { siteForHost } from "../tenant";
import { filterSections } from "../engines/sectionAudience";
import { getAdminContext } from "../auth/current";

export async function currentSite() {
  const h = await headers();
  return siteForHost(h.get("x-forwarded-host") ?? h.get("host"));
}

export async function findRedirect(siteId: string, path: string) {
  const [r] = await db
    .select()
    .from(redirects)
    .where(and(eq(redirects.siteId, siteId), eq(redirects.fromPath, path)))
    .limit(1);
  if (r)
    await db
      .update(redirects)
      .set({ hits: sql`${redirects.hits} + 1`, lastHitAt: new Date() })
      .where(eq(redirects.id, r.id));
  return r ?? null;
}

export async function loadPage(
  siteId: string,
  slug: string | null,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const [page] = slug
    ? await db
        .select()
        .from(pages)
        .where(and(eq(pages.siteId, siteId), eq(pages.slug, slug)))
        .limit(1)
    : await db
        .select()
        .from(pages)
        .where(and(eq(pages.siteId, siteId), eq(pages.isHome, true), eq(pages.status, "published")))
        .limit(1);
  if (!page) return null;
  let preview = false;
  if (page.status === "draft") {
    const ctx = await getAdminContext();
    if (!ctx || ctx.site.id !== siteId) return null; // drafts are hidden from the public
    preview = true;
  }
  const raw = (await cookies()).get("gs_params")?.value;
  const remembered: Record<string, string> = (() => {
    try {
      return JSON.parse(decodeURIComponent(raw ?? "") || "{}");
    } catch {
      return {};
    }
  })();
  const params: Record<string, string> = { ...remembered };
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string") params[k] = v;
  const secs = await db
    .select()
    .from(sections)
    .where(eq(sections.pageId, page.id))
    .orderBy(asc(sections.position));
  return { page, sections: filterSections(secs, params), preview };
}
