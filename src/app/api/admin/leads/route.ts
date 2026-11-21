import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leads, leadStages, users } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { upsertLead } from "@/lib/services/leads";

export const GET = adminRoute("crm", async (ctx, req) => {
  const u = new URL(req.url);
  const q = u.searchParams.get("q")?.trim();
  const stage = u.searchParams.get("stage");
  const source = u.searchParams.get("source");
  const campaign = u.searchParams.get("campaign");
  const owner = u.searchParams.get("owner");
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  const minScore = u.searchParams.get("minScore");
  const page = Math.max(1, Number(u.searchParams.get("page") ?? 1));
  const conds: SQL[] = [eq(leads.siteId, ctx.site.id)];
  if (q)
    conds.push(
      or(
        ilike(leads.name, `%${q}%`),
        ilike(leads.email, `%${q}%`),
        ilike(leads.phone, `%${q.replace(/[^\d+]/g, "") || q}%`),
      )!,
    );
  if (stage === "none") conds.push(sql`${leads.stageId} is null`);
  else if (stage) conds.push(eq(leads.stageId, stage));
  if (source) conds.push(eq(leads.source, source));
  if (campaign) conds.push(sql`${leads.attribution}->>'utm_campaign' = ${campaign}`);
  if (owner === "me") conds.push(eq(leads.ownerId, ctx.user.id));
  else if (owner === "none") conds.push(sql`${leads.ownerId} is null`);
  else if (owner) conds.push(eq(leads.ownerId, owner));
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from))
    conds.push(sql`${leads.createdAt} >= ${from}::date`);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) conds.push(sql`${leads.createdAt} < (${to}::date + 1)`);
  if (minScore && /^\d+$/.test(minScore)) conds.push(sql`${leads.score} >= ${Number(minScore)}`);
  const pageSize = Math.min(500, Number(u.searchParams.get("pageSize") ?? 50) || 50);
  const rows = await db
    .select({ lead: leads, stage: leadStages, owner: users.name })
    .from(leads)
    .leftJoin(leadStages, eq(leadStages.id, leads.stageId))
    .leftJoin(users, eq(users.id, leads.ownerId))
    .where(and(...conds))
    .orderBy(desc(leads.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = (
    await db.execute(sql`select count(*)::int total from leads where ${and(...conds)}`)
  ).rows as { total: number }[];
  const stages = await db
    .select()
    .from(leadStages)
    .where(eq(leadStages.siteId, ctx.site.id))
    .orderBy(leadStages.position);
  return {
    rows: rows.map((r) => ({
      ...r.lead,
      stageName: r.stage?.name ?? null,
      stageColor: r.stage?.color ?? null,
      ownerName: r.owner ?? null,
    })),
    total,
    page,
    stages,
  };
});

export const POST = adminRoute("crm", async (ctx, req) => {
  const b = z
    .object({
      name: z.string().max(120).optional(),
      phone: z.string().min(6).max(30),
      email: z.string().email().optional().or(z.literal("")),
      stageId: z.string().optional(),
      refCode: z.string().max(20).optional(),
    })
    .parse(await readJson(req));
  const { lead, created } = await upsertLead(
    ctx.site.id,
    { name: b.name, phone: b.phone, email: b.email || null, source: "manual", stageId: b.stageId },
    ctx.actor,
  );
  return {
    lead,
    created,
    message: created
      ? "Lead added."
      : "A lead with this phone number already exists — details were merged.",
  };
});
