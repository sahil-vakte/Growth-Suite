/**
 * Growth Suite — data model (Drizzle ORM, PostgreSQL).
 * Multi-tenant: every business table carries siteId. Money = integer minor units + ISO currency. Timestamps UTC.
 * Column names are converted to snake_case by the `casing` option (see src/db/index.ts and drizzle.config.ts).
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { newId } from "@/lib/ids";

const id = () => text().primaryKey().$defaultFn(newId);
const siteId = () => text().notNull();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const json = <T = unknown>() => jsonb().$type<T>();
const ts = () => timestamp({ withTimezone: true });
const strArr = () => text().array().notNull().default([]);

// ───────── Platform ─────────
export const sites = pgTable("sites", {
  id: id(),
  name: text().notNull(),
  domain: text().notNull().unique(),
  aliases: strArr(),
  timezone: text().notNull().default("Europe/London"),
  currency: text().notNull().default("GBP"),
  locale: text().notNull().default("en-GB"),
  plan: text().notNull().default("starter"),
  status: text().notNull().default("active"),
  region: text().notNull().default("eu"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable("users", {
  id: id(),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text().notNull(),
  isPlatformAdmin: boolean().notNull().default(false),
  status: text().notNull().default("active"),
  sessionVersion: integer().notNull().default(1),
  lastLoginAt: ts(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const passwordResets = pgTable("password_resets", {
  id: id(),
  userId: text().notNull(),
  tokenHash: text().notNull().unique(),
  expiresAt: ts().notNull(),
  usedAt: ts(),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    siteId: siteId(),
    userId: text().notNull(),
    role: text().notNull().default("editor"), // admin | editor | sales
    crmAccess: text().notNull().default("inherit"), // inherit | allow | deny
    mcpAccess: boolean().notNull().default(false),
    socialLevel: text().notNull().default("executive"), // executive | publisher | none
    socialApprove: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.userId)],
);

export const settings = pgTable(
  "settings",
  {
    id: id(),
    siteId: siteId(),
    key: text().notNull(),
    value: json().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.key)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    siteId: text(),
    actor: text().notNull(),
    action: text().notNull(),
    entity: text(),
    entityId: text(),
    meta: json(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.siteId, t.createdAt)],
);

export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: id(),
    siteId: siteId(),
    entity: text().notNull(),
    entityId: text().notNull(),
    operation: text().notNull(),
    snapshot: json().notNull(),
    actor: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.siteId, t.entity, t.entityId, t.createdAt)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    siteId: text(),
    type: text().notNull(),
    payload: json<Record<string, unknown>>().notNull(),
    status: text().notNull().default("queued"),
    runAt: ts().notNull().defaultNow(),
    attempts: integer().notNull().default(0),
    maxAttempts: integer().notNull().default(5),
    lastError: text(),
    idempotency: text().unique(),
    lockedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.status, t.runAt)],
);

export const moduleLicenses = pgTable(
  "module_licenses",
  {
    id: id(),
    siteId: siteId(),
    moduleKey: text().notNull(),
    endsAt: ts().notNull(),
    statement: text().notNull(),
    checkedAt: ts().notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.moduleKey)],
);

export const apiClients = pgTable("api_clients", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  clientId: text().notNull().unique(),
  secretHash: text().notNull(),
  permissions: json<Record<string, "off" | "read" | "write">>().notNull(),
  requireAdminApproval: boolean().notNull().default(false),
  active: boolean().notNull().default(true),
  lastUsedAt: ts(),
  createdAt: createdAt(),
});

// ───────── Website & content ─────────
export const pages = pgTable(
  "pages",
  {
    id: id(),
    siteId: siteId(),
    title: text().notNull(),
    slug: text().notNull(),
    status: text().notNull().default("draft"),
    isHome: boolean().notNull().default(false),
    seoTitle: text(),
    seoDescription: text(),
    schemaJson: json(),
    themeId: text(),
    fontSetId: text(),
    lastEditedBy: text(),
    lastEditedRole: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.slug)],
);

export const sections = pgTable(
  "sections",
  {
    id: id(),
    siteId: siteId(),
    pageId: text().notNull(),
    position: integer().notNull(),
    layoutKey: text().notNull(),
    name: text(),
    content: json<Record<string, unknown>>().notNull(),
    style: json<Record<string, unknown>>(),
    visible: boolean().notNull().default(true),
    audienceRule: json<{
      param: string;
      op: "equals" | "contains" | "exists";
      value?: string;
    } | null>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.pageId, t.position)],
);

export const sectionTemplates = pgTable("section_templates", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  layoutKey: text().notNull(),
  content: json<Record<string, unknown>>().notNull(),
  style: json(),
  createdAt: createdAt(),
});

export const layouts = pgTable(
  "layouts",
  {
    id: id(),
    siteId: text(),
    key: text().notNull(),
    name: text().notNull(),
    kind: text().notNull().default("section"),
    category: text().notNull().default("general"),
    defaultContent: json<Record<string, unknown>>().notNull(),
    status: text().notNull().default("active"),
    source: text().notNull().default("builtin"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.key)],
);

export const aiLayoutGenerations = pgTable("ai_layout_generations", {
  id: id(),
  siteId: siteId(),
  prompt: text().notNull(),
  status: text().notNull().default("pending"),
  output: json(),
  review: text(),
  versions: json<unknown[]>().notNull().default([]),
  createdAt: createdAt(),
});

export const themes = pgTable("themes", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  palette: json<Record<string, string>>().notNull(),
  isDefault: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const fontSets = pgTable("font_sets", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  slots: json<Record<string, unknown>>().notNull(),
  isDefault: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const menuItems = pgTable("menu_items", {
  id: id(),
  siteId: siteId(),
  label: text().notNull(),
  href: text().notNull(),
  icon: text(),
  parentId: text(),
  position: integer().notNull().default(0),
  pageId: text(),
});

export const media = pgTable(
  "media",
  {
    id: id(),
    siteId: siteId(),
    kind: text().notNull().default("image"),
    url: text().notNull(),
    title: text(),
    alt: text(),
    mime: text().notNull(),
    size: integer().notNull(),
    width: integer(),
    height: integer(),
    variants: json<Record<string, string>>(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.siteId, t.kind)],
);

export const blogCategories = pgTable(
  "blog_categories",
  {
    id: id(),
    siteId: siteId(),
    name: text().notNull(),
    slug: text().notNull(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.slug)],
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: id(),
    siteId: siteId(),
    title: text().notNull(),
    slug: text().notNull(),
    html: text().notNull(),
    excerpt: text(),
    status: text().notNull().default("draft"),
    categoryId: text(),
    isPillar: boolean().notNull().default(false),
    focusKeyword: text(),
    metaDescription: text(),
    faq: json<{ q: string; a: string }[]>().notNull().default([]),
    relatedIds: strArr(),
    authorName: text(),
    publishedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.slug)],
);

export const redirects = pgTable(
  "redirects",
  {
    id: id(),
    siteId: siteId(),
    fromPath: text().notNull(),
    toUrl: text().notNull(),
    code: integer().notNull().default(301),
    hits: integer().notNull().default(0),
    lastHitAt: ts(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.fromPath)],
);

// ───────── Lead capture ─────────
export const forms = pgTable("forms", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  status: text().notNull().default("active"),
  fields: json<unknown[]>().notNull(),
  settings: json<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: id(),
    siteId: siteId(),
    formId: text().notNull(),
    leadId: text(),
    data: json<Record<string, unknown>>().notNull(),
    pageUrl: text(),
    visitorId: text(),
    status: text().notNull().default("accepted"),
    spamReason: text(),
    ipHash: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.siteId, t.createdAt)],
);

export const whatsappNumbers = pgTable("whatsapp_numbers", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  countryCode: text().notNull().default("44"),
  number: text().notNull(),
  isDefault: boolean().notNull().default(false),
  active: boolean().notNull().default(true),
});

export const whatsappCtas = pgTable("whatsapp_ctas", {
  id: id(),
  siteId: siteId(),
  numberId: text().notNull(),
  name: text().notNull(),
  message: text().notNull(),
  sort: integer().notNull().default(0),
});

export const callCtas = pgTable("call_ctas", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  phone: text().notNull(),
  isDefault: boolean().notNull().default(false),
  active: boolean().notNull().default(true),
  sourceRules: json<unknown[]>().notNull().default([]),
});

export const clickLogs = pgTable(
  "click_logs",
  {
    id: id(),
    siteId: siteId(),
    kind: text().notNull(),
    ctaId: text(),
    pageUrl: text(),
    source: text(),
    visitorId: text(),
    refCode: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.siteId, t.kind, t.createdAt)],
);

export const popups = pgTable("popups", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  layout: text().notNull().default("center"),
  content: json<Record<string, unknown>>().notNull(),
  design: json<Record<string, unknown>>().notNull().default({}),
  targeting: json<Record<string, unknown>>().notNull().default({ match: "all", conditions: [] }),
  frequency: text().notNull().default("session"),
  delaySec: integer().notNull().default(3),
  segmentId: text(),
  active: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const chatWidgets = pgTable("chat_widgets", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  config: json<Record<string, unknown>>().notNull(),
  active: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const chatConversations = pgTable("chat_conversations", {
  id: id(),
  siteId: siteId(),
  widgetId: text().notNull(),
  visitorId: text(),
  leadId: text(),
  intent: text(),
  score: integer().notNull().default(0),
  status: text().notNull().default("open"),
  contact: json<Record<string, string>>().notNull().default({}),
  messages: json<{ role: string; text: string; at: string }[]>().notNull().default([]),
  pageUrl: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const chatTrainingItems = pgTable("chat_training_items", {
  id: id(),
  siteId: siteId(),
  question: text().notNull(),
  answer: text().notNull(),
  embedded: boolean().notNull().default(false),
});

export const chatIntentGroups = pgTable("chat_intent_groups", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  points: integer().notNull().default(10),
  phrases: strArr(),
});

export const chatAutomationRules = pgTable("chat_automation_rules", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  when: json<Record<string, unknown>>().notNull(),
  action: json<Record<string, unknown>>().notNull(),
  active: boolean().notNull().default(true),
});

export const replyTemplates = pgTable("reply_templates", {
  id: id(),
  siteId: siteId(),
  channel: text().notNull().default("crm"),
  name: text().notNull(),
  body: text().notNull(),
});

// ───────── Appointments ─────────
export const appointmentServices = pgTable("appointment_services", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  durationMinutes: integer().notNull().default(30),
  bufferMinutes: integer().notNull().default(0),
  priceMinor: integer().notNull().default(0),
  currency: text().notNull().default("GBP"),
  active: boolean().notNull().default(true),
});

export const staff = pgTable("staff", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  email: text(),
  phone: text(),
  googleCalendarId: text(),
  weeklyHours: json<Record<string, [string, string][]>>().notNull(),
  active: boolean().notNull().default(true),
});

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    siteId: siteId(),
    serviceId: text().notNull(),
    staffId: text().notNull(),
    startsAt: ts().notNull(),
    endsAt: ts().notNull(),
    name: text().notNull(),
    email: text(),
    phone: text(),
    status: text().notNull().default("confirmed"),
    leadId: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.siteId, t.staffId, t.startsAt)],
);

// ───────── CRM, attribution, audiences ─────────
export const leads = pgTable(
  "leads",
  {
    id: id(),
    siteId: siteId(),
    name: text(),
    email: text(),
    phone: text(),
    phoneKey: text(),
    source: text().notNull().default("website"),
    stageId: text(),
    ownerId: text(),
    score: integer().notNull().default(0),
    visitorId: text(),
    attribution: json<Record<string, unknown>>().notNull().default({}),
    adSource: json(),
    customFields: json<Record<string, unknown>>().notNull().default({}),
    consent: json<Record<string, unknown>>().notNull().default({}),
    waVerified: boolean().notNull().default(false),
    optedOut: boolean().notNull().default(false),
    lastInboundAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.siteId, t.phoneKey),
    index().on(t.siteId, t.createdAt),
    index().on(t.siteId, t.stageId),
  ],
);

export const leadStages = pgTable("lead_stages", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  color: text().notNull().default("#64748b"),
  position: integer().notNull().default(0),
  isWon: boolean().notNull().default(false),
  isLost: boolean().notNull().default(false),
});

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: id(),
    siteId: siteId(),
    leadId: text().notNull(),
    type: text().notNull(),
    body: text(),
    meta: json(),
    actor: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.leadId, t.createdAt)],
);

export const scoringRules = pgTable("scoring_rules", {
  id: id(),
  siteId: siteId(),
  channel: text().notNull(),
  signalKey: text().notNull(),
  points: integer().notNull(),
  active: boolean().notNull().default(true),
});

export const conversionSignals = pgTable("conversion_signals", {
  id: id(),
  siteId: siteId(),
  trigger: text().notNull(),
  triggerValue: text(),
  platform: text().notNull(),
  eventName: text().notNull(),
  valueMinor: integer().notNull().default(0),
  currency: text().notNull().default("GBP"),
  active: boolean().notNull().default(true),
});

export const conversionEvents = pgTable(
  "conversion_events",
  {
    id: id(),
    siteId: siteId(),
    signalId: text().notNull(),
    leadId: text().notNull(),
    platform: text().notNull(),
    status: text().notNull().default("queued"),
    payload: json<Record<string, unknown>>().notNull(),
    response: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.signalId, t.leadId)],
);

export const segments = pgTable("segments", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  tier: text().notNull().default("warm"),
  matchLogic: text().notNull().default("all"),
  groups: json<unknown[]>().notNull(),
  lookbackDays: integer().notNull().default(30),
  refreshMinutes: integer().notNull().default(60),
  destinations: json<Record<string, unknown>>().notNull().default({}),
  memberCount: integer().notNull().default(0),
  lastBuiltAt: ts(),
  active: boolean().notNull().default(true),
});

export const segmentMembers = pgTable(
  "segment_members",
  {
    id: id(),
    segmentId: text().notNull(),
    visitorId: text().notNull(),
    leadId: text(),
    joinedAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.segmentId, t.visitorId)],
);

export const visitors = pgTable(
  "visitors",
  {
    id: text().primaryKey(),
    siteId: siteId(),
    firstSeen: createdAt(),
    lastSeen: ts().notNull().defaultNow(),
    sessions: integer().notNull().default(1),
    firstTouch: json<Record<string, unknown>>().notNull().default({}),
    ids: json<Record<string, unknown>>().notNull().default({}),
    leadId: text(),
  },
  (t) => [index().on(t.siteId, t.lastSeen)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    siteId: siteId(),
    visitorId: text().notNull(),
    sessionId: text(),
    name: text().notNull(),
    pageUrl: text(),
    source: text(),
    medium: text(),
    device: text(),
    props: json<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.siteId, t.createdAt),
    index().on(t.siteId, t.name, t.createdAt),
    index().on(t.visitorId),
  ],
);

export const savedReports = pgTable("saved_reports", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  query: json<Record<string, unknown>>().notNull(),
  createdAt: createdAt(),
});

// ───────── WhatsApp Business ─────────
export const waTemplates = pgTable("wa_templates", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  language: text().notNull().default("en_GB"),
  category: text().notNull().default("MARKETING"),
  components: json<Record<string, unknown>>().notNull(),
  variableMap: json<Record<string, string>>().notNull().default({}),
  status: text().notNull().default("draft"),
  metaId: text(),
  updatedAt: updatedAt(),
});

export const waAutomations = pgTable("wa_automations", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  trigger: text().notNull(),
  triggerValue: text(),
  templateId: text().notNull(),
  delayMinutes: integer().notNull().default(0),
  conditions: json<{ field: string; op: string; value: string }[]>().notNull().default([]),
  quietHours: json<{ start: string; end: string } | null>(),
  skipIfReplied: boolean().notNull().default(true),
  dailyCap: integer().notNull().default(500),
  oncePerPerson: boolean().notNull().default(true),
  active: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const waAutomationRuns = pgTable(
  "wa_automation_runs",
  {
    id: id(),
    siteId: siteId(),
    automationId: text().notNull(),
    leadId: text().notNull(),
    dueAt: ts().notNull(),
    status: text().notNull().default("waiting"),
    reason: text(),
    createdAt: createdAt(),
    finishedAt: ts(),
  },
  (t) => [index().on(t.status, t.dueAt)],
);

export const waCampaigns = pgTable("wa_campaigns", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  templateId: text().notNull(),
  filters: json<Record<string, unknown>>().notNull(),
  speedPerMinute: integer().notNull().default(20),
  status: text().notNull().default("draft"),
  stats: json<Record<string, number>>().notNull().default({}),
  startedAt: ts(),
  createdAt: createdAt(),
});

export const waMessages = pgTable(
  "wa_messages",
  {
    id: id(),
    siteId: siteId(),
    leadId: text(),
    phone: text().notNull(),
    direction: text().notNull(),
    kind: text().notNull().default("template"),
    body: text(),
    status: text().notNull().default("queued"),
    providerId: text(),
    error: text(),
    campaignId: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.siteId, t.phone, t.createdAt)],
);

export const waBotRules = pgTable("wa_bot_rules", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  matchType: text().notNull().default("contains"),
  keywords: strArr(),
  replyText: text().notNull(),
  attachments: json<unknown[]>().notNull().default([]),
  thenAction: text().notNull().default("none"),
  signal: json(),
  priority: integer().notNull().default(0),
  active: boolean().notNull().default(true),
});

// ───────── Social posting ─────────
export const socialAccounts = pgTable("social_accounts", {
  id: id(),
  siteId: siteId(),
  pageId: text().notNull().unique(),
  pageName: text(),
  instagramId: text(),
  status: text().notNull().default("pending"),
  verifyCode: text(),
  createdAt: createdAt(),
});

export const socialPosts = pgTable("social_posts", {
  id: id(),
  siteId: siteId(),
  accountId: text().notNull(),
  caption: text().notNull(),
  mediaIds: strArr(),
  platforms: strArr(),
  status: text().notNull().default("draft"),
  scheduledAt: ts(),
  requestedAt: ts(),
  authorId: text().notNull(),
  approverId: text(),
  returnNote: text(),
  history: json<{ at: string; by: string; action: string; note?: string }[]>()
    .notNull()
    .default([]),
  results: json<Record<string, unknown>>().notNull().default({}),
  error: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ───────── AI & knowledge ─────────
export const knowledgeSources = pgTable("knowledge_sources", {
  id: id(),
  siteId: siteId(),
  category: text().notNull().default("business_info"),
  type: text().notNull(),
  title: text().notNull(),
  url: text(),
  status: text().notNull().default("pending"),
  createdAt: createdAt(),
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: id(),
  siteId: siteId(),
  sourceId: text(),
  text: text().notNull(),
  useFor: strArr(),
  status: text().notNull().default("pending"),
  embedding: json<number[]>(),
  createdBy: text().notNull().default("user"),
  createdAt: createdAt(),
});

export const aiOutputs = pgTable("ai_outputs", {
  id: id(),
  siteId: siteId(),
  kind: text().notNull(),
  title: text().notNull(),
  body: text().notNull(),
  status: text().notNull().default("draft"),
  meta: json(),
  createdAt: createdAt(),
});

export const aiCreditLedger = pgTable(
  "ai_credit_ledger",
  {
    id: id(),
    siteId: siteId(),
    deltaMinor: integer().notNull(),
    reason: text().notNull(),
    provider: text(),
    balanceAfter: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.siteId, t.createdAt)],
);

export const businessInterviews = pgTable("business_interviews", {
  id: id(),
  siteId: siteId(),
  token: text().notNull().unique(),
  expiresAt: ts().notNull(),
  language: text().notNull().default("en-GB"),
  questions: json<string[]>().notNull(),
  answers: json<Record<string, string>>().notNull().default({}),
  createdAt: createdAt(),
});

// ───────── Social proof, video, shop ─────────
export const shareLinks = pgTable("share_links", {
  id: id(),
  siteId: siteId(),
  kind: text().notNull(),
  token: text().notNull().unique(),
  title: text().notNull(),
  prompts: json<string[]>().notNull().default([]),
  fields: json<string[]>().notNull().default([]),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
});

export const reviews = pgTable("reviews", {
  id: id(),
  siteId: siteId(),
  kind: text().notNull(),
  linkId: text(),
  name: text().notNull(),
  fields: json<Record<string, string>>().notNull().default({}),
  rating: integer(),
  text: text(),
  audioUrl: text(),
  transcripts: json<Record<string, string>>().notNull().default({}),
  status: text().notNull().default("pending"),
  sortOrder: integer().notNull().default(0),
  createdAt: createdAt(),
});

export const videoSessions = pgTable("video_sessions", {
  id: id(),
  siteId: siteId(),
  title: text().notNull(),
  guestToken: text().notNull().unique(),
  leadId: text(),
  roomUrl: text(),
  status: text().notNull().default("scheduled"),
  minutes: integer().notNull().default(0),
  createdAt: createdAt(),
});

export const products = pgTable(
  "products",
  {
    id: id(),
    siteId: siteId(),
    name: text().notNull(),
    slug: text().notNull(),
    shortDescription: text(),
    description: text(),
    priceMinor: integer().notNull(),
    compareAtMinor: integer(),
    currency: text().notNull().default("GBP"),
    imageUrl: text(),
    sku: text(),
    stock: integer().notNull().default(0),
    status: text().notNull().default("draft"),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.slug)],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    siteId: siteId(),
    number: text().notNull(),
    items: json<{ productId: string; name: string; qty: number; priceMinor: number }[]>().notNull(),
    buyerName: text().notNull(),
    buyerEmail: text(),
    buyerPhone: text(),
    totalMinor: integer().notNull(),
    currency: text().notNull(),
    status: text().notNull().default("pending"),
    provider: text(),
    providerRef: text(),
    paymentId: text(),
    leadId: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.number)],
);

export const researchResults = pgTable("research_results", {
  id: id(),
  siteId: siteId(),
  tool: text().notNull(),
  topic: text().notNull(),
  query: text().notNull(),
  results: json<unknown[]>().notNull(),
  createdAt: createdAt(),
});

// ───────── Affiliates (paid module) ─────────
export const partners = pgTable("partners", {
  id: id(),
  siteId: siteId(),
  name: text().notNull(),
  phone: text().notNull(),
  email: text(),
  passwordHash: text(),
  code: text().notNull().unique(),
  status: text().notNull().default("active"),
  createdAt: createdAt(),
});

export const referrals = pgTable("referrals", {
  id: id(),
  siteId: siteId(),
  partnerId: text().notNull(),
  leadId: text().notNull(),
  dealValueMinor: integer(),
  termsVersion: integer().notNull(),
  status: text().notNull().default("open"),
  createdAt: createdAt(),
});

export const commissions = pgTable("commissions", {
  id: id(),
  siteId: siteId(),
  referralId: text().notNull().unique(),
  partnerId: text().notNull(),
  amountMinor: integer().notNull(),
  currency: text().notNull(),
  status: text().notNull().default("pending"),
  reason: text(),
  availableAt: ts().notNull(),
  payoutId: text(),
  createdAt: createdAt(),
});

export const payouts = pgTable("payouts", {
  id: id(),
  siteId: siteId(),
  partnerId: text().notNull(),
  amountMinor: integer().notNull(),
  currency: text().notNull(),
  status: text().notNull().default("draft"),
  approvedBy: text(),
  paidBy: text(),
  reference: text(),
  createdAt: createdAt(),
});

export const affiliateTerms = pgTable(
  "affiliate_terms",
  {
    id: id(),
    siteId: siteId(),
    version: integer().notNull(),
    rules: json<Record<string, unknown>>().notNull(),
    publishedAt: ts(),
  },
  (t) => [uniqueIndex().on(t.siteId, t.version)],
);
