import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { shareLinks, sites } from "@/db/schema";
import ReviewForm from "@/components/site/ReviewForm";

export const dynamic = "force-dynamic";
export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const [l] = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.token, (await params).token), eq(shareLinks.active, true)))
    .limit(1);
  if (!l) notFound();
  const [site] = await db.select().from(sites).where(eq(sites.id, l.siteId)).limit(1);
  return (
    <div className="site">
      <section className="s-sec">
        <div className="s-wrap s-narrow">
          <h1>{l.title}</h1>
          <p className="s-muted">Share your experience with {site?.name}.</p>
          <ReviewForm token={l.token} prompts={l.prompts} fields={l.fields} />
        </div>
      </section>
    </div>
  );
}
