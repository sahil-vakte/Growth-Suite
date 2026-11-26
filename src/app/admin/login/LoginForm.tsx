"use client";
import { useState } from "react";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        password: fd.get("password"),
        code: fd.get("code") || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) window.location.href = "/admin";
    else {
      if (data.twoFactor) setTwoFactor(true);
      setError(data.error ?? "Sign-in failed.");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {twoFactor && (
        <div className="field">
          <label htmlFor="code">Authenticator or recovery code</label>
          <input
            id="code"
            name="code"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={40}
          />
          <p className="help">Use the latest six-digit code, or one unused recovery code.</p>
        </div>
      )}
      <button
        className="btn primary"
        disabled={busy}
        style={{ width: "100%", justifyContent: "center" }}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="small" style={{ marginTop: ".75rem" }}>
        <a href="/admin/forgot">Forgot your password?</a>
      </p>
    </form>
  );
}
