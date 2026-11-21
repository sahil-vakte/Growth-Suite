import { eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { enqueue, registerHandler } from "../queue";
import { retentionMonths, retentionCutoff } from "../engines/retention";

export async function pruneAnalytics(siteId: string, months: number, now = new Date()) {
  const cutoff = retentionCutoff(months, now);
  if (!cutoff) return 0;
  let total = 0;
  for (;;) {
    // Both selection and deletion are tenant scoped. Concurrent workers skip locked rows.
    const result = await db.execute(sql`
      WITH expired AS (
        SELECT id FROM analytics_events WHERE site_id = ${siteId} AND created_at < ${cutoff.toISOString()}::timestamptz
        ORDER BY created_at LIMIT 1000 FOR UPDATE SKIP LOCKED
      )
      DELETE FROM analytics_events WHERE site_id = ${siteId} AND id IN (SELECT id FROM expired) RETURNING id
    `);
    total += result.rowCount ?? 0;
    if ((result.rowCount ?? 0) < 1000) break;
  }
  await db.update(sites).set({ analyticsRetentionLastRunAt: now }).where(eq(sites.id, siteId));
  return total;
}

export async function scheduleAnalyticsRetention(now = new Date()) {
  const months = retentionMonths(process.env.ANALYTICS_RETENTION_MONTHS);
  if (!months) return;
  const day = now.toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00Z`);
  const due = await db
    .select({ id: sites.id })
    .from(sites)
    .where(
      or(isNull(sites.analyticsRetentionLastRunAt), lt(sites.analyticsRetentionLastRunAt, start)),
    );
  for (const site of due)
    await enqueue(
      "analytics.retention",
      {},
      { siteId: site.id, idempotency: `analytics.retention:${site.id}:${day}` },
    );
}
registerHandler("analytics.retention", async (_payload, job) => {
  if (!job.siteId) throw new Error("Retention job has no site");
  await pruneAnalytics(job.siteId, retentionMonths(process.env.ANALYTICS_RETENTION_MONTHS));
});
