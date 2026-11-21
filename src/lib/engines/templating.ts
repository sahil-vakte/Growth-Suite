/** {{variable}} / {{variable|fallback}} templating used by WhatsApp templates, reply templates and emails. */
export function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*))?\}\}/g, (_m, key: string, fallback?: string) => {
    const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), vars);
    const s = v === undefined || v === null ? "" : String(v).trim();
    return s !== "" ? s : (fallback ?? "").trim();
  });
}

export function templateVariables(tpl: string): string[] {
  return [...new Set([...tpl.matchAll(/\{\{\s*([\w.]+)/g)].map((m) => m[1]))];
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
