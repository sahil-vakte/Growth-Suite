"use client";
import { useEffect, useState } from "react";
import { api } from "./ui";

type U = { id: string; userId: string; email: string; name: string; status: string; lastLoginAt: string | null; role: string; crmAccess: string; mcpAccess: boolean; socialLevel: string; socialApprove: boolean };
const blank = { email: "", name: "", password: "", role: "editor", crmAccess: "inherit", mcpAccess: false, socialLevel: "executive", socialApprove: false };

export default function UsersManager({ selfId }: { selfId: string }) {
  const [rows, setRows] = useState<U[]>([]); const [form, setForm] = useState(blank); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () => api<U[]>("/api/admin/users").then(({ data }) => setRows(Array.isArray(data) ? data : []));
  useEffect(() => { load(); }, []);
  async function add(e: React.FormEvent) { e.preventDefault(); const { ok, data } = await api<{ error?: string }>("/api/admin/users", "POST", form); setMsg({ ok, text: ok ? "User added." : data.error ?? "Failed" }); if (ok) { setForm(blank); load(); } }
  async function patch(id: string, body: Partial<U> & { password?: string }) { const { ok, data } = await api<{ error?: string }>(`/api/admin/users/${id}`, "PATCH", body); setMsg({ ok, text: ok ? "Saved." : data.error ?? "Failed" }); load(); }
  async function remove(id: string) { if (!confirm("Remove this person from the site?")) return; const { ok, data } = await api<{ error?: string }>(`/api/admin/users/${id}`, "DELETE"); setMsg({ ok, text: ok ? "Removed." : data.error ?? "Failed" }); load(); }
  const sel = (u: U, k: keyof U, opts: string[]) => <select aria-label={String(k)} value={String(u[k])} onChange={(e) => patch(u.id, { [k]: e.target.value } as Partial<U>)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
  return (
    <div>
      <h1>Users</h1>
      <p className="muted">Admins manage everything. Editors manage content and marketing (pages last edited by an admin are locked for them). Sales users see only the CRM.</p>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      <table className="data"><thead><tr><th>Person</th><th>Role</th><th>CRM</th><th>Social posting</th><th>Approver</th><th>AI assistant</th><th>Status</th><th>Last sign-in</th><th /></tr></thead><tbody>
        {rows.map((u) => <tr key={u.id}><td><strong>{u.name}</strong><div className="small muted">{u.email}</div><div className="small muted">ID: <code>{u.userId}</code></div></td><td>{sel(u, "role", ["admin", "editor", "sales"])}</td><td>{sel(u, "crmAccess", ["inherit", "allow", "deny"])}</td><td>{sel(u, "socialLevel", ["executive", "publisher", "none"])}</td>
          <td><input type="checkbox" aria-label="Can approve posts" checked={u.socialApprove} onChange={(e) => patch(u.id, { socialApprove: e.target.checked })} /></td><td><input type="checkbox" aria-label="Can connect AI assistant" checked={u.mcpAccess} onChange={(e) => patch(u.id, { mcpAccess: e.target.checked })} /></td>
          <td>{sel(u, "status", ["active", "disabled"])}</td><td className="small">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB") : "Never"}</td><td>{u.userId !== selfId && <button className="btn small danger" onClick={() => remove(u.id)}>Remove</button>}</td></tr>)}
      </tbody></table>
      <form className="card" style={{ marginTop: "1rem", maxWidth: 640 }} onSubmit={add}>
        <h3 style={{ marginTop: 0 }}>Add a user</h3>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="ue">Email</label><input id="ue" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="un">Name</label><input id="un" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="up">Password (new people only)</label><input id="up" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><div className="help">At least 10 characters with letters and numbers.</div></div>
          <div className="field"><label htmlFor="ur">Role</label><select id="ur" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>editor</option><option>admin</option><option>sales</option></select></div>
        </div>
        <button className="btn primary">Add user</button>
      </form>
    </div>
  );
}
