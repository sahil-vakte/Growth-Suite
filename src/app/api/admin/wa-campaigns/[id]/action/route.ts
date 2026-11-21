import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { waCampaigns, waTemplates } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import { campaignAudience } from "@/lib/services/scheduler";
import { audit } from "@/lib/history";

export const POST = adminRoute<{ id: string }>("whatsapp_business", async (ctx, req, p) => {
  const { action } = z.object({ action: z.enum(["preview", "start", "pause", "cancel"]) }).parse(await readJson(req));
  const c = await siteRow(waCampaigns, p.id, ctx.site.id, "Campaign");
  if (action === "preview") {
    const aud = await campaignAudience(ctx.site.id, c.filters);
    return { ok: true, message: `${aud.length} people would receive this campaign (people who replied STOP are excluded).`, count: aud.length, sample: aud.slice(0, 10).map((l) => ({ name: l.name, phone: l.phone })) };
  }
  if (action === "start") {
    const [t] = await db.select().from(waTemplates).where(eq(waTemplates.id, c.templateId)).limit(1);
    if (t?.status !== "approved") throw new HttpError(409, "The template must be approved by Meta before you can send.");
  }
  const next = { start: "running", pause: "paused", cancel: "cancelled" }[action];
  await db.update(waCampaigns).set({ status: next, ...(action === "start" && !c.startedAt ? { startedAt: new Date() } : {}) }).where(eq(waCampaigns.id, c.id));
  await audit(ctx.site.id, ctx.actor, `wa-campaigns.${action}`, "wa-campaigns", c.id);
  return { ok: true, message: `Campaign ${next}.` };
});
