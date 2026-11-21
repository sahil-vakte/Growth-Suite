import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { env } from "./env";

export type SiteRow = typeof sites.$inferSelect;
const cache = new Map<string, { site: SiteRow | null; at: number }>();

/** Resolve the tenant from the request host (public site). Falls back to DEFAULT_SITE_DOMAIN for local/self-host. */
export async function siteForHost(hostHeader: string | null | undefined): Promise<SiteRow | null> {
  const host =
    (hostHeader ?? "")
      .split(":")[0]
      .toLowerCase()
      .replace(/^www\./, "") || env.defaultSiteDomain;
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < 30_000) return hit.site;
  let [site] = await db
    .select()
    .from(sites)
    .where(or(eq(sites.domain, host), sql`${host} = ANY(${sites.aliases})`))
    .limit(1);
  // Unknown hosts get no site (multi-tenant). Local development and SINGLE_SITE_MODE fall back to DEFAULT_SITE_DOMAIN.
  const local = host === "localhost" || host === "127.0.0.1";
  if (!site && host !== env.defaultSiteDomain && (local || process.env.SINGLE_SITE_MODE === "true"))
    [site] = await db.select().from(sites).where(eq(sites.domain, env.defaultSiteDomain)).limit(1);
  cache.set(host, { site: site ?? null, at: Date.now() });
  return site ?? null;
}

export function clearSiteCache() {
  cache.clear();
}
