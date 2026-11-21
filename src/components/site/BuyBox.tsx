"use client";
import { useState } from "react";

export default function BuyBox({ productId }: { productId: string }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", qty: 1 }); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function buy(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/public/shop/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ productId, qty: f.qty }], name: f.name, email: f.email || undefined, phone: f.phone || undefined }) });
    const d = await r.json();
    if (!r.ok) { setErr(d.error); setBusy(false); return; }
    if (d.provider === "razorpay" && d.clientData) {
      const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => { const R = (window as unknown as { Razorpay: new (o: object) => { open: () => void } }).Razorpay; new R({ key: d.clientData.keyId, order_id: d.clientData.orderId, amount: d.clientData.amount, currency: d.clientData.currency, name: d.clientData.name, prefill: { name: f.name, email: f.email, contact: f.phone }, handler: () => { location.href = `/shop/thank-you?order=${d.order}`; } }).open(); };
      document.body.appendChild(s); setBusy(false); return;
    }
    if (d.provider === "mock") await fetch("/api/public/payments/mock", { method: "POST", body: JSON.stringify({ ref: d.order }) });
    location.href = d.redirectUrl;
  }
  return (
    <form className="s-card s-form" onSubmit={buy}>
      {err && <div className="s-form-error" role="alert">{err}</div>}
      <div className="s-field"><label htmlFor="bn">Your name</label><input id="bn" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="s-field w-half"><label htmlFor="be">Email</label><input id="be" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div className="s-field w-half"><label htmlFor="bp">Phone</label><input id="bp" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div className="s-field"><label htmlFor="bq">Quantity</label><input id="bq" type="number" min={1} max={99} value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} /></div>
      <button className="s-btn primary" disabled={busy}>{busy ? "Starting checkout…" : "Buy now"}</button>
    </form>
  );
}
