/** Resource-specific business rules applied by the generic CRUD layer. */
import { and, eq, ne, count } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { HttpError, type AdminContext } from "../auth/current";
import { shortCode } from "../ids";
import { randomToken } from "../crypto";
import { clearSiteCache } from "../tenant";
import { formDefinitionProblems } from "../engines/formDefinition";

type Row = Record<string, unknown>;
interface Hooks {
  beforeCreate?: (d: Row, ctx: AdminContext) => Promise<Row> | Row;
  beforeUpdate?: (d: Row, ctx: AdminContext, before: Row) => Promise<Row> | Row;
  afterSave?: (row: Row, ctx: AdminContext, before: Row | null) => Promise<void> | void;
  beforeDelete?: (row: Row, ctx: AdminContext) => Promise<void> | void;
  allowUpdateWhenReadOnly?: boolean;
}

export const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\/+/g, "/")
    .slice(0, 120);
const RESERVED = [
  "admin",
  "api",
  "blog",
  "shop",
  "book",
  "uploads",
  "_next",
  "r",
  "partner",
  "review",
  "interview",
  "video",
  "sitemap.xml",
  "robots.txt",
];

const pageLock = (ctx: AdminContext, before: Row | null) => {
  if (
    before &&
    before.lastEditedRole === "admin" &&
    ctx.member.role !== "admin" &&
    !ctx.member.isPlatformAdmin
  )
    throw new HttpError(
      403,
      "An admin last edited this page, so it is locked for editors. Duplicate it to make your own copy.",
    );
};
const editorStamp = (d: Row, ctx: AdminContext) => ({
  ...d,
  lastEditedBy: ctx.actor,
  lastEditedRole: ctx.member.isPlatformAdmin ? "admin" : ctx.member.role,
});

async function unsetOtherHome(siteId: string, id: string) {
  await db
    .update(s.pages)
    .set({ isHome: false })
    .where(and(eq(s.pages.siteId, siteId), ne(s.pages.id, id)));
}

