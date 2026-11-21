import { z } from "zod";
import { startCheckout } from "@/lib/services/shop";
import { clientIp, noSite, pjson, rateLimited, siteFromRequest, tooMany } from "@/lib/public";

export async function POST(req: Request) {
  const site = await siteFromRequest(req);
  if (!site) return noSite();
  if (rateLimited(`checkout:${clientIp(req)}`, 10, 60_000)) return tooMany();
  const p = z
    .object({
      items: z
        .array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(99) }))
        .min(1)
        .max(50),
      name: z.string().min(1).max(120),
      email: z.string().email().optional(),
      phone: z.string().max(30).optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return pjson({ error: "Please check your basket and details." }, 400);
  try {
    const r = await startCheckout(site.id, site.domain, p.data);
    return pjson({
      ok: true,
      order: r.order.number,
      provider: r.checkout.provider,
      redirectUrl: r.checkout.redirectUrl,
      clientData: r.checkout.clientData,
    });
  } catch (e) {
    return pjson({ error: e instanceof Error ? e.message : "Checkout failed" }, 409);
  }
}
