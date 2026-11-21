import { availableSlots } from "@/lib/services/appointments";
import { noSite, pjson, siteFromRequest } from "@/lib/public";

export async function GET(req: Request) {
  const site = await siteFromRequest(req);
  if (!site) return noSite();
  const u = new URL(req.url);
  const serviceId = u.searchParams.get("serviceId");
  if (!serviceId) return pjson({ error: "serviceId is required" }, 400);
  const from = u.searchParams.get("from") ?? undefined;
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from))
    return pjson({ error: "from must be YYYY-MM-DD" }, 400);
  try {
    const r = await availableSlots(
      site.id,
      serviceId,
      from,
      Number(u.searchParams.get("days") ?? 14),
    );
    return pjson({ timezone: r.timezone, slots: r.slots });
  } catch (e) {
    return pjson({ error: e instanceof Error ? e.message : "Unavailable" }, 404);
  }
}