export const resourceHooks: Record<string, Hooks> = {
  pages: {
    beforeCreate: (d, ctx) => {
      const slug = slugify(String(d.slug || d.title));
      if (RESERVED.includes(slug.split("/")[0]))
        throw new HttpError(422, `"${slug}" is a reserved address. Choose another.`);
      return editorStamp({ ...d, slug }, ctx);
    },
    beforeUpdate: (d, ctx, before) => {
      pageLock(ctx, before);
      if (d.slug !== undefined) {
        d.slug = slugify(String(d.slug));
        if (RESERVED.includes(String(d.slug).split("/")[0]))
          throw new HttpError(422, "That address is reserved.");
      }
      return editorStamp(d, ctx);
    },
    afterSave: async (row) => {
      if (row.isHome) await unsetOtherHome(String(row.siteId), String(row.id));
    },
    beforeDelete: (row, ctx) => pageLock(ctx, row),
  },
  "blog-posts": {
    beforeCreate: (d) => ({
      ...d,
      slug: slugify(String(d.slug || d.title)),
      publishedAt:
        d.status === "published" ? (d.publishedAt ?? new Date()) : (d.publishedAt ?? null),
    }),
    beforeUpdate: (d, _c, before) => ({
      ...d,
      ...(d.slug ? { slug: slugify(String(d.slug)) } : {}),
      ...(d.status === "published" && !before.publishedAt && !d.publishedAt
        ? { publishedAt: new Date() }
        : {}),
    }),
  },
  "blog-categories": { beforeCreate: (d) => ({ ...d, slug: slugify(String(d.slug || d.name)) }) },
  products: { beforeCreate: (d) => ({ ...d, slug: slugify(String(d.slug || d.name)) }) },
  redirects: {
    beforeCreate: (d) => {
      const from =
        "/" +
        String(d.fromPath)
          .replace(/^https?:\/\/[^/]+/, "")
          .replace(/^\/+/, "");
      if (![301, 302].includes(Number(d.code)))
        throw new HttpError(422, "Type must be 301 or 302.");
      return { ...d, fromPath: from };
    },
  },
  layouts: {
    beforeCreate: (d) => {
      if (!/^[a-z][a-z0-9_]{2,63}$/.test(String(d.key)))
        throw new HttpError(
          422,
          "Key must be lowercase letters, numbers and underscores (3–64 characters).",
        );
      return { ...d, source: "uploaded" };
    },
  },
  "lead-stages": {
    beforeDelete: async (row) => {
      const [{ n }] = await db
        .select({ n: count() })
        .from(s.leads)
        .where(eq(s.leads.stageId, String(row.id)));
      if (n > 0)
        throw new HttpError(
          409,
          `${n} lead(s) are still in this stage. Move them to another stage first.`,
        );
    },
  },
  segments: {
    beforeDelete: async (row) => {
      const [{ n }] = await db
        .select({ n: count() })
        .from(s.popups)
        .where(eq(s.popups.segmentId, String(row.id)));
      if (n > 0)
        throw new HttpError(
          409,
          "A popup still uses this audience. Remove it from the popup first.",
        );
    },
  },
  "wa-templates": {
    beforeUpdate: (d, _c, before) =>
      before.status === "approved" && (d.components || d.name) ? { ...d, status: "draft" } : d,
  },
  "wa-campaigns": {
    beforeUpdate: (d, _c, before) => {
      if (["running", "completed"].includes(String(before.status)) && (d.filters || d.templateId))
        throw new HttpError(409, "Pause the campaign before changing its audience or template.");
      return d;
    },
  },
  "social-accounts": {
    beforeCreate: (d) => ({ ...d, status: "pending", verifyCode: `GS-${shortCode(6)}` }),
  },
  "social-posts": {
    beforeCreate: (d, ctx) => ({
      ...d,
      authorId: ctx.user.id,
      status: "draft",
      history: [{ at: new Date().toISOString(), by: ctx.actor, action: "created" }],
    }),
    beforeUpdate: (d, ctx, before) => {
      if (
        !["draft", "returned"].includes(String(before.status)) &&
        !ctx.member.isPlatformAdmin &&
        ctx.member.role !== "admin"
      )
        throw new HttpError(
          409,
          "Only drafts can be edited. Use the post actions to change its status.",
        );
      if (
        before.authorId !== ctx.user.id &&
        ctx.member.role !== "admin" &&
        !ctx.member.isPlatformAdmin
      )
        throw new HttpError(403, "You can only edit your own drafts.");
      const { history: _h, ...rest } = d;
      return rest;
    },
  },
  "share-links": { beforeCreate: (d) => ({ ...d, token: randomToken(12) }) },
  "video-sessions": { beforeCreate: (d) => ({ ...d, guestToken: randomToken(12) }) },
  commissions: {
    beforeUpdate: (d) => {
      if (d.status === "rejected" && !d.reason)
        throw new HttpError(422, "Give a reason when rejecting a commission.");
      return d;
    },
  },
  "affiliate-terms": {
    beforeUpdate: (_d, _c, before) => {
      if (before.publishedAt)
        throw new HttpError(409, "Published terms cannot be changed. Create a new version.");
      return _d;
    },
  },
  partners: { beforeCreate: (d) => ({ ...d, code: String(d.code || shortCode(6)).toUpperCase() }) },
  submissions: {},
  forms: {
    beforeCreate: (d) => {
      const p = formDefinitionProblems(d.fields);
      if (p.length) throw new HttpError(422, p.join(" "));
      return d;
    },
    beforeUpdate: (d) => {
      if (d.fields !== undefined) {
        const p = formDefinitionProblems(d.fields);
        if (p.length) throw new HttpError(422, p.join(" "));
      }
      return d;
    },
  },
};

export { clearSiteCache };
