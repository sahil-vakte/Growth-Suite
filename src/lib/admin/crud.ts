/** Generic, site-scoped CRUD for every registered resource. */
import { and, asc, count, desc, eq, getTableColumns, ilike, or, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { HttpError, type AdminContext } from "../auth/current";
import { audit, snapshot } from "../history";
import type { FieldDef, ResourceDef } from "./resources";
import { resourceHooks } from "./hooks";

const cols = (r: ResourceDef) => getTableColumns(r.table as PgTable) as Record<string, PgColumn>;

function fieldSchema(f: FieldDef): z.ZodTypeAny {
  const opt = (s: z.ZodTypeAny) => (f.required ? s : s.nullable().optional());
  const emptyToNull = (v: unknown) => (v === "" ? null : v);
  switch (f.type) {
    case "number":
    case "money":
      return z.preprocess(emptyToNull, opt(z.coerce.number().int().finite()));
    case "bool":
      return z.preprocess(
        (v) => (v === "true" || v === "on" ? true : v === "false" ? false : v),
        z.boolean().optional(),
      );
    case "json":
      return z.preprocess(
        (v) => {
          if (typeof v !== "string") return v;
          try {
            return JSON.parse(v);
          } catch {
            return Symbol("bad");
          }
        },
        z.any().refine((v) => typeof v !== "symbol", "Must be valid JSON"),
      );
    case "datetime":
      return z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? null : new Date(String(v))),
        z
          .date()
          .nullable()
          .optional()
          .refine((d) => !d || !isNaN(d.getTime()), "Invalid date"),
      );
    case "tags":
      return z.preprocess(
        (v) =>
          typeof v === "string"
            ? v
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean)
            : (v ?? []),
        z.array(z.string().max(500)).max(200),
      );
    case "select":
      return z.preprocess(
        emptyToNull,
        opt(
          z
            .string()
            .refine((v) => !f.options || f.options.includes(v), "Choose one of the options"),
        ),
      );
    case "url":
      return z.preprocess(
        emptyToNull,
        opt(
          z
            .string()
            .max(2000)
            .refine((v) => /^(https?:\/\/|\/)/.test(v), "Must start with https:// or /"),
        ),
      );
    case "relation":
      return z.preprocess(emptyToNull, opt(z.string().max(64)));
    case "textarea":
    case "richtext":
      return z.preprocess(emptyToNull, opt(z.string().max(200_000)));
    default:
      return z.preprocess(emptyToNull, opt(z.string().max(2000)));
  }
}

export function bodySchema(r: ResourceDef, partial: boolean) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of r.fields) if (!f.readOnly) shape[f.key] = fieldSchema(f);
  const s = z.object(shape).strip();
  return partial ? s.partial() : s;
}

function siteFilter(r: ResourceDef, ctx: AdminContext): SQL {
  const c = cols(r);
  return eq(c.siteId, ctx.site.id);
}

export async function listRows(
  r: ResourceDef,
  ctx: AdminContext,
  q: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string> },
) {
  const c = cols(r);
  const conds: SQL[] = [siteFilter(r, ctx)];
  if (q.search) {
    const fields = (r.searchFields ?? [r.titleField]).filter((k) => c[k]);
    if (fields.length) conds.push(or(...fields.map((k) => ilike(c[k], `%${q.search}%`)))!);
  }
  for (const [k, v] of Object.entries(q.filters ?? {}))
    if (c[k] && v !== "") conds.push(eq(c[k], v));
  const pageSize = Math.min(100, q.pageSize ?? 25),
    page = Math.max(1, q.page ?? 1);
  const ob =
    r.orderBy && c[r.orderBy.field]
      ? r.orderBy.dir === "asc"
        ? asc(c[r.orderBy.field])
        : desc(c[r.orderBy.field])
      : c.createdAt
        ? desc(c.createdAt)
        : asc(c.id);
  const table = r.table as PgTable;
  const rows = await db
    .select()
    .from(table)
    .where(and(...conds))
    .orderBy(ob)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db
    .select({ total: count() })
    .from(table)
    .where(and(...conds));
  return { rows, total, page, pageSize };
}

export async function getRow(r: ResourceDef, ctx: AdminContext, id: string) {
  const c = cols(r);
  const [row] = await db
    .select()
    .from(r.table as PgTable)
    .where(and(eq(c.id, id), siteFilter(r, ctx)))
    .limit(1);
  if (!row) throw new HttpError(404, `${r.singular} not found.`);
  return row as Record<string, unknown>;
}

export async function createRow(r: ResourceDef, ctx: AdminContext, body: unknown) {
  if (r.readOnly || r.noCreate) throw new HttpError(405, `${r.label} cannot be created here.`);
  const data: Record<string, unknown> = {
    ...defaults(r),
    ...(bodySchema(r, false).parse(body) as object),
    siteId: ctx.site.id,
  };
  const hooks = resourceHooks[r.key];
  const values = hooks?.beforeCreate ? await hooks.beforeCreate(data, ctx) : data;
  const [row] = await db
    .insert(r.table as PgTable)
    .values(values as never)
    .returning();
  await hooks?.afterSave?.(row as Record<string, unknown>, ctx, null);
  await audit(ctx.site.id, ctx.actor, `${r.key}.create`, r.key, (row as { id: string }).id);
  return row;
}

export async function updateRow(r: ResourceDef, ctx: AdminContext, id: string, body: unknown) {
  if (r.readOnly && !resourceHooks[r.key]?.allowUpdateWhenReadOnly)
    throw new HttpError(405, `${r.label} are read-only.`);
  const before = await getRow(r, ctx, id);
  const hooks = resourceHooks[r.key];
  let data = bodySchema(r, true).parse(body) as Record<string, unknown>;
  if (hooks?.beforeUpdate) data = await hooks.beforeUpdate(data, ctx, before);
  if (r.history) await snapshot(ctx.site.id, r.key, id, before, "update", ctx.actor);
  const c = cols(r);
  const [row] = await db
    .update(r.table as PgTable)
    .set(data as never)
    .where(and(eq(c.id, id), siteFilter(r, ctx)))
    .returning();
  await hooks?.afterSave?.(row as Record<string, unknown>, ctx, before);
  await audit(ctx.site.id, ctx.actor, `${r.key}.update`, r.key, id, { fields: Object.keys(data) });
  return row;
}

export async function deleteRow(r: ResourceDef, ctx: AdminContext, id: string) {
  if (r.readOnly || r.noDelete) throw new HttpError(405, `${r.label} cannot be deleted.`);
  const before = await getRow(r, ctx, id);
  await resourceHooks[r.key]?.beforeDelete?.(before, ctx);
  if (r.history) await snapshot(ctx.site.id, r.key, id, before, "delete", ctx.actor);
  const c = cols(r);
  await db.delete(r.table as PgTable).where(and(eq(c.id, id), siteFilter(r, ctx)));
  await audit(ctx.site.id, ctx.actor, `${r.key}.delete`, r.key, id);
  return { ok: true };
}

function defaults(r: ResourceDef) {
  return Object.fromEntries(
    r.fields
      .filter((f) => f.default !== undefined && !f.readOnly)
      .map((f) => [f.key, structuredClone(f.default)]),
  );
}
