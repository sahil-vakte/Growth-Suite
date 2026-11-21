/** Audience segment evaluation over a "facts" record per visitor (computed from events and CRM). */
export interface SegmentCondition { field: string; op: "eq" | "neq" | "gte" | "lte" | "contains" | "in" | "exists"; value?: unknown }
export interface SegmentGroup { match: "all" | "any"; conditions: SegmentCondition[] }
export type Facts = Record<string, unknown>;

export const segmentFields = [
  { key: "visits", label: "Number of visits", type: "number" },
  { key: "pageViews", label: "Page views", type: "number" },
  { key: "timeOnSiteSec", label: "Total time on site (seconds)", type: "number" },
  { key: "visitedPaths", label: "Visited page (path contains)", type: "list" },
  { key: "source", label: "First source", type: "text" },
  { key: "paid", label: "Came from paid ads", type: "boolean" },
  { key: "device", label: "Device", type: "text" },
  { key: "isLead", label: "Is a lead", type: "boolean" },
  { key: "stage", label: "CRM stage", type: "text" },
  { key: "score", label: "Lead score", type: "number" },
  { key: "formSubmitted", label: "Submitted a form", type: "boolean" },
  { key: "whatsappClicked", label: "Clicked WhatsApp", type: "boolean" },
  { key: "callClicked", label: "Clicked call", type: "boolean" },
  { key: "daysSinceLastVisit", label: "Days since last visit", type: "number" },
] as const;

export function evalSegCondition(c: SegmentCondition, f: Facts): boolean {
  const v = f[c.field];
  switch (c.op) {
    case "exists": return v !== undefined && v !== null && v !== false;
    case "eq": return String(v).toLowerCase() === String(c.value).toLowerCase();
    case "neq": return String(v).toLowerCase() !== String(c.value).toLowerCase();
    case "gte": return Number(v) >= Number(c.value);
    case "lte": return Number(v) <= Number(c.value);
    case "contains": return Array.isArray(v) ? v.some((x) => String(x).toLowerCase().includes(String(c.value).toLowerCase())) : String(v ?? "").toLowerCase().includes(String(c.value).toLowerCase());
    case "in": return Array.isArray(c.value) && c.value.map((x) => String(x).toLowerCase()).includes(String(v).toLowerCase());
  }
}

export function inSegment(groups: SegmentGroup[], matchLogic: "all" | "any", f: Facts): boolean {
  if (!groups.length) return false;
  const evalGroup = (g: SegmentGroup) => !g.conditions.length ? true : g.match === "any" ? g.conditions.some((c) => evalSegCondition(c, f)) : g.conditions.every((c) => evalSegCondition(c, f));
  return matchLogic === "any" ? groups.some(evalGroup) : groups.every(evalGroup);
}
