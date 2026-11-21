import { eq } from "drizzle-orm";
import { db } from "@/db";
import { forms, sectionTemplates, whatsappCtas, callCtas } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/current";
import { builtinLayouts } from "@/lib/layouts/registry";
import PageBuilder from "@/components/admin/PageBuilder";

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin("content");
  const sid = ctx.site.id;
  const [fl, tl, wl, cl] = await Promise.all([
    db.select({ id: forms.id, name: forms.name }).from(forms).where(eq(forms.siteId, sid)),
    db.select({ id: sectionTemplates.id, name: sectionTemplates.name, layoutKey: sectionTemplates.layoutKey }).from(sectionTemplates).where(eq(sectionTemplates.siteId, sid)),
    db.select().from(whatsappCtas).where(eq(whatsappCtas.siteId, sid)),
    db.select().from(callCtas).where(eq(callCtas.siteId, sid)),
  ]);
  return <PageBuilder pageId={(await params).id} layouts={builtinLayouts.map((l) => ({ key: l.key, name: l.name, category: l.category }))} templates={tl} forms={fl} waCtas={wl.map((w) => ({ id: w.id, name: w.name, message: w.message }))} callCtas={cl.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))} />;
}
