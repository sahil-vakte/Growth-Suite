"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldDef } from "@/lib/admin/resources";

export interface RowAction { label: string; kind: "link" | "post"; href: string; confirm?: string; body?: Record<string, unknown>; showIf?: { field: string; in: unknown[] } }
export interface ClientResource {
  key: string; label: string; singular: string; titleField: string; fields: FieldDef[]; readOnly?: boolean; noCreate?: boolean; noDelete?: boolean; description?: string;
  relations: Record<string, { key: string; titleField: string }>; actions?: RowAction[]; currency: string;
}

type Row = Record<string, unknown> & { id: string };

const money = (minor: unknown, currency: string) => (minor === null || minor === undefined ? "" : new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(minor) / 100));
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");
const toLocalInput = (v: unknown) => { if (!v) return ""; const d = new Date(String(v)); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export default function ResourceManager({ res }: { res: ClientResource }) {
  const [rows, setRows] = useState<Row[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [q, setQ] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [relOptions, setRelOptions] = useState<Record<string, { id: string; title: string }[]>>({});
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const r = await fetch(`/api/admin/r/${res.key}?page=${page}&q=${encodeURIComponent(q)}`);
    const d = await r.json();
    if (!r.ok) setError(d.error ?? "Could not load."); else { setRows(d.rows); setTotal(d.total); }
    setLoading(false);
  }, [res.key, page, q]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const out: Record<string, { id: string; title: string }[]> = {};
      for (const [field, rel] of Object.entries(res.relations)) {
        const r = await fetch(`/api/admin/r/${rel.key}?pageSize=100`);
        if (r.ok) { const d = await r.json(); out[field] = d.rows.map((x: Row) => ({ id: x.id, title: String(x[rel.titleField] ?? x.id).slice(0, 80) })); }
      }
      setRelOptions(out);
    })();
  }, [res.relations]);

  const listFields = useMemo(() => res.fields.filter((f) => f.list).slice(0, 6), [res.fields]);
  const cell = (f: FieldDef, v: unknown) => {
    if (f.type === "bool") return v ? <span className="badge green">Yes</span> : <span className="badge">No</span>;
    if (f.type === "money") return money(v, (rows.find(() => true)?.currency as string) ?? res.currency);
    if (f.type === "datetime") return fmtDate(v);
    if (f.type === "relation") return relOptions[f.key]?.find((o) => o.id === v)?.title ?? (v ? String(v).slice(0, 10) : "");
    if (f.type === "color") return <span className="row"><span style={{ width: 14, height: 14, borderRadius: 3, background: String(v), display: "inline-block" }} />{String(v ?? "")}</span>;
    if (f.type === "select" && ["published", "active", "approved", "paid", "sent", "verified", "completed", "accepted"].includes(String(v))) return <span className="badge green">{String(v)}</span>;
    if (f.type === "select" && ["spam", "failed", "rejected", "cancelled"].includes(String(v))) return <span className="badge red">{String(v)}</span>;
    if (Array.isArray(v)) return v.join(", ");
    if (v && typeof v === "object") return <code className="small">{JSON.stringify(v).slice(0, 60)}</code>;
    const s = String(v ?? ""); return s.length > 80 ? s.slice(0, 80) + "…" : s;
  };

  async function runAction(a: RowAction, row: Row) {
    const href = a.href.replace(":id", row.id);
    if (a.kind === "link") { window.location.href = href; return; }
    if (a.confirm && !window.confirm(a.confirm)) return;
    const r = await fetch(href, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a.body ?? {}) });
    const d = await r.json().catch(() => ({}));
    setNotice(r.ok ? d.message ?? `${a.label}: done` : d.error ?? "Action failed"); load();
  }

  const pages = Math.max(1, Math.ceil(total / 25));
  return (
    <div>
      <div className="topbar">
        <div><h1>{res.label}</h1>{res.description && <p className="muted" style={{ margin: 0 }}>{res.description}</p>}</div>
        <span className="spacer" />
        <input placeholder="Search…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} style={{ maxWidth: 240 }} aria-label="Search" />
        {!res.readOnly && !res.noCreate && <button className="btn primary" onClick={() => setEditing("new")}>New {res.singular.toLowerCase()}</button>}
      </div>
      {notice && <div className="alert info" onClick={() => setNotice("")}>{notice}</div>}
      {error && <div className="alert error">{error}</div>}
      <table className="data">
        <thead><tr>{listFields.map((f) => <th key={f.key}>{f.label}</th>)}{res.actions?.length ? <th /> : null}</tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={listFields.length + 1} className="muted">Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={listFields.length + 1} className="muted">Nothing here yet.</td></tr> :
            rows.map((row) => (
              <tr key={row.id} style={{ cursor: "pointer" }} onClick={() => setEditing(row)}>
                {listFields.map((f) => <td key={f.key}>{cell(f, row[f.key])}</td>)}
                {res.actions?.length ? <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                  {res.actions.filter((a) => !a.showIf || a.showIf.in.includes(row[a.showIf.field])).map((a) => <button key={a.label} className="btn small" style={{ marginRight: 4 }} onClick={() => runAction(a, row)}>{a.label}</button>)}
                </td> : null}
              </tr>
            ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: ".75rem" }}>
        <span className="muted small">{total} total</span><span className="spacer" />
        <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="small">Page {page} of {pages}</span>
        <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
      {editing && <EditDrawer res={res} row={editing === "new" ? null : editing} relOptions={relOptions} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function EditDrawer({ res, row, relOptions, onClose, onSaved }: { res: ClientResource; row: Row | null; relOptions: Record<string, { id: string; title: string }[]>; onClose: () => void; onSaved: () => void }) {
  const init = () => Object.fromEntries(res.fields.map((f) => {
    const v = row ? row[f.key] : f.default;
    if (f.type === "json") return [f.key, v === undefined ? "" : JSON.stringify(v, null, 2)];
    if (f.type === "money") return [f.key, v === null || v === undefined ? "" : (Number(v) / 100).toFixed(2)];
    if (f.type === "datetime") return [f.key, toLocalInput(v)];
    if (f.type === "tags") return [f.key, Array.isArray(v) ? v.join(", ") : ""];
    return [f.key, v ?? (f.type === "bool" ? false : "")];
  }));
  const [vals, setVals] = useState<Record<string, unknown>>(init);
  const [errors, setErrors] = useState<Record<string, string>>({}); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const readOnlyAll = res.readOnly;

  async function save() {
    setBusy(true); setMsg(""); setErrors({});
    const body: Record<string, unknown> = {};
    for (const f of res.fields) {
      if (f.readOnly) continue;
      let v = vals[f.key];
      if (f.type === "money") v = v === "" ? null : Math.round(Number(v) * 100);
      if (f.type === "datetime") v = v ? new Date(String(v)).toISOString() : null;
      body[f.key] = v;
    }
    const r = await fetch(row ? `/api/admin/r/${res.key}/${row.id}` : `/api/admin/r/${res.key}`, { method: row ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) onSaved(); else { setMsg(d.error ?? "Could not save."); setErrors(Object.fromEntries((d.issues ?? []).map((i: { path: string; message: string }) => [i.path, i.message]))); }
  }
  async function remove() {
    if (!row || !window.confirm(`Delete this ${res.singular.toLowerCase()}? A copy is kept in Content history where available.`)) return;
    const r = await fetch(`/api/admin/r/${res.key}/${row.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) onSaved(); else setMsg(d.error ?? "Could not delete.");
  }
  const set = (k: string, v: unknown) => setVals((p) => ({ ...p, [k]: v }));

  return (
    <div className="drawer" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${row ? "Edit" : "New"} ${res.singular}`}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="row"><h2 style={{ margin: 0 }}>{row ? `Edit ${res.singular.toLowerCase()}` : `New ${res.singular.toLowerCase()}`}</h2><span className="spacer" /><button className="btn small" onClick={onClose}>Close</button></div>
        {row && <p className="muted small">ID: <code>{row.id}</code></p>}
        {msg && <div className="alert error">{msg}</div>}
        {res.fields.map((f) => {
          const ro = readOnlyAll || f.readOnly;
          const id = `f_${f.key}`;
          const v = vals[f.key];
          return (
            <div className="field" key={f.key}>
              {f.type === "bool" ? (
                <label htmlFor={id} className="row" style={{ fontWeight: 600 }}><input id={id} type="checkbox" checked={!!v} disabled={ro} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}</label>
              ) : <label htmlFor={id}>{f.label}{f.required && " *"}</label>}
              {f.type === "textarea" || f.type === "richtext" ? <textarea id={id} value={String(v ?? "")} readOnly={ro} rows={f.type === "richtext" ? 12 : 4} onChange={(e) => set(f.key, e.target.value)} />
                : f.type === "json" ? <textarea id={id} className="code" value={String(v ?? "")} readOnly={ro} onChange={(e) => set(f.key, e.target.value)} />
                : f.type === "select" ? <select id={id} value={String(v ?? "")} disabled={ro} onChange={(e) => set(f.key, e.target.value)}>{!f.required && <option value="">—</option>}{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                : f.type === "relation" ? <select id={id} value={String(v ?? "")} disabled={ro} onChange={(e) => set(f.key, e.target.value)}><option value="">—</option>{relOptions[f.key]?.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select>
                : f.type === "bool" ? null
                : <input id={id} type={f.type === "number" ? "number" : f.type === "money" ? "number" : f.type === "datetime" ? "datetime-local" : f.type === "color" ? "color" : "text"} step={f.type === "money" ? "0.01" : undefined} value={String(v ?? "")} readOnly={ro} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />}
              {f.help && <div className="help">{f.help}</div>}
              {errors[f.key] && <div className="err">{errors[f.key]}</div>}
            </div>
          );
        })}
        <div className="row">
          {!readOnlyAll && <button className="btn primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>}
          <span className="spacer" />
          {row && !res.readOnly && !res.noDelete && <button className="btn danger" onClick={remove}>Delete</button>}
        </div>
      </div>
    </div>
  );
}
