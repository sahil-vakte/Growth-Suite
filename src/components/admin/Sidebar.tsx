"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface Props {
  appName: string;
  groups: { label: string; items: { label: string; href: string }[] }[];
  sites: { id: string; name: string; domain: string }[];
  siteId: string;
  userName: string;
  role: string;
}

export default function Sidebar({ appName, groups, sites, siteId, userName, role }: Props) {
  const path = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isActive = (href: string) =>
    href === "/admin" ? path === href : path === href || path.startsWith(href + "/");
  const filtered = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) =>
        `${g.label} ${i.label}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    }))
    .filter((g) => g.items.length);
  async function switchSite(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/switch-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: id }),
      });
      if (!response.ok) throw new Error();
      window.location.href = "/admin";
    } catch {
      setError("Could not switch websites. Please try again.");
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.href = "/admin/login";
    } catch {
      setError("Could not sign out. Please try again.");
      setBusy(false);
    }
  }
  return (
    <aside className={`sidebar${open ? " is-open" : ""}`}>
      <div className="sidebar-heading">
        <Link href="/admin" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            g
          </span>
          {appName}
        </Link>
        <button
          className="btn small mobile-nav-toggle"
          aria-expanded={open}
          aria-controls="admin-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close menu" : "Menu"}
        </button>
      </div>
      <div
        id="admin-navigation"
        className="sidebar-content"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            document.querySelector<HTMLButtonElement>(".mobile-nav-toggle")?.focus();
          }
        }}
      >
        <div className="workspace-picker">
          <label htmlFor="workspace">Workspace</label>
          <select
            id="workspace"
            aria-label="Choose website"
            value={siteId}
            disabled={busy}
            onChange={(e) => switchSite(e.target.value)}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} / {s.domain}
              </option>
            ))}
          </select>
        </div>
        <div className="nav-search">
          <label htmlFor="find-page" className="sr-only">
            Find a page
          </label>
          <input
            id="find-page"
            type="search"
            placeholder="Find a page..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <nav aria-label="Admin">
          {filtered.map((g) => (
            <details
              className="nav-group"
              key={`${g.label}-${path}-${!!query}`}
              open={!!query || g.items.some((i) => isActive(i.href)) || g.label === "Overview"}
            >
              <summary>{g.label}</summary>
              {g.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={isActive(i.href) ? "page" : undefined}
                  className={isActive(i.href) ? "active" : ""}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {i.label}
                </Link>
              ))}
            </details>
          ))}
          {!filtered.length && (
            <p className="muted small nav-empty" role="status">
              No pages match. Try a different name.
            </p>
          )}
        </nav>
        <div className="sidebar-account">
          <span className="avatar" aria-hidden="true">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{userName}</strong>
            <span className="muted small role-label">{role}</span>
          </div>
          <div className="row account-actions">
            <Link href="/admin/account">My account</Link>
            <button className="text-button" disabled={busy} onClick={logout}>
              Sign out
            </button>
          </div>
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
