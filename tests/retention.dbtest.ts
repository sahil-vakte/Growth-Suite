import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db, pool } from "../src/db";
import { analyticsEvents, sites } from "../src/db/schema";
import { pruneAnalytics } from "../src/lib/services/analyticsRetention";
afterAll(async () => {
  await pool.end();
});
it("prunes only expired rows for the requested tenant and is retry-safe", async () => {
  const a = randomUUID(),
    b = randomUUID();
  const old = randomUUID(),
    recent = randomUUID(),
    other = randomUUID();
  try {
    await db.insert(sites).values([
      { id: a, name: "Retention test A", domain: `${a}.test` },
      { id: b, name: "Retention test B", domain: `${b}.test` },
    ]);
    await db.insert(analyticsEvents).values([
      {
        id: old,
        siteId: a,
        visitorId: "test",
        name: "page_view",
        createdAt: new Date("2020-01-01Z"),
      },
      {
        id: recent,
        siteId: a,
        visitorId: "test",
        name: "page_view",
        createdAt: new Date("2026-11-01Z"),
      },
      {
        id: other,
        siteId: b,
        visitorId: "test",
        name: "page_view",
        createdAt: new Date("2020-01-01Z"),
      },
    ]);
    const now = new Date("2026-11-21T12:00:00Z");
    expect(await pruneAnalytics(a, 0, now)).toBe(0);
    expect(await pruneAnalytics(a, 12, now)).toBe(1);
    expect(await pruneAnalytics(a, 12, now)).toBe(0);
    const remaining = await db
      .select({ id: analyticsEvents.id })
      .from(analyticsEvents)
      .where(inArray(analyticsEvents.id, [old, recent, other]));
    expect(remaining.map((r) => r.id).sort()).toEqual([recent, other].sort());
  } finally {
    await db.delete(analyticsEvents).where(inArray(analyticsEvents.siteId, [a, b]));
    await db.delete(sites).where(inArray(sites.id, [a, b]));
  }
});
