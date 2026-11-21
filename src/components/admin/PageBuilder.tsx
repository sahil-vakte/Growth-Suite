"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./ui";
import MediaPicker from "./MediaPicker";

type Section = { id: string; layoutKey: string; name: string | null; content: Record<string, unknown>; style: Record<string, unknown> | null; visible: boolean; audienceRule: { param: string; op: string; value?: string } | null; position: number };
type Page = { id: string; title: string; slug: string; status: string; isHome: boolean; lastEditedBy: string | null };
interface Props { pageId: string; layouts: { key: string; name: string; category: string }[]; templates: { id: string; name: string; layoutKey: string }[]; forms: { id: string; name: string }[]; waCtas: { id: string; name: string; message: string }[]; callCtas: { id: string; name: string; phone: string }[] }
type Pickers = Omit<Props, "pageId" | "layouts" | "templates">;

export default function PageBuilder(p: Props) {
  const [page, setPage] = useState<Page | null>(null); const [secs, setSecs] = useState<Section[]>([]); const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [adding, setAdding] = useState(false);
  const load = useCallback(async () => { const { ok, data } = await api<{ page: Page; sections: Section[]; error?: string }>(`/api/admin/pages/${p.pageId}/sections`); if (ok) { setPage(data.page); setSecs(data.sections); } else setMsg({ ok: false, text: data.error ?? "Could not load" }); }, [p.pageId]);
  useEffect(() => { load(); }, [load]);
  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000); };

  async function add(body: { layoutKey?: string; templateId?: string }) { const { ok, data } = await api<Section & { error?: string }>(`/api/admin/pages/${p.pageId}/sections`, "POST", body); if (ok) { setAdding(false); await load(); setSel(data.id); } else flash(false, data.error ?? "Failed"); }
  async function move(i: number, dir: -1 | 1) { const j = i + dir; if (j < 0 || j >= secs.length) return; const order = secs.map((s) => s.id); [order[i], order[j]] = [order[j], order[i]]; setSecs(order.map((id) => secs.find((s) => s.id === id)!)); await api(`/api/admin/pages/${p.pageId}/reorder`, "POST", { order }); }
  async function patch(id: string, body: Record<string, unknown>, quiet = false) { const { ok, data } = await api<{ error?: string; templateId?: string }>(`/api/admin/sections/${id}`, "PATCH", body); if (!quiet || !ok) flash(ok, ok ? (body.action === "save_template" ? "Saved to Common content." : "Saved.") : data.error ?? "Failed"); await load(); }
  async function remove(id: string) { if (!confirm("Delete this section? You can restore it from Content history.")) return; const { ok, data } = await api<{ error?: string }>(`/api/admin/sections/${id}`, "DELETE"); flash(ok, ok ? "Deleted." : data.error ?? ""); if (sel === id) setSel(null); load(); }
  async function setStatus(status: string) { const { ok, data } = await api<{ error?: string }>(`/api/admin/r/pages/${p.pageId}`, "PATCH", { status }); flash(ok, ok ? `Page ${status}.` : data.error ?? ""); load(); }

  if (!page) return msg ? <div className="alert error">{msg.text}</div> : <p className="muted">Loading…</p>;
  const current = secs.find((s) => s.id === sel);
  return (
    <div>
      <div className="topbar"><div><h1>{page.title}</h1><p className="muted" style={{ margin: 0 }}>/{page.isHome ? "" : page.slug} · <span className={`badge ${page.status === "published" ? "green" : "amber"}`}>{page.status}</span>{page.lastEditedBy && ` · last edited by ${page.lastEditedBy}`}</p></div><span className="spacer" />
        <a className="btn" href={`/${page.isHome ? "" : page.slug}`} target="_blank">Preview ↗</a>
        {page.status === "published" ? <button className="btn" onClick={() => setStatus("draft")}>Unpublish</button> : <button className="btn primary" onClick={() => setStatus("published")}>Publish</button>}</div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: "1rem", alignItems: "start" }}>
        <div className="card">
          <div className="row"><h3 style={{ margin: 0 }}>Sections</h3><span className="spacer" /><button className="btn small primary" onClick={() => setAdding(!adding)}>+ Add</button></div>
          {adding && <div style={{ margin: ".75rem 0", maxHeight: 340, overflowY: "auto" }}>
            {p.layouts.map((l) => <button key={l.key} className="btn small" style={{ display: "block", width: "100%", marginBottom: 4, textAlign: "left" }} onClick={() => add({ layoutKey: l.key })}>{l.name} <span className="muted small">· {l.category}</span></button>)}
            {p.templates.length > 0 && <><div className="small muted" style={{ margin: ".5rem 0" }}>Saved templates</div>{p.templates.map((t) => <button key={t.id} className="btn small" style={{ display: "block", width: "100%", marginBottom: 4, textAlign: "left" }} onClick={() => add({ templateId: t.id })}>★ {t.name}</button>)}</>}
          </div>}
          <ol style={{ listStyle: "none", padding: 0, margin: ".75rem 0 0" }}>
            {secs.map((s, i) => <li key={s.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: ".5rem", marginBottom: ".4rem", background: sel === s.id ? "#eef2ff" : "#fff", opacity: s.visible ? 1 : 0.55 }}>
              <button onClick={() => setSel(s.id)} style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 600, cursor: "pointer", textAlign: "left", width: "100%" }}>{i + 1}. {s.name || p.layouts.find((l) => l.key === s.layoutKey)?.name || s.layoutKey}{s.audienceRule && " 🎯"}</button>
              <div className="row" style={{ gap: 4, marginTop: 4 }}>
                <button className="btn small" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</button><button className="btn small" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === secs.length - 1}>↓</button>
                <button className="btn small" onClick={() => patch(s.id, { visible: !s.visible })}>{s.visible ? "Hide" : "Show"}</button>
                <button className="btn small" onClick={() => patch(s.id, { action: "duplicate" })}>Copy</button>
                <button className="btn small danger" onClick={() => remove(s.id)}>✕</button>
              </div></li>)}
            {!secs.length && <li className="muted small">No sections yet. Add one to start.</li>}
          </ol>
        </div>
        <div>{current ? <SectionEditor key={current.id} s={current} pickers={p} onSave={(b) => patch(current.id, b)} /> : <div className="card muted">Select a section to edit its content.</div>}</div>
      </div>
    </div>
  );
}

