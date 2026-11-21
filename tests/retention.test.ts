import { expect, it } from "vitest";
import { retentionCutoff, retentionMonths } from "../src/lib/engines/retention";
it("retains complete UTC months across leap years and month ends", () => {
  expect(retentionCutoff(1, new Date("2024-03-31T23:59:59Z"))?.toISOString()).toBe(
    "2024-02-01T00:00:00.000Z",
  );
  expect(retentionCutoff(12, new Date("2026-01-01T00:00:00Z"))?.toISOString()).toBe(
    "2025-01-01T00:00:00.000Z",
  );
});
it("supports explicit disable and rejects invalid destructive policies", () => {
  expect(retentionMonths(undefined)).toBe(12);
  expect(retentionCutoff(retentionMonths("0"))).toBeNull();
  for (const value of ["-1", "1.5", "NaN", "121"]) expect(() => retentionMonths(value)).toThrow();
});
