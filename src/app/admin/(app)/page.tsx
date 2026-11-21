import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { forms, leads, leadStages, pages, waAutomations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/current";
import { analyticsSummary } from "@/lib/services/analytics";
import { getSetting } from "@/lib/settings";
import { availableProviders } from "@/lib/integrations/ai";
import { balance } from "@/lib/services/credits";

export default async function Dashboard() {
  const ctx = await requireAdmin();
  const sid = ctx.site.id;
  const [a, recent, [{ np }], [{ nf }], [{ na }], wa, meta, credits] = await Promise.all([
    analyticsSummary(sid, 30),
    db
      .select({ l: leads, s: leadStages })
      .from(leads)
      .leftJoin(leadStages, eq(leadStages.id, leads.stageId))
      .where(eq(leads.siteId, sid))
      .orderBy(desc(leads.createdAt))
      .limit(8),
    db
      .select({ np: count() })
      .from(pages)
      .where(and(eq(pages.siteId, sid), eq(pages.status, "published"))),
    db.select({ nf: count() }).from(forms).where(eq(forms.siteId, sid)),
    db
      .select({ na: count() })
      .from(waAutomations)
      .where(and(eq(waAutomations.siteId, sid), eq(waAutomations.active, true))),
    getSetting(sid, "whatsapp.connection"),
    getSetting(sid, "integrations.meta"),
    balance(sid),
  ]);
  const fmt = (m: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: ctx.site.currency }).format(
      m / 100,
    );
  const checklist = [
    { done: np > 0, label: "Publish your first page", href: "/admin/r/pages" },
    { done: nf > 0, label: "Create a lead form", href: "/admin/r/forms" },
    {
      done: wa.status === "connected",
      label: "Connect WhatsApp Business",
      href: "/admin/whatsapp",
    },
    {
      done: !!meta.pixelId,
      label: "Add your Meta Pixel & Conversions API",
      href: "/admin/integrations",
    },
    {
      done: na > 0,
      label: "Switch on a WhatsApp follow-up automation",
      href: "/admin/r/wa-automations",
    },
  ];
  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Welcome back, {ctx.user.name.split(" ")[0]}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {ctx.site.name} · last 30 days
          </p>
        </div>
        <span className="spacer" />
        <a className="btn" href={`/`} target="_blank">
          View website ↗
        </a>
      </div>
      <div className="grid cols-4">
        <div className="card">
          <div className="stat">{a.users.toLocaleString("en-GB")}</div>
          <div className="stat-label">Visitors</div>
        </div>
        <div className="card">
          <div className="stat">{a.leads.toLocaleString("en-GB")}</div>
          <div className="stat-label">New leads</div>
        </div>
        <div className="card">
          <div className="stat">{a.conversions.total}</div>
          <div className="stat-label">
            Enquiries (forms {a.conversions.forms} · calls {a.conversions.calls} · WhatsApp{" "}
            {a.conversions.whatsapp})
          </div>
        </div>
        <div className="card">
          <div className="stat">{a.conversionRate}%</div>
          <div className="stat-label">Visitor → enquiry rate</div>
        </div>
      </div>
      <div className="grid cols-2" style={{ marginTop: "1rem" }}>
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>Latest leads</h3>
            <span className="spacer" />
            <Link href="/admin/crm">All leads →</Link>
          </div>
          <table className="data" style={{ marginTop: ".75rem" }}>
            <tbody>
              {recent.map(({ l, s }) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/admin/crm/${l.id}`}>{l.name || l.phone || l.email}</Link>
                    <div className="muted small">
                      {l.source} ·{" "}
                      {l.createdAt.toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  </td>
                  <td>
                    {s ? (
                      <span
                        className="badge"
                        style={{ background: s.color + "22", color: s.color }}
                      >
                        {s.name}
                      </span>
                    ) : null}
                  </td>
                  <td className="small">Score {l.score}</td>
                </tr>
              ))}
              {!recent.length && (
                <tr>
                  <td className="muted">
                    No leads yet. They appear here as soon as someone enquires.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Set-up checklist</h3>
          {checklist.map((c) => (
            <p key={c.label} style={{ margin: ".45rem 0" }}>
              {c.done ? "✅" : "⬜️"} <Link href={c.href}>{c.label}</Link>
            </p>
          ))}
          <h3>AI credits</h3>
          <p style={{ margin: 0 }}>
            <strong>{fmt(credits)}</strong> · providers: {availableProviders().join(", ")}
          </p>
          {availableProviders()[0] === "mock" && (
            <p className="muted small">
              AI runs in mock mode until an Anthropic or OpenAI key is added (see
              docs/INTEGRATIONS.pdf).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
