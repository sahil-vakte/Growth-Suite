import { and, eq, gt, gte, lt, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointmentServices, bookings, staff } from "@/db/schema";
import { generateSlots } from "../engines/appointments";
import { getSetting } from "../settings";
import { addActivity, emitLeadEvent, upsertLead } from "./leads";
import { zonedParts } from "../engines/time";

export async function availableSlots(
  siteId: string,
  serviceId: string,
  fromDay?: string,
  days = 14,
) {
  const settings = await getSetting(siteId, "appointments.settings");
  const [service] = await db
    .select()
    .from(appointmentServices)
    .where(
      and(
        eq(appointmentServices.id, serviceId),
        eq(appointmentServices.siteId, siteId),
        eq(appointmentServices.active, true),
      ),
    )
    .limit(1);
  if (!service) throw new Error("Service not found");
  const team = await db
    .select()
    .from(staff)
    .where(and(eq(staff.siteId, siteId), eq(staff.active, true)));
  const from = fromDay ?? zonedParts(new Date(), settings.timezone).day;
  const windowEnd = new Date(Date.now() + (days + 1) * 86_400_000);
  const busy = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.siteId, siteId),
        ne(bookings.status, "cancelled"),
        gte(bookings.endsAt, new Date()),
        lte(bookings.startsAt, windowEnd),
      ),
    );
  return {
    service,
    timezone: settings.timezone,
    slots: generateSlots(settings, service, team, busy, from, Math.min(days, 60)),
  };
}

export async function book(
  siteId: string,
  input: {
    serviceId: string;
    staffId: string;
    startsAt: string;
    name: string;
    email?: string;
    phone?: string;
    visitorId?: string;
  },
) {
  return db
    .transaction(async (tx) => {
      const { slots, service } = await availableSlots(siteId, input.serviceId, undefined, 60);
      const start = new Date(input.startsAt);
      const slot = slots.find(
        (s) => s.staffId === input.staffId && s.startsAt.getTime() === start.getTime(),
      );
      if (!slot) throw new Error("That time is no longer available. Please choose another.");
      // Lock on the staff member to prevent double booking under concurrency
      const { sql } = await import("drizzle-orm");
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"booking:" + input.staffId}))`);
      const clash = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.staffId, input.staffId),
            ne(bookings.status, "cancelled"),
            lt(bookings.startsAt, slot.endsAt),
            gt(bookings.endsAt, slot.startsAt),
          ),
        )
        .limit(1);
      if (clash.length) throw new Error("That time has just been taken. Please choose another.");
      const [b] = await tx
        .insert(bookings)
        .values({
          siteId,
          serviceId: service.id,
          staffId: input.staffId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          name: input.name,
          email: input.email,
          phone: input.phone,
        })
        .returning();
      return b;
    })
    .then(async (b) => {
      if (input.phone || input.email) {
        const { lead } = await upsertLead(siteId, {
          name: input.name,
          email: input.email,
          phone: input.phone,
          source: "appointment",
          visitorId: input.visitorId,
        });
        await db.update(bookings).set({ leadId: lead.id }).where(eq(bookings.id, b.id));
        await addActivity(
          siteId,
          lead.id,
          "appointment",
          `Booked for ${b.startsAt.toISOString()}`,
          { bookingId: b.id },
        );
        await emitLeadEvent(siteId, lead, { type: "appointment_booked", value: b.serviceId });
      }
      return b;
    });
}
