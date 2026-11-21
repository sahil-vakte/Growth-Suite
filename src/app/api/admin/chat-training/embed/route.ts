import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatTrainingItems, knowledgeChunks } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { embed } from "@/lib/integrations/ai";

/** Turn training Q&A into approved knowledge chunks the chatbot searches. */
export const POST = adminRoute("chatbot", async (ctx) => {
  const items = await db
    .select()
    .from(chatTrainingItems)
    .where(and(eq(chatTrainingItems.siteId, ctx.site.id), eq(chatTrainingItems.embedded, false)));
  if (!items.length) return { ok: true, message: "Everything is already embedded." };
  const vecs = await embed(items.map((i) => `${i.question}\n${i.answer}`));
  for (let k = 0; k < items.length; k++) {
    await db.insert(knowledgeChunks).values({
      siteId: ctx.site.id,
      text: `Q: ${items[k].question}\nA: ${items[k].answer}`,
      useFor: ["chatbot"],
      status: "approved",
      embedding: vecs[k],
      createdBy: "training",
    });
    await db
      .update(chatTrainingItems)
      .set({ embedded: true })
      .where(eq(chatTrainingItems.id, items[k].id));
  }
  return { ok: true, message: `${items.length} Q&A pairs embedded.` };
});
