/** Popup targeting: ALL/ANY conditions, frequency, exit intent. Evaluated in the browser and on the server. */
export type PopupCondition =
  | { field: "url"; op: "contains" | "equals" | "starts_with" | "not_contains"; value: string }
  | {
      field: "source" | "device" | "utm_source" | "utm_medium" | "utm_campaign" | "utm_content";
      op: "equals" | "not_equals";
      value: string;
    }
  | { field: "visitor"; op: "equals"; value: "new" | "returning" }
  | { field: "paid"; op: "equals"; value: "true" | "false" }
  | { field: "session_count" | "time_on_page" | "scroll_depth"; op: "gte" | "lte"; value: number }
  | { field: "exit_intent"; op: "is_true"; value?: string }
  | { field: "segment"; op: "member"; value: string };

export interface PopupContext {
  url: string;
  source: string;
  device: string;
  params: Record<string, string>;
  isReturning: boolean;
  paid: boolean;
  sessionCount: number;
  timeOnPageSec: number;
  scrollDepth: number;
  exitIntent: boolean;
  segments: string[];
}

export function evalCondition(c: PopupCondition, ctx: PopupContext): boolean {
  switch (c.field) {
    case "url": {
      const u = ctx.url.toLowerCase(),
        v = c.value.toLowerCase();
      if (c.op === "contains") return u.includes(v);
      if (c.op === "not_contains") return !u.includes(v);
      if (c.op === "starts_with")
        return new URL(ctx.url, "https://x.local").pathname.startsWith(c.value);
      return new URL(ctx.url, "https://x.local").pathname === c.value;
    }
    case "source":
    case "device":
    case "utm_source":
    case "utm_medium":
    case "utm_campaign":
    case "utm_content": {
      const actual = (
        c.field === "source"
          ? ctx.source
          : c.field === "device"
            ? ctx.device
            : (ctx.params[c.field] ?? "")
      ).toLowerCase();
      const eq = actual === String(c.value).toLowerCase();
      return c.op === "equals" ? eq : !eq;
    }
    case "visitor":
      return c.value === "returning" ? ctx.isReturning : !ctx.isReturning;
    case "paid":
      return String(ctx.paid) === c.value;
    case "session_count":
    case "time_on_page":
    case "scroll_depth": {
      const actual =
        c.field === "session_count"
          ? ctx.sessionCount
          : c.field === "time_on_page"
            ? ctx.timeOnPageSec
            : ctx.scrollDepth;
      return c.op === "gte" ? actual >= c.value : actual <= c.value;
    }
    case "exit_intent":
      return ctx.exitIntent;
    case "segment":
      return ctx.segments.includes(c.value);
  }
}

export function shouldShow(
  targeting: { match: "all" | "any"; conditions: PopupCondition[] },
  ctx: PopupContext,
): boolean {
  const conds = targeting.conditions ?? [];
  if (!conds.length) return true;
  return targeting.match === "any"
    ? conds.some((c) => evalCondition(c, ctx))
    : conds.every((c) => evalCondition(c, ctx));
}

export function needsExitIntent(targeting: { conditions: PopupCondition[] }): boolean {
  return (targeting.conditions ?? []).some((c) => c.field === "exit_intent");
}

/** Frequency gate. history = timestamps the popup was shown to this visitor; sessionShown = shown in this session. */
export function frequencyAllows(
  freq: "session" | "once" | "always",
  everShown: boolean,
  sessionShown: boolean,
): boolean {
  if (freq === "always") return true;
  if (freq === "once") return !everShown;
  return !sessionShown;
}

/** Exit intent is ignored during the first few seconds on the page. */
export const EXIT_INTENT_GRACE_MS = 3000;
