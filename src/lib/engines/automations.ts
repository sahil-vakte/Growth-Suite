/** WhatsApp automation rules: decide whether to schedule, when it is due, and whether it may send at due time. */
import { inWindow, zonedParts, zonedToUtc, addDays } from "./time";

export interface AutomationDef {
  trigger: string; triggerValue?: string | null; delayMinutes: number;
  conditions: { field: string; op: string; value: string }[];
  quietHours?: { start: string; end: string } | null; skipIfReplied: boolean; dailyCap: number; oncePerPerson: boolean; active: boolean;
}
export interface LeadFacts { stage?: string | null; source?: string; formId?: string | null; score?: number; optedOut: boolean; lastInboundAt?: Date | null; waVerified?: boolean; phone?: string | null }

export function triggerMatches(a: AutomationDef, event: { type: string; value?: string | null }): boolean {
  if (!a.active || a.trigger !== event.type) return false;
  if (!a.triggerValue) return true;
  if (event.type === "keyword") return !!event.value && event.value.toLowerCase().includes(a.triggerValue.toLowerCase());
  if (event.type === "score_reached") return Number(event.value) >= Number(a.triggerValue);
  return a.triggerValue === event.value;
}

export function conditionsHold(a: AutomationDef, lead: LeadFacts): boolean {
  return a.conditions.every((c) => {
    const actual = (lead as unknown as Record<string, unknown>)[c.field];
    if (c.op === "eq") return String(actual ?? "") === c.value;
    if (c.op === "neq") return String(actual ?? "") !== c.value;
    if (c.op === "gte") return Number(actual) >= Number(c.value);
    if (c.op === "lte") return Number(actual) <= Number(c.value);
    return true;
  });
}

/** Move a due time out of quiet hours to the end of the quiet window (in the site's time zone). */
export function applyQuietHours(due: Date, quiet: { start: string; end: string } | null | undefined, timeZone: string): Date {
  if (!quiet) return due;
  const { day, hhmm } = zonedParts(due, timeZone);
  if (!inWindow(hhmm, quiet.start, quiet.end)) return due;
  const wraps = quiet.start > quiet.end;
  const endDay = wraps && hhmm >= quiet.start ? addDays(day, 1) : day;
  return zonedToUtc(endDay, quiet.end, timeZone);
}

export function computeDueAt(a: AutomationDef, at: Date, timeZone: string): Date {
  return applyQuietHours(new Date(at.getTime() + a.delayMinutes * 60000), a.quietHours, timeZone);
}

export type SendDecision = { send: true } | { send: false; reason: string; retryAt?: Date };

/** Re-checked at due time. */
export function decideAtDue(a: AutomationDef, lead: LeadFacts, ctx: { runCreatedAt: Date; sentToday: number; alreadySentToLead: boolean; now: Date; timeZone: string }): SendDecision {
  if (!a.active) return { send: false, reason: "automation_off" };
  if (!lead.phone) return { send: false, reason: "no_phone" };
  if (lead.optedOut) return { send: false, reason: "opted_out" };
  if (a.oncePerPerson && ctx.alreadySentToLead) return { send: false, reason: "already_sent" };
  if (a.skipIfReplied && lead.lastInboundAt && lead.lastInboundAt > ctx.runCreatedAt) return { send: false, reason: "lead_replied" };
  if (!conditionsHold(a, lead)) return { send: false, reason: "conditions_no_longer_true" };
  if (ctx.sentToday >= a.dailyCap) return { send: false, reason: "daily_cap", retryAt: new Date(ctx.now.getTime() + 3600_000) };
  const moved = applyQuietHours(ctx.now, a.quietHours, ctx.timeZone);
  if (moved.getTime() !== ctx.now.getTime()) return { send: false, reason: "quiet_hours", retryAt: moved };
  return { send: true };
}

export const STOP_WORDS = ["stop", "unsubscribe", "stop all", "opt out", "cancel"];
export function isStopMessage(text: string): boolean {
  return STOP_WORDS.includes(text.trim().toLowerCase());
}
