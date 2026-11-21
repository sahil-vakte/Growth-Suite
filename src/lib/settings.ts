import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

/** Typed per-site settings with defaults. Secrets inside settings are stored encrypted by callers (see crypto.encrypt). */
export const settingDefaults = {
  "site.design": { themeId: null as string | null, fontSetId: null as string | null },
  "site.header": { enabled: true, logoUrl: "", logoAlt: "", logoLabel: "", announcement: "", email: "", phone: "", whatsapp: "", cta1: { label: "", type: "url", value: "", target: "_self" }, cta2: { label: "", type: "url", value: "", target: "_self" } },
  "site.footer": { brandText: "", address: "", phone: "", email: "", social: [] as { network: string; url: string }[], legalLinks: [] as { label: string; href: string }[], copyright: "" },
  "site.menu": { brandLabel: "", brandLogo: "", sticky: true, design: "classic", cta: { label: "", type: "url", value: "", target: "_self" }, blog: { enabled: false, label: "Blog" } },
  "site.floatingCta": { enabled: false, position: "right", whatsapp: { on: true, ctaId: "", bg: "#25D366" }, call: { on: true, ctaId: "", showNumber: false, bg: "#0f172a" }, form: { on: false, formId: "", bg: "#2563eb" } },
  "seo.robots": { content: "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n" },
  "forms.spamGuard": { enabled: true, minSeconds: 3, hourlyLimitPerIp: 10, hourlyLimitPerPhone: 3, hourlyLimitPerEmail: 3 },
  "crm.defaults": { defaultCountryCode: "44" },
  "crm.assignment": { mode: "off", userIds: [] as string[], lastIndex: -1 },
  "appointments.settings": { timezone: "Europe/London", slotIntervalMinutes: 30, leadTimeMinutes: 120, bookingWindowDays: 30, bookingFormId: "" },
  "integrations.gtm": { containerId: "" },
  "integrations.ga4": { measurementId: "", apiSecretEnc: "" },
  "integrations.meta": { pixelId: "", capiTokenEnc: "", testEventCode: "", mode: "test", excludedPaths: [] as string[], excludedPhones: [] as string[] },
  "integrations.facebookLeads": { pageId: "", pageTokenEnc: "", formMap: {} as Record<string, string> },
  "integrations.googleAdsOffline": { mode: "off", fileUser: "", filePasswordHash: "", timezone: "Europe/London", conversionNames: {} as Record<string, string> },
  "whatsapp.connection": { wabaId: "", phoneNumberId: "", displayNumber: "", status: "disconnected", quality: "" },
  "whatsapp.bot": { enabled: false, greeting: "", fallback: "", away: "", mediaReply: "", handoffReply: "", handoffWords: [] as string[], hours: { on: false, start: "09:00", end: "18:00", days: ["mon", "tue", "wed", "thu", "fri"], tz: "Europe/London" }, takeoverHours: 12, sessionHours: 24, dailyCap: 300 },
  "social.rules": { publishersNeedApproval: false, defaultHashtags: "", utmTracking: true, utmCampaign: "social" },
  "ai.settings": { defaultProvider: "auto", creditPerThousandTokensMinor: 50 },
  "brand.guidelines": { text: "" },
  "mcp.settings": { enabled: false },
} as const;

export type SettingKey = keyof typeof settingDefaults;
type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T extends readonly (infer U)[] ? Widen<U>[] : T extends object ? { -readonly [K in keyof T]: Widen<T[K]> } : T;
export type SettingValue<K extends SettingKey> = Widen<(typeof settingDefaults)[K]>;

export async function getSetting<K extends SettingKey>(siteId: string, key: K): Promise<SettingValue<K>> {
  const [row] = await db.select().from(settings).where(and(eq(settings.siteId, siteId), eq(settings.key, key))).limit(1);
  const def = settingDefaults[key] as object;
  return { ...structuredClone(def), ...((row?.value as object) ?? {}) } as SettingValue<K>;
}

export async function setSetting<K extends SettingKey>(siteId: string, key: K, value: Partial<SettingValue<K>>): Promise<SettingValue<K>> {
  const current = await getSetting(siteId, key);
  const merged = { ...current, ...value };
  await db.insert(settings).values({ siteId, key, value: merged })
    .onConflictDoUpdate({ target: [settings.siteId, settings.key], set: { value: merged, updatedAt: new Date() } });
  return merged as SettingValue<K>;
}

export const isSettingKey = (k: string): k is SettingKey => k in settingDefaults;
