"use client";
import { useMemo, useRef, useState } from "react";
import type { FormField } from "@/lib/services/forms";
import { evaluateFormula } from "@/lib/engines/formula";

function cookie(name: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="))
    ?.split("=")[1];
}

export default function FormClient({
  formId,
  fields,
  submitLabel,
}: {
  formId: string;
  fields: FormField[];
  submitLabel: string;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [message, setMessage] = useState("");
  const renderedAt = useRef(Date.now());
  const visible = (f: FormField) =>
    !f.showIf || String(values[f.showIf.field] ?? "") === f.showIf.equals;
  const calc = useMemo(
    () =>
      Object.fromEntries(
        fields
          .filter((f) => f.type === "calculated" && f.formula)
          .map((f) => {
            try {
              return [
                f.key,
                evaluateFormula(
                  f.formula!,
                  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])),
                ),
              ];
            } catch {
              return [f.key, null];
            }
          }),
      ),
    [fields, values],
  );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy");
    setErrors({});
    setMessage("");
    const hp =
      (e.currentTarget.elements.namedItem("company_website") as HTMLInputElement | null)?.value ??
      "";
    const res = await fetch(`/api/public/forms/${formId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        values,
        visitorId: cookie("gs_vid"),
        pageUrl: location.href,
        renderedAt: renderedAt.current,
        hp,
        ids: {
          fbp: cookie("_fbp"),
          fbc: cookie("_fbc"),
          gaClientId: cookie("_ga")?.split(".").slice(-2).join("."),
        },
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({
        event: "cms_form_submit",
        form_id: formId,
      });
      if (d.redirectUrl) {
        location.href = d.redirectUrl;
        return;
      }
      setState("done");
      setMessage(d.message);
    } else {
      setState("idle");
      setMessage(d.error ?? "Please try again.");
      setErrors(d.errors ?? {});
    }
  }
  if (state === "done")
    return (
      <div className="s-form-done" role="status">
        {message}
      </div>
    );
  const set = (k: string, v: unknown) => setValues((p) => ({ ...p, [k]: v }));
  return (
    <form id={`form-${formId}`} className="s-form" onSubmit={submit} noValidate>
      <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
        <label>
          Website
          <input name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {message && (
        <div className="s-form-error" role="alert">
          {message}
        </div>
      )}
      <div className="s-form-grid">
        {fields.filter(visible).map((f) => {
          const id = `${formId}-${f.key}`;
          const err = errors[f.key];
          const common = {
            id,
            name: f.key,
            required: f.required,
            placeholder: f.placeholder,
            "aria-invalid": !!err || undefined,
            "aria-describedby": err ? `${id}-err` : undefined,
          };
          if (f.type === "hidden")
            return (
              <input key={f.key} type="hidden" name={f.key} value={String(values[f.key] ?? "")} />
            );
          return (
            <div key={f.key} className={`s-field w-${f.width ?? "full"}`}>
              {f.type === "consent" || f.type === "checkbox" ? (
                <label className="s-check">
                  <input
                    type="checkbox"
                    {...common}
                    checked={!!values[f.key]}
                    onChange={(e) => set(f.key, e.target.checked)}
                  />{" "}
                  {f.label}
                  {f.required && " *"}
                </label>
              ) : (
                <label htmlFor={id}>
                  {f.label}
                  {f.required && " *"}
                </label>
              )}
              {f.type === "textarea" ? (
                <textarea
                  {...common}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : f.type === "select" ? (
                <select
                  {...common}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                >
                  <option value="">Choose…</option>
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === "radio" ? (
                <div role="radiogroup">
                  {f.options?.map((o) => (
                    <label key={o} className="s-check">
                      <input
                        type="radio"
                        name={f.key}
                        value={o}
                        checked={values[f.key] === o}
                        onChange={() => set(f.key, o)}
                      />{" "}
                      {o}
                    </label>
                  ))}
                </div>
              ) : f.type === "calculated" ? (
                <output className="s-calc" htmlFor={id}>
                  {f.prefix}
                  {calc[f.key] === null ||
                  calc[f.key] === undefined ||
                  !Number.isFinite(Number(calc[f.key]))
                    ? "—"
                    : Number(calc[f.key]).toLocaleString("en-GB", { maximumFractionDigits: 2 })}
                  {f.suffix}
                </output>
              ) : f.type === "consent" || f.type === "checkbox" ? null : (
                <input
                  {...common}
                  type={
                    f.type === "tel"
                      ? "tel"
                      : f.type === "email"
                        ? "email"
                        : f.type === "number"
                          ? "number"
                          : f.type === "date"
                            ? "date"
                            : "text"
                  }
                  autoComplete={
                    f.type === "email"
                      ? "email"
                      : f.type === "tel"
                        ? "tel"
                        : f.key === "name"
                          ? "name"
                          : undefined
                  }
                  value={String(values[f.key] ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
              {err && (
                <div id={`${id}-err`} className="s-err">
                  {err}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="s-btn primary" disabled={state === "busy"}>
        {state === "busy" ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
