/** Long-running background worker: runs the scheduler tick every minute (automations, campaigns, social posts, segments, jobs). */
import { tick } from "../src/lib/jobs";

const INTERVAL = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);
let stopping = false;
process.on("SIGTERM", () => { stopping = true; }); process.on("SIGINT", () => { stopping = true; });

async function loop() {
  while (!stopping) {
    try { const r = await tick(); if (r.automations.sent || r.jobs.processed || r.jobs.failed) console.log(new Date().toISOString(), JSON.stringify(r)); }
    catch (e) { console.error("tick failed", e); }
    await new Promise((r) => setTimeout(r, INTERVAL));
  }
  process.exit(0);
}
loop();