function SectionEditor({ s, pickers, onSave }: { s: Section; pickers: Pickers; onSave: (b: Record<string, unknown>) => void }) {
  const [content, setContent] = useState(s.content); const [name, setName] = useState(s.name ?? "");
  const [rule, setRule] = useState(s.audienceRule ?? { param: "", op: "equals", value: "" }); const [ruleOn, setRuleOn] = useState(!!s.audienceRule);
  const [styleJson, setStyleJson] = useState(JSON.stringify(s.style ?? {}, null, 2)); const [err, setErr] = useState("");
  function save() { let style: Record<string, unknown> | null = null; try { style = styleJson.trim() ? JSON.parse(styleJson) : null; } catch { setErr("Style must be valid JSON."); return; } setErr(""); onSave({ content, name: name || null, style, audienceRule: ruleOn && rule.param ? rule : null }); }
  return (
    <div className="card">
      <div className="row"><h3 style={{ margin: 0 }}>Edit section</h3><span className="muted small">{s.layoutKey}</span><span className="spacer" /><button className="btn small" onClick={() => onSave({ action: "save_template", templateName: name || s.layoutKey })}>Save as template</button><button className="btn primary" onClick={save}>Save</button></div>
      {err && <div className="alert error">{err}</div>}
      <div className="field" style={{ marginTop: "1rem" }}><label htmlFor="sname">Section name (admin only)</label><input id="sname" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <ValueEditor value={content} onChange={(v) => setContent(v as Record<string, unknown>)} pickers={pickers} path="" />
      <div className="card" style={{ background: "#f8fafc", marginTop: "1rem" }}>
        <label className="row"><input type="checkbox" checked={ruleOn} onChange={(e) => setRuleOn(e.target.checked)} /> Show only to some visitors</label>
        {ruleOn && <div className="grid cols-4" style={{ marginTop: ".5rem" }}>
          <div><label htmlFor="rp">URL parameter</label><input id="rp" value={rule.param} placeholder="utm_content" onChange={(e) => setRule({ ...rule, param: e.target.value })} /></div>
          <div><label htmlFor="ro">Condition</label><select id="ro" value={rule.op} onChange={(e) => setRule({ ...rule, op: e.target.value })}><option value="equals">is exactly</option><option value="contains">contains</option><option value="exists">is present</option></select></div>
          {rule.op !== "exists" && <div><label htmlFor="rv">Value</label><input id="rv" value={rule.value ?? ""} placeholder="offer-a" onChange={(e) => setRule({ ...rule, value: e.target.value })} /></div>}
        </div>}
        <p className="muted small">Parameters are remembered for the whole visit. Keep a copy of the section with no rule as the default. Test in a private window with the parameter in the address.</p>
      </div>
      <details style={{ marginTop: "1rem" }}><summary className="small">Colours & fonts (style JSON)</summary><textarea className="code" value={styleJson} onChange={(e) => setStyleJson(e.target.value)} aria-label="Style JSON" /></details>
    </div>
  );
}

