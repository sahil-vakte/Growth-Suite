import { z } from "zod";
import { adminRoute, readJson } from "@/lib/api";
import { blogStep } from "@/lib/services/aiStudio";

export const POST = adminRoute("blog", async (ctx, req) => {
  const b = z
    .object({
      step: z.enum(["outline", "questions", "draft"]),
      topic: z.string().min(3).max(300),
      keyword: z.string().max(100).optional(),
      outline: z.string().max(20_000).optional(),
      questions: z.string().max(20_000).optional(),
      instructions: z.string().max(2000).optional(),
    })
    .parse(await readJson(req));
  return blogStep(ctx.site.id, b.step, b);
});
