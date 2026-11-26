import * as Sentry from "@sentry/node";
import { recordMock } from "./http";
import type { ApiErrorEvent } from "../requestContext";
let configured = false;
export async function reportApiError(event: ApiErrorEvent) {
  if (!process.env.SENTRY_DSN || process.env.INTEGRATIONS_MODE === "mock") {
    recordMock("sentry", "api.error", event);
    return;
  }
  try {
    if (!configured) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        defaultIntegrations: false,
        enableRuntimeChannelInjection: false,
        beforeSend: (event) => ({
          type: event.type,
          event_id: event.event_id,
          timestamp: event.timestamp,
          level: "error",
          message: "API request failed",
          tags: Object.fromEntries(
            ["requestId", "route", "method", "siteId", "status"].map((key) => [
              key,
              event.tags?.[key],
            ]),
          ),
        }),
        tracesSampleRate: 0,
        maxBreadcrumbs: 0,
      });
      configured = true;
    }
    // No exception text, stack, request URL, cookies, headers or user context is sent.
    Sentry.captureEvent({
      message: "API request failed",
      level: "error",
      tags: {
        requestId: event.requestId,
        route: event.route,
        method: event.method,
        siteId: event.siteId ?? "unresolved",
        status: String(event.status),
      },
    });
    await Sentry.flush(1000);
  } catch {
    /* Monitoring must never change the application's response. */
  }
}
