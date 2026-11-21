import { and, eq, gte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { conversionEvents, conversionSignals, leads, sites } from "@/db/schema";
import { getSetting } from "@/lib/settings";
import { buildOfflineCsv } from "@/lib/engines/googleAdsFile";
import { hashEmail, hashPhone } from "@/lib/engines/hashing";

/** Private CSV that Google Ads Data Manager fetches on a schedule (HTTPS with username/password). Last 90 days. */
export async function GET(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const cfg = await getSetting(siteId, "integrations.googleAdsOffline");
  if (cfg.mode !== "file" || !cfg.fileUser || !cfg.filePasswordHash)
    return new Response("Not found", { status: 404 });
  const [user, pass] = Buffer.from(
    (req.headers.get("authorization") ?? "").replace(/^Basic\s+/i, ""),
    "base64",
  )
    .toString()
    .split(":");
  if (user !== cfg.fileUser || !pass || !(await bcrypt.compare(pass, cfg.filePasswordHash)))
    return new Response("Unauthorised", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="conversions"' },
    });
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  const since = new Date(Date.now() - 90 * 86_400_000);
  const rows = await db
    .select({ ev: conversionEvents, sig: conversionSignals, lead: leads })
    .from(conversionEvents)
    .innerJoin(conversionSignals, eq(conversionSignals.id, conversionEvents.signalId))
    .innerJoin(leads, eq(leads.id, conversionEvents.leadId))
    .where(
      and(
        eq(conversionEvents.siteId, siteId),
        eq(conversionEvents.platform, "google_ads_file"),
        gte(conversionEvents.createdAt, since),
      ),
    );
  const csv = buildOfflineCsv(
    rows
      .filter((r) => r.lead.source !== "facebook_lead")
      .map((r) => {
        const a = r.lead.attribution as Record<string, string | undefined>;
        return {
          gclid: a.gclid,
          gbraid: a.gbraid,
          wbraid: a.wbraid,
          hashedEmail: hashEmail(r.lead.email, "google"),
          hashedPhone: hashPhone(r.lead.phone, "google"),
          conversionName: cfg.conversionNames[r.sig.eventName] ?? r.sig.eventName,
          at: r.ev.createdAt,
          valueMinor: r.sig.valueMinor,
          currency: r.sig.currency,
          orderId: r.ev.id,
        };
      }),
    cfg.timezone || site?.timezone || "UTC",
  );
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" },
  });
}
