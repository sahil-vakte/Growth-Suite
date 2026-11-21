import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/lib/env";
import { safeEqual, decrypt } from "@/lib/crypto";
import { fetchFacebookLead } from "@/lib/integrations/adPlatforms";
import { addActivity, upsertLead } from "@/lib/services/leads";

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (
    u.searchParams.get("hub.mode") === "subscribe" &&
    env.meta.leadsVerifyToken &&
    u.searchParams.get("hub.verify_token") === env.meta.leadsVerifyToken
  )
    return new Response(u.searchParams.get("hub.challenge") ?? "");
  return new Response("Forbidden", { status: 403 });
}

/** Facebook / Instagram lead ads → CRM leads (source facebook_lead). */
export async function POST(req: Request) {
  const raw = await req.text();
  if (env.meta.appSecret) {
    const expected = "sha256=" + createHmac("sha256", env.meta.appSecret).update(raw).digest("hex");
    if (!safeEqual(expected, req.headers.get("x-hub-signature-256") ?? ""))
      return new Response("Bad signature", { status: 401 });
  } else if (env.nodeEnv === "production" && !env.forceMock)
    return new Response("META_APP_SECRET not configured", { status: 503 });
  const body = JSON.parse(raw || "{}");
  for (const entry of body.entry ?? [])
    for (const ch of entry.changes ?? []) {
      if (ch.field !== "leadgen") continue;
      const { page_id, leadgen_id, form_id } = ch.value ?? {};
      const r = await db.execute(
        sql`select site_id, value from settings where key = 'integrations.facebookLeads' and value->>'pageId' = ${String(page_id)} limit 1`,
      );
      const row = r.rows[0] as
        | { site_id: string; value: { pageTokenEnc?: string; formMap?: Record<string, string> } }
        | undefined;
      if (!row) continue;
      const lead = await fetchFacebookLead(
        leadgen_id,
        row.value.pageTokenEnc ? decrypt(row.value.pageTokenEnc) : "",
      );
      const f = Object.fromEntries(lead.field_data.map((d) => [d.name, d.values[0]]));
      const { lead: l } = await upsertLead(row.site_id, {
        name: f.full_name ?? [f.first_name, f.last_name].filter(Boolean).join(" "),
        email: f.email,
        phone: f.phone_number,
        source: "facebook_lead",
        customFields: {
          ...f,
          leadgen_id,
          fb_form_id: form_id,
          mapped_form: row.value.formMap?.[form_id],
        },
      });
      await addActivity(row.site_id, l.id, "submission", "Facebook lead form", {
        leadgen_id,
        form_id,
      });
    }
  return new Response("OK");
}
