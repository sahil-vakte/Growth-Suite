import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Analytics summary straight from first-party events (indexed by site + time). */
export async function analyticsSummary(siteId: string, days = 30, from?: Date, to?: Date) {
  const start = (from ?? new Date(Date.now() - days * 86_400_000)).toISOString();
  const end = (to ?? new Date()).toISOString();
  const q = async <T>(query: ReturnType<typeof sql>) => (await db.execute(query)).rows as T[];
  const range = sql`site_id = ${siteId} and created_at >= ${start} and created_at < ${end}`;
  const [totals] = await q<{ users: number; sessions: number; views: number; forms: number; calls: number; whatsapp: number }>(sql`
    select count(distinct visitor_id)::int users, count(distinct session_id)::int sessions,
      count(*) filter (where name='page_view')::int views, count(*) filter (where name='form_submit')::int forms,
      count(*) filter (where name='call_click')::int calls, count(*) filter (where name='whatsapp_click')::int whatsapp
    from analytics_events where ${range}`);
  const [leadsRow] = await q<{ leads: number }>(sql`select count(*)::int leads from leads where site_id = ${siteId} and created_at >= ${start} and created_at < ${end}`);
  const [subs] = await q<{ n: number }>(sql`select count(*)::int n from submissions where site_id = ${siteId} and status='accepted' and created_at >= ${start} and created_at < ${end}`);
  const conversions = (subs?.n ?? 0) + (totals?.calls ?? 0) + (totals?.whatsapp ?? 0);
  const bySource = await q<{ source: string; medium: string; users: number; conversions: number }>(sql`
    with s as (select visitor_id, min(source) source, min(medium) medium from analytics_events where ${range} and name='page_view' group by visitor_id)
    select coalesce(s.source,'(direct)') source, coalesce(s.medium,'(none)') medium, count(distinct s.visitor_id)::int users,
      count(distinct e.visitor_id) filter (where e.name in ('form_submit','call_click','whatsapp_click'))::int conversions
    from s left join analytics_events e on e.visitor_id = s.visitor_id and e.site_id = ${siteId} and e.created_at >= ${start}
    group by 1,2 order by users desc limit 20`);
  const byDevice = await q<{ device: string; users: number }>(sql`select coalesce(device,'unknown') device, count(distinct visitor_id)::int users from analytics_events where ${range} group by 1 order by 2 desc`);
  const topPages = await q<{ page: string; views: number; avg_scroll: number }>(sql`
    select split_part(page_url,'?',1) page, count(*) filter (where name='page_view')::int views,
      coalesce(round(avg((props->>'depth')::int) filter (where name='scroll')),0)::int avg_scroll
    from analytics_events where ${range} group by 1 order by views desc limit 15`);
  const events = await q<{ name: string; total: number }>(sql`select name, count(*)::int total from analytics_events where ${range} group by 1 order by 2 desc`);
  const daily = await q<{ day: string; users: number; leads: number }>(sql`
    select to_char(d::date,'YYYY-MM-DD') as day,
      (select count(distinct visitor_id) from analytics_events where site_id=${siteId} and created_at::date = d::date)::int users,
      (select count(*) from leads where site_id=${siteId} and created_at::date = d::date)::int leads
    from generate_series(${start}::timestamptz, ${end}::timestamptz, interval '1 day') d order by 1`);
  const users = totals?.users ?? 0;
  return { range: { start, end }, users, sessions: totals?.sessions ?? 0, pageViews: totals?.views ?? 0, leads: leadsRow?.leads ?? 0,
    conversions: { total: conversions, forms: subs?.n ?? 0, calls: totals?.calls ?? 0, whatsapp: totals?.whatsapp ?? 0 },
    conversionRate: users ? Math.round((conversions / users) * 1000) / 10 : 0, bySource, byDevice, topPages, events, daily };
}
