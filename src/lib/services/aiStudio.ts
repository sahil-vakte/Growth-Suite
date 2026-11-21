/** AI content tools grounded in the site's approved knowledge. */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiOutputs, knowledgeChunks } from "@/db/schema";
import { runAi } from "./credits";
import { retrieve } from "./chatbot";
import { getSetting } from "../settings";

export const KINDS = {
  faq: "8 FAQs with answers",
  usp: "6 unique selling points",
  ad_copy: "5 ad variations (headline under 30 characters, description under 90)",
  section: "copy for a landing-page section (heading, subheading, 3 bullets, button label)",
  sales_story: "a short sales story (problem, turning point, result)",
  email: "a follow-up email (subject and body)",
  qa: "10 real questions customers ask, with answers",
} as const;

export async function generateContent(
  siteId: string,
  kind: keyof typeof KINDS,
  input: { topic: string; tone?: string; audience?: string; platform?: string; count?: number },
) {
  const brand = await getSetting(siteId, "brand.guidelines");
  const facts = (await retrieve(siteId, input.topic, 8)).map((h) => `- ${h.text}`).join("\n");
  const res = await runAi(
    siteId,
    {
      system: `You write marketing copy in British English. Use ONLY the facts provided; never invent prices, guarantees or statistics. ${brand.text ? "Brand guidelines:\n" + brand.text.slice(0, 4000) : ""}`,
      prompt: `${input.topic}\nWrite ${KINDS[kind]}${input.count ? ` (${input.count} items)` : ""}.${input.tone ? ` Tone: ${input.tone}.` : ""}${input.audience ? ` Audience: ${input.audience}.` : ""}${input.platform ? ` Platform: ${input.platform}.` : ""}\n\nFacts:\n${facts || "(no approved knowledge yet — keep claims general)"}`,
      maxTokens: 1800,
    },
    `generate ${kind}`,
  );
  const [out] = await db
    .insert(aiOutputs)
    .values({
      siteId,
      kind,
      title: `${kind.replace("_", " ")}: ${input.topic}`.slice(0, 200),
      body: res.text,
      meta: { ...input, provider: res.provider },
    })
    .returning();
  return out;
}

/** Multi-step blog writer: outline → research questions → full draft. Each step can also be done by hand. */
export async function blogStep(
  siteId: string,
  step: "outline" | "questions" | "draft",
  input: {
    topic: string;
    keyword?: string;
    outline?: string;
    questions?: string;
    instructions?: string;
  },
) {
  const facts = (await retrieve(siteId, input.topic, 8)).map((h) => `- ${h.text}`).join("\n");
  const prompts = {
    outline: `${input.topic}\nCreate an SEO blog outline (H2/H3 headings) targeting "${input.keyword ?? input.topic}". Cover what searchers and AI answers expect. Return Markdown headings only.`,
    questions: `${input.topic}\nList 8 research questions a writer must answer for this outline:\n${input.outline ?? ""}`,
    draft: `${input.topic}\nWrite the full article in HTML (use <h2>, <h3>, <p>, <ul>) following this outline:\n${input.outline ?? ""}\nAnswer these questions within the article:\n${input.questions ?? ""}\nFocus keyword: ${input.keyword ?? ""}. ${input.instructions ?? ""}\nUse these business facts where relevant:\n${facts}`,
  };
  const res = await runAi(
    siteId,
    {
      system: "You are an expert SEO writer. British English. No invented statistics.",
      prompt: prompts[step],
      maxTokens: step === "draft" ? 4000 : 1200,
    },
    `blog ${step}`,
  );
  return { step, text: res.text, provider: res.provider };
}

export async function addKnowledgeText(
  siteId: string,
  sourceId: string | null,
  text: string,
  createdBy: string,
) {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);
  const chunks: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + "\n\n" + p).length > 1200 && cur) {
      chunks.push(cur);
      cur = p;
    } else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) chunks.push(cur);
  if (!chunks.length && text.trim()) chunks.push(text.trim().slice(0, 1200));
  for (const c of chunks)
    await db
      .insert(knowledgeChunks)
      .values({ siteId, sourceId, text: c, status: "pending", createdBy });
  return chunks.length;
}

export async function approvedKnowledgeCount(siteId: string) {
  return (
    await db
      .select({ id: knowledgeChunks.id })
      .from(knowledgeChunks)
      .where(and(eq(knowledgeChunks.siteId, siteId), eq(knowledgeChunks.status, "approved")))
  ).length;
}
