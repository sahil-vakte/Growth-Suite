/** WhatsApp auto-reply bot. The customer wrote first, so free-form replies (no template) are allowed within 24h. */
import { inWindow, zonedParts } from "./time";
import { isStopMessage } from "./automations";

export interface BotRule { id: string; name: string; matchType: "exact" | "contains"; keywords: string[]; replyText: string; thenAction: "none" | "handoff"; priority: number; active: boolean }
export interface BotSettings {
  enabled: boolean; greeting?: string; fallback?: string; away?: string; mediaReply?: string; handoffReply?: string; handoffWords?: string[];
  hours?: { on: boolean; start: string; end: string; days: string[]; tz: string }; takeoverHours: number; dailyCap: number;
}
export interface BotContext { text: string | null; isMedia: boolean; isNewChat: boolean; optedOut: boolean; lastHumanReplyAt?: Date | null; repliesToday: number; now: Date }
export type BotReply = { reply: string | null; action: "none" | "handoff" | "opt_out"; ruleId?: string; reason: string };

export function botRespond(rules: BotRule[], s: BotSettings, ctx: BotContext): BotReply {
  if (ctx.text && isStopMessage(ctx.text)) return { reply: null, action: "opt_out", reason: "stop" };
  if (!s.enabled) return { reply: null, action: "none", reason: "bot_off" };
  if (ctx.optedOut) return { reply: null, action: "none", reason: "opted_out" };
  if (ctx.repliesToday >= s.dailyCap) return { reply: null, action: "none", reason: "daily_cap" };
  if (s.takeoverHours > 0 && ctx.lastHumanReplyAt && ctx.now.getTime() - ctx.lastHumanReplyAt.getTime() < s.takeoverHours * 3600_000)
    return { reply: null, action: "none", reason: "human_takeover" };
  if (s.hours?.on) {
    const { hhmm, weekday } = zonedParts(ctx.now, s.hours.tz);
    const open = s.hours.days.includes(weekday) && inWindow(hhmm, s.hours.start, s.hours.end);
    if (!open && s.away) return { reply: s.away, action: "none", reason: "away" };
  }
  if (ctx.isMedia && !ctx.text) return { reply: s.mediaReply ?? s.fallback ?? null, action: "none", reason: "media" };
  const text = (ctx.text ?? "").trim().toLowerCase();
  if (s.handoffWords?.some((w) => w && text.includes(w.toLowerCase()))) return { reply: s.handoffReply ?? null, action: "handoff", reason: "handoff_words" };
  const sorted = [...rules].filter((r) => r.active).sort((a, b) => b.priority - a.priority);
  for (const r of sorted) {
    const hit = r.keywords.some((k) => {
      const kw = k.trim().toLowerCase();
      if (!kw) return false;
      return r.matchType === "exact" ? text === kw : new RegExp(`(^|\\W)${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i").test(text);
    });
    if (hit) return { reply: r.replyText, action: r.thenAction, ruleId: r.id, reason: "rule" };
  }
  if (ctx.isNewChat && s.greeting) return { reply: s.greeting, action: "none", reason: "greeting" };
  return { reply: s.fallback ?? null, action: "none", reason: "fallback" };
}
