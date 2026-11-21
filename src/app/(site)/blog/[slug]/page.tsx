import { and, desc, eq, inArray, lt, gt, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { blogCategories, blogPosts } from "@/db/schema";
import { currentSite } from "@/lib/site/pageData";
import { getAdminContext } from "@/lib/auth/current";
import { sanitizeHtml } from "@/lib/site/sanitize";
import SiteShell from "@/components/site/SiteShell";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const site = await currentSite();
  if (!site) return null;
  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.siteId, site.id), eq(blogPosts.slug, slug)))
    .limit(1);
  if (!post) return null;
  if (post.status !== "published") {
    const ctx = await getAdminContext();
    if (!ctx || ctx.site.id !== site.id) return null;
  }
  return { site, post };
}

export async function generateMetadata({ params }: Props) {
  const d = await load((await params).slug);
  if (!d) return {};
  return {
    title: `${d.post.title} | ${d.site.name}`,
    description: d.post.metaDescription ?? d.post.excerpt ?? undefined,
    alternates: { canonical: `https://${d.site.domain}/blog/${d.post.slug}` },
  };
}

export default async function BlogPost({ params }: Props) {
  const d = await load((await params).slug);
  if (!d) notFound();
  const { site, post } = d;
  const [cat] = post.categoryId
    ? await db.select().from(blogCategories).where(eq(blogCategories.id, post.categoryId)).limit(1)
    : [];
  const related = post.relatedIds.length
    ? await db
        .select()
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.siteId, site.id),
            inArray(blogPosts.id, post.relatedIds),
            eq(blogPosts.status, "published"),
          ),
        )
    : [];
  const [prev] = post.publishedAt
    ? await db
        .select()
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.siteId, site.id),
            eq(blogPosts.status, "published"),
            lt(blogPosts.publishedAt, post.publishedAt),
          ),
        )
        .orderBy(desc(blogPosts.publishedAt))
        .limit(1)
    : [];
  const [next] = post.publishedAt
    ? await db
        .select()
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.siteId, site.id),
            eq(blogPosts.status, "published"),
            gt(blogPosts.publishedAt, post.publishedAt),
          ),
        )
        .orderBy(asc(blogPosts.publishedAt))
        .limit(1)
    : [];
  const url = `https://${site.domain}/blog/${post.slug}`;
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.publishedAt?.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      author: post.authorName ? { "@type": "Person", name: post.authorName } : undefined,
      mainEntityOfPage: url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: `https://${site.domain}/blog` },
        ...(cat
          ? [
              {
                "@type": "ListItem",
                position: 2,
                name: cat.name,
                item: `https://${site.domain}/blog/category/${cat.slug}`,
              },
            ]
          : []),
        { "@type": "ListItem", position: cat ? 3 : 2, name: post.title, item: url },
      ],
    },
    ...(post.faq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: post.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : []),
  ];
  return (
    <SiteShell site={site} path={`/blog/${post.slug}`}>
      <article className="s-sec">
        <div className="s-wrap s-narrow">
          <nav className="s-breadcrumbs" aria-label="Breadcrumb">
            <a href="/blog">Blog</a>
            {cat && (
              <>
                {" "}
                › <a href={`/blog/category/${cat.slug}`}>{cat.name}</a>
              </>
            )}{" "}
            › {post.title}
          </nav>
          <h1>{post.title}</h1>
          <p className="s-muted">
            {post.authorName && `${post.authorName} · `}
            {post.publishedAt?.toLocaleDateString("en-GB", { dateStyle: "long" })}
          </p>
          <div className="s-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.html) }} />
          {post.faq.length > 0 && (
            <>
              <h2>Frequently asked questions</h2>
              {post.faq.map((f, i) => (
                <details key={i} className="s-faq">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </>
          )}
          {related.length > 0 && (
            <>
              <h2>Related reading</h2>
              <ul>
                {related.map((r) => (
                  <li key={r.id}>
                    <a href={`/blog/${r.slug}`}>{r.title}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="row" style={{ justifyContent: "space-between", marginTop: "2rem" }}>
            {prev ? <a href={`/blog/${prev.slug}`}>← {prev.title}</a> : <span />}
            {next ? <a href={`/blog/${next.slug}`}>{next.title} →</a> : <span />}
          </p>
        </div>
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
    </SiteShell>
  );
}
