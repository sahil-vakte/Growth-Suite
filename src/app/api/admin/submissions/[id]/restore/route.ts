import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import { addActivity, upsertLead } from "@/lib/services/leads";

/** Restore a held entry as a real lead. Skipped messages and ad events are deliberately not sent afterwards. */
export const POST = adminRoute<{ id: string }>("submissions", async (ctx, _req, p) => {
  const s = await siteRow(submissions, p.id, ctx.site.id, "Submission");
  if (s.status !== "spam") throw new HttpError(409, "This entry is not held as spam.");
  const d = s.data as Record<string, string>;
  const { lead } = await upsertLead(ctx.site.id, { name: d.name ?? d.full_name, email: d.__email, phone: d.__phone, source: "website", visitorId: s.visitorId }, ctx.actor);
  await db.update(submissions).set({ status: "accepted", spamReason: null, leadId: lead.id }).where(eq(submissions.id, s.id));
  await addActivity(ctx.site.id, lead.id, "submission", "Restored from suspected spam", { submissionId: s.id }, ctx.actor);
  return { ok: true, message: "Restored as a lead." };
});
