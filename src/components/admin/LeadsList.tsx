"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./ui";
import { parseCsv } from "@/lib/admin/csv";

type Lead = { ownerName: string | null; id: string; name: string | null; phone: string | null; email: string | null; source: string; score: number; createdAt: string; stageName: string | null; stageColor: string | null; attribution: Record<string, string> };
type Stage = { id: string; name: string; color: string };
const ago = (d: string) => { const s = (Date.now() - new Date(d).getTime()) / 1000; return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };

export default function LeadsList() {
  const [rows, setRows] = useState<Lead[]>([]); const [stages, setStages] = useState<Stage[]>([]); const [total, setTotal] = useState(0);
  const [q, setQ] = useState(""); const [stage, setStage] = useState(""); const [source, setSource] = useState(""); const [owner, setOwner] = useState(""); const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [newArrived, setNewArrived] = useState(false);
  const latest = useRef<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await api<{ rows: Lead[]; total: number; stages: Stage[] }>(`/api/admin/leads?q=${encodeURIComponent(q)}&stage=${stage}&source=${source}&owner=${owner}&page=${page}`);
    setRows(data.rows ?? []); setTotal(data.total ?? 0); setStages(data.stages ?? []);
    if (page === 1 && !q && !stage && !source && data.rows?.[0]) latest.current = data.rows[0].id;
  }, [q, stage, source, owner, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { // poll for new leads every 30s
    const t = setInterval(async () => { const { data } = await api<{ rows: Lead[] }>(`/api/admin/leads?page=1`); if (data.rows?.[0] && latest.current && data.rows[0].id !== latest.current) { setNewArrived(true); latest.current = data.rows[0].id; } }, 30_000);
    return () => clearInterval(t);
  }, []);
  const counts = new Map<string, number>(); rows.forEach((r) => r.phone && counts.set(r.phone, (counts.get(r.phone) ?? 0) + 1));
  return (
    <div>
      <div className="topbar"><h1>Leads</h1><span className="muted">{total} total</span><span className="spacer" /><Link className="btn" href="/admin/crm/board">Pipeline board</Link><a className="btn" href={`/api/admin/exports/leads?stage=${stage}&source=${source}&owner=${owner}`}>Export leads</a><button className="btn primary" onClick={() => setAdding(!adding)}>Add lead</button></div>
      {newArrived && <div className="alert ok" onClick={() => { setNewArrived(false); setPage(1); load(); }} style={{ cursor: "pointer" }}>New lead arrived! Click to refresh.</div>}
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      {adding && <AddLead stages={stages} onDone={(m) => { setMsg(m); setAdding(false); load(); }} />}
      <div className="row" style={{ marginBottom: ".75rem" }}>
        <input placeholder="Search name, phone or email" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} style={{ maxWidth: 300 }} aria-label="Search leads" />
        <select aria-label="Source" value={source} onChange={(e) => { setPage(1); setSource(e.target.value); }} style={{ maxWidth: 180 }}><option value="">All sources</option>{["website", "whatsapp", "chat", "facebook_lead", "appointment", "manual", "import", "shop"].map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Owner" value={owner} onChange={(e) => { setPage(1); setOwner(e.target.value); }} style={{ maxWidth: 180 }}><option value="">Everyone's leads</option><option value="me">My leads</option><option value="none">Unassigned</option></select>
      </div>
      <div className="row" style={{ marginBottom: ".75rem" }}>
        <button className={`btn small${stage === "" ? " primary" : ""}`} onClick={() => setStage("")}>All</button>
        {stages.map((s) => <button key={s.id} className={`btn small${stage === s.id ? " primary" : ""}`} onClick={() => { setPage(1); setStage(s.id); }}>{s.name}</button>)}
      </div>
      <table className="data"><thead><tr><th>Lead</th><th>Contact</th><th>Stage</th><th>Source</th><th>Campaign</th><th>Owner</th><th>Score</th><th>Age</th></tr></thead><tbody>
        {rows.map((l) => <tr key={l.id}><td><Link href={`/admin/crm/${l.id}`}><strong>{l.name || "—"}</strong></Link>{l.phone && (counts.get(l.phone) ?? 0) > 1 && <span className="badge amber" style={{ marginLeft: 6 }}>repeat</span>}</td><td className="small">{l.phone}<br />{l.email}</td>
          <td>{l.stageName && <span className="badge" style={{ background: (l.stageColor ?? "#64748b") + "22", color: l.stageColor ?? undefined }}>{l.stageName}</span>}</td><td className="small">{l.source}</td><td className="small">{l.attribution?.utm_campaign ?? (l.attribution?.gclid ? "Google Ads" : "")}</td><td className="small">{l.ownerName ?? "—"}</td><td>{l.score}</td><td className="small">{ago(l.createdAt)}</td></tr>)}
        {!rows.length && <tr><td colSpan={8} className="muted">No leads match.</td></tr>}
      </tbody></table>
      <div className="row" style={{ marginTop: ".75rem" }}><span className="spacer" /><button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="small">Page {page}</span><button className="btn small" disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Next</button></div>
      <ImportCsv onDone={(m) => { setMsg(m); load(); }} />
    </div>
  );
}

