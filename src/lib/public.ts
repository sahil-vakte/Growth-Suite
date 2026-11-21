/** Helpers for public (visitor-facing) endpoints. */
import { NextResponse } from "next/server";
import { siteForHost, type SiteRow } from "./tenant";

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    req.headers.get("x-real-ip") ??
    "0.0.0.0"
  ).trim();
}

export async function siteFromRequest(req: Request): Promise<SiteRow | null> {
  const s = await siteForHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  return s && s.status === "active" ? s : null;
}

export { rateLimited } from "./integrations/rateLimit";

export const pjson = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const tooMany = () => pjson({ error: "Too many requests. Please slow down." }, 429);
export const noSite = () => pjson({ error: "Unknown website." }, 404);
