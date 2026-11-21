import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { hashPassword, passwordProblems } from "@/lib/auth/password";
import { audit } from "@/lib/history";
import { memberSchema } from "@/lib/admin/schemas";

async function guard(ctx: { member: { role: string; isPlatformAdmin?: boolean } }) { if (ctx.member.role !== "admin" && !ctx.member.isPlatformAdmin) throw new HttpError(403, "Only admins can manage users."); }
async function load(siteId: string, id: string) {
  const [m] = await db.select().from(memberships).where(and(eq(memberships.id, id), eq(memberships.siteId, siteId))).limit(1);
  if (!m) throw new HttpError(404, "User not found."); return m;
}
async function adminsLeft(siteId: string, excludingId: string) {
  const [{ n }] = await db.select({ n: count() }).from(memberships).where(and(eq(memberships.siteId, siteId), eq(memberships.role, "admin"), sql`${memberships.id} <> ${excludingId}`)); return n;
}

export const PATCH = adminRoute<{ id: string }>("users", async (ctx, req, p) => {
  await guard(ctx);
  const m = await load(ctx.site.id, p.id);
  const b = memberSchema.partial().extend({ name: z.string().max(120).optional(), status: z.enum(["active", "disabled"]).optional(), password: z.string().max(200).optional() }).parse(await readJson(req));
  if (m.role === "admin" && b.role && b.role !== "admin" && (await adminsLeft(ctx.site.id, m.id)) === 0) throw new HttpError(409, "Keep at least one admin on the site.");
  const { name, status, password, ...mem } = b;
  if (Object.keys(mem).length) await db.update(memberships).set(mem).where(eq(memberships.id, m.id));
  const up: Record<string, unknown> = {};
  if (name) up.name = name;
  if (status) { up.status = status; up.sessionVersion = sql`${users.sessionVersion} + 1`; }
  if (password) { const prob = passwordProblems(password); if (prob) throw new HttpError(422, prob); up.passwordHash = await hashPassword(password); up.sessionVersion = sql`${users.sessionVersion} + 1`; }
  if (Object.keys(up).length) await db.update(users).set(up).where(eq(users.id, m.userId));
  await audit(ctx.site.id, ctx.actor, "users.update", "users", m.userId, { fields: Object.keys(b) });
  return { ok: true };
});

export const DELETE = adminRoute<{ id: string }>("users", async (ctx, _req, p) => {
  await guard(ctx);
  const m = await load(ctx.site.id, p.id);
  if (m.userId === ctx.user.id) throw new HttpError(409, "You cannot remove yourself.");
  if (m.role === "admin" && (await adminsLeft(ctx.site.id, m.id)) === 0) throw new HttpError(409, "Keep at least one admin on the site.");
  await db.delete(memberships).where(eq(memberships.id, m.id));
  await audit(ctx.site.id, ctx.actor, "users.remove", "users", m.userId);
  return { ok: true };
});
