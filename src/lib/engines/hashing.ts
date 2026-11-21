/** Normalise + SHA-256 hash customer data for Meta CAPI and Google (enhanced conversions / Customer Match).
 * Meta: email trimmed+lowercased; phone digits only incl. country code.
 * Google: email trimmed+lowercased, gmail/googlemail dots and +suffix removed; phone in E.164 with leading "+". */
import { createHash } from "node:crypto";

export type AdPlatform = "meta" | "google";
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function normaliseEmailFor(email: string, platform: AdPlatform): string {
  let e = email.trim().toLowerCase();
  if (platform === "google") {
    const [local, domain] = e.split("@");
    if (domain && /^(gmail|googlemail)\.com$/.test(domain))
      e = `${local.split("+")[0].replace(/\./g, "")}@${domain}`;
  }
  return e;
}

export function hashEmail(
  email: string | null | undefined,
  platform: AdPlatform,
): string | undefined {
  return email ? sha256(normaliseEmailFor(email, platform)) : undefined;
}

export function hashPhone(
  e164: string | null | undefined,
  platform: AdPlatform,
): string | undefined {
  if (!e164) return undefined;
  const digits = e164.replace(/\D/g, "");
  if (!digits) return undefined;
  return sha256(platform === "google" ? `+${digits}` : digits);
}

export function hashName(name?: string | null): { fn?: string; ln?: string } {
  if (!name) return {};
  const parts = name.trim().toLowerCase().split(/\s+/);
  return {
    fn: parts[0] ? sha256(parts[0]) : undefined,
    ln: parts.length > 1 ? sha256(parts[parts.length - 1]) : undefined,
  };
}
