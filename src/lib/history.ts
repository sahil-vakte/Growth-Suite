import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, contentRevisions } from "@/db/schema";

const KEEP = 3;

/** Snapshot an item before it changes or is deleted. Keeps the last 3 versions per item. */
export async function snapshot(siteId: string, entity: string, entityId: string, row: unknown, operation: "update" | "delete" | "restore", actor: string) {
  if (!row) return;
  await db.insert(contentRevisions).values({ siteId, entity, entityId, operation, snapshot: row as object, actor });
  const all = await db.select({ id: contentRevisions.id }).from(contentRevisions)
    .where(and(eq(contentRevisions.siteId, siteId), eq(contentRevisions.entity, entity), eq(contentRevisions.entityId, entityId)))
    .orderBy(desc(contentRevisions.createdAt));
  const extra = all.slice(KEEP).map((r) => r.id);
  if (extra.length) await db.delete(contentRevisions).where(inArray(contentRevisions.id, extra));
}

export async function audit(siteId: string | null, actor: string, action: string, entity?: string, entityId?: string, meta?: Record<string, unknown>) {
  await db.insert(auditLogs).values({ siteId, actor, action, entity, entityId, meta });
}
