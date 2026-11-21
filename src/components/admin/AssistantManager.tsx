"use client";
import { useEffect, useState } from "react";
import { api } from "./ui";

type Client = {
  id: string;
  name: string;
  clientId: string;
  permissions: Record<string, string>;
  active: boolean;
  requireAdminApproval: boolean;
  lastUsedAt: string | null;
};

export default function AssistantManager({ baseUrl }: { baseUrl: string }) {
  const [data, setData] = useState<{ groups: string[]; clients: Client[] }>({
    groups: [],
    clients: [],
  });
  const [name, setName] = useState("Claude");
  const [secret, setSecret] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [msg, setMsg] = useState("");
  const load = () =>
    api<{ groups: string[]; clients: Client[] }>("/api/admin/mcp-clients").then(({ data }) =>
      setData(data),
    );
  useEffect(() => {
    load();
  }, []);
  async function create() {
    const perms = Object.fromEntries(data.groups.map((g) => [g, "read"]));
    const { ok, data: d } = await api<{ clientId: string; clientSecret: string; error?: string }>(
      "/api/admin/mcp-clients",
      "POST",
      { name, permissions: perms },
    );
    if (ok) {
      setSecret(d);
      load();
    } else setMsg(d.error ?? "Failed");
  }
  async function patch(id: string, body: Record<string, unknown>) {
    const { data: d } = await api<{ clientSecret?: string; message?: string; error?: string }>(
      `/api/admin/mcp-clients/${id}`,
      "PATCH",
      body,
    );
    if (d.clientSecret)
      setSecret({
        clientId: data.clients.find((c) => c.id === id)!.clientId,
        clientSecret: d.clientSecret,
      });
    setMsg(d.message ?? d.error ?? "Saved.");
    load();
  }
  async function remove(id: string) {
    if (confirm("Disconnect this assistant?")) {
      await api(`/api/admin/mcp-clients/${id}`, "DELETE");
      load();
    }
  }
  return (
    <div>
      <h1>AI assistant connector (MCP)</h1>
      <p className="muted">
        Let Claude, ChatGPT or any MCP client work on this site in plain language. Choose Off, Read
        or Write per area. There are no delete tools, and knowledge an assistant adds waits for your
        approval.
      </p>
      <div className="card">
        <p className="small">
          Server URL: <code>{baseUrl}/api/mcp</code> · Token URL (OAuth client credentials):{" "}
          <code>{baseUrl}/api/mcp/token</code>
        </p>
        <div className="row">
          <input
            aria-label="Connection name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button className="btn primary" onClick={create}>
            Create connection
          </button>
        </div>
        {secret && (
          <div className="alert ok">
            Client ID: <code>{secret.clientId}</code>
            <br />
            Client secret: <code>{secret.clientSecret}</code>
            <br />
            <strong>Copy the secret now — it will not be shown again.</strong>
          </div>
        )}
        {msg && <div className="alert info">{msg}</div>}
      </div>
      {data.clients.map((c) => (
        <div className="card" key={c.id} style={{ marginTop: "1rem" }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>{c.name}</h3>
            <code className="small">{c.clientId}</code>
            <span className="spacer" />
            <span className="small muted">
              Last used: {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString("en-GB") : "never"}
            </span>
          </div>
          <div className="grid cols-4" style={{ marginTop: ".75rem" }}>
            {data.groups.map((g) => (
              <div key={g}>
                <label htmlFor={`${c.id}-${g}`}>{g}</label>
                <select
                  id={`${c.id}-${g}`}
                  value={c.permissions[g] ?? "off"}
                  onChange={(e) =>
                    patch(c.id, { permissions: { ...c.permissions, [g]: e.target.value } })
                  }
                >
                  <option>off</option>
                  <option>read</option>
                  <option>write</option>
                </select>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: ".75rem" }}>
            <label className="row">
              <input
                type="checkbox"
                checked={c.active}
                onChange={(e) => patch(c.id, { active: e.target.checked })}
              />{" "}
              Active
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={c.requireAdminApproval}
                onChange={(e) => patch(c.id, { requireAdminApproval: e.target.checked })}
              />{" "}
              Block new tokens (require admin)
            </label>
            <span className="spacer" />
            <button className="btn small" onClick={() => patch(c.id, { rotate: true })}>
              Rotate secret
            </button>
            <button className="btn small danger" onClick={() => remove(c.id)}>
              Disconnect
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
