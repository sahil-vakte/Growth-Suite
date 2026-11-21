/** Role & feature permissions. admin = everything for the site; editor = content & marketing (not users/billing/integration secrets);
 * sales = CRM only. crmAccess and socialLevel refine access per member. */
export type Role = "admin" | "editor" | "sales";
export type Feature =
  | "content"
  | "blog"
  | "media"
  | "themes"
  | "navigation"
  | "forms"
  | "submissions"
  | "whatsapp"
  | "whatsapp_business"
  | "social"
  | "calls"
  | "popups"
  | "chatbot"
  | "appointments"
  | "audiences"
  | "scoring"
  | "crm"
  | "analytics"
  | "seo"
  | "shop"
  | "knowledge"
  | "ai"
  | "integrations"
  | "reviews"
  | "video"
  | "users"
  | "modules"
  | "affiliates"
  | "settings"
  | "history";

const editorFeatures: Feature[] = [
  "content",
  "blog",
  "media",
  "themes",
  "navigation",
  "forms",
  "submissions",
  "whatsapp",
  "whatsapp_business",
  "social",
  "calls",
  "popups",
  "chatbot",
  "appointments",
  "audiences",
  "analytics",
  "seo",
  "shop",
  "knowledge",
  "ai",
  "reviews",
  "video",
  "history",
];

export interface Member {
  role: Role;
  crmAccess: "inherit" | "allow" | "deny";
  socialLevel: "executive" | "publisher" | "none";
  isPlatformAdmin?: boolean;
}

export function canAccess(m: Member, f: Feature): boolean {
  if (m.isPlatformAdmin || m.role === "admin") return f === "crm" ? m.crmAccess !== "deny" : true;
  if (f === "crm")
    return m.crmAccess === "allow" || (m.crmAccess === "inherit" && m.role === "sales");
  if (f === "social" && m.socialLevel === "none") return false;
  if (m.role === "sales") return false;
  return editorFeatures.includes(f);
}
