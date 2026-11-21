import { and, eq } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { contentRevisions, sections } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { resourceByKey } from "@/lib/admin/resources";
import { siteRow } from "@/lib/admin/rows";
import { snapshot, audit } from "@/lib/history";

/** Restore a saved version. The current version is snapshotted first, so a restore can itself be undone.
 *  A deleted page also gets back the sections it contained (from their own delete snapshots). */
export const POST = adminRoute<{ id: string }>("history", async (ctx, _req, p) => {
  const rev = await siteRow(contentRevisions, p.id, ctx.site.id, "Version");
  const table = rev.entity === "sections" ? (sections as unknown as PgTable) : (resourceByKey(rev.entity)?.table as PgTable | undefined);
  if (!table) throw new HttpError(422, "This item type cannot be restored.");
  const cols = getTableColumns(table) as Record<string, PgColumn>;
  const snap = { ...(rev.snapshot as Record<string, unknown>) };
  for (const k of Object.keys(snap)) if (/At$/.test(k) && typeof snap[k] === "string") snap[k] = new Date(snap[k] as string);
  if (snap.siteId !== ctx.site.id) throw new HttpError(403, "Version belongs to another site.");
  const [existing] = await db.select().from(table).where(and(eq(cols.id, rev.entityId), eq(cols.siteId, ctx.site.id))).limit(1);
  if (existing) { await snapshot(ctx.site.id, rev.entity, rev.entityId, existing, "restore", ctx.actor); await db.update(table).set(snap as never).where(eq(cols.id, rev.entityId)); }
  else await db.insert(table).values(snap as never);
  if (rev.entity === "pages" && !existing) {
    const secRevs = await db.select().from(contentRevisions).where(and(eq(contentRevisions.siteId, ctx.site.id), eq(contentRevisions.entity, "sections"), eq(contentRevisions.operation, "delete")));
    for (const sr of secRevs) { const s = sr.snapshot as Record<string, unknown>; if (s.pageId === rev.entityId) await db.insert(sections).values({ ...(s as object), createdAt: new Date(String(s.createdAt)), updatedAt: new Date() } as never).onConflictDoNothing(); }
  }
  await audit(ctx.site.id, ctx.actor, "history.restore", rev.entity, rev.entityId, { revisionId: rev.id });
  return { ok: true, message: "Restored." };
});
