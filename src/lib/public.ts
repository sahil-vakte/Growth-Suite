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

/** Per-instance sliding-window limiter. Put a shared store (Redis) in front at multi-instance scale. */
const buckets = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 50_000)
    for (const [k, v] of buckets)
      if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  return arr.length > max;
}

export const pjson = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const tooMany = () => pjson({ error: "Too many requests. Please slow down." }, 429);
export const noSite = () => pjson({ error: "Unknown website." }, 404);
