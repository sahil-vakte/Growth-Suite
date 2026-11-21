import { afterEach, expect, it, vi } from "vitest";
const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureEvent: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
}));
vi.mock("@sentry/node", () => sentry);
import { reportApiError } from "../src/lib/integrations/errorTracking";
import { mockLog } from "../src/lib/integrations/http";
const event = {
  event: "api.error" as const,
  requestId: "test-request",
  route: "/api/example/[id]",
  method: "POST",
  siteId: "site-a",
  status: 500,
};
afterEach(() => {
  vi.unstubAllEnvs();
});
it("records mock metadata without contacting Sentry", async () => {
  vi.stubEnv("INTEGRATIONS_MODE", "mock");
  vi.stubEnv("SENTRY_DSN", "https://example@example.test/1");
  await reportApiError(event);
  expect(sentry.captureEvent).not.toHaveBeenCalled();
  expect(mockLog[0]).toMatchObject({ provider: "sentry", payload: event });
});
it("strips SDK-added user, request, breadcrumb and exception data before sending", async () => {
  vi.stubEnv("INTEGRATIONS_MODE", "auto");
  vi.stubEnv("SENTRY_DSN", "https://example@example.test/1");
  await reportApiError(event);
  const options = sentry.init.mock.calls[0][0];
  expect(options.defaultIntegrations).toBe(false);
  const sanitised = options.beforeSend({
    type: "error",
    message: "secret",
    user: { email: "private@example.test" },
    request: { headers: { authorization: "secret" } },
    breadcrumbs: [{ message: "private" }],
    tags: { ...event, arbitrary: "private" },
  });
  expect(Object.keys(sanitised).sort()).toEqual([
    "event_id",
    "level",
    "message",
    "tags",
    "timestamp",
    "type",
  ]);
  expect(JSON.stringify(sanitised)).not.toMatch(/secret|private|arbitrary/);
  expect(sentry.flush).toHaveBeenCalledWith(1000);
});
