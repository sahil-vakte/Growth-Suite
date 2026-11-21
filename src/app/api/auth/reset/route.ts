import { createHash } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { hashPassword, passwordProblems } from "@/lib/auth/password";
import { audit } from "@/lib/history";
import { clientIp, pjson, rateLimited, tooMany } from "@/lib/public";

export async function POST(req: Request) {
  if (rateLimited(`reset:${clientIp(req)}`, 10, 15 * 60_000)) return tooMany();
  const p = z
    .object({ token: z.string().min(20).max(200), password: z.string().max(200) })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return pjson({ error: "This link is not valid." }, 400);
  const prob = passwordProblems(p.data.password);
  if (prob) return pjson({ error: prob }, 422);
  const hash = createHash("sha256").update(p.data.token).digest("hex");
  const [r] = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResets.tokenHash, hash),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!r)
    return pjson({ error: "This link has expired or was already used. Ask for a new one." }, 410);
  const [u] = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(p.data.password),
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, r.userId))
    .returning();
  await audit(null, u.email, "auth.password_reset");
  return pjson({ ok: true, message: "Password changed. You can now sign in." });
}
