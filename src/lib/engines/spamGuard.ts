/** Spam guard for public form posts: honeypot, minimum fill time, rate limits and junk-text checks.
 * Pure: callers supply recent counts. A held entry creates no lead, message or ad conversion. */
export interface SpamInput {
  honeypot?: string | null;
  renderedAt?: number | null; // ms epoch when the form was rendered
  now?: number;
  values: Record<string, unknown>;
  recentCounts: { ip: number; phone: number; email: number }; // submissions in the last hour
}
export interface SpamConfig {
  enabled: boolean;
  minSeconds: number;
  hourlyLimitPerIp: number;
  hourlyLimitPerPhone: number;
  hourlyLimitPerEmail: number;
}
export const defaultSpamConfig: SpamConfig = {
  enabled: true,
  minSeconds: 3,
  hourlyLimitPerIp: 10,
  hourlyLimitPerPhone: 3,
  hourlyLimitPerEmail: 3,
};

export type SpamVerdict = { spam: false } | { spam: true; reason: string };

export function checkSpam(input: SpamInput, cfg: SpamConfig = defaultSpamConfig): SpamVerdict {
  if (!cfg.enabled) return { spam: false };
  if (input.honeypot && String(input.honeypot).trim() !== "")
    return { spam: true, reason: "honeypot_filled" };
  const now = input.now ?? Date.now();
  if (input.renderedAt && now - input.renderedAt < cfg.minSeconds * 1000)
    return { spam: true, reason: "too_fast" };
  if (input.recentCounts.ip >= cfg.hourlyLimitPerIp) return { spam: true, reason: "ip_rate_limit" };
  if (input.recentCounts.phone >= cfg.hourlyLimitPerPhone)
    return { spam: true, reason: "phone_rate_limit" };
  if (input.recentCounts.email >= cfg.hourlyLimitPerEmail)
    return { spam: true, reason: "email_rate_limit" };
  const text = Object.values(input.values)
    .filter((v) => typeof v === "string")
    .join(" ");
  if (isJunk(text)) return { spam: true, reason: "junk_text" };
  return { spam: false };
}

export function isJunk(text: string): boolean {
  if (!text) return false;
  const links = (text.match(/https?:\/\//gi) ?? []).length;
  if (links >= 3) return true;
  if (
    /\b(viagra|casino|crypto ?airdrop|seo services|backlinks? package|loan approval guaranteed)\b/i.test(
      text,
    )
  )
    return true;
  if (/<a\s+href=|\[url=/i.test(text)) return true;
  // Long runs of consonants with no vowels typical of keyboard mashing
  const words = text.split(/\s+/).filter((w) => w.length >= 12);
  if (words.some((w) => /^[^aeiouy\d]{12,}$/i.test(w))) return true;
  return false;
}
