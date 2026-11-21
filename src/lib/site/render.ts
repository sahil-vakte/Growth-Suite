/** Shared data loading for public pages: theme variables, menu, header/footer, runtime config. */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { callCtas, chatWidgets, fontSets, forms, menuItems, popups, themes, whatsappCtas, whatsappNumbers, segmentMembers } from "@/db/schema";
import { getSetting } from "../settings";
import type { RuntimeConfig } from "@/components/site/SiteRuntime";
import type { SiteRow } from "../tenant";

export async function themeStyle(siteId: string, themeId?: string | null, fontSetId?: string | null): Promise<Record<string, string>> {
  const design = await getSetting(siteId, "site.design");
  const tid = themeId ?? design.themeId; const fid = fontSetId ?? design.fontSetId;
  const [theme] = tid ? await db.select().from(themes).where(and(eq(themes.id, tid), eq(themes.siteId, siteId))).limit(1) : await db.select().from(themes).where(and(eq(themes.siteId, siteId), eq(themes.isDefault, true))).limit(1);
  const [fonts] = fid ? await db.select().from(fontSets).where(and(eq(fontSets.id, fid), eq(fontSets.siteId, siteId))).limit(1) : await db.select().from(fontSets).where(and(eq(fontSets.siteId, siteId), eq(fontSets.isDefault, true))).limit(1);
  const p = (theme?.palette ?? {}) as Record<string, string>;
  const safe = (v: unknown) => (typeof v === "string" && /^[#a-zA-Z0-9(),.\s%-]{1,40}$/.test(v) ? v : undefined);
  const style: Record<string, string> = {};
  const map: Record<string, string> = { primary: "--p", primary_text: "--p-text", accent: "--accent", bg: "--bg", surface: "--surface", text: "--text", text_secondary: "--text2", border: "--border" };
  for (const [k, cssVar] of Object.entries(map)) { const v = safe(p[k]); if (v) style[cssVar] = v; }
  const slots = (fonts?.slots ?? {}) as Record<string, { family?: string }>;
  const fam = (s?: { family?: string }) => (s?.family && /^[\w\s-]{1,60}$/.test(s.family) ? `"${s.family}", system-ui, sans-serif` : undefined);
  if (fam(slots.font1)) style["--font1"] = fam(slots.font1)!;
  if (fam(slots.font2)) style["--font2"] = fam(slots.font2)!;
  return style;
}

export function googleFontsHref(slots: Record<string, { family?: string; weight?: number }>): string | null {
  const fams = [...new Set(Object.values(slots).map((s) => s.family).filter((f): f is string => !!f && /^[\w\s-]{1,60}$/.test(f)))];
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700;800`).join("&")}&display=swap` : null;
}

export async function siteChrome(siteId: string) {
  const [header, footer, menu, items] = await Promise.all([getSetting(siteId, "site.header"), getSetting(siteId, "site.footer"), getSetting(siteId, "site.menu"), db.select().from(menuItems).where(eq(menuItems.siteId, siteId)).orderBy(asc(menuItems.position))]);
  const top = items.filter((i) => !i.parentId).map((i) => ({ ...i, children: items.filter((c) => c.parentId === i.id) }));
  return { header, footer, menu, links: top };
}

export async function runtimeConfig(site: SiteRow, visitorId: string | undefined, pageUrl: string): Promise<RuntimeConfig> {
  const [pops, floating, calls, wNums, wCtas, chats] = await Promise.all([
    db.select().from(popups).where(and(eq(popups.siteId, site.id), eq(popups.active, true))),
    getSetting(site.id, "site.floatingCta"),
    db.select().from(callCtas).where(and(eq(callCtas.siteId, site.id), eq(callCtas.active, true))),
    db.select().from(whatsappNumbers).where(and(eq(whatsappNumbers.siteId, site.id), eq(whatsappNumbers.active, true))),
    db.select().from(whatsappCtas).where(eq(whatsappCtas.siteId, site.id)),
    db.select().from(chatWidgets).where(and(eq(chatWidgets.siteId, site.id), eq(chatWidgets.active, true))),
  ]);
  const segs = visitorId ? (await db.select({ id: segmentMembers.segmentId }).from(segmentMembers).where(eq(segmentMembers.visitorId, visitorId))).map((r) => r.id) : [];
  const defCall = calls.find((c) => c.isDefault) ?? calls[0];
  const waCta = wCtas.find((c) => c.id === floating.whatsapp.ctaId) ?? wCtas[0];
  const waNum = wNums.find((n) => n.id === waCta?.numberId) ?? wNums.find((n) => n.isDefault) ?? wNums[0];
  const waHref = waNum ? `https://wa.me/${(waNum.countryCode + waNum.number).replace(/\D/g, "")}${waCta ? `?text=${encodeURIComponent(waCta.message.replaceAll("{page_url}", pageUrl))}` : ""}` : null;
  const callCta = calls.find((c) => c.id === floating.call.ctaId) ?? defCall;
  let formId: string | null = null;
  if (floating.form.on && floating.form.formId) { const [f] = await db.select({ id: forms.id }).from(forms).where(and(eq(forms.id, floating.form.formId), eq(forms.siteId, site.id))).limit(1); formId = f?.id ?? null; }
  const path = new URL(pageUrl).pathname;
  const chat = chats.find((w) => {
    const scope = (w.config as { pageScope?: { urlRules?: { op: string; value: string }[] } }).pageScope;
    const rules = scope?.urlRules ?? [];
    return !rules.length || rules.some((r) => (r.op === "starts_with" ? path.startsWith(r.value) : r.op === "equals" ? path === r.value : path.includes(r.value)));
  });
  return {
    popups: pops.map((p) => ({ id: p.id, layout: p.layout, content: p.content, design: p.design as Record<string, string>, targeting: p.targeting as RuntimeConfig["popups"][number]["targeting"], frequency: p.frequency as "session", delaySec: p.delaySec, segmentId: p.segmentId })),
    floating: { enabled: floating.enabled, position: floating.position, whatsappHref: floating.whatsapp.on ? waHref : null, callHref: floating.call.on && callCta ? `tel:${callCta.phone.replace(/[^\d+]/g, "")}` : null, formId, colors: { wa: floating.whatsapp.bg, call: floating.call.bg, form: floating.form.bg } },
    call: defCall ? { defaultPhone: defCall.phone, rules: defCall.sourceRules as RuntimeConfig["call"] extends infer T ? T extends { rules: infer R } ? R : never : never } : null,
    chat: chat ? { id: chat.id, config: { botName: (chat.config as Record<string, unknown>).botName, greeting: (chat.config as Record<string, unknown>).greeting, themeColor: (chat.config as Record<string, unknown>).themeColor, position: (chat.config as Record<string, unknown>).position } } : null,
    segments: segs,
  };
}
