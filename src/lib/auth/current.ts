import { cookies, headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, sites, users } from "@/db/schema";
import { readSession, SESSION_COOKIE, SITE_COOKIE } from "./session";
import { canAccess, type Feature, type Member } from "./permissions";

export type UserRow = typeof users.$inferSelect;
export type SiteRow = typeof sites.$inferSelect;
export type MemberRow = typeof memberships.$inferSelect;

export interface AdminContext {
  user: UserRow;
  site: SiteRow;
  member: Member & { socialApprove: boolean; mcpAccess: boolean };
  actor: string; // email used in audit trails
  sites: { id: string; name: string; domain: string }[];
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const jar = await cookies();
  const claims = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const [user] = await db.select().from(users).where(eq(users.id, claims.uid)).limit(1);
  if (!user || user.status !== "active" || user.sessionVersion !== claims.ver) return null;

  const rows = await db.select({ m: memberships, s: sites }).from(memberships)
    .innerJoin(sites, eq(sites.id, memberships.siteId)).where(eq(memberships.userId, user.id));
  let all = rows.map((r) => ({ id: r.s.id, name: r.s.name, domain: r.s.domain }));
  if (user.isPlatformAdmin) all = (await db.select().from(sites)).map((s) => ({ id: s.id, name: s.name, domain: s.domain }));
  const wanted = jar.get(SITE_COOKIE)?.value;
  const chosenId = all.find((s) => s.id === wanted)?.id ?? all[0]?.id;
  if (!chosenId) return null;
  const [site] = await db.select().from(sites).where(eq(sites.id, chosenId)).limit(1);
  const m = rows.find((r) => r.s.id === chosenId)?.m;
  const member = m
    ? { role: m.role as Member["role"], crmAccess: m.crmAccess as Member["crmAccess"], socialLevel: m.socialLevel as Member["socialLevel"], socialApprove: m.socialApprove, mcpAccess: m.mcpAccess, isPlatformAdmin: user.isPlatformAdmin }
    : { role: "admin" as const, crmAccess: "inherit" as const, socialLevel: "publisher" as const, socialApprove: true, mcpAccess: true, isPlatformAdmin: true };
  return { user, site, member, actor: user.email, sites: all };
}

export async function requireAdmin(feature?: Feature): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new HttpError(401, "Please sign in.");
  if (feature && !canAccess(ctx.member, feature)) throw new HttpError(403, "You do not have access to this area.");
  return ctx;
}

/** Same-origin check for state-changing requests (CSRF defence in addition to SameSite=Lax cookies). */
export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return; // non-browser clients (curl, server-to-server) carry no cookies cross-site
  const host = h.get("x-forwarded-host") ?? h.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Cross-site request blocked.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Bad origin.");
  }
}

export async function membershipFor(siteId: string, userId: string) {
  const [m] = await db.select().from(memberships).where(and(eq(memberships.siteId, siteId), eq(memberships.userId, userId))).limit(1);
  return m ?? null;
}
