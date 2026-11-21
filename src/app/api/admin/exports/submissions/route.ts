import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { forms, leads, submissions } from "@/db/schema";
import { adminRoute } from "@/lib/api";

const cell = (v: unknown) => {
  const s =
    v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** CSV of accepted submissions with ad-source columns. */
export const GET = adminRoute("submissions", async (ctx, req) => {
  const formId = new URL(req.url).searchParams.get("formId");
  const rows = await db
    .select({ s: submissions, f: forms, l: leads })
    .from(submissions)
    .innerJoin(forms, eq(forms.id, submissions.formId))
    .leftJoin(leads, eq(leads.id, submissions.leadId))
    .where(
      and(
        eq(submissions.siteId, ctx.site.id),
        eq(submissions.status, "accepted"),
        formId ? eq(submissions.formId, formId) : undefined,
      ),
    )
    .orderBy(desc(submissions.createdAt))
    .limit(50_000);
  const keys = [
    ...new Set(rows.flatMap((r) => Object.keys(r.s.data).filter((k) => !k.startsWith("__")))),
  ];
  const attr = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "fbclid",
    "landingPage",
  ];
  const lines = [["submitted_at", "form", "page_url", ...keys, ...attr].join(",")];
  for (const r of rows) {
    const a = (r.l?.attribution ?? {}) as Record<string, unknown>;
    lines.push(
      [
        r.s.createdAt.toISOString(),
        r.f.name,
        r.s.pageUrl,
        ...keys.map((k) => r.s.data[k]),
        ...attr.map((k) => (k === "gclid" || k === "fbclid" ? (a[k] ? "yes" : "") : a[k])),
      ]
        .map(cell)
        .join(","),
    );
  }
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="submissions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
