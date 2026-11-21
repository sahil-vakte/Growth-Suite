import { z } from "zod";
import { book } from "@/lib/services/appointments";
import { clientIp, noSite, pjson, rateLimited, siteFromRequest, tooMany } from "@/lib/public";

export async function POST(req: Request) {
  const site = await siteFromRequest(req); if (!site) return noSite();
  if (rateLimited(`book:${clientIp(req)}`, 10, 60_000)) return tooMany();
  const p = z.object({ serviceId: z.string(), staffId: z.string(), startsAt: z.string().datetime(), name: z.string().min(1).max(120), email: z.string().email().optional().or(z.literal("")), phone: z.string().max(30).optional(), visitorId: z.string().max(64).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return pjson({ error: "Please complete your name and a contact detail." }, 400);
  if (!p.data.email && !p.data.phone) return pjson({ error: "Please give a phone number or email." }, 422);
  try { const b = await book(site.id, { ...p.data, email: p.data.email || undefined }); return pjson({ ok: true, bookingId: b.id, startsAt: b.startsAt }); }
  catch (e) { return pjson({ error: e instanceof Error ? e.message : "Could not book" }, 409); }
}
