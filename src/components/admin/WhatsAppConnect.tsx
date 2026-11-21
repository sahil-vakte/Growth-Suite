"use client";
import { useEffect, useState } from "react";
import { api } from "./ui";

export default function WhatsAppConnect({ partnerId }: { partnerId: string }) {
  const [conn, setConn] = useState<Record<string, string>>({});
  const [waba, setWaba] = useState("");
  const [numbers, setNumbers] = useState<
    { id: string; display_phone_number: string; verified_name: string }[]
  >([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [test, setTest] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  useEffect(() => {
    api<Record<string, string>>("/api/admin/settings/whatsapp.connection").then(({ data }) => {
      setConn(data);
      setWaba(data.wabaId ?? "");
    });
  }, []);
  async function fetchNumbers() {
    const { ok, data } = await api<{ numbers: typeof numbers; error?: string }>(
      "/api/admin/whatsapp/connect",
      "POST",
      { wabaId: waba },
    );
    if (ok) setNumbers(data.numbers);
    else setMsg({ ok: false, text: data.error ?? "Failed" });
  }
  async function save(id: string) {
    const { ok, data } = await api<{ message?: string; error?: string }>(
      "/api/admin/whatsapp/connect",
      "POST",
      { wabaId: waba, phoneNumberId: id },
    );
    setMsg({ ok, text: data.message ?? data.error ?? "" });
    if (ok) setConn({ ...conn, status: "connected", phoneNumberId: id });
  }
  async function tryIt() {
    const { data } = await api<{ reply: string | null; reason: string }>(
      "/api/admin/whatsapp/bot-test",
      "POST",
      { text: test, newChat: false },
    );
    setReply(data.reply ? `${data.reply}  (${data.reason})` : `No reply (${data.reason})`);
  }
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Connection</h3>
      <p>
        Status:{" "}
        {conn.status === "connected" ? (
          <span className="badge green">Connected {conn.displayNumber}</span>
        ) : (
          <span className="badge amber">{conn.status || "Not connected"}</span>
        )}
      </p>
      <ol className="small">
        <li>
          In Meta Business Settings, share your WhatsApp account with our partner business ID
          {partnerId ? (
            <>
              {" "}
              <code>{partnerId}</code>
            </>
          ) : (
            " (set META_PARTNER_BUSINESS_ID)"
          )}{" "}
          with full control.
        </li>
        <li>Enter your WhatsApp Business Account ID below and fetch your numbers.</li>
        <li>Pick the number. Saving checks with Meta that it is really reachable.</li>
      </ol>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      <div className="field">
        <label htmlFor="waba">WhatsApp Business Account ID</label>
        <input
          id="waba"
          value={waba}
          onChange={(e) => setWaba(e.target.value)}
          placeholder="e.g. 102345678901234"
        />
      </div>
      <button className="btn" onClick={fetchNumbers}>
        Fetch my numbers
      </button>
      {numbers.map((n) => (
        <div key={n.id} className="row" style={{ marginTop: ".5rem" }}>
          <span>
            {n.display_phone_number} — {n.verified_name}
          </span>
          <span className="spacer" />
          <button className="btn small primary" onClick={() => save(n.id)}>
            Use this number
          </button>
        </div>
      ))}
      <h3>Try the bot</h3>
      <div className="row">
        <input
          value={test}
          onChange={(e) => setTest(e.target.value)}
          placeholder="Type what a customer might send"
          aria-label="Test message"
          style={{ flex: 1 }}
        />
        <button className="btn" onClick={tryIt}>
          Try it
        </button>
      </div>
      {reply && <p className="alert info">{reply}</p>}
    </div>
  );
}
