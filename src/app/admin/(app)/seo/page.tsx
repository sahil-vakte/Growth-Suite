import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/current";
import { SettingsForm } from "@/components/admin/ui";
import SeoResearch from "@/components/admin/SeoResearch";

export default async function SeoPage() {
  const ctx = await requireAdmin("seo");
  const list = await db.select().from(pages).where(and(eq(pages.siteId, ctx.site.id), eq(pages.status, "published")));
  const titles = list.map((p) => p.seoTitle || p.title);
  return (
    <div>
      <h1>SEO tools</h1>
      <h2>Active URLs & titles</h2>
      <table className="data"><thead><tr><th>Address</th><th>Title</th><th>Meta title</th><th>Meta description</th><th>Issues</th></tr></thead><tbody>
        {list.map((p) => { const t = p.seoTitle || p.title; const issues = [!p.seoDescription && "missing description", (p.seoDescription?.length ?? 0) > 160 && "description too long", t.length > 60 && "title over 60 characters", titles.filter((x) => x === t).length > 1 && "duplicate title"].filter(Boolean); return <tr key={p.id}><td>/{p.isHome ? "" : p.slug}</td><td>{p.title}</td><td>{p.seoTitle}</td><td className="small">{p.seoDescription}</td><td>{issues.length ? issues.map((i) => <span key={String(i)} className="badge amber" style={{ marginRight: 4 }}>{i}</span>) : <span className="badge green">OK</span>}</td></tr>; })}
      </tbody></table>
      <p className="small" style={{ marginTop: ".5rem" }}>Sitemap: <a href="/sitemap.xml" target="_blank">/sitemap.xml</a> (pages and blog posts, updated automatically) · <a href="/robots.txt" target="_blank">/robots.txt</a></p>
      <div className="grid cols-2" style={{ marginTop: "1rem" }}>
        <SettingsForm settingKey="seo.robots" title="robots.txt" help="The sitemap line is added automatically." />
        <SeoResearch />
      </div>
    </div>
  );
}
