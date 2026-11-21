/** Lead lifecycle: create/merge, stage changes, notes, events → automations, conversion signals and scoring. */
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  conversionSignals,
  leadActivities,
  leadStages,
  leads,
  scoringRules,
  waAutomationRuns,
  waAutomations,
  analyticsEvents,
} from "@/db/schema";
import { normaliseEmail, normalisePhone, phoneKey } from "../engines/phone";
import { computeDueAt, triggerMatches, type AutomationDef } from "../engines/automations";
import { computeScore, type Signal } from "../engines/scoring";
import { getSetting } from "../settings";
import { queueConversion } from "./conversions";
import { sites } from "@/db/schema";

export type LeadRow = typeof leads.$inferSelect;
export interface LeadInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string;
  visitorId?: string | null;
  attribution?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
  consent?: Record<string, unknown>;
  stageId?: string | null;
}

export async function defaultStageId(siteId: string): Promise<string | null> {
  const [s] = await db
    .select()
    .from(leadStages)
    .where(eq(leadStages.siteId, siteId))
    .orderBy(asc(leadStages.position))
    .limit(1);
  return s?.id ?? null;
}

/** Create a lead, or merge into the existing lead with the same phone (then the same email). Existing values are never overwritten. */
export async function upsertLead(
  siteId: string,
  input: LeadInput,
  actor = "system",
): Promise<{ lead: LeadRow; created: boolean }> {
  const { defaultCountryCode } = await getSetting(siteId, "crm.defaults");
  const phone = normalisePhone(input.phone, defaultCountryCode);
  const key = phoneKey(phone);
  const email = normaliseEmail(input.email);
  if (!key && !email) throw new Error("A lead needs a phone number or an email address.");

  let existing: LeadRow | undefined;
  if (key)
    [existing] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.siteId, siteId), eq(leads.phoneKey, key)))
      .limit(1);
  if (!existing && email && !key)
    [existing] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.siteId, siteId), eq(leads.email, email)))
      .limit(1);

  if (existing) {
    const merged = {
      name: existing.name || input.name || null,
      email: existing.email || email,
      attribution: { ...(input.attribution ?? {}), ...existing.attribution },
      customFields: { ...existing.customFields, ...(input.customFields ?? {}) },
      consent: { ...existing.consent, ...(input.consent ?? {}) },
      visitorId: existing.visitorId ?? input.visitorId ?? null,
    };
    const [lead] = await db.update(leads).set(merged).where(eq(leads.id, existing.id)).returning();
    return { lead, created: false };
  }

  const stageId = input.stageId ?? (await defaultStageId(siteId));
  const ownerId = await nextOwner(siteId);
  const [lead] = await db
    .insert(leads)
    .values({
      siteId,
      name: input.name ?? null,
      email,
      phone,
      phoneKey: key,
      source: input.source ?? "website",
      stageId,
      ownerId,
      visitorId: input.visitorId ?? null,
      attribution: input.attribution ?? {},
      customFields: input.customFields ?? {},
      consent: input.consent ?? {},
    })
    .onConflictDoNothing()
    .returning();
  if (!lead) return upsertLead(siteId, input, actor); // lost a race with a concurrent insert for the same phone
  await addActivity(
    siteId,
    lead.id,
    "system",
    `Lead created from ${lead.source}`,
    { source: lead.source },
    actor,
  );
  await emitLeadEvent(siteId, lead, { type: "lead_created", value: lead.source });
  return { lead, created: true };
}

export async function addActivity(
  siteId: string,
  leadId: string,
  type: string,
  body: string | null,
  meta?: Record<string, unknown>,
  actor?: string,
) {
  await db.insert(leadActivities).values({ siteId, leadId, type, body, meta, actor });
}

export async function changeStage(siteId: string, leadId: string, stageId: string, actor: string) {
  const [stage] = await db
    .select()
    .from(leadStages)
    .where(and(eq(leadStages.id, stageId), eq(leadStages.siteId, siteId)))
    .limit(1);
  if (!stage) throw new Error("Stage not found");
  const [before] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.siteId, siteId)))
    .limit(1);
  if (!before) throw new Error("Lead not found");
  if (before.stageId === stageId) return before;
  const [lead] = await db.update(leads).set({ stageId }).where(eq(leads.id, leadId)).returning();
  await addActivity(
    siteId,
    leadId,
    "stage_change",
    `Stage changed to ${stage.name}`,
    { from: before.stageId, to: stageId },
    actor,
  );
  await emitLeadEvent(siteId, lead, { type: "stage_changed", value: stage.name, stageId });
  return lead;
}

export interface LeadEvent {
  type: string;
  value?: string | null;
  stageId?: string;
  formId?: string;
}

