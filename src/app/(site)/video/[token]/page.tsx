import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { videoSessions } from "@/db/schema";

export const dynamic = "force-dynamic";
export default async function VideoPage({ params }: { params: Promise<{ token: string }> }) {
  const [v] = await db
    .select()
    .from(videoSessions)
    .where(eq(videoSessions.guestToken, (await params).token))
    .limit(1);
  if (!v) notFound();
  return (
    <div className="site">
      <section className="s-sec">
        <div className="s-wrap s-center">
          <h1>{v.title}</h1>
          {v.roomUrl && v.status !== "ended" ? (
            <>
              <p className="s-muted">Your video call is ready.</p>
              <a
                className="s-btn primary"
                href={v.roomUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Join the call
              </a>
            </>
          ) : (
            <p className="s-muted">This call has not started yet, or has ended.</p>
          )}
        </div>
      </section>
    </div>
  );
}
