"use client";
import { useEffect, useState } from "react";

export async function api<T = Record<string, unknown>>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<{ ok: boolean; data: T }> {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await r.json().catch(() => ({}))) as T;
  return { ok: r.ok, data };
}

const label = (k: string) =>
  k
    .replace(/Enc$|Hash$/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/[_.]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

/** Edits one settings key. Scalars get inputs; nested objects/arrays get a JSON box. Secret fields are write-only. */
export function SettingsForm({
  settingKey,
  title,
  help,
  fields,
}: {
  settingKey: string;
  title: string;
  help?: string;
  fields?: string[];
}) {
  const [vals, setVals] = useState<Record<string, unknown> | null>(null);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    api<Record<string, unknown>>(`/api/admin/settings/${settingKey}`).then(({ ok, data }) => {
      if (ok) {
        setVals(data);
        setRaw(
          Object.fromEntries(
            Object.entries(data)
              .filter(([, v]) => typeof v === "object" && v !== null)
              .map(([k, v]) => [k, JSON.stringify(v, null, 2)]),
          ),
        );
      } else setMsg({ ok: false, text: String((data as { error?: string }).error) });
    });
  }, [settingKey]);
  async function save() {
    if (!vals) return;
    const body: Record<string, unknown> = { ...vals };
    for (const [k, v] of Object.entries(raw)) {
      try {
        body[k] = JSON.parse(v);
      } catch {
        setMsg({ ok: false, text: `${label(k)} is not valid JSON.` });
        return;
      }
    }
    const { ok, data } = await api<Record<string, unknown>>(
      `/api/admin/settings/${settingKey}`,
      "PUT",
      body,
    );
    setMsg(
      ok
        ? { ok: true, text: "Saved." }
        : { ok: false, text: String((data as { error?: string }).error) },
    );
    if (ok) setVals(data);
  }
  if (!vals)
    return (
      <div className="card">
        <h3>{title}</h3>
        {msg ? <div className="alert error">{msg.text}</div> : <p className="muted">Loading…</p>}
      </div>
    );
  const keys = (fields ?? Object.keys(vals)).filter((k) => k in vals);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {help && <p className="muted small">{help}</p>}
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      {keys.map((k) => {
        const v = vals[k];
        const id = `${settingKey}-${k}`;
        const secret = /Enc$|PasswordHash$/.test(k);
        if (typeof v === "boolean")
          return (
            <div className="field" key={k}>
              <label className="row" htmlFor={id}>
                <input
                  id={id}
                  type="checkbox"
                  checked={v}
                  onChange={(e) => setVals({ ...vals, [k]: e.target.checked })}
                />{" "}
                {label(k)}
              </label>
            </div>
          );
        if (typeof v === "object" && v !== null)
          return (
            <div className="field" key={k}>
              <label htmlFor={id}>{label(k)}</label>
              <textarea
                id={id}
                className="code"
                value={raw[k] ?? ""}
                onChange={(e) => setRaw({ ...raw, [k]: e.target.value })}
              />
            </div>
          );
        const long =
          typeof v === "string" &&
          (v.length > 80 || k === "content" || k === "text" || k.toLowerCase().includes("address"));
        return (
          <div className="field" key={k}>
            <label htmlFor={id}>
              {label(k)}
              {secret && " (stored encrypted)"}
            </label>
            {long ? (
              <textarea
                id={id}
                value={String(v ?? "")}
                onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
                rows={k === "content" || k === "text" ? 10 : 3}
              />
            ) : (
              <input
                id={id}
                type={typeof v === "number" ? "number" : secret ? "password" : "text"}
                value={String(v ?? "")}
                placeholder={secret ? "Paste to set or replace" : undefined}
                autoComplete="off"
                onFocus={(e) =>
                  secret &&
                  String(v).startsWith("••") &&
                  setVals({ ...vals, [k]: "" }) &&
                  e.target.select()
                }
                onChange={(e) =>
                  setVals({
                    ...vals,
                    [k]: typeof v === "number" ? Number(e.target.value) : e.target.value,
                  })
                }
              />
            )}
          </div>
        );
      })}
      <button className="btn primary" onClick={save}>
        Save
      </button>
    </div>
  );
}

/** A small form that POSTs to an endpoint and shows the result message (and optional JSON output). */
export function ActionForm({
  title,
  endpoint,
  fields,
  submitLabel = "Run",
  help,
  showResult,
}: {
  title: string;
  endpoint: string;
  fields: {
    key: string;
    label: string;
    type?: "text" | "textarea" | "number" | "select" | "checkbox";
    options?: string[];
    placeholder?: string;
    default?: string | number | boolean;
  }[];
  submitLabel?: string;
  help?: string;
  showResult?: (d: Record<string, unknown>) => React.ReactNode;
}) {
  const [vals, setVals] = useState<Record<string, unknown>>(
    Object.fromEntries(
      fields.map((f) => [f.key, f.default ?? (f.type === "checkbox" ? false : "")]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; data: Record<string, unknown> } | null>(null);
  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = Object.fromEntries(
      Object.entries(vals)
        .filter(([, v]) => v !== "")
        .map(([k, v]) => [k, fields.find((f) => f.key === k)?.type === "number" ? Number(v) : v]),
    );
    setRes(await api(endpoint, "POST", body));
    setBusy(false);
  }
  return (
    <form className="card" onSubmit={run}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {help && <p className="muted small">{help}</p>}
      {fields.map((f) => (
        <div className="field" key={f.key}>
          {f.type === "checkbox" ? (
            <label className="row">
              <input
                type="checkbox"
                checked={!!vals[f.key]}
                onChange={(e) => setVals({ ...vals, [f.key]: e.target.checked })}
              />{" "}
              {f.label}
            </label>
          ) : (
            <label htmlFor={`${title}-${f.key}`}>{f.label}</label>
          )}
          {f.type === "textarea" ? (
            <textarea
              id={`${title}-${f.key}`}
              rows={6}
              value={String(vals[f.key])}
              placeholder={f.placeholder}
              onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
            />
          ) : f.type === "select" ? (
            <select
              id={`${title}-${f.key}`}
              value={String(vals[f.key])}
              onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
            >
              {f.options?.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : f.type === "checkbox" ? null : (
            <input
              id={`${title}-${f.key}`}
              type={f.type === "number" ? "number" : "text"}
              value={String(vals[f.key])}
              placeholder={f.placeholder}
              onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
            />
          )}
        </div>
      ))}
      <button className="btn primary" disabled={busy}>
        {busy ? "Working…" : submitLabel}
      </button>
      {res && (
        <div className={`alert ${res.ok ? "ok" : "error"}`}>
          {String(res.data.message ?? res.data.error ?? (res.ok ? "Done." : "Failed."))}
        </div>
      )}
      {res?.ok && showResult?.(res.data)}
    </form>
  );
}
