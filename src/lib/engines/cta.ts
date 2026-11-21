/** CTA object used by every section button, popup, menu and floating bar.
 * Shape: { label, type: url|whatsapp|phone|call|form, value, target, wa_message }.
 * A button renders only when it has BOTH a label and a destination. */
export interface Cta {
  label: string;
  type: "url" | "whatsapp" | "phone" | "call" | "form";
  value: string;
  target?: "_self" | "_blank";
  wa_message?: string;
}

export const blankCta: Cta = { label: "", type: "url", value: "", target: "_self", wa_message: "" };

export function isCta(v: unknown): v is Cta {
  return !!v && typeof v === "object" && "type" in v && "value" in v && "label" in v;
}

export function safeUrl(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (s.startsWith("#")) return s;
  try {
    const u = new URL(s);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Returns the href for a CTA, or null when it should not be drawn. */
export function ctaHref(cta: Partial<Cta> | null | undefined, pageUrl = ""): string | null {
  if (!cta || !cta.label?.trim() || !cta.value?.trim()) return null;
  const value = cta.value.trim();
  switch (cta.type) {
    case "whatsapp": {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 8) return null;
      const msg = (cta.wa_message ?? "").replaceAll("{page_url}", pageUrl);
      return `https://wa.me/${digits}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
    }
    case "phone":
    case "call": {
      const digits = value.replace(/[^\d+]/g, "");
      return digits.replace(/\D/g, "").length >= 6 ? `tel:${digits}` : null;
    }
    case "form":
      return /^[\w-]+$/.test(value) ? `#form-${value}` : null;
    default:
      return safeUrl(value);
  }
}
