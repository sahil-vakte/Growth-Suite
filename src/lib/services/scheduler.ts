/** Scheduler "tick": due automation runs, campaign throttling, scheduled social posts, segment refresh, job queue.
 * Run every minute via `npm run worker`, or call POST /api/cron/tick with CRON_SECRET from any cron service. */
import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, leadStages, segments, segmentMembers, sites, socialAccounts, socialPosts, visitors, waAutomationRuns, waAutomations, waCampaigns, waMessages, media } from "@/db/schema";
import { decideAtDue, type AutomationDef } from "../engines/automations";
import { inSegment, type SegmentGroup } from "../engines/segments";
import { tooLate } from "../engines/social";
import { processDueJobs, registerHandler } from "../queue";
import { sendTemplateToLead } from "./whatsapp";
import { sendEmail } from "../integrations/email";
import { publishToFacebook, publishToInstagram } from "../integrations/other";
import { escapeHtml } from "../engines/templating";
import { visitorFacts } from "./tracking";
import { assertPublicUrl } from "../net";

export async function runDueAutomations(limit = 200) {
  const due = await db.select().from(waAutomationRuns).where(and(eq(waAutomationRuns.status, "waiting"), lte(waAutomationRuns.dueAt, new Date()))).limit(limit);
  let sent = 0, skipped = 0;
  for (const run of due) {
    const [a] = await db.select().from(waAutomations).where(eq(waAutomations.id, run.automationId)).limit(1);
    const [lead] = await db.select().from(leads).where(eq(leads.id, run.leadId)).limit(1);
    const [site] = await db.select().from(sites).where(eq(sites.id, run.siteId)).limit(1);
    if (!a || !lead || !site) { await finish(run.id, "skipped", "removed"); skipped++; continue; }
    const stage = lead.stageId ? (await db.select().from(leadStages).where(eq(leadStages.id, lead.stageId)).limit(1))[0]?.name : null;
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const [{ sentToday }] = await db.select({ sentToday: count() }).from(waAutomationRuns).where(and(eq(waAutomationRuns.automationId, a.id), eq(waAutomationRuns.status, "sent"), gte(waAutomationRuns.finishedAt, today)));
    const [{ prior }] = await db.select({ prior: count() }).from(waAutomationRuns).where(and(eq(waAutomationRuns.automationId, a.id), eq(waAutomationRuns.leadId, lead.id), eq(waAutomationRuns.status, "sent")));
    const decision = decideAtDue(a as unknown as AutomationDef, { ...lead, stage }, { runCreatedAt: run.createdAt, sentToday, alreadySentToLead: prior > 0, now: new Date(), timeZone: site.timezone });
    if (!decision.send) {
      if (decision.retryAt) await db.update(waAutomationRuns).set({ dueAt: decision.retryAt, reason: decision.reason }).where(eq(waAutomationRuns.id, run.id));
      else { await finish(run.id, "skipped", decision.reason); skipped++; }
      continue;
    }
    try { await sendTemplateToLead(site.id, lead, a.templateId); await finish(run.id, "sent", null); sent++; }
    catch (e) { await finish(run.id, "failed", e instanceof Error ? e.message : String(e)); }
  }
  return { sent, skipped };
}
const finish = (id: string, status: string, reason: string | null) => db.update(waAutomationRuns).set({ status, reason, finishedAt: new Date() }).where(eq(waAutomationRuns.id, id));

export async function campaignAudience(siteId: string, filters: Record<string, unknown>) {
  const conds = [eq(leads.siteId, siteId), eq(leads.optedOut, false), sql`${leads.phone} is not null`];
  if (filters.stageIds && (filters.stageIds as string[]).length) conds.push(inArray(leads.stageId, filters.stageIds as string[]));
  if (filters.source) conds.push(eq(leads.source, String(filters.source)));
  if (filters.verifiedOnly) conds.push(eq(leads.waVerified, true));
  if (filters.repliedOnly) conds.push(sql`${leads.lastInboundAt} is not null`);
  if (filters.createdFrom) conds.push(gte(leads.createdAt, new Date(String(filters.createdFrom))));
  if (filters.createdTo) conds.push(lte(leads.createdAt, new Date(String(filters.createdTo))));
  return db.select().from(leads).where(and(...conds));
}

export async function runCampaigns() {
  const running = await db.select().from(waCampaigns).where(eq(waCampaigns.status, "running"));
  for (const c of running) {
    const audience = await campaignAudience(c.siteId, c.filters);
    const already = new Set((await db.select({ leadId: waMessages.leadId }).from(waMessages).where(eq(waMessages.campaignId, c.id))).map((r) => r.leadId));
    const batch = audience.filter((l) => !already.has(l.id)).slice(0, c.speedPerMinute);
    let sent = c.stats.sent ?? 0, failed = c.stats.failed ?? 0;
    for (const l of batch) { try { await sendTemplateToLead(c.siteId, l, c.templateId, { campaignId: c.id }); sent++; } catch { failed++; } }
    const done = audience.length - already.size - batch.length <= 0;
    await db.update(waCampaigns).set({ stats: { ...c.stats, audience: audience.length, sent, failed }, status: done ? "completed" : "running" }).where(eq(waCampaigns.id, c.id));
  }
}

