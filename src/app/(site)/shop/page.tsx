import { notFound } from "next/navigation";
import { currentSite } from "@/lib/site/pageData";
import SiteShell from "@/components/site/SiteShell";
import { SectionView } from "@/components/site/Sections";

export const dynamic = "force-dynamic";
export default async function ShopPage() {
  const site = await currentSite(); if (!site) notFound();
  return <SiteShell site={site} path="/shop"><SectionView layoutKey="products_grid" content={{ heading: "Shop", max: 60 }} siteId={site.id} pageUrl={`https://${site.domain}/shop`} sectionId="shop" isFirst currency={site.currency} /></SiteShell>;
}
