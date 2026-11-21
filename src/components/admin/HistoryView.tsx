"use client";
import { useEffect, useState } from "react";
import { api } from "./ui";

type R = {
  id: string;
  entity: string;
  entityId: string;
  operation: string;
  actor: string;
  createdAt: string;
  snapshot: Record<string, unknown>;
};
export default function HistoryView() {
  const [op, setOp] = useState("");
  const [rows, setRows] = useState<R[]>([]);
  const [msg, setMsg] = useState("");
  const load = () =>
    api<R[]>(`/api/admin/history${op ? `?op=${op}` : ""}`).then(({ data }) =>
      setRows(Array.isArray(data) ? data : []),
    );
  useEffect(() => {
    load();
  }, [op]);
  async function restore(id: string) {
    if (!confirm("Restore this version? The current version is saved first, so you can undo this."))
      return;
    const { data } = await api<{ message?: string; error?: string }>(
      `/api/admin/history/${id}/restore`,
      "POST",
      {},
    );
    setMsg(data.message ?? data.error ?? "");
    load();
  }
  return (
    <div>
      <div className="topbar">
        <h1>Content history</h1>
        <span className="spacer" />
        <select
          aria-label="Filter"
          value={op}
          onChange={(e) => setOp(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="">All changes</option>
          <option value="update">Edits only</option>
          <option value="delete">Deletions only</option>
        </select>
      </div>
      <p className="muted">
        Every edit and deletion is saved automatically before it happens. The last three versions of
        each item are kept.
      </p>
      {msg && <div className="alert info">{msg}</div>}
      <table className="data">
        <thead>
          <tr>
            <th>When</th>
            <th>What</th>
            <th>Change</th>
            <th>Who</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="small">{new Date(r.createdAt).toLocaleString("en-GB")}</td>
              <td>
                {r.entity}:{" "}
                {String(
                  r.snapshot.title ??
                    r.snapshot.name ??
                    r.snapshot.label ??
                    r.snapshot.layoutKey ??
                    r.entityId,
                )}
              </td>
              <td>
                <span className={`badge ${r.operation === "delete" ? "red" : ""}`}>
                  {r.operation === "update"
                    ? "before edit"
                    : r.operation === "delete"
                      ? "deleted"
                      : "before restore"}
                </span>
              </td>
              <td className="small">{r.actor}</td>
              <td>
                <button className="btn small" onClick={() => restore(r.id)}>
                  Restore
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={5} className="muted">
                No changes recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
