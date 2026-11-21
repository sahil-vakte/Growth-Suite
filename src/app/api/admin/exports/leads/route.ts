import { withApiLog } from "@/lib/apiLogging";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { leads, leadStages, users } from "@/db/schema";
import { adminRoute } from "@/lib/api";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** CSV of leads, honouring the same filters as the list. */
export const GET = withApiLog(
  "/api/admin/exports/leads",
  "GET",
  adminRoute("crm", async (ctx, req) => {
    const u = new URL(req.url);
    const conds: SQL[] = [eq(leads.siteId, ctx.site.id)];
    const stage = u.searchParams.get("stage");
    const source = u.searchParams.get("source");
    const owner = u.searchParams.get("owner");
    if (stage) conds.push(eq(leads.stageId, stage));
    if (source) conds.push(eq(leads.source, source));
    if (owner === "me") conds.push(eq(leads.ownerId, ctx.user.id));
    else if (owner === "none") conds.push(sql`${leads.ownerId} is null`);
    else if (owner) conds.push(eq(leads.ownerId, owner));
    const rows = await db
      .select({ l: leads, s: leadStages.name, o: users.name })
      .from(leads)
      .leftJoin(leadStages, eq(leadStages.id, leads.stageId))
      .leftJoin(users, eq(users.id, leads.ownerId))
      .where(and(...conds))
      .orderBy(desc(leads.createdAt))
      .limit(100_000);
    const head = [
      "created_at",
      "name",
      "phone",
      "email",
      "stage",
      "owner",
      "source",
      "score",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "opted_out",
    ];
    const lines = [head.join(",")];
    for (const r of rows) {
      const a = r.l.attribution as Record<string, string>;
      lines.push(
        [
          r.l.createdAt.toISOString(),
          r.l.name,
          r.l.phone,
          r.l.email,
          r.s,
          r.o,
          r.l.source,
          r.l.score,
          a.utm_source,
          a.utm_medium,
          a.utm_campaign,
          r.l.optedOut,
        ]
          .map(cell)
          .join(","),
      );
    }
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }),
);
