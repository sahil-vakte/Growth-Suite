import { z } from "zod";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { adjustCredits, balance } from "@/lib/services/credits";
import { availableProviders } from "@/lib/integrations/ai";
import { createCheckout } from "@/lib/integrations/payments";
import { env } from "@/lib/env";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { CREDITS_PRODUCT } from "@/lib/services/shop";

export const GET = adminRoute("ai", async (ctx) => ({
  balanceMinor: await balance(ctx.site.id),
  currency: ctx.site.currency,
  providers: availableProviders(),
}));

/** Buy credits. Mock payment mode adds credits immediately (development only). */
export const POST = adminRoute("ai", async (ctx, req) => {
  if (ctx.member.role !== "admin" && !ctx.member.isPlatformAdmin)
    throw new HttpError(403, "Only admins can buy credits.");
  const { amountMinor } = z
    .object({ amountMinor: z.number().int().min(100).max(10_000_000) })
    .parse(await readJson(req));
  const reference = `CR-${Date.now().toString(36).toUpperCase()}`;
  const checkout = await createCheckout({
    amountMinor,
    currency: ctx.site.currency,
    reference,
    customer: { name: ctx.user.name, email: ctx.user.email },
    successUrl: `${env.appUrl}/admin/ai?paid=1`,
    cancelUrl: `${env.appUrl}/admin/ai`,
  });
  if (checkout.provider === "mock") {
    const b = await adjustCredits(ctx.site.id, amountMinor, "credit purchase (mock payment)");
    return { ok: true, message: "Credits added (mock payment).", balanceMinor: b };
  }
  // Credits are added only when the payment provider's signed webhook confirms payment (see markPaid).
  await db.insert(orders).values({
    siteId: ctx.site.id,
    number: reference,
    items: [{ productId: CREDITS_PRODUCT, name: "AI credits", qty: 1, priceMinor: amountMinor }],
    buyerName: ctx.user.name,
    buyerEmail: ctx.user.email,
    totalMinor: amountMinor,
    currency: ctx.site.currency,
    provider: checkout.provider,
    providerRef: checkout.providerRef,
  });
  return {
    ok: true,
    redirectUrl: checkout.redirectUrl,
    clientData: checkout.clientData,
    message: "Complete payment to add credits. They appear once the payment is confirmed.",
  };
});
