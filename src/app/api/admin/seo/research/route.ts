import { z } from "zod";
import { db } from "@/db";
import { researchResults } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { webSearch } from "@/lib/integrations/other";

/** QnA Finder (Quora/Reddit questions) and Instagram post search via a search API. Results are saved by topic. */
export const POST = adminRoute("seo", async (ctx, req) => {
  const b = z.object({ tool: z.enum(["qna", "instagram"]), topic: z.string().min(2).max(200), site: z.enum(["quora.com", "reddit.com", "stackexchange.com", "instagram.com"]).optional(), afterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), handle: z.string().max(60).optional() }).parse(await readJson(req));
  const site = b.tool === "instagram" ? "instagram.com" : b.site ?? "quora.com";
  const q = b.tool === "instagram" && b.handle ? `${b.topic} "@${b.handle.replace(/^@/, "")}"` : b.topic;
  const results = await webSearch(q, { site, afterDate: b.afterDate, num: 20 });
  const [row] = await db.insert(researchResults).values({ siteId: ctx.site.id, tool: b.tool, topic: b.topic, query: `${q} site:${site}`, results }).returning();
  return { ok: true, id: row.id, results };
});
