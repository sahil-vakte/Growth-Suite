"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./ui";
import { renderTemplate } from "@/lib/engines/templating";

type Activity = {
  id: string;
  type: string;
  body: string | null;
  actor: string | null;
  createdAt: string;
  meta: Record<string, unknown> | null;
};
type Data = {
  lead: Record<string, unknown> & {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    stageId: string | null;
    score: number;
    source: string;
    attribution: Record<string, string>;
    customFields: Record<string, unknown>;
    optedOut: boolean;
    waVerified: boolean;
    createdAt: string;
    lastInboundAt: string | null;
  };
  timeline: Activity[];
  submissions: { id: string; data: Record<string, unknown>; pageUrl: string; createdAt: string }[];
  journey: { id: string; name: string; pageUrl: string; createdAt: string; source: string }[];
  stages: { id: string; name: string; color: string }[];
  bookings: { id: string; startsAt: string; status: string }[];
  conversions: { id: string; platform: string; status: string; createdAt: string }[];
};

export default function LeadDetail({
  id,
  waTemplates,
  replyTemplates,
  isAdmin,
}: {
  id: string;
  waTemplates: { id: string; name: string }[];
  replyTemplates: { name: string; body: string }[];
  isAdmin: boolean;
}) {
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    api<{ id: string; name: string }[]>("/api/admin/crm/team").then(({ data }) =>
      setTeam(Array.isArray(data) ? data : []),
    );
  }, []);
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState("timeline");
  const [note, setNote] = useState("");
  const [wa, setWa] = useState("");
  const [tpl, setTpl] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(
    () =>
      api<Data>(`/api/admin/leads/${id}`).then(({ ok, data }) =>
        ok
          ? setD(data)
          : setMsg({ ok: false, text: String((data as unknown as { error: string }).error) }),
      ),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (!d)
    return msg ? <div className="alert error">{msg.text}</div> : <p className="muted">Loading…</p>;
  const l = d.lead;
  async function setStage(stageId: string) {
    const { ok, data } = await api<{ error?: string }>(`/api/admin/leads/${id}`, "PATCH", {
      stageId,
    });
    setMsg({ ok, text: ok ? "Stage updated." : (data.error ?? "") });
    load();
  }
  async function addNote(type: "note" | "call") {
    if (!note.trim()) return;
    await api(`/api/admin/leads/${id}/notes`, "POST", { text: note, type });
    setNote("");
    load();
  }
  async function sendWa() {
    const { ok, data } = await api<{ message?: string; error?: string }>(
      `/api/admin/leads/${id}/whatsapp`,
      "POST",
      tpl ? { templateId: tpl } : { text: wa },
    );
    setMsg({ ok, text: data.message ?? data.error ?? "" });
    if (ok) {
      setWa("");
      setTpl("");
    }
    load();
  }
  async function erase() {
    if (!confirm("Permanently erase this lead and all their personal data? This cannot be undone."))
      return;
    const { ok, data } = await api<{ message?: string; error?: string }>(
      `/api/admin/leads/${id}`,
      "DELETE",
    );
    if (ok) location.href = "/admin/crm";
    else setMsg({ ok, text: data.error ?? "" });
  }
  const vars = {
    name: l.name ?? "",
    first_name: (l.name ?? "").split(" ")[0],
    phone: l.phone ?? "",
    email: l.email ?? "",
  };
  const openWa = (text: string) =>
    l.phone &&
    window.open(
      `https://wa.me/${l.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`,
      "_blank",
    );
  const inWindow =
    l.lastInboundAt && Date.now() - new Date(l.lastInboundAt).getTime() < 24 * 3600_000;
  return (
    <div>
      <div className="topbar">
        <div>
          <h1>{l.name || l.phone || l.email}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {l.source} · added {new Date(l.createdAt).toLocaleString("en-GB")} · score {l.score}
            {l.optedOut && " · opted out of WhatsApp"}
            {l.waVerified && " · WhatsApp verified"}
          </p>
        </div>
        <span className="spacer" />
        <select
          aria-label="Owner"
          value={String(l.ownerId ?? "")}
          onChange={async (e) => {
            await api(`/api/admin/leads/${id}`, "PATCH", { ownerId: e.target.value || null });
            setMsg({ ok: true, text: "Owner updated." });
            load();
          }}
          style={{ maxWidth: 200 }}
        >
          <option value="">Unassigned</option>
          {team.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Stage"
          value={l.stageId ?? ""}
          onChange={(e) => setStage(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="" disabled>
            Choose stage
          </option>
          {d.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      <div className="grid cols-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Contact</h3>
          {l.phone && (
            <p>
              <a href={`tel:${l.phone}`}>📞 {l.phone}</a> ·{" "}
              <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank">
                WhatsApp
              </a>
            </p>
          )}
          {l.email && (
            <p>
              <a href={`mailto:${l.email}`}>✉️ {l.email}</a>
            </p>
          )}
          <h3>Submitted details</h3>
          <table className="data">
            <tbody>
              {Object.entries(l.customFields).map(([k, v]) => (
                <tr key={k}>
                  <td className="muted">{k}</td>
                  <td>{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Ad source</h3>
          <table className="data">
            <tbody>
              {[
                "utm_source",
                "utm_medium",
                "utm_campaign",
                "utm_content",
                "utm_term",
                "landingPage",
                "referrer",
                "device",
              ]
                .filter((k) => l.attribution[k])
                .map((k) => (
                  <tr key={k}>
                    <td className="muted">{k}</td>
                    <td className="small">{l.attribution[k]}</td>
                  </tr>
                ))}
              <tr>
                <td className="muted">Google click ID</td>
                <td>
                  {l.attribution.gclid || l.attribution.gbraid || l.attribution.wbraid
                    ? "captured"
                    : "none"}
                </td>
              </tr>
              <tr>
                <td className="muted">Meta click ID</td>
                <td>{l.attribution.fbclid ? "captured" : "none"}</td>
              </tr>
            </tbody>
          </table>
          {d.conversions.length > 0 && (
            <>
              <h3>Sent to ad platforms</h3>
              {d.conversions.map((c) => (
                <p key={c.id} className="small">
                  {c.platform}:{" "}
                  <span
                    className={`badge ${c.status === "sent" ? "green" : c.status === "failed" ? "red" : ""}`}
                  >
                    {c.status}
                  </span>{" "}
                  {new Date(c.createdAt).toLocaleString("en-GB")}
                </p>
              ))}
            </>
          )}
          <div className="row" style={{ marginTop: "1rem" }}>
            <a className="btn small" href={`/api/admin/leads/${id}/export`}>
              Export data (SAR)
            </a>
            {isAdmin && (
              <button className="btn small danger" onClick={erase}>
                Erase (right to be forgotten)
              </button>
            )}
          </div>
        </div>
        <div className="card">
          <div className="tabs" role="tablist">
            {["timeline", "whatsapp", "journey", "submissions"].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? "on" : ""}
                onClick={() => setTab(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {tab === "timeline" && (
            <>
              <textarea
                aria-label="Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note or log a call…"
                rows={3}
              />
              <div className="row" style={{ margin: ".5rem 0 1rem" }}>
                <button className="btn small primary" onClick={() => addNote("note")}>
                  Add note
                </button>
                <button className="btn small" onClick={() => addNote("call")}>
                  Log call
                </button>
              </div>
              <div className="timeline">
                {d.timeline.map((a) => (
                  <div key={a.id} className="item">
                    <div className="when">
                      {new Date(a.createdAt).toLocaleString("en-GB")} · {a.type.replace("_", " ")}
                      {a.actor ? ` · ${a.actor}` : ""}
                    </div>
                    <div style={{ whiteSpace: "pre-line" }}>{a.body}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "whatsapp" && (
            <>
              {l.optedOut ? (
                <div className="alert error">This person replied STOP. Do not message them.</div>
              ) : (
                <>
                  <label htmlFor="tpl">Approved template (any time)</label>
                  <select id="tpl" value={tpl} onChange={(e) => setTpl(e.target.value)}>
                    <option value="">—</option>
                    {waTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="wa" style={{ marginTop: ".75rem" }}>
                    Free-text reply{" "}
                    {inWindow
                      ? "(customer wrote in the last 24 hours)"
                      : "(only within 24 hours of their last message)"}
                  </label>
                  <textarea
                    id="wa"
                    value={wa}
                    onChange={(e) => setWa(e.target.value)}
                    rows={3}
                    disabled={!inWindow}
                  />
                  <div className="row" style={{ margin: ".5rem 0" }}>
                    <button className="btn primary small" onClick={sendWa} disabled={!tpl && !wa}>
                      Send via WhatsApp Business
                    </button>
                  </div>
                  {replyTemplates.length > 0 && (
                    <>
                      <h3>Quick replies (opens WhatsApp)</h3>
                      {replyTemplates.map((r) => (
                        <button
                          key={r.name}
                          className="btn small"
                          style={{ margin: 2 }}
                          onClick={() => openWa(renderTemplate(r.body, vars))}
                        >
                          {r.name}
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}
          {tab === "journey" && (
            <div className="timeline">
              {d.journey.length ? (
                d.journey.map((e) => (
                  <div key={e.id} className="item">
                    <div className="when">
                      {new Date(e.createdAt).toLocaleString("en-GB")} · {e.source}
                    </div>
                    {e.name.replace("_", " ")} {e.pageUrl}
                  </div>
                ))
              ) : (
                <p className="muted">No website visits linked to this lead.</p>
              )}
            </div>
          )}
          {tab === "submissions" &&
            (d.submissions.length ? (
              d.submissions.map((s) => (
                <div key={s.id} className="card" style={{ marginBottom: ".5rem" }}>
                  <div className="small muted">
                    {new Date(s.createdAt).toLocaleString("en-GB")} · {s.pageUrl}
                  </div>
                  <pre className="small" style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(
                      Object.fromEntries(
                        Object.entries(s.data).filter(([k]) => !k.startsWith("__")),
                      ),
                      null,
                      2,
                    )}
                  </pre>
                </div>
              ))
            ) : (
              <p className="muted">No form submissions.</p>
            ))}
        </div>
      </div>
    </div>
  );
}
