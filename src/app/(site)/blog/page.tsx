import { currentSite } from "@/lib/site/pageData";
import { BlogIndex } from "@/components/site/BlogIndex";

export const dynamic = "force-dynamic";
export async function generateMetadata() { const site = await currentSite(); return { title: site ? `Blog | ${site.name}` : "Blog" }; }
export default function BlogPage() { return <BlogIndex />; }
