"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "./ui";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  stageId: string | null;
  score: number;
  source: string;
  ownerName: string | null;
};
type Stage = { id: string; name: string; color: string };

/** Pipeline board: drag a card to another column to change its stage (same rules and events as the dropdown). */
export default function LeadsBoard() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [owner, setOwner] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    const { data } = await api<{ rows: Lead[]; stages: Stage[] }>(
      `/api/admin/leads?pageSize=500&owner=${owner}`,
    );
    setLeads(data.rows ?? []);
    setStages(data.stages ?? []);
  }, [owner]);
  useEffect(() => {
    load();
  }, [load]);
  async function move(leadId: string, stageId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === stageId) return;
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, stageId } : l)));
    const { ok, data } = await api<{ error?: string }>(`/api/admin/leads/${leadId}`, "PATCH", {
      stageId,
    });
    if (!ok) {
      setMsg({ ok, text: data.error ?? "Could not move the lead." });
      load();
    }
  }
  const cols: (Stage | { id: ""; name: string; color: string })[] = [
    { id: "", name: "No stage", color: "#94a3b8" },
    ...stages,
  ];
  return (
    <div>
      <div className="topbar">
        <h1>Pipeline</h1>
        <span className="spacer" />
        <select
          aria-label="Owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="">Everyone's leads</option>
          <option value="me">My leads</option>
          <option value="none">Unassigned</option>
        </select>
        <Link className="btn" href="/admin/crm">
          List view
        </Link>
      </div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      <p className="muted small">
        Drag a card into another column to change its stage. Moving a lead triggers the same
        follow-ups and ad conversions as changing it on the lead page. Keyboard users: open the lead
        and use the stage menu.
      </p>
      <div style={{ display: "flex", gap: ".75rem", overflowX: "auto", paddingBottom: "1rem" }}>
        {cols
          .filter((c) => c.id || leads.some((l) => !l.stageId))
          .map((c) => {
            const list = leads.filter((l) => (l.stageId ?? "") === c.id);
            return (
              <section
                key={c.id || "none"}
                aria-label={c.name}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag && c.id) move(drag, c.id);
                  setDrag(null);
                }}
                style={{
                  minWidth: 250,
                  flex: "0 0 250px",
                  background: "#eef1f7",
                  borderRadius: 10,
                  padding: ".6rem",
                  borderTop: `4px solid ${c.color}`,
                }}
              >
                <h3 style={{ margin: "0 0 .5rem", fontSize: ".95rem" }}>
                  {c.name} <span className="muted small">{list.length}</span>
                </h3>
                {list.map((l) => (
                  <article
                    key={l.id}
                    draggable
                    onDragStart={() => setDrag(l.id)}
                    className="card"
                    style={{
                      padding: ".6rem .7rem",
                      marginBottom: ".45rem",
                      cursor: "grab",
                      opacity: drag === l.id ? 0.5 : 1,
                    }}
                  >
                    <Link href={`/admin/crm/${l.id}`}>
                      <strong>{l.name || l.phone || l.email}</strong>
                    </Link>
                    <div className="small muted">
                      {l.source} · score {l.score}
                      {l.ownerName ? ` · ${l.ownerName}` : ""}
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
      </div>
    </div>
  );
}
