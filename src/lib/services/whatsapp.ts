/** WhatsApp Business service: send templates to leads, process inbound messages (STOP, bot, keyword automations, Ref codes). */
import { and, count, eq, gte, desc } from "drizzle-orm";
import { db } from "@/db";
import { clickLogs, leads, waBotRules, waMessages, waTemplates, visitors } from "@/db/schema";
import { renderTemplate } from "../engines/templating";
import { botRespond, type BotRule } from "../engines/waBot";
import { getSetting } from "../settings";
import { sendTemplate, sendText } from "../integrations/whatsapp";
import { addActivity, emitLeadEvent, upsertLead } from "./leads";

type Lead = typeof leads.$inferSelect;

export function templateBodyParams(tpl: typeof waTemplates.$inferSelect, vars: Record<string, unknown>): string[] {
  const body = String((tpl.components as { body?: string }).body ?? "");
  const n = [...body.matchAll(/\{\{(\d+)\}\}/g)].length;
  return Array.from({ length: n }, (_, i) => renderTemplate(tpl.variableMap[String(i + 1)] ?? "", vars) || "-");
}

export function leadVars(lead: Lead, extra: Record<string, unknown> = {}) {
  const first = (lead.name ?? "").split(" ")[0];
  return { name: lead.name ?? "", first_name: first, email: lead.email ?? "", phone: lead.phone ?? "", source: lead.source, ...lead.customFields, ...extra };
}

export async function sendTemplateToLead(siteId: string, lead: Lead, templateId: string, opts: { campaignId?: string; actor?: string } = {}) {
  if (!lead.phone) throw new Error("Lead has no phone number");
  if (lead.optedOut) throw new Error("Lead has opted out of WhatsApp messages");
  const [tpl] = await db.select().from(waTemplates).where(and(eq(waTemplates.id, templateId), eq(waTemplates.siteId, siteId))).limit(1);
  if (!tpl) throw new Error("Template not found");
  if (tpl.status !== "approved") throw new Error("Template is not approved by Meta yet");
  const conn = await getSetting(siteId, "whatsapp.connection");
  const params = templateBodyParams(tpl, leadVars(lead));
  const [msg] = await db.insert(waMessages).values({ siteId, leadId: lead.id, phone: lead.phone, direction: "out", kind: "template", body: `${tpl.name}: ${params.join(" | ")}`, campaignId: opts.campaignId }).returning();
  try {
    const r = await sendTemplate({ phoneNumberId: conn.phoneNumberId, to: lead.phone, template: tpl.name, language: tpl.language, bodyParams: params });
    await db.update(waMessages).set({ status: "sent", providerId: r.id }).where(eq(waMessages.id, msg.id));
    await addActivity(siteId, lead.id, "whatsapp", `WhatsApp template "${tpl.name}" sent`, { direction: "out", messageId: msg.id, mock: !!r.mock }, opts.actor ?? "system");
    return msg.id;
  } catch (e) {
    await db.update(waMessages).set({ status: "failed", error: e instanceof Error ? e.message : String(e) }).where(eq(waMessages.id, msg.id));
    throw e;
  }
}

/** Inbound message from the Cloud API webhook (already routed to the site by phone number id). */
export async function handleInbound(siteId: string, m: { from: string; name?: string; text: string | null; isMedia: boolean; providerId: string }) {
  const phone = m.from.startsWith("+") ? m.from : `+${m.from}`;
  const refMatch = m.text?.match(/\(Ref:\s*([A-Z0-9]{6})\)/i);
  let visitorId: string | null = null; let attribution: Record<string, unknown> = {};
  if (refMatch) {
    const [click] = await db.select().from(clickLogs).where(and(eq(clickLogs.siteId, siteId), eq(clickLogs.refCode, refMatch[1].toUpperCase()), gte(clickLogs.createdAt, new Date(Date.now() - 30 * 86_400_000)))).limit(1);
    if (click?.visitorId) {
      visitorId = click.visitorId;
      const [v] = await db.select().from(visitors).where(eq(visitors.id, click.visitorId)).limit(1);
      if (v) attribution = { ...(v.ids as object), ...(v.firstTouch as object) };
    }
  }
  const { lead, created } = await upsertLead(siteId, { name: m.name, phone, source: "whatsapp", visitorId, attribution, customFields: created0(m.text) });
  await db.insert(waMessages).values({ siteId, leadId: lead.id, phone, direction: "in", kind: m.isMedia ? "media" : "text", body: m.text, status: "received", providerId: m.providerId });
  await db.update(leads).set({ lastInboundAt: new Date() }).where(eq(leads.id, lead.id));
  await addActivity(siteId, lead.id, "whatsapp", m.text ?? "[media]", { direction: "in" }, "customer");
  if (m.text) await emitLeadEvent(siteId, lead, { type: "keyword", value: m.text });

  const settings = await getSetting(siteId, "whatsapp.bot");
  const rules = (await db.select().from(waBotRules).where(eq(waBotRules.siteId, siteId))) as unknown as BotRule[];
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const [{ n }] = await db.select({ n: count() }).from(waMessages).where(and(eq(waMessages.siteId, siteId), eq(waMessages.direction, "out"), eq(waMessages.kind, "text"), gte(waMessages.createdAt, today)));
  const [lastHuman] = await db.select().from(waMessages).where(and(eq(waMessages.leadId, lead.id), eq(waMessages.direction, "out"), eq(waMessages.kind, "human"))).orderBy(desc(waMessages.createdAt)).limit(1);
  const decision = botRespond(rules, { ...settings, handoffWords: settings.handoffWords }, { text: m.text, isMedia: m.isMedia, isNewChat: created, optedOut: lead.optedOut, lastHumanReplyAt: lastHuman?.createdAt ?? null, repliesToday: n, now: new Date() });
  if (decision.action === "opt_out") {
    await db.update(leads).set({ optedOut: true }).where(eq(leads.id, lead.id));
    await addActivity(siteId, lead.id, "system", "Opted out of WhatsApp (STOP)");
    return { lead, decision };
  }
  if (decision.reply) {
    const conn = await getSetting(siteId, "whatsapp.connection");
    const r = await sendText(conn.phoneNumberId, phone, decision.reply);
    await db.insert(waMessages).values({ siteId, leadId: lead.id, phone, direction: "out", kind: "text", body: decision.reply, status: "sent", providerId: r.id });
    if (decision.ruleId) {
      const rule = rules.find((x) => x.id === decision.ruleId) as unknown as { name: string } | undefined;
      await emitLeadEvent(siteId, lead, { type: "bot_answer", value: decision.ruleId });
      await addActivity(siteId, lead.id, "whatsapp", `Bot answer "${rule?.name}" sent`, { direction: "out", bot: true });
    }
  }
  if (decision.action === "handoff") await addActivity(siteId, lead.id, "system", "Chat handed to the team");
  return { lead, decision };
}

const created0 = (text: string | null) => (text ? { first_whatsapp_message: text.slice(0, 500) } : {});
