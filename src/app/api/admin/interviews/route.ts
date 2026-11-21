import { z } from "zod";
import { db } from "@/db";
import { businessInterviews } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { eq } from "drizzle-orm";

const DEFAULT_QUESTIONS = ["What does your business sell, in one or two sentences?", "Who is your ideal customer?", "What problems do customers come to you with?", "What makes you different from competitors?", "What are your prices or price ranges?", "What do customers most often ask before buying?", "What objections do you hear, and how do you answer them?", "What results or outcomes can customers expect?", "Which areas or locations do you serve?", "What are your opening hours and how can people contact you?", "Are there things we must never say or promise?", "Share a customer success story."];

/** Private 14-day interview link for the business owner (a new link replaces the old one). */
export const POST = adminRoute("knowledge", async (ctx, req) => {
  const b = z.object({ questions: z.array(z.string().min(3).max(500)).max(50).optional(), language: z.string().max(10).default("en-GB") }).parse(await readJson(req).catch(() => ({})));
  await db.delete(businessInterviews).where(eq(businessInterviews.siteId, ctx.site.id));
  const token = randomToken(18);
  await db.insert(businessInterviews).values({ siteId: ctx.site.id, token, expiresAt: new Date(Date.now() + 14 * 86_400_000), questions: b.questions?.length ? b.questions : DEFAULT_QUESTIONS, language: b.language });
  return { ok: true, url: `${env.appUrl}/interview/${token}`, message: "Send this link to the business owner. It expires in 14 days." };
});
