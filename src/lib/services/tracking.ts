/** First-party analytics: visitor cookie (gs_vid), sessions (30-minute inactivity), events and first-touch attribution. */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents, visitors } from "@/db/schema";
import { classifySource, detectDevice, mergeAttribution, touchFromUrl, CLICK_KEYS } from "../engines/attribution";

export const VISITOR_COOKIE = "gs_vid";
export const SESSION_GAP_MS = 30 * 60_000;
const ALLOWED_EVENTS = new Set(["page_view", "scroll", "form_view", "form_submit", "whatsapp_click", "call_click", "popup_shown", "popup_closed", "popup_click", "chat_open", "chat_message", "cta_click", "booking_made", "purchase", "video_play", "time_on_page"]);

export interface TrackInput { siteId: string; visitorId: string; name: string; url: string; referrer?: string; userAgent?: string | null; props?: Record<string, unknown>; ids?: Record<string, string | undefined> }

export async function track(i: TrackInput): Promise<{ sessionId: string; isNew: boolean }> {
  if (!ALLOWED_EVENTS.has(i.name)) throw new Error("Unknown event");
  const now = new Date();
  const touch = touchFromUrl(i.url, i.referrer, detectDevice(i.userAgent), now);
  const { source, medium } = classifySource(touch.params, i.referrer);
  const [v] = await db.select().from(visitors).where(eq(visitors.id, i.visitorId)).limit(1);
  const clickIds: Record<string, string> = {};
  for (const k of CLICK_KEYS) if (touch.params[k]) clickIds[k] = touch.params[k];
  const idsUpdate = { ...(i.ids ?? {}), ...clickIds };
  let sessionNo = 1, isNew = false;
  if (!v) {
    isNew = true;
    await db.insert(visitors).values({ id: i.visitorId, siteId: i.siteId, firstTouch: mergeAttribution({}, touch, now), ids: clean(idsUpdate) }).onConflictDoNothing();
  } else {
    const newSession = now.getTime() - v.lastSeen.getTime() > SESSION_GAP_MS;
    sessionNo = v.sessions + (newSession ? 1 : 0);
    await db.update(visitors).set({
      lastSeen: now, sessions: sessionNo,
      firstTouch: mergeAttribution(v.firstTouch as Record<string, string>, touch, now),
      ids: { ...(v.ids as object), ...clean(idsUpdate) },
    }).where(eq(visitors.id, v.id));
  }
  const sessionId = `${i.visitorId}.${sessionNo}`;
  await db.insert(analyticsEvents).values({ siteId: i.siteId, visitorId: i.visitorId, sessionId, name: i.name, pageUrl: touch.landingPage?.slice(0, 1000), source, medium, device: touch.device, props: i.props ?? null });
  return { sessionId, isNew };
}

const clean = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v).map(([k, v]) => [k, String(v).slice(0, 300)]));

export async function visitorFacts(siteId: string, visitorId: string) {
  const r = await db.execute(sql`
    select v.sessions, v.first_touch, v.last_seen, v.lead_id,
      count(e.*) filter (where e.name = 'page_view') as page_views,
      array_agg(distinct e.page_url) filter (where e.name = 'page_view') as paths,
      bool_or(e.name = 'form_submit') as form_submitted, bool_or(e.name = 'whatsapp_click') as wa, bool_or(e.name = 'call_click') as call
    from visitors v left join analytics_events e on e.visitor_id = v.id
    where v.id = ${visitorId} and v.site_id = ${siteId} group by v.id`);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const ft = (row.first_touch ?? {}) as Record<string, string>;
  return { visits: Number(row.sessions), pageViews: Number(row.page_views), visitedPaths: (row.paths as string[]) ?? [], source: ft.utm_source ?? "(direct)", paid: !!(ft.gclid || ft.gbraid || ft.wbraid || /cpc|paid/.test(ft.utm_medium ?? "")), device: ft.device, isLead: !!row.lead_id, formSubmitted: !!row.form_submitted, whatsappClicked: !!row.wa, callClicked: !!row.call, daysSinceLastVisit: Math.floor((Date.now() - new Date(row.last_seen as string).getTime()) / 86_400_000) };
}
