import { describe, it, expect } from "vitest";
import { normalisePhone, phoneKey, normaliseEmail } from "@/lib/engines/phone";
import { checkSpam, defaultSpamConfig } from "@/lib/engines/spamGuard";
import { touchFromUrl, mergeAttribution, classifySource, detectDevice } from "@/lib/engines/attribution";
import { ctaHref } from "@/lib/engines/cta";
import { pickNumber } from "@/lib/engines/callTracking";
import { shouldShow, frequencyAllows, type PopupContext } from "@/lib/engines/popupTargeting";
import { generateSlots } from "@/lib/engines/appointments";
import { computeScore } from "@/lib/engines/scoring";
import { inSegment } from "@/lib/engines/segments";
import { renderTemplate, templateVariables } from "@/lib/engines/templating";
import { applyQuietHours, decideAtDue, triggerMatches, computeDueAt, type AutomationDef } from "@/lib/engines/automations";
import { botRespond, type BotRule, type BotSettings } from "@/lib/engines/waBot";
import { hashEmail, hashPhone, sha256 } from "@/lib/engines/hashing";
import { evaluateFormula } from "@/lib/engines/formula";
import { buildOfflineCsv, formatConversionTime } from "@/lib/engines/googleAdsFile";
import { generateLicenceKeys, signLicence, verifyLicence, licenceActive } from "@/lib/engines/licence";
import { can, nextStatus, tooLate, captionWarnings, addUtm } from "@/lib/engines/social";
import { commissionFor, canMarkPaid } from "@/lib/engines/affiliates";
import { sectionVisible } from "@/lib/engines/sectionAudience";
import { zonedToUtc, inWindow } from "@/lib/engines/time";

