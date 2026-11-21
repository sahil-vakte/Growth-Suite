"use client";
import { useEffect, useState } from "react";

type Slot = { staffId: string; startsAt: string; endsAt: string };
export default function Booking({ services, staff }: { services: { id: string; name: string; durationMinutes: number; price: string }[]; staff: { id: string; name: string }[] }) {
  const [service, setService] = useState(services[0]?.id ?? ""); const [slots, setSlots] = useState<Slot[]>([]); const [tz, setTz] = useState(""); const [chosen, setChosen] = useState<Slot | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "" }); const [state, setState] = useState<"idle" | "busy" | "done">("idle"); const [err, setErr] = useState("");
  useEffect(() => { if (!service) return; fetch(`/api/public/appointments/slots?serviceId=${service}&days=14`).then((r) => r.json()).then((d) => { setSlots(d.slots ?? []); setTz(d.timezone ?? ""); setChosen(null); }); }, [service]);
  const byDay = slots.reduce<Record<string, Slot[]>>((acc, s) => { const d = new Date(s.startsAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz || undefined }); (acc[d] ??= []).push(s); return acc; }, {});
  async function book(e: React.FormEvent) {
    e.preventDefault(); if (!chosen) return; setState("busy"); setErr("");
    const vid = document.cookie.split("; ").find((c) => c.startsWith("gs_vid="))?.split("=")[1];
    const r = await fetch("/api/public/appointments/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId: service, staffId: chosen.staffId, startsAt: chosen.startsAt, ...f, email: f.email || undefined, phone: f.phone || undefined, visitorId: vid }) });
    const d = await r.json(); if (r.ok) setState("done"); else { setErr(d.error); setState("idle"); }
  }
  if (!services.length) return <p className="s-muted">Online booking is not available yet.</p>;
  if (state === "done") return <div className="s-form-done" role="status">You are booked in for {new Date(chosen!.startsAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: tz || undefined })}. We look forward to seeing you.</div>;
  return (
    <div>
      <div className="s-field"><label htmlFor="svc">Service</label><select id="svc" value={service} onChange={(e) => setService(e.target.value)}>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min {s.price && `· ${s.price}`}</option>)}</select></div>
      {tz && <p className="s-muted">Times shown in {tz}.</p>}
      {Object.entries(byDay).slice(0, 7).map(([day, list]) => <div key={day} style={{ marginBottom: "1rem" }}><h3>{day}</h3><div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>{list.map((s) => <button key={s.startsAt + s.staffId} type="button" className={`s-btn ${chosen === s ? "primary" : "secondary"}`} style={{ padding: ".4rem .8rem" }} onClick={() => setChosen(s)}>{new Date(s.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz || undefined })}{staff.length > 1 ? ` · ${staff.find((x) => x.id === s.staffId)?.name}` : ""}</button>)}</div></div>)}
      {!slots.length && <p className="s-muted">No times available in the next two weeks.</p>}
      {chosen && <form className="s-card s-form" onSubmit={book}>
        {err && <div className="s-form-error" role="alert">{err}</div>}
        <div className="s-field"><label htmlFor="nm">Name</label><input id="nm" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="s-field w-half"><label htmlFor="em">Email</label><input id="em" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="s-field w-half"><label htmlFor="ph">Phone</label><input id="ph" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <button className="s-btn primary" disabled={state === "busy"}>{state === "busy" ? "Booking…" : "Confirm booking"}</button>
      </form>}
    </div>
  );
}
