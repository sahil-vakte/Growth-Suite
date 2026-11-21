"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  async function switchSite(id: string) {
    await fetch("/api/auth/switch-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: id }),
    });
    window.location.href = "/admin";
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }
  return (
    <aside className="sidebar">
      <div className="brand">{appName}</div>
      {sites.length > 1 ? (
        <select
          aria-label="Choose website"
          value={siteId}
          onChange={(e) => switchSite(e.target.value)}
          style={{
            background: "#1e293b",
            color: "#fff",
            borderColor: "#334155",
            marginBottom: ".5rem",
          }}
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.domain}
            </option>
          ))}
        </select>
      ) : (
        <div className="small" style={{ padding: "0 .5rem .5rem" }}>
          {sites[0]?.name}
        </div>
      )}
      <nav aria-label="Admin">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="group">{g.label}</div>
            {g.items.map((i) => {
              const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} className={active ? "active" : ""}>
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div
        style={{
          borderTop: "1px solid #1e293b",
          marginTop: "1rem",
          paddingTop: ".75rem",
          fontSize: ".8rem",
        }}
      >
        <div style={{ color: "#fff" }}>{userName}</div>
        <div>{role}</div>
        <div className="row" style={{ marginTop: ".5rem" }}>
          <Link href="/admin/account" className="btn small">
            My account
          </Link>
          <button className="btn small" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
