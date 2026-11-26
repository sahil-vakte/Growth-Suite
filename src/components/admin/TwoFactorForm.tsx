"use client";
import { useState } from "react";

export default function TwoFactorForm({
  enabled,
  required,
  siteRequired,
  canManage,
  siteName,
}: {
  enabled: boolean;
  required: boolean;
  siteRequired: boolean;
  canManage: boolean;
  siteName: string;
}) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(action: string, policy?: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, password, code, required: policy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Please try again.");
      if (data.secret) setSecret(data.secret);
      else if (data.codes) {
        setCodes(data.codes);
        setSecret("");
        setPassword("");
        setCode("");
      } else window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (codes.length)
    return (
      <section className="card">
        <h2>Save your recovery codes</h2>
        <p>
          Two-factor authentication is enabled. Store these codes in your password manager or print
          them. Each code works once. You will not see this list again.
        </p>
        <ul aria-label="Recovery codes">
          {codes.map((c) => (
            <li key={c}>
              <code>{c}</code>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={() => window.print()}>
          Print codes
        </button>{" "}
        <a className="btn primary" href="/admin">
          I have saved my codes
        </a>
      </section>
    );
  return (
    <section className="card" style={{ maxWidth: 680 }}>
      <h2>Two-factor authentication</h2>
      <p>
        {enabled
          ? "Enabled. Your account requires a code when you sign in."
          : "Add a second step at sign-in using an authenticator app."}
      </p>
      {required && (
        <div className="alert">
          Your site requires administrators to set this up before continuing.
        </div>
      )}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(enabled ? "disable" : secret ? "confirm" : "begin");
        }}
      >
        <div className="field">
          <label htmlFor="mfa-password">Current password</label>
          <input
            id="mfa-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={200}
          />
        </div>
        {secret && (
          <div>
            <h3>Connect your authenticator</h3>
            <ol>
              <li>Open your authenticator app and choose to add an account using a setup key.</li>
              <li>
                Name it Growth Suite, choose time-based codes and enter this key:{" "}
                <p>
                  <code style={{ overflowWrap: "anywhere" }}>{secret}</code>
                </p>
              </li>
              <li>Enter the six-digit code below. This setup key expires in ten minutes.</li>
            </ol>
          </div>
        )}
        {(secret || enabled) && (
          <div className="field">
            <label htmlFor="mfa-code">
              {enabled ? "Authenticator or recovery code" : "Authenticator code"}
            </label>
            <input
              id="mfa-code"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={40}
            />
          </div>
        )}
        <button className={`btn ${enabled ? "" : "primary"}`} disabled={busy}>
          {busy
            ? "Please wait..."
            : enabled
              ? "Turn off two-factor authentication"
              : secret
                ? "Verify and enable"
                : "Set up authenticator"}
        </button>
        {secret && (
          <button type="button" className="btn" disabled={busy} onClick={() => void send("begin")}>
            Restart setup
          </button>
        )}
      </form>
      {canManage && enabled && (
        <section style={{ marginTop: "2rem" }}>
          <h3>Security for {siteName}</h3>
          <p>
            {siteRequired
              ? "Administrators must use two-factor authentication."
              : "Two-factor authentication is optional for administrators."}{" "}
            Editors and sales users can enable it for their own accounts.
          </p>
          <button
            className="btn"
            disabled={busy || !password}
            onClick={() => void send("policy", !siteRequired)}
          >
            {siteRequired ? "Make optional for administrators" : "Require for administrators"}
          </button>
          <p className="small muted">
            Enter your current password above to change this site's policy.
          </p>
        </section>
      )}
    </section>
  );
}
