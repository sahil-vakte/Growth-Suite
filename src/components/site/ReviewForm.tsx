"use client";
import { useState } from "react";

export default function ReviewForm({
  token,
  prompts,
  fields,
}: {
  token: string;
  prompts: string[];
  fields: string[];
}) {
  const [f, setF] = useState<{
    name: string;
    rating: number;
    text: string;
    consent: boolean;
    fields: Record<string, string>;
  }>({ name: "", rating: 5, text: "", consent: false, fields: {} });
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`/api/public/reviews/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    const d = await r.json();
    setMsg(d.message ?? d.error);
    setDone(r.ok);
  }
  if (done) return <div className="s-form-done">{msg}</div>;
  return (
    <form className="s-form s-card" onSubmit={send}>
      {msg && <div className="s-form-error">{msg}</div>}
      {prompts.length > 0 && (
        <ul className="s-muted">
          {prompts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="s-field">
        <label htmlFor="rn">Your name</label>
        <input
          id="rn"
          required
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
      </div>
      {fields.map((k) => (
        <div className="s-field" key={k}>
          <label htmlFor={`rf-${k}`}>{k[0].toUpperCase() + k.slice(1)}</label>
          <input
            id={`rf-${k}`}
            value={f.fields[k] ?? ""}
            onChange={(e) => setF({ ...f, fields: { ...f.fields, [k]: e.target.value } })}
          />
        </div>
      ))}
      <div className="s-field">
        <label htmlFor="rr">Rating</label>
        <select
          id="rr"
          value={f.rating}
          onChange={(e) => setF({ ...f, rating: Number(e.target.value) })}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
            </option>
          ))}
        </select>
      </div>
      <div className="s-field">
        <label htmlFor="rt">Your review</label>
        <textarea
          id="rt"
          rows={5}
          required
          value={f.text}
          onChange={(e) => setF({ ...f, text: e.target.value })}
        />
      </div>
      <div className="s-field">
        <label className="s-check">
          <input
            type="checkbox"
            checked={f.consent}
            onChange={(e) => setF({ ...f, consent: e.target.checked })}
          />{" "}
          I agree that my name and review can be shown on the website.
        </label>
      </div>
      <button className="s-btn primary">Send review</button>
    </form>
  );
}