/** Fan out a lead event: schedule WhatsApp automations, queue conversion signals, refresh score. */
export async function emitLeadEvent(siteId: string, lead: LeadRow, ev: LeadEvent) {
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  const tz = site?.timezone ?? "UTC";
  const autos = await db
    .select()
    .from(waAutomations)
    .where(and(eq(waAutomations.siteId, siteId), eq(waAutomations.active, true)));
  for (const a of autos) {
    const def = a as unknown as AutomationDef;
    const value = ev.type === "form_submitted" ? (ev.formId ?? null) : (ev.value ?? null);
    if (!triggerMatches(def, { type: ev.type, value })) continue;
    await db.insert(waAutomationRuns).values({
      siteId,
      automationId: a.id,
      leadId: lead.id,
      dueAt: computeDueAt(def, new Date(), tz),
    });
  }
  const signalTrigger = (
    {
      stage_changed: "stage",
      appointment_booked: "appointment_booked",
      wa_verified: "wa_verified",
      score_reached: "score_reached",
      form_submitted: "form_submitted",
      bot_answer: "bot_answer",
    } as Record<string, string>
  )[ev.type];
  if (signalTrigger) {
    const sigs = await db
      .select()
      .from(conversionSignals)
      .where(
        and(
          eq(conversionSignals.siteId, siteId),
          eq(conversionSignals.trigger, signalTrigger),
          eq(conversionSignals.active, true),
        ),
      );
    for (const s of sigs) {
      const ok =
        !s.triggerValue ||
        (signalTrigger === "stage" &&
          (s.triggerValue === ev.stageId || s.triggerValue === ev.value)) ||
        (signalTrigger === "score_reached" && Number(ev.value) >= Number(s.triggerValue)) ||
        s.triggerValue === ev.value ||
        s.triggerValue === ev.formId;
      if (ok) await queueConversion(s, lead);
    }
  }
  if (ev.type !== "score_reached") await recomputeScore(siteId, lead.id);
}

/** Signals come from the lead's own activity and their visitor's events. */
export async function recomputeScore(siteId: string, leadId: string): Promise<number> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return 0;
  const acts = await db
    .select({ type: leadActivities.type, meta: leadActivities.meta })
    .from(leadActivities)
    .where(eq(leadActivities.leadId, leadId));
  const signals: Signal[] = [];
  for (const a of acts) {
    if (a.type === "submission") signals.push({ channel: "form", key: "form_submitted" });
    if (a.type === "whatsapp" && (a.meta as { direction?: string } | null)?.direction === "in")
      signals.push({ channel: "whatsapp", key: "whatsapp_reply" });
    if (a.type === "call") signals.push({ channel: "call", key: "call_click" });
    if (a.type === "appointment")
      signals.push({ channel: "appointment", key: "appointment_booked" });
    if (a.type === "chat") signals.push({ channel: "chatbot", key: "chat_contact_given" });
  }
  if (lead.waVerified) signals.push({ channel: "whatsapp", key: "wa_verified" });
  if (lead.visitorId) {
    const evs = await db
      .select({ name: analyticsEvents.name, pageUrl: analyticsEvents.pageUrl })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.siteId, siteId), eq(analyticsEvents.visitorId, lead.visitorId)))
      .limit(2000);
    for (const e of evs) {
      if (e.name === "whatsapp_click") signals.push({ channel: "whatsapp", key: "whatsapp_click" });
      if (e.name === "call_click") signals.push({ channel: "call", key: "call_click" });
      if (e.name === "page_view" && /pric|fees|cost/i.test(e.pageUrl ?? ""))
        signals.push({ channel: "website", key: "pricing_page_view" });
    }
    const [{ sessions }] = (
      await db.execute(
        sql`select coalesce(max(sessions),1) as sessions from visitors where id = ${lead.visitorId}`,
      )
    ).rows as { sessions: number }[];
    if (Number(sessions) > 1) signals.push({ channel: "website", key: "return_visit" });
  }
  const rules = await db.select().from(scoringRules).where(eq(scoringRules.siteId, siteId));
  const score = computeScore(signals, rules);
  if (score !== lead.score) {
    await db.update(leads).set({ score }).where(eq(leads.id, leadId));
    if (score > lead.score)
      await emitLeadEvent(
        siteId,
        { ...lead, score },
        { type: "score_reached", value: String(score) },
      );
  }
  return score;
}

/** Round-robin assignment of new leads across the chosen team members (crm.assignment setting). */
export async function nextOwner(siteId: string): Promise<string | null> {
  const a = await getSetting(siteId, "crm.assignment");
  if (a.mode !== "round_robin" || !a.userIds.length) return null;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"assign:" + siteId}))`);
    const fresh = await getSetting(siteId, "crm.assignment");
    const idx = (fresh.lastIndex + 1) % fresh.userIds.length;
    await tx.execute(sql`insert into settings (id, site_id, key, value, updated_at) values (${"set_" + siteId + "_assign"}, ${siteId}, 'crm.assignment', ${JSON.stringify({ ...fresh, lastIndex: idx })}::jsonb, now())
      on conflict (site_id, key) do update set value = excluded.value, updated_at = now()`);
    return fresh.userIds[idx];
  });
}