const isCta = (v: unknown): v is Record<string, string> => !!v && typeof v === "object" && !Array.isArray(v) && "type" in v && "value" in v && "label" in v;
const isImage = (k: string, v: unknown) => !!v && typeof v === "object" && !Array.isArray(v) && "url" in v && "alt" in v && /image|thumbnail|logo|photo/i.test(k);
const pretty = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function ValueEditor({ value, onChange, pickers, path, label }: { value: unknown; onChange: (v: unknown) => void; pickers: Pickers; path: string; label?: string }) {
  const key = path.split(".").pop() ?? "";
  if (isCta(value)) return <CtaEditor label={label ?? pretty(key)} cta={value} onChange={onChange} pickers={pickers} />;
  if (isImage(key, value)) return <ImageField label={label ?? pretty(key)} img={value as { url: string; alt: string }} onChange={onChange} />;
  if (Array.isArray(value)) {
    return (
      <div className="field"><label>{label ?? pretty(key)}</label>
        {value.map((item, i) => <div key={i} className="card" style={{ padding: ".6rem .8rem", marginBottom: ".5rem", background: "#fbfcff" }}>
          <div className="row"><strong className="small">#{i + 1}</strong><span className="spacer" /><button className="btn small danger" onClick={() => onChange(value.filter((_, k) => k !== i))}>Remove</button></div>
          <ValueEditor value={item} onChange={(v) => onChange(value.map((x, k) => (k === i ? v : x)))} pickers={pickers} path={`${path}.${i}`} label=" " />
        </div>)}
        <button className="btn small" onClick={() => onChange([...value, blankLike(value[value.length - 1])])}>+ Add</button>
      </div>
    );
  }
  if (value && typeof value === "object") {
    return <div>{label && label.trim() && <h4>{label}</h4>}{Object.entries(value as Record<string, unknown>).map(([k, v]) => <ValueEditor key={k} value={v} path={path ? `${path}.${k}` : k} pickers={pickers} onChange={(nv) => onChange({ ...(value as object), [k]: nv })} />)}</div>;
  }
  if (typeof value === "boolean") return <div className="field"><label className="row"><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label ?? pretty(key)}</label></div>;
  if (typeof value === "number") return <div className="field"><label>{label ?? pretty(key)}</label><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} /></div>;
  if (key === "formId") return <div className="field"><label>Form</label><select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{pickers.forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>;
  const s = String(value ?? ""); const long = s.length > 80 || /body|text|subheading|answer|^a$|quote|address/i.test(key);
  return <div className="field"><label>{label && label.trim() ? label : pretty(key)}</label>{long ? <textarea value={s} onChange={(e) => onChange(e.target.value)} rows={3} /> : <input value={s} onChange={(e) => onChange(e.target.value)} />}</div>;
}

