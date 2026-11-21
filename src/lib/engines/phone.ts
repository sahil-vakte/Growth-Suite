/** Phone number normalisation. Stored as E.164 (+447700900123). De-duplication uses the full E.164 digits,
 * which (unlike "last 10 digits") is safe across countries. */
export function normalisePhone(
  raw: string | null | undefined,
  defaultCountryCode = "44",
): string | null {
  if (!raw) return null;
  let s = String(raw)
    .trim()
    .replace(/[\s().-]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15 ? "+" + digits : null;
  }
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const cc = defaultCountryCode.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  else if (digits.startsWith(cc) && digits.length > 10) return validate("+" + digits);
  return validate("+" + cc + digits);
}

function validate(e164: string): string | null {
  const len = e164.length - 1;
  return len >= 8 && len <= 15 ? e164 : null;
}

export function phoneKey(e164: string | null): string | null {
  return e164 ? e164.replace(/\D/g, "") : null;
}

export function normaliseEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}
