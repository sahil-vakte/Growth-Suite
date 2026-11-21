import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { verifyRazorpayWebhook, verifyStripeWebhook } from "@/lib/integrations/payments";
import { markPaid } from "@/lib/services/shop";
import { pjson } from "@/lib/public";
import { env } from "@/lib/env";

/** Payment provider webhooks. Signatures are verified before anything changes. */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await req.text();
  if (provider === "razorpay") {
    if (!verifyRazorpayWebhook(raw, req.headers.get("x-razorpay-signature") ?? "")) return pjson({ error: "bad signature" }, 401);
    const ev = JSON.parse(raw);
    if (ev.event === "payment.captured" || ev.event === "order.paid") {
      const pay = ev.payload?.payment?.entity; const orderRef = pay?.order_id;
      const [o] = await db.select().from(orders).where(eq(orders.providerRef, orderRef)).limit(1);
      if (o) await markPaid(o.siteId, orderRef, pay.id);
    }
    return pjson({ ok: true });
  }
  if (provider === "stripe") {
    if (!verifyStripeWebhook(raw, req.headers.get("stripe-signature") ?? "")) return pjson({ error: "bad signature" }, 401);
    const ev = JSON.parse(raw);
    if (ev.type === "checkout.session.completed") {
      const sess = ev.data.object;
      const [o] = await db.select().from(orders).where(eq(orders.providerRef, sess.id)).limit(1);
      if (o) await markPaid(o.siteId, sess.id, sess.payment_intent ?? sess.id);
    }
    return pjson({ ok: true });
  }
  if (provider === "mock" && env.forceMock) {
    const { ref } = JSON.parse(raw || "{}");
    const [o] = await db.select().from(orders).where(and(eq(orders.number, String(ref)), eq(orders.provider, "mock"))).limit(1);
    if (o?.providerRef) await markPaid(o.siteId, o.providerRef, `mock_pay_${Date.now()}`);
    return pjson({ ok: !!o });
  }
  return pjson({ error: "Unknown provider" }, 404);
}
