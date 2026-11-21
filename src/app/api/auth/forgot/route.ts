import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/integrations/email";
import { escapeHtml } from "@/lib/engines/templating";
import { clientIp, pjson, rateLimited, tooMany } from "@/lib/public";

/** Always answers the same way, so it cannot be used to discover which emails have accounts. */
export async function POST(req: Request) {
  if (rateLimited(`forgot:${clientIp(req)}`, 5, 15 * 60_000)) return tooMany();
  const p = z.object({ email: z.string().email() }).safeParse(await req.json().catch(() => null));
  const generic = {
    ok: true,
    message: "If that email has an account, a reset link is on its way. It works for one hour.",
  };
  if (!p.success) return pjson(generic);
  const [u] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, p.data.email.toLowerCase()))
    .limit(1);
  if (!u || u.status !== "active") return pjson(generic);
  const token = randomToken(32);
  await db.insert(passwordResets).values({
    userId: u.id,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 3600_000),
  });
  const url = `${env.appUrl}/admin/reset?token=${token}`;
  await sendEmail({
    to: u.email,
    subject: `Reset your ${env.appName} password`,
    html: `<p>Hi ${escapeHtml(u.name)},</p><p>Use this link to choose a new password. It works once, for one hour:</p><p><a href="${url}">${url}</a></p><p>If you did not ask for this, ignore this email.</p>`,
  });
  // In mock mode (no email provider) the link is returned so the flow can be tested end-to-end.
  return pjson(env.forceMock ? { ...generic, devResetUrl: url } : generic);
}