function AddLead({ stages, onDone }: { stages: Stage[]; onDone: (m: { ok: boolean; text: string }) => void }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", stageId: "" });
  async function save(e: React.FormEvent) { e.preventDefault(); const { ok, data } = await api<{ message?: string; error?: string }>("/api/admin/leads", "POST", { ...f, stageId: f.stageId || undefined }); onDone({ ok, text: data.message ?? data.error ?? "" }); }
  return (
    <form className="card" onSubmit={save} style={{ marginBottom: "1rem" }}>
      <div className="grid cols-4">
        <div><label htmlFor="ln">Name</label><input id="ln" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label htmlFor="lp">Phone (with country code) *</label><input id="lp" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+44 7700 900123" /></div>
        <div><label htmlFor="le">Email (leave blank if none)</label><input id="le" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label htmlFor="ls">Stage</label><select id="ls" value={f.stageId} onChange={(e) => setF({ ...f, stageId: e.target.value })}><option value="">Default</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      </div>
      <button className="btn primary" style={{ marginTop: ".75rem" }}>Save lead</button>
    </form>
  );
}

function ImportCsv({ onDone }: { onDone: (m: { ok: boolean; text: string }) => void }) {
  const [csv, setCsv] = useState(""); const [header, setHeader] = useState<string[]>([]); const [map, setMap] = useState<Record<string, string>>({});
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    file.text().then((t) => { setCsv(t); const h = parseCsv(t)[0] ?? []; setHeader(h); setMap(Object.fromEntries(h.map((c) => [c, /phone|mobile|tel/i.test(c) ? "phone" : /mail/i.test(c) ? "email" : /name/i.test(c) ? "name" : /country/i.test(c) ? "country_code" : "custom"]))); });
  }
  async function run(dryRun: boolean) { const { ok, data } = await api<Record<string, number | string>>("/api/admin/leads/import", "POST", { csv, mapping: map, dryRun }); onDone({ ok, text: ok ? `${dryRun ? "Preview: " : ""}${data.imported} new, ${data.merged ?? 0} merged with existing, ${data.duplicatesInFile} duplicates in file, ${data.skippedNoPhone} rows without a phone skipped.` : String(data.error) }); }
  return (
    <div className="card" style={{ marginTop: "1.5rem" }}>
      <h3 style={{ marginTop: 0 }}>Bulk upload (CSV)</h3><p className="muted small">Phone is required. Duplicates are matched by phone number — never by email.</p>
      <input type="file" accept=".csv,text/csv" onChange={onFile} aria-label="CSV file" />
      {header.length > 0 && <><div className="grid cols-4" style={{ marginTop: ".75rem" }}>{header.map((h) => <div key={h}><label>{h}</label><select value={map[h]} onChange={(e) => setMap({ ...map, [h]: e.target.value })}>{["name", "phone", "email", "country_code", "custom", "ignore"].map((o) => <option key={o}>{o}</option>)}</select></div>)}</div>
        <div className="row" style={{ marginTop: ".75rem" }}><button className="btn" onClick={() => run(true)}>Preview</button><button className="btn primary" onClick={() => run(false)}>Import</button></div></>}
    </div>
  );
}
