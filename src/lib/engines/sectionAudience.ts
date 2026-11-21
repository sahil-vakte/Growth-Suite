/** Per-section audience rule on URL parameters, remembered for the visit. */
export interface AudienceRule {
  param: string;
  op: "equals" | "contains" | "exists";
  value?: string;
}

export function sectionVisible(
  rule: AudienceRule | null | undefined,
  params: Record<string, string>,
): boolean {
  if (!rule || !rule.param) return true;
  const v = params[rule.param];
  if (rule.op === "exists") return v !== undefined && v !== "";
  if (v === undefined) return false;
  if (rule.op === "contains") return v.toLowerCase().includes((rule.value ?? "").toLowerCase());
  return v.toLowerCase() === (rule.value ?? "").toLowerCase();
}

/** Among sections sharing a group, rule-matched sections win; the no-rule copy is the default. */
export function filterSections<T extends { audienceRule?: AudienceRule | null; visible: boolean }>(
  sections: T[],
  params: Record<string, string>,
): T[] {
  return sections.filter((s) => s.visible && sectionVisible(s.audienceRule ?? null, params));
}
