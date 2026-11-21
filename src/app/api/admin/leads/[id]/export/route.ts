import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { leadActivities, leads, submissions, waMessages } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { siteRow } from "@/lib/admin/rows";

/** Subject access request: everything held about one lead, as JSON. */
export const GET = adminRoute<{ id: string }>("crm", async (ctx, _req, p) => {
  const lead = await siteRow(leads, p.id, ctx.site.id, "Lead");
  const data = { lead, activities: await db.select().from(leadActivities).where(eq(leadActivities.leadId, lead.id)), submissions: await db.select().from(submissions).where(and(eq(submissions.siteId, ctx.site.id), eq(submissions.leadId, lead.id))), whatsapp: await db.select().from(waMessages).where(eq(waMessages.leadId, lead.id)) };
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="lead-${lead.id}.json"` } });
});
