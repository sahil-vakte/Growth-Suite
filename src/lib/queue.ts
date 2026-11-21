/** Postgres-backed job queue (FOR UPDATE SKIP LOCKED). Safe with many workers. Swap for SQS/Redis at very high scale. */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";

export type JobHandler = (payload: Record<string, unknown>, job: { id: string; siteId: string | null; attempts: number }) => Promise<void>;
const handlers = new Map<string, JobHandler>();

export function registerHandler(type: string, fn: JobHandler) { handlers.set(type, fn); }

export async function enqueue(type: string, payload: Record<string, unknown>, opts: { siteId?: string; runAt?: Date; idempotency?: string; maxAttempts?: number } = {}) {
  const [row] = await db.insert(jobs).values({ type, payload, siteId: opts.siteId ?? null, runAt: opts.runAt ?? new Date(), idempotency: opts.idempotency, maxAttempts: opts.maxAttempts ?? 5 })
    .onConflictDoNothing({ target: jobs.idempotency }).returning({ id: jobs.id });
  return row?.id ?? null;
}

export async function processDueJobs(limit = 25): Promise<{ processed: number; failed: number }> {
  const res = await db.execute(sql`
    UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
    WHERE id IN (
      SELECT id FROM jobs WHERE (status = 'queued' AND run_at <= now())
         OR (status = 'running' AND locked_at < now() - interval '10 minutes')
      ORDER BY run_at LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING id, type, payload, site_id, attempts, max_attempts`);
  let processed = 0, failed = 0;
  for (const r of res.rows as { id: string; type: string; payload: Record<string, unknown>; site_id: string | null; attempts: number; max_attempts: number }[]) {
    const h = handlers.get(r.type);
    try {
      if (!h) throw new Error(`No handler for job type ${r.type}`);
      await h(r.payload, { id: r.id, siteId: r.site_id, attempts: r.attempts });
      await db.execute(sql`UPDATE jobs SET status = 'done', updated_at = now() WHERE id = ${r.id}`);
      processed++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      const final = r.attempts >= r.max_attempts;
      const backoffSec = Math.min(3600, 30 * 2 ** (r.attempts - 1)); // 30s, 60s, 2m, 4m … max 1h
      await db.execute(sql`UPDATE jobs SET status = ${final ? "failed" : "queued"}, last_error = ${msg.slice(0, 2000)},
        run_at = now() + (${backoffSec} || ' seconds')::interval, updated_at = now() WHERE id = ${r.id}`);
    }
  }
  return { processed, failed };
}
