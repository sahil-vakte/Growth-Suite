import { headers } from "next/headers";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { currentSite, findRedirect, loadPage } from "@/lib/site/pageData";
import SiteShell from "@/components/site/SiteShell";
import { SectionView } from "@/components/site/Sections";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const site = await currentSite();
  if (!site) return {};
  const { slug } = await params;
  const data = await loadPage(site.id, slug?.join("/") ?? null, await searchParams);
  if (!data) return { title: site.name };
  const path = slug?.length ? `/${slug.join("/")}` : "/";
  return {
    title: data.page.seoTitle || `${data.page.title} | ${site.name}`,
    description: data.page.seoDescription ?? undefined,
    alternates: { canonical: `https://${site.domain}${path}` },
    robots: data.preview ? { index: false } : undefined,
  };
}

export default async function PublicPage({ params, searchParams }: Props) {
  const site = await currentSite();
  if (!site || site.status !== "active") notFound();
  const { slug } = await params;
  const path = slug?.length ? `/${slug.join("/")}` : "/";
  const data = await loadPage(site.id, slug?.join("/") ?? null, await searchParams);
  if (!data) {
    const r = await findRedirect(site.id, path);
    if (r) {
      if (r.code === 302) redirect(r.toUrl);
      permanentRedirect(r.toUrl);
    }
    notFound();
  }
  const schema = data.page.schemaJson;
  return (
    <SiteShell site={site} themeId={data.page.themeId} fontSetId={data.page.fontSetId} path={path}>
      {data.preview && (
        <div className="s-draft-bar">
          Draft preview — visitors see “Page not found” until you publish this page.
        </div>
      )}
      {data.sections.map((s, i) => (
        <SectionView
          key={s.id}
          layoutKey={s.layoutKey}
          content={s.content}
          siteId={site.id}
          pageUrl={`https://${site.domain}${path}`}
          sectionId={s.id}
          isFirst={i === 0}
          currency={site.currency}
        />
      ))}
      {data.sections.length === 0 && (
        <section className="s-sec">
          <div className="s-wrap s-center">
            <h1>{data.page.title}</h1>
            <p className="s-muted">This page has no sections yet.</p>
          </div>
        </section>
      )}
      {schema ? (
        <script
          nonce={(await headers()).get("x-nonce") ?? undefined}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
        />
      ) : null}
    </SiteShell>
  );
}
