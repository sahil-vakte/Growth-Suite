/** AI-assistant connector (Model Context Protocol). Each tool belongs to a feature group; each client gets Off / Read / Write
 * per group. There are deliberately no delete tools; anything the assistant adds to knowledge waits for human approval. */
import { and, asc, count, desc, eq, gte, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { snapshot, audit } from "../history";
import { slugify } from "../admin/hooks";
import { addActivity, changeStage, upsertLead } from "../services/leads";
import { analyticsSummary } from "../services/analytics";
import { builtinLayouts } from "../layouts/registry";

export type Mode = "read" | "write";
export interface McpCtx { siteId: string; actor: string }
export interface Tool { name: string; group: string; mode: Mode; description: string; input: z.ZodObject<z.ZodRawShape>; run: (ctx: McpCtx, args: Record<string, unknown>) => Promise<unknown> }

export const GROUPS = ["docs", "pages", "forms", "crm", "menu", "analytics", "blog", "knowledge"] as const;

const T = (t: Tool) => t;
export const tools: Tool[] = [
  T({ name: "docs_overview", group: "docs", mode: "read", description: "What this platform can do and which tools exist.", input: z.object({}), run: async () => ({ groups: GROUPS, layouts: builtinLayouts.map((l) => ({ key: l.key, name: l.name, defaultContent: l.defaultContent })), note: "No delete tools. Knowledge you add waits for approval." }) }),
  T({ name: "pages_list", group: "pages", mode: "read", description: "List website pages.", input: z.object({ status: z.enum(["draft", "published", "archived"]).optional() }),
    run: async (c, a) => db.select({ id: s.pages.id, title: s.pages.title, slug: s.pages.slug, status: s.pages.status, updatedAt: s.pages.updatedAt }).from(s.pages).where(and(eq(s.pages.siteId, c.siteId), a.status ? eq(s.pages.status, String(a.status)) : undefined)).orderBy(desc(s.pages.updatedAt)).limit(200) }),
  T({ name: "pages_get", group: "pages", mode: "read", description: "Read a page and its sections.", input: z.object({ pageId: z.string() }),
    run: async (c, a) => { const [p] = await db.select().from(s.pages).where(and(eq(s.pages.id, String(a.pageId)), eq(s.pages.siteId, c.siteId))).limit(1); if (!p) throw new Error("Page not found"); return { ...p, sections: await db.select().from(s.sections).where(eq(s.sections.pageId, p.id)).orderBy(asc(s.sections.position)) }; } }),
  T({ name: "pages_create", group: "pages", mode: "write", description: "Create a draft page.", input: z.object({ title: z.string().min(1).max(200), slug: z.string().max(120).optional(), seoDescription: z.string().max(320).optional() }),
    run: async (c, a) => { const [p] = await db.insert(s.pages).values({ siteId: c.siteId, title: String(a.title), slug: slugify(String(a.slug ?? a.title)), status: "draft", seoDescription: a.seoDescription as string | undefined, lastEditedBy: c.actor, lastEditedRole: "assistant" }).returning(); await audit(c.siteId, c.actor, "mcp.pages_create", "pages", p.id); return p; } }),
  T({ name: "pages_update", group: "pages", mode: "write", description: "Update a page's title, SEO fields or status (draft/published).", input: z.object({ pageId: z.string(), title: z.string().max(200).optional(), seoTitle: z.string().max(200).optional(), seoDescription: z.string().max(320).optional(), status: z.enum(["draft", "published"]).optional() }),
    run: async (c, a) => { const [before] = await db.select().from(s.pages).where(and(eq(s.pages.id, String(a.pageId)), eq(s.pages.siteId, c.siteId))).limit(1); if (!before) throw new Error("Page not found"); await snapshot(c.siteId, "pages", before.id, before, "update", c.actor); const { pageId: _x, ...rest } = a; const [p] = await db.update(s.pages).set({ ...rest, lastEditedBy: c.actor, lastEditedRole: "assistant" }).where(eq(s.pages.id, before.id)).returning(); return p; } }),
  T({ name: "sections_create", group: "pages", mode: "write", description: "Add a section to a page using a layout key (see docs_overview) and content matching that layout.", input: z.object({ pageId: z.string(), layoutKey: z.string(), content: z.record(z.unknown()).optional(), position: z.number().int().optional() }),
    run: async (c, a) => { const layout = builtinLayouts.find((l) => l.key === a.layoutKey); if (!layout) throw new Error("Unknown layout"); const [p] = await db.select().from(s.pages).where(and(eq(s.pages.id, String(a.pageId)), eq(s.pages.siteId, c.siteId))).limit(1); if (!p) throw new Error("Page not found"); const [{ n }] = await db.select({ n: count() }).from(s.sections).where(eq(s.sections.pageId, p.id)); const [sec] = await db.insert(s.sections).values({ siteId: c.siteId, pageId: p.id, layoutKey: layout.key, position: Number(a.position ?? n), content: { ...layout.defaultContent, ...((a.content as object) ?? {}) } }).returning(); return sec; } }),
  T({ name: "sections_update_content", group: "pages", mode: "write", description: "Replace or merge a section's content.", input: z.object({ sectionId: z.string(), content: z.record(z.unknown()), merge: z.boolean().default(true) }),
    run: async (c, a) => { const [sec] = await db.select().from(s.sections).where(and(eq(s.sections.id, String(a.sectionId)), eq(s.sections.siteId, c.siteId))).limit(1); if (!sec) throw new Error("Section not found"); await snapshot(c.siteId, "sections", sec.id, sec, "update", c.actor); const content = a.merge === false ? (a.content as Record<string, unknown>) : { ...sec.content, ...(a.content as object) }; const [u] = await db.update(s.sections).set({ content }).where(eq(s.sections.id, sec.id)).returning(); return u; } }),
  T({ name: "forms_list", group: "forms", mode: "read", description: "List lead forms.", input: z.object({}), run: async (c) => db.select({ id: s.forms.id, name: s.forms.name, status: s.forms.status, fields: s.forms.fields }).from(s.forms).where(eq(s.forms.siteId, c.siteId)) }),
  T({ name: "crm_leads_list", group: "crm", mode: "read", description: "Search leads by name, phone or email; newest first.", input: z.object({ q: z.string().max(100).optional(), limit: z.number().int().min(1).max(100).default(25) }),
    run: async (c, a) => db.select({ id: s.leads.id, name: s.leads.name, phone: s.leads.phone, email: s.leads.email, source: s.leads.source, score: s.leads.score, stageId: s.leads.stageId, createdAt: s.leads.createdAt }).from(s.leads).where(and(eq(s.leads.siteId, c.siteId), a.q ? sql`(${s.leads.name} ilike ${"%" + a.q + "%"} or ${s.leads.phone} ilike ${"%" + a.q + "%"} or ${s.leads.email} ilike ${"%" + a.q + "%"})` : undefined)).orderBy(desc(s.leads.createdAt)).limit(Number(a.limit ?? 25)) }),
  T({ name: "crm_lead_get", group: "crm", mode: "read", description: "Read one lead with its timeline.", input: z.object({ leadId: z.string() }),
    run: async (c, a) => { const [l] = await db.select().from(s.leads).where(and(eq(s.leads.id, String(a.leadId)), eq(s.leads.siteId, c.siteId))).limit(1); if (!l) throw new Error("Lead not found"); return { ...l, timeline: await db.select().from(s.leadActivities).where(eq(s.leadActivities.leadId, l.id)).orderBy(desc(s.leadActivities.createdAt)).limit(50) }; } }),
  T({ name: "crm_stages_list", group: "crm", mode: "read", description: "Pipeline stages.", input: z.object({}), run: async (c) => db.select().from(s.leadStages).where(eq(s.leadStages.siteId, c.siteId)).orderBy(asc(s.leadStages.position)) }),
  T({ name: "crm_lead_create", group: "crm", mode: "write", description: "Add a lead (phone with country code preferred).", input: z.object({ name: z.string().max(120).optional(), phone: z.string().max(30).optional(), email: z.string().email().optional() }),
    run: async (c, a) => (await upsertLead(c.siteId, { name: a.name as string, phone: a.phone as string, email: a.email as string, source: "manual" }, c.actor)).lead }),
  T({ name: "crm_lead_note_add", group: "crm", mode: "write", description: "Add a note to a lead's timeline.", input: z.object({ leadId: z.string(), note: z.string().min(1).max(5000) }),
    run: async (c, a) => { const [l] = await db.select({ id: s.leads.id }).from(s.leads).where(and(eq(s.leads.id, String(a.leadId)), eq(s.leads.siteId, c.siteId))).limit(1); if (!l) throw new Error("Lead not found"); await addActivity(c.siteId, l.id, "note", String(a.note), undefined, c.actor); return { ok: true }; } }),
  T({ name: "crm_lead_set_stage", group: "crm", mode: "write", description: "Move a lead to a stage.", input: z.object({ leadId: z.string(), stageId: z.string() }),
    run: async (c, a) => changeStage(c.siteId, String(a.leadId), String(a.stageId), c.actor) }),
  T({ name: "menu_get", group: "menu", mode: "read", description: "Navigation links.", input: z.object({}), run: async (c) => db.select().from(s.menuItems).where(eq(s.menuItems.siteId, c.siteId)).orderBy(asc(s.menuItems.position)) }),
  T({ name: "menu_add_link", group: "menu", mode: "write", description: "Add a link to the menu.", input: z.object({ label: z.string().min(1).max(60), href: z.string().max(500), parentId: z.string().optional() }),
    run: async (c, a) => { const [{ n }] = await db.select({ n: count() }).from(s.menuItems).where(eq(s.menuItems.siteId, c.siteId)); return (await db.insert(s.menuItems).values({ siteId: c.siteId, label: String(a.label), href: String(a.href), parentId: (a.parentId as string) ?? null, position: n }).returning())[0]; } }),
  T({ name: "analytics_report", group: "analytics", mode: "read", description: "Traffic, conversions and top pages for the last N days.", input: z.object({ days: z.number().int().min(1).max(365).default(30) }), run: async (c, a) => analyticsSummary(c.siteId, Number(a.days ?? 30)) }),
  T({ name: "blog_posts_list", group: "blog", mode: "read", description: "Blog posts.", input: z.object({ q: z.string().max(100).optional() }), run: async (c, a) => db.select({ id: s.blogPosts.id, title: s.blogPosts.title, slug: s.blogPosts.slug, status: s.blogPosts.status }).from(s.blogPosts).where(and(eq(s.blogPosts.siteId, c.siteId), a.q ? ilike(s.blogPosts.title, `%${a.q}%`) : undefined)).limit(100) }),
  T({ name: "blog_post_save", group: "blog", mode: "write", description: "Create or update a blog post as a draft (HTML content).", input: z.object({ postId: z.string().optional(), title: z.string().min(1).max(200), html: z.string().min(1).max(200_000), metaDescription: z.string().max(320).optional(), focusKeyword: z.string().max(100).optional() }),
    run: async (c, a) => {
      if (a.postId) { const [b] = await db.select().from(s.blogPosts).where(and(eq(s.blogPosts.id, String(a.postId)), eq(s.blogPosts.siteId, c.siteId))).limit(1); if (!b) throw new Error("Post not found"); await snapshot(c.siteId, "blog-posts", b.id, b, "update", c.actor); return (await db.update(s.blogPosts).set({ title: String(a.title), html: String(a.html), metaDescription: a.metaDescription as string, focusKeyword: a.focusKeyword as string }).where(eq(s.blogPosts.id, b.id)).returning())[0]; }
      return (await db.insert(s.blogPosts).values({ siteId: c.siteId, title: String(a.title), slug: `${slugify(String(a.title))}-${Date.now().toString(36)}`, html: String(a.html), metaDescription: a.metaDescription as string, focusKeyword: a.focusKeyword as string, status: "draft", authorName: "Assistant" }).returning())[0];
    } }),
  T({ name: "kb_chunks_list", group: "knowledge", mode: "read", description: "Knowledge chunks (approved and pending).", input: z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }), run: async (c, a) => db.select({ id: s.knowledgeChunks.id, text: s.knowledgeChunks.text, status: s.knowledgeChunks.status }).from(s.knowledgeChunks).where(and(eq(s.knowledgeChunks.siteId, c.siteId), a.status ? eq(s.knowledgeChunks.status, String(a.status)) : undefined)).limit(200) }),
  T({ name: "kb_chunk_create", group: "knowledge", mode: "write", description: "Propose a knowledge chunk. It is held until a person approves it.", input: z.object({ text: z.string().min(10).max(4000) }),
    run: async (c, a) => (await db.insert(s.knowledgeChunks).values({ siteId: c.siteId, text: String(a.text), status: "pending", createdBy: "assistant" }).returning())[0] }),
];

export function allowedTools(perms: Record<string, "off" | "read" | "write">) {
  return tools.filter((t) => { const p = perms[t.group] ?? "off"; return p === "write" || (p === "read" && t.mode === "read"); });
}

export const recentlySince = (days: number) => gte(s.analyticsEvents.createdAt, new Date(Date.now() - days * 86_400_000));
