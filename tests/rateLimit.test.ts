import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { MemoryRateLimiter } from "../src/lib/engines/rateLimit";
const exec = promisify(execFile);
describe("sliding window rate limiting", () => {
  it("permits exactly the quota, and rejected hits do not extend the window", () => {
    const limiter = new MemoryRateLimiter();
    expect(limiter.limited("one", 2, 1000, 100)).toBe(false);
    expect(limiter.limited("one", 2, 1000, 200)).toBe(false);
    expect(limiter.limited("one", 2, 1000, 500)).toBe(true);
    expect(limiter.limited("one", 2, 1000, 1099)).toBe(true);
    expect(limiter.limited("one", 2, 1000, 1100)).toBe(false);
  });
  it("keeps keys separate and resets only the selected key", () => {
    const limiter = new MemoryRateLimiter();
    expect(limiter.limited("a", 1, 1000, 100)).toBe(false);
    expect(limiter.limited("b", 1, 1000, 100)).toBe(false);
    limiter.reset("a");
    expect(limiter.limited("a", 1, 1000, 101)).toBe(false);
    expect(limiter.limited("b", 1, 1000, 101)).toBe(true);
  });
  it("bounds storage without evicting active limits", () => {
    const limiter = new MemoryRateLimiter(1);
    expect(limiter.limited("a", 1, 1000, 100)).toBe(false);
    expect(limiter.limited("b", 1, 1000, 101)).toBe(true);
    expect(limiter.limited("b", 1, 1000, 1100)).toBe(false);
  });
  it.skipIf(!process.env.REDIS_URL)(
    "holds one quota across two Node processes using real Redis",
    async () => {
      const key = `test:${randomUUID()}`;
      const results = await Promise.all(
        [0, 1].map(() =>
          exec(process.execPath, ["--import", "tsx", "tests/fixtures/rate-process.ts", key], {
            env: process.env,
            timeout: 20_000,
          }),
        ),
      );
      expect(results.reduce((sum, r) => sum + JSON.parse(r.stdout).allowed, 0)).toBe(8);
    },
    30_000,
  );
});
