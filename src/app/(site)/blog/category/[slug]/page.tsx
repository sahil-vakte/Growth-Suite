import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { blogCategories } from "@/db/schema";
import { currentSite } from "@/lib/site/pageData";
import { BlogIndex } from "@/components/site/BlogIndex";

export const dynamic = "force-dynamic";
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const site = await currentSite();
  if (!site) notFound();
  const { slug } = await params;
  const [cat] = await db
    .select()
    .from(blogCategories)
    .where(and(eq(blogCategories.siteId, site.id), eq(blogCategories.slug, slug)))
    .limit(1);
  if (!cat) notFound();
  return <BlogIndex categoryId={cat.id} heading={cat.name} />;
}
