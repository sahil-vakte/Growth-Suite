/** Conversion signals → Meta CAPI / GA4 / Google Ads offline file. Once per lead per signal; queued with retries. */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversionEvents, conversionSignals, leads, visitors } from "@/db/schema";
import { hashEmail, hashName, hashPhone, sha256 } from "../engines/hashing";
import { enqueue, registerHandler } from "../queue";
import { getSetting } from "../settings";
import { sendGa4Event, sendMetaEvent } from "../integrations/adPlatforms";
import { decrypt } from "../crypto";

type Signal = typeof conversionSignals.$inferSelect;
type Lead = typeof leads.$inferSelect;

export async function queueConversion(signal: Signal, lead: Lead) {
  const [ev] = await db
    .insert(conversionEvents)
    .values({
      siteId: lead.siteId,
      signalId: signal.id,
      leadId: lead.id,
      platform: signal.platform,
      payload: {
        eventName: signal.eventName,
        valueMinor: signal.valueMinor,
        currency: signal.currency,
        at: new Date().toISOString(),
      },
    })
    .onConflictDoNothing()
    .returning();
  if (!ev) return null; // already sent for this lead + rule
  if (signal.platform !== "google_ads_file")
    await enqueue(
      "conversion.send",
      { eventId: ev.id },
      { siteId: lead.siteId, idempotency: `conv:${ev.id}` },
    );
  return ev.id;
}

/** Fill identity gaps from the lead's own visitor record (our first-party cookie). */
async function identityFor(lead: Lead) {
  const a = lead.attribution as Record<string, string | undefined>;
  let ids: Record<string, string | undefined> = {};
  if (lead.visitorId) {
    const [v] = await db.select().from(visitors).where(eq(visitors.id, lead.visitorId)).limit(1);
    ids = (v?.ids as Record<string, string | undefined>) ?? {};
  }
  return {
    fbp: a.fbp ?? ids.fbp,
    fbc:
      a.fbc ??
      ids.fbc ??
      (a.fbclid
        ? `fb.1.${Date.parse(String(a.firstTouchAt ?? new Date())) || Date.now()}.${a.fbclid}`
        : undefined),
    gaClientId: a.gaClientId ?? ids.gaClientId,
    gaSessionId: a.gaSessionId ?? ids.gaSessionId,
    gclid: a.gclid ?? ids.gclid,
  };
}

registerHandler("conversion.send", async (payload) => {
  const [ev] = await db
    .select()
    .from(conversionEvents)
    .where(eq(conversionEvents.id, String(payload.eventId)))
    .limit(1);
  if (!ev || ev.status === "sent") return;
  const [lead] = await db.select().from(leads).where(eq(leads.id, ev.leadId)).limit(1);
  const [signal] = await db
    .select()
    .from(conversionSignals)
    .where(eq(conversionSignals.id, ev.signalId))
    .limit(1);
  if (!lead || !signal) {
    await db
      .update(conversionEvents)
      .set({ status: "skipped", response: "lead or rule removed" })
      .where(eq(conversionEvents.id, ev.id));
    return;
  }
  const idn = await identityFor(lead);
  let response: unknown;
  if (signal.platform === "meta") {
    const meta = await getSetting(lead.siteId, "integrations.meta");
    const token = meta.capiTokenEnc ? decrypt(meta.capiTokenEnc) : "";
    response = await sendMetaEvent({
      pixelId: meta.pixelId,
      token,
      testEventCode: meta.mode === "test" ? meta.testEventCode : undefined,
      eventName: signal.eventName,
      eventId: `crm_${ev.id}`,
      eventTime: Math.floor(Date.now() / 1000),
      actionSource: "system_generated",
      userData: {
        em: hashEmail(lead.email, "meta"),
        ph: hashPhone(lead.phone, "meta"),
        ...hashName(lead.name),
        fbp: idn.fbp,
        fbc: idn.fbc,
        external_id: lead.visitorId ? sha256(lead.visitorId) : undefined,
        lead_id:
          lead.source === "facebook_lead"
            ? String((lead.customFields as Record<string, unknown>).leadgen_id ?? "") || undefined
            : undefined,
      },
      customData: { value: signal.valueMinor / 100, currency: signal.currency, lead_id: lead.id },
    });
  } else if (signal.platform === "google") {
    const ga = await getSetting(lead.siteId, "integrations.ga4");
    if (!idn.gaClientId) {
      await db
        .update(conversionEvents)
        .set({ status: "skipped", response: "no Google Analytics client id for this lead" })
        .where(eq(conversionEvents.id, ev.id));
      return;
    }
    response = await sendGa4Event({
      measurementId: ga.measurementId,
      apiSecret: ga.apiSecretEnc ? decrypt(ga.apiSecretEnc) : "",
      clientId: idn.gaClientId,
      sessionId: idn.gaSessionId,
      userData: {
        sha256_email_address: hashEmail(lead.email, "google"),
        sha256_phone_number: hashPhone(lead.phone, "google"),
      },
      name: signal.eventName,
      params: { value: signal.valueMinor / 100, currency: signal.currency, lead_id: lead.id },
    });
  }
  await db
    .update(conversionEvents)
    .set({ status: "sent", response: JSON.stringify(response ?? {}).slice(0, 2000) })
    .where(and(eq(conversionEvents.id, ev.id)));
});
