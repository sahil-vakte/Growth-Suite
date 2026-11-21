/** Appointment slot generation. Staff weekly hours are in the site's time zone; output slots are UTC. */
import { addDays, zonedParts, zonedToUtc } from "./time";

export interface SlotSettings { timezone: string; slotIntervalMinutes: number; leadTimeMinutes: number; bookingWindowDays: number }
export interface ServiceDef { durationMinutes: number; bufferMinutes: number }
export interface StaffDef { id: string; weeklyHours: Record<string, [string, string][]> }
export interface BusyRange { staffId: string; startsAt: Date; endsAt: Date }
export interface Slot { staffId: string; startsAt: Date; endsAt: Date }

export function generateSlots(settings: SlotSettings, service: ServiceDef, staffList: StaffDef[], busy: BusyRange[], from: string, days: number, now = new Date()): Slot[] {
  const earliest = now.getTime() + settings.leadTimeMinutes * 60000;
  const latest = now.getTime() + settings.bookingWindowDays * 86_400_000;
  const durMs = service.durationMinutes * 60000;
  const bufMs = service.bufferMinutes * 60000;
  const stepMs = Math.max(5, settings.slotIntervalMinutes) * 60000;
  const out: Slot[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    const weekday = zonedParts(zonedToUtc(day, "12:00", settings.timezone), settings.timezone).weekday;
    for (const s of staffList) {
      for (const [open, close] of s.weeklyHours[weekday] ?? []) {
        const openAt = zonedToUtc(day, open, settings.timezone).getTime();
        const closeAt = zonedToUtc(day, close, settings.timezone).getTime();
        for (let t = openAt; t + durMs <= closeAt; t += stepMs) {
          if (t < earliest || t > latest) continue;
          const end = t + durMs;
          const clash = busy.some((b) => b.staffId === s.id && t < b.endsAt.getTime() + bufMs && end + bufMs > b.startsAt.getTime());
          if (!clash) out.push({ staffId: s.id, startsAt: new Date(t), endsAt: new Date(end) });
        }
      }
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
