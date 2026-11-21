/** Unified lead score across channels: sum of points for each signal seen (each signal counted once unless repeatable). */
export interface ScoringRuleDef { channel: string; signalKey: string; points: number; active: boolean }
export interface Signal { channel: string; key: string }

export const platformDefaultRules: ScoringRuleDef[] = [
  { channel: "form", signalKey: "form_submitted", points: 30, active: true },
  { channel: "whatsapp", signalKey: "whatsapp_click", points: 15, active: true },
  { channel: "whatsapp", signalKey: "whatsapp_reply", points: 20, active: true },
  { channel: "whatsapp", signalKey: "wa_verified", points: 15, active: true },
  { channel: "call", signalKey: "call_click", points: 20, active: true },
  { channel: "chatbot", signalKey: "chat_contact_given", points: 25, active: true },
  { channel: "website", signalKey: "pricing_page_view", points: 10, active: true },
  { channel: "website", signalKey: "return_visit", points: 5, active: true },
  { channel: "appointment", signalKey: "appointment_booked", points: 40, active: true },
];

export function computeScore(signals: Signal[], siteRules: ScoringRuleDef[], useDefaults = true): number {
  const rules = new Map<string, number>();
  if (useDefaults) for (const r of platformDefaultRules) rules.set(`${r.channel}:${r.signalKey}`, r.points);
  for (const r of siteRules) {
    const k = `${r.channel}:${r.signalKey}`;
    if (r.active) rules.set(k, r.points); else rules.delete(k);
  }
  const seen = new Set<string>();
  let score = 0;
  for (const s of signals) {
    const k = `${s.channel}:${s.key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    score += rules.get(k) ?? 0;
  }
  return Math.max(0, Math.min(100, score));
}
