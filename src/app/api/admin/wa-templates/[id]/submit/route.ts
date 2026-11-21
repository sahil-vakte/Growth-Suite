import { eq } from "drizzle-orm";
import { db } from "@/db";
import { waTemplates } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import { getSetting } from "@/lib/settings";
import { submitTemplate, templateProblems } from "@/lib/integrations/whatsapp";

export const POST = adminRoute<{ id: string }>("whatsapp_business", async (ctx, _req, p) => {
  const t = await siteRow(waTemplates, p.id, ctx.site.id, "Template");
  const comps = t.components as { header?: string; body?: string; footer?: string; buttons?: unknown[] };
  const problems = templateProblems({ name: t.name, components: comps });
  if (problems.length) throw new HttpError(422, problems.join(" "));
  const conn = await getSetting(ctx.site.id, "whatsapp.connection");
  const components = [
    ...(comps.header ? [{ type: "HEADER", format: "TEXT", text: comps.header }] : []),
    { type: "BODY", text: comps.body },
    ...(comps.footer ? [{ type: "FOOTER", text: comps.footer }] : []),
    ...(comps.buttons?.length ? [{ type: "BUTTONS", buttons: comps.buttons }] : []),
  ];
  const r = await submitTemplate(conn.wabaId, { name: t.name, language: t.language, category: t.category, components });
  const status = r.status?.toUpperCase() === "APPROVED" ? "approved" : r.status?.toUpperCase() === "REJECTED" ? "rejected" : "pending";
  await db.update(waTemplates).set({ status, metaId: r.id }).where(eq(waTemplates.id, t.id));
  return { ok: true, message: status === "approved" ? "Template approved." : "Submitted to Meta for review. This usually takes minutes to a few hours." };
});
