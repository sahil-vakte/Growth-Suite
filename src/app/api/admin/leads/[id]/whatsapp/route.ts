import { z } from "zod";
import { db } from "@/db";
import { leads, waMessages } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import { getSetting } from "@/lib/settings";
import { sendText } from "@/lib/integrations/whatsapp";
import { sendTemplateToLead } from "@/lib/services/whatsapp";
import { addActivity } from "@/lib/services/leads";

/** Staff reply: a template at any time, or free text inside the 24-hour customer-service window. */
export const POST = adminRoute<{ id: string }>("crm", async (ctx, req, p) => {
  const lead = await siteRow(leads, p.id, ctx.site.id, "Lead");
  const b = z
    .object({ templateId: z.string().optional(), text: z.string().max(4096).optional() })
    .parse(await readJson(req));
  if (b.templateId) {
    await sendTemplateToLead(ctx.site.id, lead, b.templateId, { actor: ctx.actor });
    return { ok: true, message: "Template sent." };
  }
  if (!b.text) throw new HttpError(422, "Write a message or choose a template.");
  if (lead.optedOut) throw new HttpError(409, "This person replied STOP and cannot be messaged.");
  if (!lead.lastInboundAt || Date.now() - lead.lastInboundAt.getTime() > 24 * 3600_000)
    throw new HttpError(
      409,
      "Free text is only allowed within 24 hours of the customer's last message. Send an approved template instead.",
    );
  const conn = await getSetting(ctx.site.id, "whatsapp.connection");
  const r = await sendText(conn.phoneNumberId, lead.phone!, b.text);
  await db.insert(waMessages).values({
    siteId: ctx.site.id,
    leadId: lead.id,
    phone: lead.phone!,
    direction: "out",
    kind: "human",
    body: b.text,
    status: "sent",
    providerId: r.id,
  });
  await addActivity(
    ctx.site.id,
    lead.id,
    "whatsapp",
    b.text,
    { direction: "out", by: ctx.actor },
    ctx.actor,
  );
  return { ok: true, message: "Message sent." };
});
