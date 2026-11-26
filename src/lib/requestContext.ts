import { AsyncLocalStorage } from "node:async_hooks";
export interface RequestContext {
  requestId: string;
  route: string;
  method: string;
  siteId: string | null;
}
export const requestContext = new AsyncLocalStorage<RequestContext>();
export function setRequestSite(siteId: string) {
  const ctx = requestContext.getStore();
  if (ctx) ctx.siteId = siteId;
}
export interface ApiErrorEvent extends RequestContext {
  status: number;
  event: "api.error";
}
export function safeApiEvent(ctx: RequestContext, status: number): ApiErrorEvent {
  return {
    event: "api.error",
    requestId: ctx.requestId,
    route: ctx.route,
    method: ctx.method,
    siteId: ctx.siteId,
    status,
  };
}
