import { z } from "zod";
import { db } from "@/db";
import { knowledgeSources, researchResults } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { addKnowledgeText } from "@/lib/services/aiStudio";
import { assertPublicUrl } from "@/lib/net";

function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h\d|li|br|tr)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}

/** Add knowledge from pasted text or a web page. Everything waits for approval in Knowledge chunks. */
export const POST = adminRoute("knowledge", async (ctx, req) => {
  const b = z
    .object({
      type: z.enum(["text", "url"]),
      title: z.string().min(1).max(200),
      category: z
        .enum(["business_info", "competitor", "market_intel", "qa"])
        .default("business_info"),
      text: z.string().max(200_000).optional(),
      url: z.string().url().optional(),
    })
    .parse(await readJson(req));
  let text = b.text ?? "";
  if (b.type === "url") {
    if (!b.url) throw new HttpError(422, "Enter a URL.");
    const res = await fetch(await assertPublicUrl(b.url), {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "GrowthSuite-KnowledgeBot/1.0" },
    });
    if (!res.ok) throw new HttpError(502, `The page returned ${res.status}.`);
    text = htmlToText((await res.text()).slice(0, 2_000_000));
    await db.insert(researchResults).values({
      siteId: ctx.site.id,
      tool: "scraper",
      topic: b.title,
      query: b.url,
      results: [{ url: b.url, chars: text.length }],
    });
  }
  if (text.length < 30) throw new HttpError(422, "Not enough text to add.");
  const [src] = await db
    .insert(knowledgeSources)
    .values({
      siteId: ctx.site.id,
      category: b.category,
      type: b.type,
      title: b.title,
      url: b.url,
      status: "processed",
    })
    .returning();
  const n = await addKnowledgeText(ctx.site.id, src.id, text, ctx.actor);
  return { ok: true, message: `${n} chunk(s) added and waiting for approval.` };
});
