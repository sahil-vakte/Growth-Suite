import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { waMessages } from "@/db/schema";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { handleInbound } from "@/lib/services/whatsapp";
import { eq } from "drizzle-orm";

/** Meta webhook verification (GET) */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && env.whatsapp.verifyToken && u.searchParams.get("hub.verify_token") === env.whatsapp.verifyToken)
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

/** Inbound messages & status updates. Routed to the site whose saved phone number id matches. */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  if (env.whatsapp.appSecret) {
    const expected = "sha256=" + createHmac("sha256", env.whatsapp.appSecret).update(raw).digest("hex");
    if (!safeEqual(expected, sig)) return new Response("Bad signature", { status: 401 });
  } else if (env.nodeEnv === "production" && !env.forceMock) return new Response("META_APP_SECRET not configured", { status: 503 });
  const body = JSON.parse(raw || "{}");
  for (const entry of body.entry ?? []) for (const change of entry.changes ?? []) {
    const v = change.value ?? {};
    const phoneNumberId = v.metadata?.phone_number_id;
    const r = await db.execute(sql`select site_id from settings where key = 'whatsapp.connection' and value->>'phoneNumberId' = ${phoneNumberId} limit 1`);
    const siteId = (r.rows[0] as { site_id?: string } | undefined)?.site_id;
    if (!siteId) continue;
    for (const st of v.statuses ?? []) await db.update(waMessages).set({ status: st.status === "failed" ? "failed" : st.status, error: st.errors?.[0]?.title }).where(eq(waMessages.providerId, st.id));
    for (const m of v.messages ?? []) {
      const name = v.contacts?.find((c: { wa_id: string }) => c.wa_id === m.from)?.profile?.name;
      const text = m.type === "text" ? m.text?.body : m.type === "button" ? m.button?.text : m.type === "interactive" ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title) : null;
      await handleInbound(siteId, { from: m.from, name, text: text ?? null, isMedia: !text, providerId: m.id });
    }
  }
  return new Response("OK");
}
