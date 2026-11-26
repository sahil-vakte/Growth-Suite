import { withApiLog } from "@/lib/apiLogging";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  analyticsEvents,
  bookings,
  leadActivities,
  leads,
  leadStages,
  memberships,
  submissions,
  waMessages,
  conversionEvents,
} from "@/db/schema";
import { HttpError } from "@/lib/auth/current";
import { adminRoute, readJson } from "@/lib/api";
import { siteRow } from "@/lib/admin/rows";
import { changeStage, addActivity } from "@/lib/services/leads";
import { normaliseEmail } from "@/lib/engines/phone";
import { audit } from "@/lib/history";

export const GET = withApiLog(
  "/api/admin/leads/[id]",
  "GET",
  adminRoute<{ id: string }>("crm", async (ctx, _req, p) => {
    const lead = await siteRow(leads, p.id, ctx.site.id, "Lead");
    const [timeline, subs, msgs, journey, stages, books, conversions] = await Promise.all([
      db
        .select()
        .from(leadActivities)
        .where(eq(leadActivities.leadId, lead.id))
        .orderBy(desc(leadActivities.createdAt))
        .limit(200),
      db
        .select()
        .from(submissions)
        .where(and(eq(submissions.siteId, ctx.site.id), eq(submissions.leadId, lead.id)))
        .orderBy(desc(submissions.createdAt)),
      db
        .select()
        .from(waMessages)
        .where(and(eq(waMessages.siteId, ctx.site.id), eq(waMessages.leadId, lead.id)))
        .orderBy(desc(waMessages.createdAt))
        .limit(100),
      lead.visitorId
        ? db
            .select()
            .from(analyticsEvents)
            .where(
              and(
                eq(analyticsEvents.siteId, ctx.site.id),
                eq(analyticsEvents.visitorId, lead.visitorId),
              ),
            )
            .orderBy(desc(analyticsEvents.createdAt))
            .limit(100)
        : Promise.resolve([]),
      db
        .select()
        .from(leadStages)
        .where(eq(leadStages.siteId, ctx.site.id))
        .orderBy(leadStages.position),
      db
        .select()
        .from(bookings)
        .where(and(eq(bookings.siteId, ctx.site.id), eq(bookings.leadId, lead.id))),
      db.select().from(conversionEvents).where(eq(conversionEvents.leadId, lead.id)),
    ]);
    return {
      lead,
      timeline,
      submissions: subs,
      messages: msgs,
      journey,
      stages,
      bookings: books,
      conversions,
    };
  }),
);

export const PATCH = withApiLog(
  "/api/admin/leads/[id]",
  "PATCH",
  adminRoute<{ id: string }>("crm", async (ctx, req, p) => {
    const lead = await siteRow(leads, p.id, ctx.site.id, "Lead");
    const b = z
      .object({
        stageId: z.string().optional(),
        name: z.string().max(120).optional(),
        email: z.string().max(200).optional(),
        ownerId: z.string().nullable().optional(),
        optedOut: z.boolean().optional(),
      })
      .parse(await readJson(req));
    if (b.stageId && b.stageId !== lead.stageId)
      await changeStage(ctx.site.id, lead.id, b.stageId, ctx.actor);
    const patch: Record<string, unknown> = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.email !== undefined) patch.email = b.email ? normaliseEmail(b.email) : null;
    if (b.ownerId) {
      const [m] = await db
        .select()
        .from(memberships)
        .where(and(eq(memberships.siteId, ctx.site.id), eq(memberships.userId, b.ownerId)))
        .limit(1);
      if (!m) throw new HttpError(422, "That person is not a member of this site.");
    }
    if (b.ownerId !== undefined) {
      patch.ownerId = b.ownerId;
      await addActivity(
        ctx.site.id,
        lead.id,
        "system",
        b.ownerId ? "Lead assigned" : "Lead unassigned",
        { ownerId: b.ownerId },
        ctx.actor,
      );
    }
    if (b.optedOut !== undefined) patch.optedOut = b.optedOut;
    if (Object.keys(patch).length) await db.update(leads).set(patch).where(eq(leads.id, lead.id));
    return { ok: true };
  }),
);

/** Right to erasure: removes the lead, its timeline, messages and submissions. */
export const DELETE = withApiLog(
  "/api/admin/leads/[id]",
  "DELETE",
  adminRoute<{ id: string }>("crm", async (ctx, _req, p) => {
    const lead = await siteRow(leads, p.id, ctx.site.id, "Lead");
    if (ctx.member.role !== "admin" && !ctx.member.isPlatformAdmin)
      throw new Error("Only admins can erase a lead.");
    await db.transaction(async (tx) => {
      await tx
        .delete(waMessages)
        .where(
          and(
            eq(waMessages.siteId, ctx.site.id),
            or(
              eq(waMessages.leadId, lead.id),
              lead.phone ? eq(waMessages.phone, lead.phone) : undefined,
            ),
          ),
        );
      await tx
        .delete(submissions)
        .where(and(eq(submissions.siteId, ctx.site.id), eq(submissions.leadId, lead.id)));
      await tx.delete(conversionEvents).where(eq(conversionEvents.leadId, lead.id));
      await tx.delete(leads).where(eq(leads.id, lead.id));
    });
    await audit(ctx.site.id, ctx.actor, "leads.erase", "leads", lead.id);
    return { ok: true, message: "Lead and personal data erased." };
  }),
);
