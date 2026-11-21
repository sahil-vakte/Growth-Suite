import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pages, sections } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { siteRow } from "@/lib/admin/rows";
import { runAi } from "@/lib/services/credits";
import { retrieve } from "@/lib/services/chatbot";
import { snapshot } from "@/lib/history";

/** AI page builder: rewrites the text of every section on a page for a keyword, tone and goal. Buttons, images and structure are kept. */
export const POST = adminRoute("ai", async (ctx, req) => {
  const b = z
    .object({
      pageId: z.string(),
      keyword: z.string().max(100),
      tone: z.string().max(60).default("clear and friendly"),
      goal: z.string().max(300),
      brochureText: z.string().max(50_000).optional(),
    })
    .parse(await readJson(req));
  const page = await siteRow(pages, b.pageId, ctx.site.id, "Page");
  const secs = await db
    .select()
    .from(sections)
    .where(eq(sections.pageId, page.id))
    .orderBy(asc(sections.position));
  const facts = (await retrieve(ctx.site.id, `${b.keyword} ${b.goal}`, 8))
    .map((h) => h.text)
    .join("\n");
  let updated = 0;
  for (const s of secs) {
    const textOnly = JSON.stringify(s.content, (k, v) =>
      ["primaryCta", "secondaryCta", "image", "backgroundImage", "formId", "videoUrl"].includes(k)
        ? undefined
        : v,
    );
    const res = await runAi(
      ctx.site.id,
      {
        system:
          "Rewrite website copy. Return ONLY valid JSON with exactly the same keys and structure as given. British English. Never invent prices or statistics.",
        prompt: `Section JSON:\n${textOnly}\n\nKeyword: ${b.keyword}\nTone: ${b.tone}\nGoal: ${b.goal}\nFacts:\n${facts}\n${b.brochureText ? "Brochure:\n" + b.brochureText.slice(0, 8000) : ""}`,
        json: true,
        maxTokens: 1500,
      },
      "ai page builder",
    );
    if (res.provider === "mock") continue; // keep content unchanged without a real AI provider
    try {
      const next = JSON.parse(res.text);
      await snapshot(ctx.site.id, "sections", s.id, s, "update", ctx.actor);
      await db
        .update(sections)
        .set({
          content: {
            ...s.content,
            ...next,
            primaryCta: s.content.primaryCta,
            secondaryCta: s.content.secondaryCta,
            image: s.content.image,
          },
        })
        .where(eq(sections.id, s.id));
      updated++;
    } catch {
      /* skip sections where the model did not return JSON */
    }
  }
  return {
    ok: true,
    message: updated
      ? `${updated} section(s) rewritten. Previous versions are in Content history.`
      : "No sections changed (connect an AI provider to use this tool).",
  };
});
