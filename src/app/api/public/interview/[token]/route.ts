import { withApiLog } from "@/lib/apiLogging";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { businessInterviews } from "@/db/schema";
import { pjson } from "@/lib/public";

async function load(token: string) {
  const [i] = await db
    .select()
    .from(businessInterviews)
    .where(eq(businessInterviews.token, token))
    .limit(1);
  return i && i.expiresAt > new Date() ? i : null;
}

async function handleGET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const i = await load((await params).token);
  if (!i) return pjson({ error: "This interview link has expired. Ask for a new one." }, 404);
  return pjson({
    questions: i.questions,
    answers: i.answers,
    language: i.language,
    expiresAt: i.expiresAt,
  });
}

/** Answers save as they go, so the owner can come back later with the same link. */
async function handlePOST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const i = await load((await params).token);
  if (!i) return pjson({ error: "This interview link has expired." }, 404);
  const p = z
    .object({ index: z.number().int().min(0).max(200), answer: z.string().max(20_000) })
    .safeParse(await req.json().catch(() => null));
  if (!p.success || p.data.index >= i.questions.length)
    return pjson({ error: "Invalid answer" }, 400);
  await db
    .update(businessInterviews)
    .set({ answers: { ...i.answers, [String(p.data.index)]: p.data.answer } })
    .where(eq(businessInterviews.id, i.id));
  return pjson({ ok: true });
}

export const GET = withApiLog("/api/public/interview/[token]", "GET", handleGET);

export const POST = withApiLog("/api/public/interview/[token]", "POST", handlePOST);
