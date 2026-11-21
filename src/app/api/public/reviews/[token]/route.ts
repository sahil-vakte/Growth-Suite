import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { reviews, shareLinks } from "@/db/schema";
import { clientIp, pjson, rateLimited, tooMany } from "@/lib/public";

/** Customers submit a review via a share link. Reviews wait for moderation. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (await rateLimited(`review:${clientIp(req)}`, 5, 60_000)) return tooMany();
  const { token } = await params;
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.token, token), eq(shareLinks.active, true)))
    .limit(1);
  if (!link) return pjson({ error: "This review link is no longer active." }, 404);
  const p = z
    .object({
      name: z.string().min(1).max(120),
      rating: z.number().int().min(1).max(5).optional(),
      text: z.string().max(4000).optional(),
      fields: z.record(z.string().max(200)).optional(),
      consent: z.literal(true),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success)
    return pjson({ error: "Please add your name, your review and tick the consent box." }, 400);
  const fields = Object.fromEntries(
    Object.entries(p.data.fields ?? {}).filter(([k]) => link.fields.includes(k)),
  );
  await db.insert(reviews).values({
    siteId: link.siteId,
    kind: link.kind === "audio" ? "audio" : "text",
    linkId: link.id,
    name: p.data.name,
    rating: p.data.rating,
    text: p.data.text,
    fields,
    status: "pending",
  });
  return pjson({
    ok: true,
    message: "Thank you! Your review will appear once it has been checked.",
  });
}
