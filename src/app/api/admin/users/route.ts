import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { hashPassword, passwordProblems } from "@/lib/auth/password";
import { audit } from "@/lib/history";
import { memberSchema } from "@/lib/admin/schemas";


export const GET = adminRoute("users", async (ctx) => {
  const rows = await db.select({ m: memberships, u: users }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.siteId, ctx.site.id));
  return rows.map(({ m, u }) => ({ id: m.id, userId: u.id, email: u.email, name: u.name, status: u.status, lastLoginAt: u.lastLoginAt, role: m.role, crmAccess: m.crmAccess, mcpAccess: m.mcpAccess, socialLevel: m.socialLevel, socialApprove: m.socialApprove }));
});

export const POST = adminRoute("users", async (ctx, req) => {
  if (ctx.member.role !== "admin" && !ctx.member.isPlatformAdmin) throw new HttpError(403, "Only admins can add users.");
  const b = memberSchema.extend({ email: z.string().email(), name: z.string().min(1).max(120), password: z.string().max(200).optional() }).parse(await readJson(req));
  let [u] = await db.select().from(users).where(eq(sql`lower(${users.email})`, b.email.toLowerCase())).limit(1);
  if (!u) {
    if (!b.password) throw new HttpError(422, "Set a password for the new user.");
    const prob = passwordProblems(b.password); if (prob) throw new HttpError(422, prob);
    [u] = await db.insert(users).values({ email: b.email.toLowerCase(), name: b.name, passwordHash: await hashPassword(b.password) }).returning();
  }
  const [m] = await db.insert(memberships).values({ siteId: ctx.site.id, userId: u.id, role: b.role, crmAccess: b.crmAccess, mcpAccess: b.mcpAccess, socialLevel: b.socialLevel, socialApprove: b.socialApprove }).onConflictDoNothing().returning();
  if (!m) throw new HttpError(409, "That person is already a member of this site.");
  await audit(ctx.site.id, ctx.actor, "users.add", "users", u.id, { role: b.role });
  return { ok: true };
});
