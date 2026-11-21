import { shareLinks } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import { env } from "@/lib/env";

export default async function ShareLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin("reviews");
  const l = await siteRow(shareLinks, (await params).id, ctx.site.id, "Link");
  const url = `${env.appUrl}/review/${l.token}`;
  return (
    <div>
      <h1>{l.title}</h1>
      <div className="card">
        <p>
          Send this link to customers. Reviews arrive as “pending” in Reviews & testimonials until
          you approve them.
        </p>
        <p>
          <a href={url} target="_blank">
            {url}
          </a>
        </p>
      </div>
    </div>
  );
}
