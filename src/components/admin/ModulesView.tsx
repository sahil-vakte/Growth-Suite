"use client";
import { useEffect, useState } from "react";
import { api } from "./ui";

type M = { key: string; name: string; active: boolean; endsAt: string | null };
export default function ModulesView({ platform }: { platform: boolean }) {
  const [rows, setRows] = useState<M[]>([]);
  const [msg, setMsg] = useState("");
  const load = () =>
    api<M[]>("/api/admin/modules").then(({ data }) => setRows(Array.isArray(data) ? data : []));
  useEffect(() => {
    load();
  }, []);
  async function unlock(key: string) {
    const { data } = await api<{ message?: string; error?: string }>("/api/admin/modules", "POST", {
      moduleKey: key,
      months: 12,
    });
    setMsg(data.message ?? data.error ?? "");
    load();
  }
  return (
    <div>
      <h1>Modules</h1>
      <p className="muted">
        Paid add-ons. When licensing is switched off (no LICENCE_PUBLIC_KEY), every module is
        available.
      </p>
      {msg && <div className="alert info">{msg}</div>}
      <table className="data">
        <thead>
          <tr>
            <th>Module</th>
            <th>Status</th>
            <th>Ends</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.key}>
              <td>{m.name}</td>
              <td>
                {m.active ? (
                  <span className="badge green">Unlocked</span>
                ) : (
                  <span className="badge">Locked</span>
                )}
              </td>
              <td>{m.endsAt ? new Date(m.endsAt).toLocaleDateString("en-GB") : "—"}</td>
              <td>
                {platform && (
                  <button className="btn small" onClick={() => unlock(m.key)}>
                    Unlock 12 months
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
