import { withApiLog } from "@/lib/apiLogging";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, pages } from "@/db/schema";
import { siteForHost } from "@/lib/tenant";

async function handleGET(req: Request) {
  const site = await siteForHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  if (!site) return new Response("Not found", { status: 404 });
  const base = `https://${site.domain}`;
  const ps = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, site.id), eq(pages.status, "published")));
  const bs = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.siteId, site.id), eq(blogPosts.status, "published")));
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const urls = [
    ...ps.map((p) => ({
      loc: p.isHome ? `${base}/` : `${base}/${p.slug}`,
      lastmod: p.updatedAt,
      freq: "weekly",
      pri: p.isHome ? "1.0" : "0.8",
    })),
    ...(bs.length ? [{ loc: `${base}/blog`, lastmod: new Date(), freq: "daily", pri: "0.7" }] : []),
    ...bs.map((b) => ({
      loc: `${base}/blog/${b.slug}`,
      lastmod: b.updatedAt,
      freq: "monthly",
      pri: b.isPillar ? "0.8" : "0.6",
    })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}

export const GET = withApiLog("/sitemap.xml", "GET", handleGET);
