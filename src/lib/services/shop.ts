import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, products } from "@/db/schema";
import { createCheckout } from "../integrations/payments";
import { env } from "../env";
import { addActivity, upsertLead } from "./leads";
import { shortCode } from "../ids";

/** Pseudo product ID for AI-credit top-ups bought through the normal payment flow. */
export const CREDITS_PRODUCT = "__credits__";

export async function startCheckout(
  siteId: string,
  domain: string,
  input: {
    items: { productId: string; qty: number }[];
    name: string;
    email?: string;
    phone?: string;
  },
) {
  const ids = input.items.map((i) => i.productId);
  const list = await db
    .select()
    .from(products)
    .where(
      and(eq(products.siteId, siteId), inArray(products.id, ids), eq(products.status, "active")),
    );
  if (list.length !== new Set(ids).size)
    throw new Error("A product in your basket is no longer available.");
  const currency = list[0].currency;
  if (list.some((p) => p.currency !== currency))
    throw new Error("Items must use the same currency.");
  const lines = input.items.map((i) => {
    const p = list.find((x) => x.id === i.productId)!;
    if (p.stock < i.qty) throw new Error(`Only ${p.stock} of ${p.name} left.`);
    return { productId: p.id, name: p.name, qty: i.qty, priceMinor: p.priceMinor };
  });
  const totalMinor = lines.reduce((a, l) => a + l.qty * l.priceMinor, 0);
  const number = `${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${shortCode(5)}`;
  const base = env.appUrl.includes("localhost") ? env.appUrl : `https://${domain}`;
  const checkout = await createCheckout({
    amountMinor: totalMinor,
    currency,
    reference: number,
    customer: { name: input.name, email: input.email, phone: input.phone },
    successUrl: `${base}/shop/thank-you?order=${number}`,
    cancelUrl: `${base}/shop`,
  });
  const [order] = await db
    .insert(orders)
    .values({
      siteId,
      number,
      items: lines,
      buyerName: input.name,
      buyerEmail: input.email,
      buyerPhone: input.phone,
      totalMinor,
      currency,
      provider: checkout.provider,
      providerRef: checkout.providerRef,
    })
    .returning();
  return { order, checkout };
}

/** Mark paid exactly once (webhooks can repeat), reduce stock and record the buyer as a lead. */
export async function markPaid(siteId: string, providerRef: string, paymentId: string) {
  const [o] = await db
    .update(orders)
    .set({ status: "paid", paymentId })
    .where(
      and(
        eq(orders.siteId, siteId),
        eq(orders.providerRef, providerRef),
        eq(orders.status, "pending"),
      ),
    )
    .returning();
  if (!o) return null;
  if (o.items.every((l) => l.productId === CREDITS_PRODUCT)) {
    const { adjustCredits } = await import("./credits");
    await adjustCredits(
      siteId,
      o.items.reduce((a, l) => a + l.qty * l.priceMinor, 0),
      `credit purchase ${o.number} (${o.provider})`,
      o.provider ?? undefined,
    );
    return o;
  }
  for (const l of o.items)
    await db
      .update(products)
      .set({ stock: sql`greatest(${products.stock} - ${l.qty}, 0)` })
      .where(eq(products.id, l.productId));
  if (o.buyerPhone || o.buyerEmail) {
    const { lead } = await upsertLead(siteId, {
      name: o.buyerName,
      email: o.buyerEmail,
      phone: o.buyerPhone,
      source: "shop",
    });
    await db.update(orders).set({ leadId: lead.id }).where(eq(orders.id, o.id));
    await addActivity(siteId, lead.id, "system", `Order ${o.number} paid`, {
      orderId: o.id,
      totalMinor: o.totalMinor,
      currency: o.currency,
    });
  }
  return o;
}
