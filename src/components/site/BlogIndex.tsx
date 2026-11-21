import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { blogCategories, blogPosts } from "@/db/schema";
import { currentSite } from "@/lib/site/pageData";
import SiteShell from "@/components/site/SiteShell";


export async function BlogIndex({ categoryId, heading }: { categoryId?: string; heading?: string }) {
  const site = await currentSite(); if (!site) notFound();
  const conds = [eq(blogPosts.siteId, site.id), eq(blogPosts.status, "published")];
  if (categoryId) conds.push(eq(blogPosts.categoryId, categoryId));
  const posts = await db.select().from(blogPosts).where(and(...conds)).orderBy(desc(blogPosts.publishedAt)).limit(60);
  const cats = await db.select().from(blogCategories).where(eq(blogCategories.siteId, site.id));
  return (
    <SiteShell site={site} path="/blog">
      <section className="s-sec"><div className="s-wrap">
        <h1>{heading ?? "Blog"}</h1>
        {cats.length > 0 && <p className="row">{cats.map((c) => <a key={c.id} href={`/blog/category/${c.slug}`} style={{ marginRight: 12 }}>{c.name}</a>)}</p>}
        <div className="s-cards">{posts.map((p) => <a key={p.id} className="s-card s-link-card" href={`/blog/${p.slug}`}><h3>{p.title}</h3><p className="s-muted">{p.excerpt ?? p.metaDescription ?? ""}</p><p className="s-muted" style={{ fontSize: ".85rem" }}>{p.publishedAt?.toLocaleDateString("en-GB", { dateStyle: "long" })}</p></a>)}</div>
        {posts.length === 0 && <p className="s-muted">No posts yet.</p>}
      </div></section>
    </SiteShell>
  );
}
