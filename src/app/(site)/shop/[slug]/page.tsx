import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { products } from "@/db/schema";
import { currentSite } from "@/lib/site/pageData";
import { sanitizeHtml } from "@/lib/site/sanitize";
import SiteShell from "@/components/site/SiteShell";
import BuyBox from "@/components/site/BuyBox";

export const dynamic = "force-dynamic";
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const site = await currentSite(); if (!site) notFound();
  if ((await params).slug === "thank-you") return <SiteShell site={site} path="/shop/thank-you"><section className="s-sec"><div className="s-wrap s-center"><h1>Thank you for your order</h1><p className="s-muted">You will receive a confirmation shortly.</p><a className="s-btn primary" href="/">Back to the home page</a></div></section></SiteShell>;
  const [p] = await db.select().from(products).where(and(eq(products.siteId, site.id), eq(products.slug, (await params).slug), eq(products.status, "active"))).limit(1);
  if (!p) notFound();
  const fmt = (m: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: p.currency }).format(m / 100);
  return (
    <SiteShell site={site} path={`/shop/${p.slug}`}>
      <section className="s-sec"><div className="s-wrap s-grid2">
        <div>{p.imageUrl && <img src={p.imageUrl} alt={p.name} className="s-hero-img" />}</div>
        <div><h1>{p.name}</h1><p className="s-price">{fmt(p.priceMinor)}{p.compareAtMinor && p.compareAtMinor > p.priceMinor ? <s className="s-muted" style={{ fontSize: "1.1rem", marginLeft: 10 }}>{fmt(p.compareAtMinor)}</s> : null}</p>
          {p.shortDescription && <p className="s-lead">{p.shortDescription}</p>}
          {p.stock > 0 ? <BuyBox productId={p.id} /> : <p className="s-muted">Out of stock.</p>}
          {p.description && <div className="s-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.description) }} />}</div>
      </div></section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku, image: p.imageUrl, offers: { "@type": "Offer", price: (p.priceMinor / 100).toFixed(2), priceCurrency: p.currency, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } }).replace(/</g, "\\u003c") }} />
    </SiteShell>
  );
}
