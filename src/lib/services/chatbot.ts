/** Website AI chatbot: answers from approved knowledge, scores intent, and turns contact details into CRM leads. */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatAutomationRules, chatConversations, chatIntentGroups, chatWidgets, knowledgeChunks } from "@/db/schema";
import { cosine, embed } from "../integrations/ai";
import { runAi, InsufficientCredits } from "./credits";
import { normaliseEmail, normalisePhone } from "../engines/phone";
import { addActivity, recomputeScore, upsertLead } from "./leads";
import { getSetting } from "../settings";

const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;

export async function retrieve(siteId: string, query: string, k = 4) {
  const chunks = await db.select().from(knowledgeChunks).where(and(eq(knowledgeChunks.siteId, siteId), eq(knowledgeChunks.status, "approved"))).limit(2000);
  if (!chunks.length) return [];
  const [q] = await embed([query]);
  return chunks.filter((c) => Array.isArray(c.embedding)).map((c) => ({ text: c.text, score: cosine(q, c.embedding as number[]) })).sort((a, b) => b.score - a.score).slice(0, k);
}

export async function chatTurn(siteId: string, widgetId: string, input: { message: string; conversationId?: string | null; visitorId?: string; pageUrl?: string }) {
  const [widget] = await db.select().from(chatWidgets).where(and(eq(chatWidgets.id, widgetId), eq(chatWidgets.siteId, siteId), eq(chatWidgets.active, true))).limit(1);
  if (!widget) throw new Error("Chat is not available.");
  const cfg = widget.config as { botName?: string; instructions?: string; model?: string; handoff?: { whatsapp?: string; phone?: string } };
  let [conv] = input.conversationId ? await db.select().from(chatConversations).where(and(eq(chatConversations.id, input.conversationId), eq(chatConversations.siteId, siteId))).limit(1) : [];
  if (!conv) [conv] = await db.insert(chatConversations).values({ siteId, widgetId, visitorId: input.visitorId, pageUrl: input.pageUrl }).returning();
  const now = new Date().toISOString();
  const history = [...conv.messages, { role: "user", text: input.message, at: now }];

  // Intent scoring
  const intents = await db.select().from(chatIntentGroups).where(eq(chatIntentGroups.siteId, siteId));
  let score = conv.score; let intent = conv.intent;
  for (const g of intents) if (g.phrases.some((p) => p && input.message.toLowerCase().includes(p.toLowerCase()))) { score = Math.min(100, score + g.points); intent = g.name; }

  // Contact capture → lead
  const contact = { ...conv.contact };
  const phoneM = input.message.match(PHONE_RE)?.[1]; const emailM = input.message.match(EMAIL_RE)?.[0];
  const { defaultCountryCode } = await getSetting(siteId, "crm.defaults");
  const phone = phoneM ? normalisePhone(phoneM, defaultCountryCode) : null; const email = emailM ? normaliseEmail(emailM) : null;
  if (phone) contact.phone = phone; if (email) contact.email = email;
  let leadId = conv.leadId;
  if ((phone || email) && !leadId) {
    const { lead } = await upsertLead(siteId, { phone: contact.phone, email: contact.email, name: contact.name, source: "chat", visitorId: input.visitorId });
    leadId = lead.id;
    await addActivity(siteId, lead.id, "chat", `Website chat: "${input.message.slice(0, 300)}"`, { conversationId: conv.id, pageUrl: input.pageUrl });
    await recomputeScore(siteId, lead.id);
  }

  // Answer
  let reply: string;
  const hits = await retrieve(siteId, input.message);
  const context = hits.filter((h) => h.score > 0.15).map((h) => h.text).join("\n---\n");
  try {
    const ai = await runAi(siteId, {
      system: `You are ${cfg.botName ?? "the assistant"} for this business. ${cfg.instructions ?? ""}\nAnswer ONLY from the business knowledge below. If the answer is not there, say you will pass the question to the team and ask for the visitor's name and phone number. Keep answers under 80 words. Use British English.\n\nBusiness knowledge:\n${context || "(none yet)"}`,
      prompt: history.slice(-8).map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.text}`).join("\n") + "\nAssistant:",
      provider: (cfg.model as "auto") ?? "auto", maxTokens: 300,
    }, "chatbot reply");
    reply = ai.provider === "mock" ? (hits[0] && hits[0].score > 0.3 ? hits[0].text.replace(/^Q:.*\nA:\s*/s, "") : "Thanks for your message! A member of the team will get back to you. Could you share your name and phone number?") : ai.text.trim();
  } catch (e) {
    reply = e instanceof InsufficientCredits ? "Thanks — a member of the team will reply shortly. Could you leave your phone number?" : "Sorry, I could not answer that right now. Please leave your phone number and we will call you.";
  }
  if (phone || email) reply = `Thank you — we have your details and someone will be in touch soon.${reply ? "\n\n" + reply : ""}`;

  // Automation rules (e.g. hot lead → offer WhatsApp)
  const rules = await db.select().from(chatAutomationRules).where(and(eq(chatAutomationRules.siteId, siteId), eq(chatAutomationRules.active, true)));
  for (const r of rules) {
    const w = r.when as { type: string; value: unknown }; const a = r.action as { type: string; value: string };
    const hit = (w.type === "score" && score >= Number(w.value)) || (w.type === "intent" && intent === w.value) || (w.type === "keyword" && input.message.toLowerCase().includes(String(w.value).toLowerCase())) || (w.type === "messages" && history.filter((m) => m.role === "user").length >= Number(w.value));
    if (hit && a.value) { reply += a.type === "whatsapp" ? `\n\nPrefer WhatsApp? Message us: https://wa.me/${a.value.replace(/\D/g, "")}` : a.type === "call" ? `\n\nCall us on ${a.value}` : a.type === "url" ? `\n\n${a.value}` : `\n\n${a.value}`; break; }
  }
  history.push({ role: "bot", text: reply, at: new Date().toISOString() });
  await db.update(chatConversations).set({ messages: history.slice(-100), score, intent, contact, leadId }).where(eq(chatConversations.id, conv.id));
  return { conversationId: conv.id, reply };
}
