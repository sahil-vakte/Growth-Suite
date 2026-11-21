"use client";
import { useState } from "react";

async function post(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export function ForgotForm() {
  const [msg, setMsg] = useState("");
  const [dev, setDev] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { data } = await post("/api/auth/forgot", {
      email: new FormData(e.currentTarget).get("email"),
    });
    setMsg(data.message ?? data.error);
    setDev(data.devResetUrl ?? "");
  }
  return (
    <form onSubmit={submit}>
      {msg && (
        <div className="alert ok" role="status">
          {msg}
        </div>
      )}
      {dev && (
        <p className="small">
          Test mode link: <a href={dev}>reset password</a>
        </p>
      )}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="username" />
      </div>
      <button className="btn primary">Send reset link</button>{" "}
      <a href="/admin/login" className="small">
        Back to sign in
      </a>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("password") !== fd.get("confirm")) {
      setMsg({ ok: false, text: "The two passwords do not match." });
      return;
    }
    const { ok, data } = await post("/api/auth/reset", { token, password: fd.get("password") });
    setMsg({ ok, text: data.message ?? data.error });
  }
  if (msg?.ok)
    return (
      <div>
        <div className="alert ok">{msg.text}</div>
        <a className="btn primary" href="/admin/login">
          Sign in
        </a>
      </div>
    );
  return (
    <form onSubmit={submit}>
      {msg && (
        <div className="alert error" role="alert">
          {msg.text}
        </div>
      )}
      <div className="field">
        <label htmlFor="pw">New password</label>
        <input id="pw" name="password" type="password" required autoComplete="new-password" />
        <div className="help">At least 10 characters, with letters and numbers.</div>
      </div>
      <div className="field">
        <label htmlFor="pw2">Repeat new password</label>
        <input id="pw2" name="confirm" type="password" required autoComplete="new-password" />
      </div>
      <button className="btn primary">Save new password</button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    if (fd.get("next") !== fd.get("confirm")) {
      setMsg({ ok: false, text: "The two new passwords do not match." });
      return;
    }
    const { ok, data } = await post("/api/auth/change-password", {
      current: fd.get("current"),
      next: fd.get("next"),
    });
    setMsg({ ok, text: data.message ?? data.error });
    if (ok) form.reset();
  }
  return (
    <form className="card" style={{ maxWidth: 480 }} onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>Change password</h3>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      <div className="field">
        <label htmlFor="cur">Current password</label>
        <input id="cur" name="current" type="password" required autoComplete="current-password" />
      </div>
      <div className="field">
        <label htmlFor="nx">New password</label>
        <input id="nx" name="next" type="password" required autoComplete="new-password" />
      </div>
      <div className="field">
        <label htmlFor="cf">Repeat new password</label>
        <input id="cf" name="confirm" type="password" required autoComplete="new-password" />
      </div>
      <button className="btn primary">Change password</button>
    </form>
  );
}