export async function runScheduledSocial() {
  const due = await db.select().from(socialPosts).where(and(eq(socialPosts.status, "scheduled"), lte(socialPosts.scheduledAt, new Date())));
  const publishing = await db.select().from(socialPosts).where(eq(socialPosts.status, "publishing"));
  for (const p of [...due, ...publishing]) {
    if (p.scheduledAt && tooLate(p.scheduledAt)) { await db.update(socialPosts).set({ status: "failed", error: "Not sent within 6 hours of the scheduled time." }).where(eq(socialPosts.id, p.id)); continue; }
    await publishSocialPost(p.id);
  }
}

export async function publishSocialPost(postId: string) {
  const [p] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId)).limit(1);
  if (!p) return;
  const [acct] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, p.accountId)).limit(1);
  const files = p.mediaIds.length ? await db.select().from(media).where(inArray(media.id, p.mediaIds)) : [];
  const results: Record<string, unknown> = { ...p.results }; const errors: string[] = [];
  const token = process.env.META_SYSTEM_USER_TOKEN ?? "";
  for (const platform of p.platforms) {
    if (results[platform]) continue;
    try {
      if (platform === "facebook") results.facebook = await publishToFacebook(acct?.pageId ?? "", token, p.caption, files[0]?.url);
      if (platform === "instagram") {
        if (!files[0]) throw new Error("Instagram needs a photo or video.");
        results.instagram = await publishToInstagram(acct?.instagramId ?? "", token, p.caption, files[0].url);
      }
    } catch (e) { errors.push(`${platform}: ${e instanceof Error ? e.message : e}`); }
  }
  const allDone = p.platforms.every((x) => results[x]);
  await db.update(socialPosts).set({ results, status: allDone ? "published" : "failed", error: errors.join("; ") || null, history: [...p.history, { at: new Date().toISOString(), by: "system", action: allDone ? "published" : "failed" }] }).where(eq(socialPosts.id, p.id));
}

export async function rebuildSegment(segmentId: string) {
  const [seg] = await db.select().from(segments).where(eq(segments.id, segmentId)).limit(1);
  if (!seg) return 0;
  const since = new Date(Date.now() - seg.lookbackDays * 86_400_000);
  const vis = await db.select({ id: visitors.id, leadId: visitors.leadId }).from(visitors).where(and(eq(visitors.siteId, seg.siteId), gte(visitors.lastSeen, since))).limit(50_000);
  const members: { visitorId: string; leadId: string | null }[] = [];
  for (const v of vis) {
    const facts = await visitorFacts(seg.siteId, v.id);
    if (!facts) continue;
    let extra: Record<string, unknown> = {};
    if (v.leadId) {
      const [l] = await db.select({ score: leads.score, stage: leadStages.name }).from(leads).leftJoin(leadStages, eq(leadStages.id, leads.stageId)).where(eq(leads.id, v.leadId)).limit(1);
      extra = { score: l?.score ?? 0, stage: l?.stage ?? "" };
    }
    if (inSegment(seg.groups as SegmentGroup[], seg.matchLogic as "all" | "any", { ...facts, ...extra })) members.push({ visitorId: v.id, leadId: v.leadId });
  }
  await db.transaction(async (tx) => {
    await tx.delete(segmentMembers).where(eq(segmentMembers.segmentId, seg.id));
    for (let i = 0; i < members.length; i += 500) await tx.insert(segmentMembers).values(members.slice(i, i + 500).map((m) => ({ segmentId: seg.id, ...m }))).onConflictDoNothing();
    await tx.update(segments).set({ memberCount: members.length, lastBuiltAt: new Date() }).where(eq(segments.id, seg.id));
  });
  return members.length;
}

export async function refreshSegments() {
  const all = await db.select().from(segments).where(eq(segments.active, true));
  for (const s of all) if (!s.lastBuiltAt || Date.now() - s.lastBuiltAt.getTime() > s.refreshMinutes * 60_000) await rebuildSegment(s.id);
}

registerHandler("email.lead_forward", async (p) => {
  const values = p.values as Record<string, unknown>;
  const rows = Object.entries(values).map(([k, v]) => `<tr><td style="padding:4px 8px;color:#555">${escapeHtml(k)}</td><td style="padding:4px 8px">${escapeHtml(String(v))}</td></tr>`).join("");
  await sendEmail({ to: String(p.to), subject: `New enquiry: ${p.formName}`, html: `<p>New submission from ${escapeHtml(String(p.pageUrl))}</p><table>${rows}</table>` });
});

registerHandler("webhook.post", async (p) => {
  const url = await assertPublicUrl(String(p.url));
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "GrowthSuite-Webhook/1.0" }, body: JSON.stringify(p.body), signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
});

registerHandler("social.publish", async (p) => { await publishSocialPost(String(p.postId)); });

export async function tick() {
  const started = Date.now();
  const automations = await runDueAutomations();
  await runCampaigns();
  await runScheduledSocial();
  await refreshSegments();
  const jobsResult = await processDueJobs(50);
  return { ms: Date.now() - started, automations, jobs: jobsResult };
}
