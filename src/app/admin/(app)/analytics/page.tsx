import { requireAdmin } from "@/lib/auth/current";
import { analyticsSummary } from "@/lib/services/analytics";

export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const ctx = await requireAdmin("analytics");
  const days = Math.min(365, Math.max(1, Number((await searchParams).days ?? 30)));
  const a = await analyticsSummary(ctx.site.id, days);
  const max = Math.max(1, ...a.daily.map((d) => d.users));
  return (
    <div>
      <div className="topbar">
        <h1>Analytics</h1>
        <span className="spacer" />
        {[7, 30, 90].map((d) => (
          <a key={d} className={`btn small${d === days ? " primary" : ""}`} href={`?days=${d}`}>
            {d} days
          </a>
        ))}
      </div>
      <div className="grid cols-4">
        {[
          ["Users", a.users],
          ["Sessions", a.sessions],
          ["Page views", a.pageViews],
          ["Leads", a.leads],
          ["Form enquiries", a.conversions.forms],
          ["Call clicks", a.conversions.calls],
          ["WhatsApp clicks", a.conversions.whatsapp],
          ["Conversion rate", `${a.conversionRate}%`],
        ].map(([l, v]) => (
          <div key={String(l)} className="card">
            <div className="stat">{typeof v === "number" ? v.toLocaleString("en-GB") : v}</div>
            <div className="stat-label">{l}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Visitors per day</h3>
        <div
          role="img"
          aria-label="Visitors per day bar chart"
          style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 140 }}
        >
          {a.daily.map((d) => (
            <div
              key={d.day}
              title={`${d.day}: ${d.users} visitors, ${d.leads} leads`}
              style={{
                flex: 1,
                background: "#2346d8",
                opacity: 0.85,
                height: `${(d.users / max) * 100}%`,
                minHeight: d.users ? 2 : 0,
                borderRadius: "3px 3px 0 0",
              }}
            />
          ))}
        </div>
      </div>
      <div className="grid cols-2" style={{ marginTop: "1rem" }}>
        <div>
          <h2>Source performance</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Source / medium</th>
                <th>Users</th>
                <th>Converted</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {a.bySource.map((s) => (
                <tr key={s.source + s.medium}>
                  <td>
                    {s.source} / {s.medium}
                  </td>
                  <td>{s.users}</td>
                  <td>{s.conversions}</td>
                  <td>{s.users ? Math.round((s.conversions / s.users) * 1000) / 10 : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Devices</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Device</th>
                <th>Users</th>
              </tr>
            </thead>
            <tbody>
              {a.byDevice.map((d) => (
                <tr key={d.device}>
                  <td>{d.device}</td>
                  <td>{d.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Top pages</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Page</th>
                <th>Views</th>
                <th>Avg scroll</th>
              </tr>
            </thead>
            <tbody>
              {a.topPages.map((p) => (
                <tr key={p.page}>
                  <td>{p.page}</td>
                  <td>{p.views}</td>
                  <td>{p.avg_scroll}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Events</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Event</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {a.events.map((e) => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td>{e.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
