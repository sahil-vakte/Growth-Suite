/** First-touch attribution. Values captured once and never overwritten; later touches only fill gaps.
 * Click IDs from any visit within CLICK_WINDOW_DAYS are kept. */
export const CLICK_WINDOW_DAYS = 90;
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export const CLICK_KEYS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid"] as const;

export interface Touch {
  params: Record<string, string>;
  landingPage?: string;
  referrer?: string;
  device?: string;
  at: string; // ISO
}

export type Attribution = Record<string, string | undefined> & { firstTouchAt?: string };

export function touchFromUrl(url: string, referrer: string | undefined, device: string | undefined, at = new Date()): Touch {
  const u = new URL(url, "https://placeholder.local");
  const params: Record<string, string> = {};
  for (const k of [...UTM_KEYS, ...CLICK_KEYS]) {
    const v = u.searchParams.get(k);
    if (v) params[k] = v.slice(0, 500);
  }
  return { params, landingPage: u.pathname + (u.search ? u.search : ""), referrer, device, at: at.toISOString() };
}

/** Merge a new touch into existing attribution without overwriting anything already set. */
export function mergeAttribution(existing: Attribution, touch: Touch, now = new Date()): Attribution {
  const out: Attribution = { ...existing };
  const fill = (k: string, v: string | undefined) => { if (v && !out[k]) out[k] = v; };
  for (const k of UTM_KEYS) fill(k, touch.params[k]);
  const ageDays = (now.getTime() - new Date(touch.at).getTime()) / 86_400_000;
  if (ageDays <= CLICK_WINDOW_DAYS) for (const k of CLICK_KEYS) fill(k, touch.params[k]);
  fill("landingPage", touch.landingPage);
  fill("referrer", touch.referrer);
  fill("device", touch.device);
  fill("firstTouchAt", touch.at);
  return out;
}

/** Classify the traffic source/medium for analytics. */
export function classifySource(params: Record<string, string>, referrer?: string): { source: string; medium: string; paid: boolean } {
  if (params.gclid || params.gbraid || params.wbraid) return { source: "google", medium: "cpc", paid: true };
  if (params.fbclid && /cpc|paid|ads?/i.test(params.utm_medium ?? "")) return { source: params.utm_source ?? "facebook", medium: params.utm_medium!, paid: true };
  if (params.utm_source) {
    const medium = params.utm_medium ?? "referral";
    return { source: params.utm_source, medium, paid: /cpc|ppc|paid|display|cpm/i.test(medium) };
  }
  if (params.fbclid) return { source: "facebook", medium: "social", paid: false };
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, "");
      if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(host)) return { source: host.split(".")[0], medium: "organic", paid: false };
      if (/facebook\.|instagram\.|linkedin\.|t\.co|twitter\.|x\.com|youtube\./.test(host)) return { source: host.split(".")[0], medium: "social", paid: false };
      return { source: host, medium: "referral", paid: false };
    } catch { /* ignore */ }
  }
  return { source: "(direct)", medium: "(none)", paid: false };
}

export function detectDevice(userAgent: string | null | undefined): "mobile" | "tablet" | "desktop" {
  const ua = userAgent ?? "";
  if (/ipad|tablet|kindle|silk/i.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/i.test(ua)) return "mobile";
  return "desktop";
}
