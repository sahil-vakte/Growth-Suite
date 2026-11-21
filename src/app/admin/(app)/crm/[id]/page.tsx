import LeadDetail from "@/components/admin/LeadDetail";
import { requireAdmin } from "@/lib/auth/current";
import { db } from "@/db";
import { replyTemplates, waTemplates } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin("crm");
  const [tpls, replies] = await Promise.all([db.select({ id: waTemplates.id, name: waTemplates.name }).from(waTemplates).where(and(eq(waTemplates.siteId, ctx.site.id), eq(waTemplates.status, "approved"))), db.select().from(replyTemplates).where(eq(replyTemplates.siteId, ctx.site.id))]);
  return <LeadDetail id={(await params).id} waTemplates={tpls} replyTemplates={replies.map((r) => ({ name: r.name, body: r.body }))} isAdmin={ctx.member.role === "admin" || !!ctx.member.isPlatformAdmin} />;
}