describe("phone & email", () => {
  it("normalises UK, Indian and international numbers to E.164", () => {
    expect(normalisePhone("07700 900123", "44")).toBe("+447700900123");
    expect(normalisePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalisePhone("9876543210", "91")).toBe("+919876543210");
    expect(normalisePhone("0044 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("12")).toBeNull();
    expect(phoneKey("+447700900123")).toBe("447700900123");
  });
  it("validates emails", () => {
    expect(normaliseEmail(" A@Example.COM ")).toBe("a@example.com");
    expect(normaliseEmail("not-an-email")).toBeNull();
  });
});

describe("spam guard", () => {
  const base = { values: { name: "Jane", message: "Hello" }, recentCounts: { ip: 0, phone: 0, email: 0 } };
  it("accepts normal entries", () => expect(checkSpam({ ...base, renderedAt: 0, now: 10_000 })).toEqual({ spam: false }));
  it("holds honeypot, too-fast, rate-limited and junk entries", () => {
    expect(checkSpam({ ...base, honeypot: "x" })).toMatchObject({ spam: true, reason: "honeypot_filled" });
    expect(checkSpam({ ...base, renderedAt: 9_000, now: 10_000 })).toMatchObject({ reason: "too_fast" });
    expect(checkSpam({ ...base, recentCounts: { ip: 10, phone: 0, email: 0 } })).toMatchObject({ reason: "ip_rate_limit" });
    expect(checkSpam({ ...base, values: { m: "buy http://a http://b http://c" } })).toMatchObject({ reason: "junk_text" });
  });
  it("can be switched off", () => expect(checkSpam({ ...base, honeypot: "x" }, { ...defaultSpamConfig, enabled: false })).toEqual({ spam: false }));
});

describe("attribution", () => {
  it("captures first touch and never overwrites", () => {
    const t1 = touchFromUrl("https://s.com/a?utm_source=google&utm_medium=cpc&gclid=G1", "https://google.com", "mobile", new Date("2026-01-01"));
    const t2 = touchFromUrl("https://s.com/b?utm_source=facebook&fbclid=F1", undefined, "desktop", new Date("2026-01-05"));
    const a = mergeAttribution(mergeAttribution({}, t1, new Date("2026-01-01")), t2, new Date("2026-01-05"));
    expect(a.utm_source).toBe("google");
    expect(a.gclid).toBe("G1");
    expect(a.fbclid).toBe("F1"); // gap filled
    expect(a.landingPage).toBe("/a?utm_source=google&utm_medium=cpc&gclid=G1");
  });
  it("drops click ids older than 90 days", () => {
    const old = touchFromUrl("https://s.com/?gclid=OLD", undefined, undefined, new Date("2025-01-01"));
    expect(mergeAttribution({}, old, new Date("2026-01-01")).gclid).toBeUndefined();
  });
  it("classifies sources and devices", () => {
    expect(classifySource({ gclid: "x" })).toMatchObject({ source: "google", paid: true });
    expect(classifySource({}, "https://www.google.co.uk/")).toMatchObject({ medium: "organic" });
    expect(classifySource({})).toMatchObject({ source: "(direct)" });
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
  });
});

describe("CTA links", () => {
  it("builds WhatsApp, phone, form and URL links and hides incomplete buttons", () => {
    expect(ctaHref({ label: "Chat", type: "whatsapp", value: "+44 7700 900123", wa_message: "Hi from {page_url}" }, "https://s.com/p"))
      .toBe("https://wa.me/447700900123?text=Hi%20from%20https%3A%2F%2Fs.com%2Fp");
    expect(ctaHref({ label: "Call", type: "phone", value: "+44 20 7946 0000" })).toBe("tel:+442079460000");
    expect(ctaHref({ label: "Quote", type: "form", value: "abc123" })).toBe("#form-abc123");
    expect(ctaHref({ label: "", type: "url", value: "https://x.com" })).toBeNull();
    expect(ctaHref({ label: "Bad", type: "url", value: "javascript:alert(1)" })).toBeNull();
  });
});

describe("call tracking", () => {
  const rules = [{ type: "google_ads" as const, phone: "+441111" }, { type: "utm_source" as const, value: "newsletter", phone: "+442222" }];
  it("first matching rule wins, default otherwise, sticky for 30 days", () => {
    expect(pickNumber("+440000", rules, { params: { gclid: "x", utm_source: "newsletter" } })).toBe("+441111");
    expect(pickNumber("+440000", rules, { params: { utm_source: "newsletter" } })).toBe("+442222");
    expect(pickNumber("+440000", rules, { params: {} })).toBe("+440000");
    expect(pickNumber("+440000", rules, { params: {} }, { phone: "+441111", at: Date.now() - 86_400_000 })).toBe("+441111");
  });
});

describe("popup targeting", () => {
  const ctx: PopupContext = { url: "https://s.com/pricing?utm_source=fb", source: "fb", device: "mobile", params: { utm_source: "fb" }, isReturning: true, paid: false, sessionCount: 3, timeOnPageSec: 25, scrollDepth: 60, exitIntent: false, segments: ["seg1"] };
  it("evaluates ALL and ANY", () => {
    expect(shouldShow({ match: "all", conditions: [{ field: "url", op: "contains", value: "pricing" }, { field: "visitor", op: "equals", value: "returning" }] }, ctx)).toBe(true);
    expect(shouldShow({ match: "all", conditions: [{ field: "exit_intent", op: "is_true" }, { field: "time_on_page", op: "gte", value: 20 }] }, ctx)).toBe(false);
    expect(shouldShow({ match: "any", conditions: [{ field: "exit_intent", op: "is_true" }, { field: "segment", op: "member", value: "seg1" }] }, ctx)).toBe(true);
  });
  it("respects frequency", () => {
    expect(frequencyAllows("once", true, false)).toBe(false);
    expect(frequencyAllows("session", true, false)).toBe(true);
    expect(frequencyAllows("session", true, true)).toBe(false);
  });
});

describe("appointment slots", () => {
  it("creates slots in the site time zone, honours lead time, buffer and existing bookings", () => {
    const now = new Date("2026-06-01T06:00:00Z"); // Mon 07:00 London (BST)
    const staffList = [{ id: "s1", weeklyHours: { mon: [["09:00", "11:00"]] as [string, string][] } }];
    const busy = [{ staffId: "s1", startsAt: new Date("2026-06-01T08:30:00Z"), endsAt: new Date("2026-06-01T09:00:00Z") }]; // 09:30-10:00 BST
    const slots = generateSlots({ timezone: "Europe/London", slotIntervalMinutes: 30, leadTimeMinutes: 60, bookingWindowDays: 30 }, { durationMinutes: 30, bufferMinutes: 0 }, staffList, busy, "2026-06-01", 1, now);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(["2026-06-01T08:00:00.000Z", "2026-06-01T09:00:00.000Z", "2026-06-01T09:30:00.000Z"]);
  });
});

describe("lead scoring", () => {
  it("sums each signal once, site rules override defaults", () => {
    expect(computeScore([{ channel: "form", key: "form_submitted" }, { channel: "form", key: "form_submitted" }], [])).toBe(30);
    expect(computeScore([{ channel: "form", key: "form_submitted" }], [{ channel: "form", signalKey: "form_submitted", points: 50, active: true }])).toBe(50);
    expect(computeScore([{ channel: "form", key: "form_submitted" }], [{ channel: "form", signalKey: "form_submitted", points: 50, active: false }])).toBe(0);
  });
});

describe("segments", () => {
  it("evaluates AND/OR groups", () => {
    const facts = { visits: 3, visitedPaths: ["/pricing", "/"], isLead: false, source: "google" };
    expect(inSegment([{ match: "all", conditions: [{ field: "visits", op: "gte", value: 2 }, { field: "visitedPaths", op: "contains", value: "pricing" }] }], "all", facts)).toBe(true);
    expect(inSegment([{ match: "all", conditions: [{ field: "isLead", op: "eq", value: true }] }, { match: "any", conditions: [{ field: "source", op: "eq", value: "google" }] }], "any", facts)).toBe(true);
    expect(inSegment([], "all", facts)).toBe(false);
  });
});

describe("templating", () => {
  it("fills variables with fallbacks", () => {
    expect(renderTemplate("Hi {{name|there}}, re {{form.title}}", { name: "", form: { title: "Quote" } })).toBe("Hi there, re Quote");
    expect(templateVariables("{{a}} {{b|x}} {{a}}")).toEqual(["a", "b"]);
  });
});

describe("WhatsApp automations", () => {
  const a: AutomationDef = { trigger: "stage_changed", triggerValue: "Qualified", delayMinutes: 60, conditions: [{ field: "stage", op: "eq", value: "Qualified" }], quietHours: { start: "21:00", end: "09:00" }, skipIfReplied: true, dailyCap: 2, oncePerPerson: true, active: true };
  it("matches triggers and moves out of quiet hours", () => {
    expect(triggerMatches(a, { type: "stage_changed", value: "Qualified" })).toBe(true);
    expect(triggerMatches(a, { type: "stage_changed", value: "New" })).toBe(false);
    const due = computeDueAt(a, new Date("2026-03-10T21:30:00Z"), "UTC"); // 22:30 → quiet → next 09:00
    expect(due.toISOString()).toBe("2026-03-11T09:00:00.000Z");
    expect(applyQuietHours(new Date("2026-03-10T12:00:00Z"), a.quietHours, "UTC").toISOString()).toBe("2026-03-10T12:00:00.000Z");
  });
  it("re-checks conditions, STOP, replies and caps at due time", () => {
    const lead = { stage: "Qualified", optedOut: false, phone: "+447700900123", lastInboundAt: null };
    const ctx = { runCreatedAt: new Date("2026-03-10T10:00:00Z"), sentToday: 0, alreadySentToLead: false, now: new Date("2026-03-10T12:00:00Z"), timeZone: "UTC" };
    expect(decideAtDue(a, lead, ctx)).toEqual({ send: true });
    expect(decideAtDue(a, { ...lead, stage: "Enrolled" }, ctx)).toMatchObject({ reason: "conditions_no_longer_true" });
    expect(decideAtDue(a, { ...lead, optedOut: true }, ctx)).toMatchObject({ reason: "opted_out" });
    expect(decideAtDue(a, { ...lead, lastInboundAt: new Date("2026-03-10T11:00:00Z") }, ctx)).toMatchObject({ reason: "lead_replied" });
    expect(decideAtDue(a, lead, { ...ctx, sentToday: 2 })).toMatchObject({ reason: "daily_cap" });
  });
});

describe("WhatsApp bot", () => {
  const rules: BotRule[] = [{ id: "r1", name: "Price", matchType: "contains", keywords: ["price", "cost"], replyText: "Our prices start at £99.", thenAction: "none", priority: 1, active: true }];
  const s: BotSettings = { enabled: true, greeting: "Welcome!", fallback: "A person will reply soon.", handoffWords: ["agent"], handoffReply: "Connecting you.", takeoverHours: 12, dailyCap: 100 };
  const ctx = { text: "what is the price?", isMedia: false, isNewChat: false, optedOut: false, repliesToday: 0, now: new Date() };
  it("answers rules, hands off, greets, honours STOP and human takeover", () => {
    expect(botRespond(rules, s, ctx)).toMatchObject({ reply: "Our prices start at £99.", ruleId: "r1" });
    expect(botRespond(rules, s, { ...ctx, text: "talk to an agent" })).toMatchObject({ action: "handoff" });
    expect(botRespond(rules, s, { ...ctx, text: "hello", isNewChat: true })).toMatchObject({ reply: "Welcome!" });
    expect(botRespond(rules, s, { ...ctx, text: "STOP" })).toMatchObject({ action: "opt_out" });
    expect(botRespond(rules, s, { ...ctx, lastHumanReplyAt: new Date() })).toMatchObject({ reason: "human_takeover" });
  });
});

describe("hashing", () => {
  it("normalises per platform", () => {
    expect(hashEmail(" John.Doe+x@Gmail.com ", "google")).toBe(sha256("johndoe@gmail.com"));
    expect(hashEmail(" John.Doe@Gmail.com ", "meta")).toBe(sha256("john.doe@gmail.com"));
    expect(hashPhone("+447700900123", "meta")).toBe(sha256("447700900123"));
    expect(hashPhone("+447700900123", "google")).toBe(sha256("+447700900123"));
  });
});

describe("calculator formulas", () => {
  it("evaluates arithmetic, fields and functions safely", () => {
    expect(evaluateFormula("2 + 3 * 4")).toBe(14);
    expect(evaluateFormula("({a} + {b}) / 2", { a: 10, b: 20 })).toBe(15);
    expect(evaluateFormula("round(pmt({rate}/12, {years}*12, {amount}), 2)", { rate: 0.06, years: 25, amount: 200000 })).toBe(1288.6);
    expect(evaluateFormula("2^3^2")).toBe(512);
    expect(() => evaluateFormula("process.exit()")).toThrow();
  });
});

describe("Google Ads offline file", () => {
  it("writes header and time-zone offsets, skips unmatched rows", () => {
    expect(formatConversionTime(new Date("2026-07-01T12:00:00Z"), "Europe/London")).toBe("2026-07-01 13:00:00+01:00");
    const csv = buildOfflineCsv([
      { gclid: "G1", conversionName: "Qualified", at: new Date("2026-01-15T10:00:00Z"), valueMinor: 2500000, currency: "INR" },
      { conversionName: "Qualified", at: new Date(), valueMinor: 0, currency: "INR" },
    ], "Asia/Kolkata");
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("Google Click ID");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("2026-01-15 15:30:00+05:30");
    expect(lines[1]).toContain("25000.00");
  });
});

describe("module licences", () => {
  it("verifies signatures and applies the grace period", () => {
    const { publicKeyPem, privateKeyPem } = generateLicenceKeys();
    const st = signLicence({ site: "s1", module: "affiliates", endsAt: "2099-01-01T00:00:00Z", issuedAt: new Date().toISOString() }, privateKeyPem);
    const p = verifyLicence(st, publicKeyPem);
    expect(licenceActive(p, "s1", "affiliates", new Date())).toBe(true);
    expect(licenceActive(p, "s2", "affiliates", new Date())).toBe(false);
    expect(licenceActive(p, "s1", "affiliates", new Date(Date.now() - 15 * 86_400_000))).toBe(false);
    expect(verifyLicence(st.slice(0, -3) + "AAA", publicKeyPem)).toBeNull();
  });
});

describe("social approvals", () => {
  const exec = { id: "e", isAdmin: false, level: "executive" as const, canApprove: false };
  const pub = { id: "p", isAdmin: false, level: "publisher" as const, canApprove: true };
  it("enforces who can do what", () => {
    expect(can(exec, "submit", { authorId: "e", status: "draft" }, { publishersNeedApproval: false })).toBe(true);
    expect(can(exec, "publish_now", { authorId: "e", status: "draft" }, { publishersNeedApproval: false })).toBe(false);
    expect(can(pub, "approve", { authorId: "e", status: "pending_approval" }, { publishersNeedApproval: false })).toBe(true);
    expect(can(pub, "approve", { authorId: "p", status: "pending_approval" }, { publishersNeedApproval: false })).toBe(false);
    expect(can(pub, "publish_now", { authorId: "p", status: "draft" }, { publishersNeedApproval: true })).toBe(false);
  });
  it("transitions and lateness", () => {
    expect(nextStatus("approve", new Date(Date.now() + 3600_000))).toBe("scheduled");
    expect(nextStatus("approve", null)).toBe("publishing");
    expect(tooLate(new Date(Date.now() - 7 * 3600_000))).toBe(true);
    expect(captionWarnings("see https://x.com", ["instagram"])).toHaveLength(1);
    expect(addUtm("go https://www.site.com/p and https://other.com", "site.com", "facebook", "spring")).toContain("utm_source=facebook");
    expect(addUtm("https://other.com", "site.com", "facebook", "s")).toBe("https://other.com");
  });
});

describe("affiliates & section audiences & time", () => {
  it("calculates commission and enforces four-eyes", () => {
    expect(commissionFor({ type: "percent", percent: 10, holdDays: 30, minPayoutMinor: 0, conversionStage: "Won" }, 250000)).toBe(25000);
    expect(canMarkPaid("admin1", "admin1")).toBe(false);
    expect(canMarkPaid("admin1", "admin2")).toBe(true);
  });
  it("shows sections by URL parameter", () => {
    expect(sectionVisible({ param: "utm_content", op: "equals", value: "offer-a" }, { utm_content: "offer-a" })).toBe(true);
    expect(sectionVisible({ param: "utm_content", op: "equals", value: "offer-a" }, {})).toBe(false);
    expect(sectionVisible(null, {})).toBe(true);
  });
  it("converts zoned times across DST", () => {
    expect(zonedToUtc("2026-01-15", "09:00", "Europe/London").toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(zonedToUtc("2026-07-15", "09:00", "Europe/London").toISOString()).toBe("2026-07-15T08:00:00.000Z");
    expect(zonedToUtc("2026-07-15", "09:00", "Asia/Kolkata").toISOString()).toBe("2026-07-15T03:30:00.000Z");
    expect(inWindow("22:00", "21:00", "09:00")).toBe(true);
    expect(inWindow("12:00", "21:00", "09:00")).toBe(false);
  });
});
