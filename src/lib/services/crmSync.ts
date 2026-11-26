/**
 * Avrix CRM hub connector: every lead created or moved here is also sent to the shared CRM
 * (avrix-marketing → POST /api/intake/leads and /api/intake/status), through the job queue with retries.
 *
 * Environment (see .env.example):
 *   AVRIX_CRM_URL, AVRIX_CRM_KEY, AVRIX_CRM_SECRET  — default key (CRM application "growth-suite")
 *   AVRIX_CRM_SITE_KEYS  — optional JSON: {"client-domain.com": {"key": "...", "secret": "..."}} to send a
 *                          site's leads to its own CRM application instead
 *   AVRIX_CRM_SITES      — optional comma-separated list of site domains to sync; blank = every site
 */
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leadStages, leads, sites } from "@/db/schema";
import { enqueue, registerHandler } from "../queue";

type Creds = { key: string; secret: string };
const url = () => (process.env.AVRIX_CRM_URL ?? "").replace(/\/$/, "");

function siteKeys(): Record<string, Creds> {
  try {
    return JSON.parse(process.env.AVRIX_CRM_SITE_KEYS || "{}");
  } catch {
    return {};
  }
}

export function credsFor(site: { id: string; domain: string }): Creds | null {
  if (!url()) return null;
  const only = (process.env.AVRIX_CRM_SITES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (only.length && !only.includes(site.domain.toLowerCase())) return null;
  const own = siteKeys()[site.domain] ?? siteKeys()[site.id];
  if (own?.key && own?.secret) return own;
  const key = process.env.AVRIX_CRM_KEY,
    secret = process.env.AVRIX_CRM_SECRET;
  return key && secret ? { key, secret } : null;
}

export const crmEnabled = () =>
  !!url() && (!!process.env.AVRIX_CRM_KEY || process.env.AVRIX_CRM_SITE_KEYS);

/** Queue a sync. Called after a lead is created or merged, and after a stage change. */
export async function queueCrmSync(
  siteId: string,
  leadId: string,
  kind: "lead" | "stage" = "lead",
) {
  if (!crmEnabled()) return;
  await enqueue(
    "crm.sync",
    { leadId, kind },
    {
      siteId,
      idempotency:
        kind === "lead" ? `crm:${leadId}:${Date.now() - (Date.now() % 60_000)}` : undefined,
    },
  );
}

async function post(path: string, creds: Creds, payload: unknown, idempotencyKey?: string) {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac("sha256", creds.secret).update(`${ts}.${body}`).digest("hex");
  const res = await fetch(`${url()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${creds.key}`,
      "x-avrix-timestamp": ts,
      "x-avrix-signature": `sha256=${sig}`,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`CRM responded ${res.status}`);
}

registerHandler("crm.sync", async (p, job) => {
  const leadId = String(p.leadId);
  const [row] = await db
    .select({ lead: leads, site: sites, stage: leadStages })
    .from(leads)
    .innerJoin(sites, eq(sites.id, leads.siteId))
    .leftJoin(leadStages, eq(leadStages.id, leads.stageId))
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!row || row.lead.siteId !== job.siteId) return;
  const creds = credsFor(row.site);
  if (!creds) return;
  const { lead, site, stage } = row;
  if (p.kind === "stage") {
    await post("/api/intake/status", creds, { externalId: lead.id, stage: stage?.name ?? null });
    return;
  }
  const cf = (lead.customFields ?? {}) as Record<string, unknown>;
  await post(
    "/api/intake/leads",
    creds,
    {
      externalId: lead.id,
      externalUrl: `https://${site.domain}/admin/crm/${lead.id}`,
      name: lead.name ?? undefined,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      businessName:
        typeof cf.company === "string"
          ? cf.company
          : typeof cf.business === "string"
            ? cf.business
            : undefined,
      message: typeof cf.message === "string" ? cf.message : undefined,
      source:
        lead.source === "facebook" || lead.source === "facebook_lead_ads"
          ? "FACEBOOK_LEAD_AD"
          : lead.source === "whatsapp"
            ? "WHATSAPP"
            : lead.source === "chatbot"
              ? "CHATBOT"
              : "WEBSITE_FORM",
      stage: stage?.name ?? undefined,
      attribution: Object.fromEntries(
        Object.entries(lead.attribution ?? {}).filter(([, v]) =>
          ["string", "number", "boolean"].includes(typeof v),
        ),
      ),
      customFields: {
        ...cf,
        site: site.domain,
        siteName: site.name,
        score: lead.score,
        waVerified: lead.waVerified,
        growthSuiteSource: lead.source,
      },
      consent: { marketing: (lead.consent as Record<string, unknown>)?.marketing === true },
      occurredAt: lead.createdAt.toISOString(),
    },
    `gs-${lead.id}-${lead.updatedAt.getTime()}`,
  );
});
