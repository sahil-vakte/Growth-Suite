import { eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeChunks } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { siteRow } from "@/lib/admin/rows";
import { embed } from "@/lib/integrations/ai";

export const POST = adminRoute<{ id: string }>("knowledge", async (ctx, _req, p) => {
  const c = await siteRow(knowledgeChunks, p.id, ctx.site.id, "Chunk");
  const [vec] = await embed([c.text]);
  await db
    .update(knowledgeChunks)
    .set({ status: "approved", embedding: vec })
    .where(eq(knowledgeChunks.id, c.id));
  return { ok: true, message: "Approved — the chatbot and content tools can now use this." };
});
