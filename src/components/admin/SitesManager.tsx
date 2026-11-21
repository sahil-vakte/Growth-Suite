"use client";
import { useEffect, useState } from "react";
import { api } from "./ui";

type Site = { id: string; name: string; domain: string; aliases: string[]; timezone: string; currency: string; locale: string; plan: string; status: string; region: string };
const blank = { name: "", domain: "", aliases: "", timezone: "Europe/London", currency: "GBP", locale: "en-GB", plan: "starter", region: "eu" };

export default function SitesManager() {
  const [rows, setRows] = useState<Site[]>([]); const [f, setF] = useState(blank); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () => api<Site[]>("/api/admin/platform/sites").then(({ data }) => setRows(Array.isArray(data) ? data : []));
  useEffect(() => { load(); }, []);
  async function create(e: React.FormEvent) { e.preventDefault(); const { ok, data } = await api<{ error?: string }>("/api/admin/platform/sites", "POST", { ...f, aliases: f.aliases.split(",").map((x) => x.trim()).filter(Boolean) }); setMsg({ ok, text: ok ? "Site created. Switch to it from the menu at the top left." : data.error ?? "Failed" }); if (ok) { setF(blank); load(); } }
  async function toggle(s: Site) { await api(`/api/admin/platform/sites/${s.id}`, "PATCH", { status: s.status === "active" ? "suspended" : "active" }); load(); }
  return (
    <div>
      <h1>Platform — client sites</h1>
      <p className="muted">Each client website is a site. Visitors are matched to a site by domain; point the client's DNS at this platform and issue SSL (see docs/INTEGRATIONS.pdf, “Client domains &amp; SSL”).</p>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      <table className="data"><thead><tr><th>Site</th><th>Domain</th><th>Region / currency / time zone</th><th>Plan</th><th>Status</th><th /></tr></thead><tbody>
        {rows.map((s) => <tr key={s.id}><td><strong>{s.name}</strong><div className="small muted">{s.id}</div></td><td>{s.domain}{s.aliases.length ? <div className="small muted">{s.aliases.join(", ")}</div> : null}</td><td className="small">{s.region} · {s.currency} · {s.timezone}</td><td>{s.plan}</td><td><span className={`badge ${s.status === "active" ? "green" : "red"}`}>{s.status}</span></td><td><button className="btn small" onClick={() => toggle(s)}>{s.status === "active" ? "Suspend" : "Reactivate"}</button></td></tr>)}
      </tbody></table>
      <form className="card" style={{ marginTop: "1rem" }} onSubmit={create}>
        <h3 style={{ marginTop: 0 }}>Add a client site</h3>
        <div className="grid cols-4">
          {(["name", "domain", "aliases", "timezone", "currency", "locale", "plan", "region"] as const).map((k) => <div key={k}><label htmlFor={`site-${k}`}>{k === "aliases" ? "Other domains (comma separated)" : k[0].toUpperCase() + k.slice(1)}</label><input id={`site-${k}`} required={k === "name" || k === "domain"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
        </div>
        <button className="btn primary" style={{ marginTop: ".75rem" }}>Create site</button>
      </form>
    </div>
  );
}
