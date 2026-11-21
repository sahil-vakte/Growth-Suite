/** Dynamic number insertion: show a different phone number depending on the visitor's source.
 * First matching rule wins; the chosen number is remembered for STICKY_DAYS. */
export const STICKY_DAYS = 30;
export interface SourceRule {
  type: "google_ads" | "meta_ads" | "utm_source" | "utm_medium" | "referrer" | "param";
  value?: string; // match value (case-insensitive contains for referrer, equals otherwise)
  param?: string; // for type=param
  phone: string;
}
export interface VisitContext { params: Record<string, string>; referrer?: string }

export function matchRule(rule: SourceRule, ctx: VisitContext): boolean {
  const p = ctx.params;
  const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  switch (rule.type) {
    case "google_ads": return !!(p.gclid || p.gbraid || p.wbraid);
    case "meta_ads":
      return (!!p.fbclid && (!p.utm_medium || /cpc|paid|ads?/i.test(p.utm_medium))) ||
        ((eq(p.utm_source, "facebook") || eq(p.utm_source, "instagram")) && /cpc|paid/i.test(p.utm_medium ?? ""));
    case "utm_source": return eq(p.utm_source, rule.value);
    case "utm_medium": return eq(p.utm_medium, rule.value);
    case "referrer": return !!ctx.referrer && !!rule.value && ctx.referrer.toLowerCase().includes(rule.value.toLowerCase());
    case "param": return !!rule.param && (rule.value ? eq(p[rule.param], rule.value) : p[rule.param] !== undefined);
  }
}

export function pickNumber(defaultPhone: string, rules: SourceRule[], ctx: VisitContext, sticky?: { phone: string; at: number }, now = Date.now()): string {
  if (sticky && now - sticky.at < STICKY_DAYS * 86_400_000) return sticky.phone;
  for (const r of rules) if (matchRule(r, ctx)) return r.phone;
  return defaultPhone;
}
