import { and, eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { HttpError } from "../auth/current";

/** Load one row that must belong to the site, or 404. */
export async function siteRow<T extends PgTable & { id: PgColumn; siteId: PgColumn }>(
  table: T,
  id: string,
  siteId: string,
  what = "Item",
): Promise<T["$inferSelect"]> {
  const [row] = await db
    .select()
    .from(table as PgTable)
    .where(and(eq(table.id, id), eq(table.siteId, siteId)))
    .limit(1);
  if (!row) throw new HttpError(404, `${what} not found.`);
  return row as T["$inferSelect"];
}
