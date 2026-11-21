/** Payments: Razorpay (India) and Stripe (rest of world) behind one interface. */
import { createHmac } from "node:crypto";
import { env, isConfigured } from "../env";
import { callJson, recordMock } from "./http";
import { safeEqual } from "../crypto";

export type PaymentProvider = "razorpay" | "stripe" | "mock";
export interface CheckoutRequest {
  amountMinor: number;
  currency: string;
  reference: string;
  customer: { name: string; email?: string; phone?: string };
  successUrl: string;
  cancelUrl: string;
}
export interface CheckoutResult {
  provider: PaymentProvider;
  providerRef: string;
  redirectUrl?: string;
  clientData?: Record<string, unknown>;
}

export function pickProvider(currency: string): PaymentProvider {
  if (currency === "INR" && isConfigured.razorpay()) return "razorpay";
  if (isConfigured.stripe()) return "stripe";
  if (isConfigured.razorpay()) return "razorpay";
  return "mock";
}

export async function createCheckout(r: CheckoutRequest): Promise<CheckoutResult> {
  const provider = pickProvider(r.currency);
  if (provider === "razorpay") {
    const order = await callJson<{ id: string }>("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: r.amountMinor, currency: r.currency, receipt: r.reference }),
    });
    return {
      provider,
      providerRef: order.id,
      clientData: {
        keyId: env.razorpay.keyId,
        orderId: order.id,
        amount: r.amountMinor,
        currency: r.currency,
        name: r.customer.name,
      },
    };
  }
  if (provider === "stripe") {
    const form = new URLSearchParams({
      mode: "payment",
      success_url: r.successUrl,
      cancel_url: r.cancelUrl,
      client_reference_id: r.reference,
      "line_items[0][price_data][currency]": r.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(r.amountMinor),
      "line_items[0][price_data][product_data][name]": `Order ${r.reference}`,
      "line_items[0][quantity]": "1",
    });
    if (r.customer.email) form.set("customer_email", r.customer.email);
    const s = await callJson<{ id: string; url: string }>(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.stripe.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      },
    );
    return { provider, providerRef: s.id, redirectUrl: s.url };
  }
  const m = recordMock("payments", "checkout", r);
  return {
    provider: "mock",
    providerRef: m.id,
    redirectUrl: `${r.successUrl}${r.successUrl.includes("?") ? "&" : "?"}mock_paid=1&ref=${encodeURIComponent(r.reference)}`,
  };
}

export function verifyRazorpayWebhook(rawBody: string, signature: string): boolean {
  if (!env.razorpay.webhookSecret) return false;
  return safeEqual(
    createHmac("sha256", env.razorpay.webhookSecret).update(rawBody).digest("hex"),
    signature,
  );
}

/** Stripe signature header: t=timestamp,v1=signature */
export function verifyStripeWebhook(rawBody: string, header: string, toleranceSec = 300): boolean {
  if (!env.stripe.webhookSecret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > toleranceSec)
    return false;
  return safeEqual(
    createHmac("sha256", env.stripe.webhookSecret).update(`${parts.t}.${rawBody}`).digest("hex"),
    parts.v1,
  );
}
