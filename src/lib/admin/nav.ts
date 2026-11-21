import type { Feature } from "../auth/permissions";

export interface NavItem { label: string; href: string; feature?: Feature }
export interface NavGroup { label: string; items: NavItem[] }

const r = (key: string, label: string, feature: Feature): NavItem => ({ label, href: `/admin/r/${key}`, feature });

export const adminNav: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/admin" }, { label: "Analytics", href: "/admin/analytics", feature: "analytics" }] },
  { label: "Website", items: [r("pages", "Pages", "content"), r("blog-posts", "Blog", "blog"), r("section-templates", "Common content", "content"), r("layouts", "Section layouts", "content"), { label: "Media library", href: "/admin/media", feature: "media" }, r("themes", "Themes", "themes"), r("font-sets", "Font sets", "themes"), r("menu-items", "Menu", "navigation"), { label: "Header, footer & menu style", href: "/admin/settings/site", feature: "navigation" }, { label: "Content history", href: "/admin/history", feature: "history" }] },
  { label: "Lead capture", items: [r("forms", "Forms", "forms"), r("submissions", "Submissions", "submissions"), r("popups", "Popups", "popups"), r("whatsapp-numbers", "WhatsApp numbers", "whatsapp"), r("whatsapp-ctas", "WhatsApp CTAs", "whatsapp"), r("call-ctas", "Click to call", "calls"), { label: "Floating CTA & spam guard", href: "/admin/settings/capture", feature: "forms" }, r("chat-widgets", "Chatbots", "chatbot"), r("chat-training", "Chatbot training", "chatbot"), r("chat-intents", "Chat intents", "chatbot"), r("chat-rules", "Chat automation", "chatbot")] },
  { label: "CRM", items: [{ label: "Leads", href: "/admin/crm", feature: "crm" }, r("lead-stages", "Pipeline stages", "crm"), r("reply-templates", "Reply templates", "crm"), r("scoring-rules", "Scoring rules", "scoring"), r("segments", "Audiences", "audiences"), r("conversion-signals", "Conversion signals", "integrations")] },
  { label: "WhatsApp Business", items: [{ label: "Connection & bot", href: "/admin/whatsapp", feature: "whatsapp_business" }, r("wa-templates", "Templates", "whatsapp_business"), r("wa-automations", "Automations", "whatsapp_business"), r("wa-campaigns", "Campaigns", "whatsapp_business"), r("wa-bot-rules", "Bot answers", "whatsapp_business"), r("wa-messages", "Message log", "whatsapp_business")] },
  { label: "Social posting", items: [r("social-accounts", "Accounts", "social"), r("social-posts", "Posts & approvals", "social")] },
  { label: "Appointments", items: [r("appointment-services", "Services", "appointments"), r("staff", "Staff & hours", "appointments"), r("bookings", "Bookings", "appointments"), { label: "Booking settings", href: "/admin/settings/appointments", feature: "appointments" }] },
  { label: "AI", items: [{ label: "AI studio & credits", href: "/admin/ai", feature: "ai" }, r("knowledge-sources", "Knowledge sources", "knowledge"), r("knowledge-chunks", "Knowledge chunks", "knowledge"), r("ai-outputs", "Output library", "ai"), r("business-interviews", "Business interviews", "knowledge")] },
  { label: "Social proof", items: [r("reviews", "Reviews", "reviews"), r("share-links", "Review links", "reviews"), r("video-sessions", "Video sessions", "video")] },
  { label: "Shop", items: [r("products", "Products", "shop"), r("orders", "Orders", "shop")] },
  { label: "SEO", items: [{ label: "SEO tools", href: "/admin/seo", feature: "seo" }, r("redirects", "Redirects", "seo"), r("research", "Research results", "seo")] },
  { label: "Affiliates", items: [r("partners", "Partners", "affiliates"), r("referrals", "Referrals", "affiliates"), r("commissions", "Commissions", "affiliates"), r("payouts", "Payouts", "affiliates"), r("affiliate-terms", "Programme terms", "affiliates")] },
  { label: "Administration", items: [{ label: "Platform — client sites", href: "/admin/platform", feature: "platform" as never },{ label: "Integrations", href: "/admin/integrations", feature: "integrations" }, { label: "AI assistant (MCP)", href: "/admin/assistant", feature: "integrations" }, { label: "Users", href: "/admin/users", feature: "users" }, { label: "Modules", href: "/admin/modules", feature: "modules" }, r("audit-logs", "Audit log", "users")] },
];
