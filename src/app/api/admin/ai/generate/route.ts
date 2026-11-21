import { z } from "zod";
import { adminRoute, readJson } from "@/lib/api";
import { generateContent, KINDS } from "@/lib/services/aiStudio";

export const POST = adminRoute("ai", async (ctx, req) => {
  const b = z.object({ kind: z.enum(Object.keys(KINDS) as [keyof typeof KINDS]), topic: z.string().min(3).max(500), tone: z.string().max(60).optional(), audience: z.string().max(200).optional(), platform: z.string().max(60).optional(), count: z.number().int().min(1).max(20).optional() }).parse(await readJson(req));
  return generateContent(ctx.site.id, b.kind, b);
});
