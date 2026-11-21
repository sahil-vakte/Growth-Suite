"use client";
import { useMemo, useState } from "react";
import { api } from "./ui";
import { evaluateFormula } from "@/lib/engines/formula";
import { FIELD_TYPES, formDefinitionProblems } from "@/lib/engines/formDefinition";

type Field = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  width?: string;
  formula?: string;
  prefix?: string;
  suffix?: string;
  showIf?: { field: string; equals: string } | null;
};
type Settings = {
  successMessage?: string;
  redirectUrl?: string;
  forwardEmails?: string[];
  webhooks?: string[];
  waOtp?: boolean;
  isTest?: boolean;
  submitLabel?: string;
};
const TYPE_LABEL: Record<string, string> = {
  text: "Short text",
  email: "Email",
  tel: "Phone",
  textarea: "Long text",
  number: "Number",
  select: "Drop-down",
  radio: "Choice buttons",
  checkbox: "Tick box",
  date: "Date",
  hidden: "Hidden value",
  calculated: "Calculated result",
  consent: "Consent tick box",
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "f_$1")
    .slice(0, 40) || "field";

/** Visual form builder: no JSON needed. Saves through the same validated API as the raw editor. */
export default function FormBuilder({
  id,
  name,
  status,
  initialFields,
  initialSettings,
}: {
  id: string;
  name: string;
  status: string;
  initialFields: Field[];
  initialSettings: Settings;
}) {
  const [fields, setFields] = useState<Field[]>(initialFields ?? []);
  const [settings, setSettings] = useState<Settings>(initialSettings ?? {});
  const [title, setTitle] = useState(name);
  const [active, setActive] = useState(status === "active");
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [test, setTest] = useState<Record<string, string>>({});
  const problems = useMemo(() => formDefinitionProblems(fields), [fields]);
  const f = fields[sel];
  const set = (patch: Partial<Field>) =>
    setFields((fs) => fs.map((x, i) => (i === sel ? { ...x, ...patch } : x)));
  function add(type: string) {
    const base = slug(TYPE_LABEL[type]);
    let key = base;
    let n = 2;
    while (fields.some((x) => x.key === key)) key = `${base}_${n++}`;
    setFields([
      ...fields,
      {
        key,
        label: TYPE_LABEL[type],
        type,
        required: false,
        width: "full",
        ...(type === "select" || type === "radio" ? { options: ["Option 1", "Option 2"] } : {}),
        ...(type === "calculated" ? { formula: "0" } : {}),
      },
    ]);
    setSel(fields.length);
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= fields.length) return;
    const c = [...fields];
    [c[i], c[j]] = [c[j], c[i]];
    setFields(c);
    setSel(j);
  }
  function remove(i: number) {
    if (!confirm("Remove this field?")) return;
    setFields(fields.filter((_, k) => k !== i));
    setSel(Math.max(0, i - 1));
  }
  async function save() {
    if (problems.length) {
      setMsg({ ok: false, text: problems.join(" ") });
      return;
    }
    const { ok, data } = await api<{ error?: string }>(`/api/admin/r/forms/${id}`, "PATCH", {
      name: title,
      status: active ? "active" : "inactive",
      fields,
      settings,
    });
    setMsg({ ok, text: ok ? "Form saved." : (data.error ?? "Could not save.") });
  }
  const calcPreview = (formula?: string) => {
    try {
      const v = evaluateFormula(
        formula ?? "",
        Object.fromEntries(Object.entries(test).map(([k, v]) => [k, Number(v)])),
      );
      return Number.isFinite(v)
        ? v.toLocaleString("en-GB", { maximumFractionDigits: 2 })
        : "— (fill in the test values)";
    } catch (e) {
      return e instanceof Error ? e.message : "error";
    }
  };
  const list = (v?: string[]) => (v ?? []).join("\n");
  return (
    <div>
      <div className="topbar">
        <div>
          <input
            aria-label="Form name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ fontSize: "1.3rem", fontWeight: 700, maxWidth: 420 }}
          />
        </div>
        <span className="spacer" />
        <label className="row">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{" "}
          Active
        </label>
        <a className="btn" href={`/api/admin/exports/submissions?formId=${id}`}>
          Download submissions
        </a>
        <button className="btn primary" onClick={save}>
          Save form
        </button>
      </div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      {problems.length > 0 && (
        <div className="alert info small">To fix before saving: {problems.join(" ")}</div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 320px) 1fr",
          gap: "1rem",
          alignItems: "start",
        }}
      >
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Fields</h3>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {fields.map((x, i) => (
              <li
                key={i}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: ".45rem .55rem",
                  marginBottom: ".35rem",
                  background: i === sel ? "#eef2ff" : "#fff",
                }}
              >
                <button
                  onClick={() => setSel(i)}
                  style={{
                    background: "none",
                    border: "none",
                    font: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    padding: 0,
                  }}
                >
                  <strong>{x.label || x.key}</strong>
                  {x.required && " *"}
                  <div className="small muted">
                    {TYPE_LABEL[x.type] ?? x.type}
                    {x.showIf?.field ? " · conditional" : ""}
                  </div>
                </button>
                <div className="row" style={{ gap: 4, marginTop: 4 }}>
                  <button
                    className="btn small"
                    aria-label="Move up"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    ↑
                  </button>
                  <button
                    className="btn small"
                    aria-label="Move down"
                    onClick={() => move(i, 1)}
                    disabled={i === fields.length - 1}
                  >
                    ↓
                  </button>
                  <button className="btn small danger" onClick={() => remove(i)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <label htmlFor="addf" style={{ marginTop: ".75rem" }}>
            Add a field
          </label>
          <select id="addf" value="" onChange={(e) => e.target.value && add(e.target.value)}>
            <option value="">Choose a type…</option>
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid">
          {f ? (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Field settings</h3>
              <div className="grid cols-2">
                <div className="field">
                  <label htmlFor="fl">Label (what visitors see)</label>
                  <input id="fl" value={f.label} onChange={(e) => set({ label: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="fk">Key (used in reports and formulas)</label>
                  <input id="fk" value={f.key} onChange={(e) => set({ key: e.target.value })} />
                  <div className="help">
                    Use name, phone and email for contact fields so leads are created correctly.
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="ft">Type</label>
                  <select id="ft" value={f.type} onChange={(e) => set({ type: e.target.value })}>
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="fw">Width</label>
                  <select
                    id="fw"
                    value={f.width ?? "full"}
                    onChange={(e) => set({ width: e.target.value })}
                  >
                    <option value="full">Full width</option>
                    <option value="half">Half</option>
                    <option value="third">One third</option>
                  </select>
                </div>
                {!["calculated", "hidden", "consent", "checkbox", "radio", "select"].includes(
                  f.type,
                ) && (
                  <div className="field">
                    <label htmlFor="fp">Placeholder</label>
                    <input
                      id="fp"
                      value={f.placeholder ?? ""}
                      onChange={(e) => set({ placeholder: e.target.value })}
                    />
                  </div>
                )}
                {f.type !== "calculated" && (
                  <div className="field">
                    <label className="row">
                      <input
                        type="checkbox"
                        checked={!!f.required}
                        onChange={(e) => set({ required: e.target.checked })}
                      />{" "}
                      Required
                    </label>
                  </div>
                )}
              </div>
              {(f.type === "select" || f.type === "radio") && (
                <div className="field">
                  <label htmlFor="fo">Options (one per line)</label>
                  <textarea
                    id="fo"
                    value={list(f.options)}
                    onChange={(e) =>
                      set({
                        options: e.target.value
                          .split("\n")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              )}
              {f.type === "calculated" && (
                <>
                  <div className="field">
                    <label htmlFor="ff">Formula</label>
                    <input
                      id="ff"
                      value={f.formula ?? ""}
                      onChange={(e) => set({ formula: e.target.value })}
                      placeholder="round(pmt({rate}/100/12, {years}*12, {amount}), 2)"
                    />
                    <div className="help">
                      Use {"{field_key}"} for other fields. Functions: round, min, max, ceil, floor,
                      abs, pmt(rate, periods, amount). Operators: + − × ÷ % ^.
                    </div>
                  </div>
                  <div className="grid cols-2">
                    <div className="field">
                      <label htmlFor="fpre">Prefix</label>
                      <input
                        id="fpre"
                        value={f.prefix ?? ""}
                        onChange={(e) => set({ prefix: e.target.value })}
                        placeholder="£"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="fsuf">Suffix</label>
                      <input
                        id="fsuf"
                        value={f.suffix ?? ""}
                        onChange={(e) => set({ suffix: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="card" style={{ background: "#f8fafc" }}>
                    <strong className="small">Try the formula</strong>
                    <div className="grid cols-4">
                      {fields
                        .filter((x) => x.type === "number")
                        .map((x) => (
                          <div key={x.key}>
                            <label>{x.key}</label>
                            <input
                              type="number"
                              value={test[x.key] ?? ""}
                              onChange={(e) => setTest({ ...test, [x.key]: e.target.value })}
                            />
                          </div>
                        ))}
                    </div>
                    <p className="small">
                      Result: <strong>{String(calcPreview(f.formula))}</strong>
                    </p>
                  </div>
                </>
              )}
              <div className="card" style={{ background: "#f8fafc", marginTop: ".75rem" }}>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={!!f.showIf?.field}
                    onChange={(e) =>
                      set({
                        showIf: e.target.checked
                          ? { field: fields.find((x) => x.key !== f.key)?.key ?? "", equals: "" }
                          : null,
                      })
                    }
                  />{" "}
                  Show this field only when another answer matches
                </label>
                {f.showIf?.field !== undefined && f.showIf && (
                  <div className="grid cols-2" style={{ marginTop: ".5rem" }}>
                    <div>
                      <label htmlFor="sif">When field</label>
                      <select
                        id="sif"
                        value={f.showIf.field}
                        onChange={(e) => set({ showIf: { ...f.showIf!, field: e.target.value } })}
                      >
                        {fields
                          .filter((x) => x.key !== f.key)
                          .map((x) => (
                            <option key={x.key} value={x.key}>
                              {x.label}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="sie">equals</label>
                      <input
                        id="sie"
                        value={f.showIf.equals}
                        onChange={(e) => set({ showIf: { ...f.showIf!, equals: e.target.value } })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card muted">Add your first field from the list.</div>
          )}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>After someone submits</h3>
            <div className="grid cols-2">
              <div className="field">
                <label htmlFor="sm">Thank-you message</label>
                <textarea
                  id="sm"
                  rows={2}
                  value={settings.successMessage ?? ""}
                  onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="sr">Or send them to a page (optional)</label>
                <input
                  id="sr"
                  value={settings.redirectUrl ?? ""}
                  placeholder="/thank-you"
                  onChange={(e) => setSettings({ ...settings, redirectUrl: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="sb">Button text</label>
                <input
                  id="sb"
                  value={settings.submitLabel ?? ""}
                  placeholder="Send"
                  onChange={(e) => setSettings({ ...settings, submitLabel: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="se">Email each lead to (one per line)</label>
                <textarea
                  id="se"
                  rows={2}
                  value={list(settings.forwardEmails)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      forwardEmails: e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="sw">Send each lead to webhooks (https, one per line)</label>
                <textarea
                  id="sw"
                  rows={2}
                  value={list(settings.webhooks)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      webhooks: e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={!!settings.isTest}
                    onChange={(e) => setSettings({ ...settings, isTest: e.target.checked })}
                  />{" "}
                  Test form (entries do not become leads)
                </label>
              </div>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Use this form</h3>
            <p className="small">
              Add a <strong>Form with text</strong> section in the page builder and choose this
              form, or set any button to “Open a form”. Form ID: <code>{id}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
