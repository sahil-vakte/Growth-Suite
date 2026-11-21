import type { Feature } from "../auth/permissions";
import type { SettingKey } from "../settings";

/** Which feature may read/write each settings key, and how secrets inside it are handled. */
export const settingFeature: Record<SettingKey, Feature> = {
  "site.design": "themes",
  "site.header": "navigation",
  "site.footer": "navigation",
  "site.menu": "navigation",
  "site.floatingCta": "forms",
  "seo.robots": "seo",
  "forms.spamGuard": "forms",
  "crm.defaults": "crm",
  "crm.assignment": "crm",
  "appointments.settings": "appointments",
  "integrations.gtm": "integrations",
  "integrations.ga4": "integrations",
  "integrations.meta": "integrations",
  "integrations.facebookLeads": "integrations",
  "integrations.googleAdsOffline": "integrations",
  "whatsapp.connection": "whatsapp_business",
  "whatsapp.bot": "whatsapp_business",
  "social.rules": "social",
  "ai.settings": "ai",
  "brand.guidelines": "themes",
  "mcp.settings": "integrations",
};
export const MASK = "•••••••• (saved)";
export const isSecretKey = (k: string) => k.endsWith("Enc") || k.endsWith("PasswordHash");
