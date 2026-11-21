import { unstable_rethrow } from "next/navigation";
import pino from "pino";
import { randomUUID } from "node:crypto";
import { requestContext, safeApiEvent, type RequestContext } from "./requestContext";
import { reportApiError } from "./integrations/errorTracking";
const logger = pino({ base: undefined, level: "info" });

/** Route templates are supplied by source code, never derived from visitor URLs. */
export function withApiLog<Args extends unknown[]>(
  route: string,
  method: string,
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    const context: RequestContext = { requestId: randomUUID(), route, method, siteId: null };
    return requestContext.run(context, async () => {
      let response: Response;
      try {
        response = await handler(...args);
      } catch (error) {
        unstable_rethrow(error);
        response = Response.json(
          { error: "Something went wrong. Please try again." },
          { status: 500 },
        );
      }
      if (response.status >= 400) {
        const event = safeApiEvent(context, response.status);
        if (response.status >= 500) {
          logger.error(event, "API request failed");
          await reportApiError(event);
        } else logger.warn(event, "API request rejected");
      }
      const headers = new Headers(response.headers);
      headers.set("X-Request-ID", context.requestId);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    });
  };
}