function blankLike(v: unknown): unknown {
  if (typeof v === "string") return ""; if (typeof v === "number") return 0; if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map(blankLike);
  if (v && typeof v === "object") { if (isCta(v)) return { ...v, label: "" }; return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ["icon", "rating", "highlight", "type", "target"].includes(k) ? x : blankLike(x)])); }
  return "";
}

function CtaEditor({ label, cta, onChange, pickers }: { label: string; cta: Record<string, string>; onChange: (v: unknown) => void; pickers: Pickers }) {
  const set = (k: string, v: string) => onChange({ ...cta, [k]: v });
  return (
    <div className="field" style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: ".6rem" }}>
      <label>{label} (button)</label>
      <div className="grid cols-2">
        <input placeholder="Button text (leave blank to hide)" value={cta.label} onChange={(e) => set("label", e.target.value)} aria-label="Button text" />
        <select value={cta.type} onChange={(e) => onChange({ ...cta, type: e.target.value, value: "" })} aria-label="Button action"><option value="url">Open a link</option><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="form">Open a form</option></select>
        {cta.type === "form" ? <select value={cta.value} onChange={(e) => set("value", e.target.value)} aria-label="Form"><option value="">Choose a form</option>{pickers.forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          : cta.type === "whatsapp" ? <><input placeholder="WhatsApp number with country code" value={cta.value} onChange={(e) => set("value", e.target.value)} aria-label="WhatsApp number" />{pickers.waCtas.length > 0 && <select aria-label="Use a WhatsApp CTA message" onChange={(e) => { const w = pickers.waCtas.find((x) => x.id === e.target.value); if (w) onChange({ ...cta, wa_message: w.message }); }}><option value="">Use a saved message…</option>{pickers.waCtas.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}<textarea placeholder="Pre-written message ({page_url} adds the page address)" value={cta.wa_message ?? ""} onChange={(e) => set("wa_message", e.target.value)} rows={2} aria-label="WhatsApp message" /></>
          : cta.type === "phone" ? <select value={cta.value} onChange={(e) => set("value", e.target.value)} aria-label="Phone number"><option value="">Choose a number</option>{pickers.callCtas.map((c) => <option key={c.id} value={c.phone}>{c.name} — {c.phone}</option>)}</select>
          : <input placeholder="/page or https://…" value={cta.value} onChange={(e) => set("value", e.target.value)} aria-label="Link" />}
        {cta.type === "url" && <label className="row small"><input type="checkbox" checked={cta.target === "_blank"} onChange={(e) => set("target", e.target.checked ? "_blank" : "_self")} /> Open in a new tab</label>}
      </div>
    </div>
  );
}

function ImageField({ label, img, onChange }: { label: string; img: { url: string; alt: string }; onChange: (v: unknown) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="field"><label>{label}</label>
      <div className="row" style={{ alignItems: "flex-start" }}>
        {img.url ? <img src={img.url.replace(/-full\.webp$/, "-w480.webp")} onError={(e) => { (e.target as HTMLImageElement).src = img.url; }} alt="" style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /> : <div style={{ width: 96, height: 72, borderRadius: 6, border: "1px dashed var(--border)", display: "grid", placeItems: "center" }} className="small muted">No image</div>}
        <div style={{ flex: 1 }}>
          <div className="row"><button type="button" className="btn small" onClick={() => setOpen(true)}>{img.url ? "Change image" : "Choose image"}</button>{img.url && <button type="button" className="btn small danger" onClick={() => onChange({ ...img, url: "" })}>Remove</button>}</div>
          <input style={{ marginTop: ".4rem" }} placeholder="Alt text — describe the image for screen readers and SEO" value={img.alt} onChange={(e) => onChange({ ...img, alt: e.target.value })} aria-label={`${label} alt text`} />
        </div>
      </div>
      {open && <MediaPicker onClose={() => setOpen(false)} onPick={(m) => { onChange({ url: m.url, alt: img.alt || m.alt }); setOpen(false); }} />}
    </div>
  );
}
