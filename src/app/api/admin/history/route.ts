import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentRevisions } from "@/db/schema";
import { adminRoute } from "@/lib/api";

export const GET = adminRoute("history", async (ctx, req) => {
  const op = new URL(req.url).searchParams.get("op");
  return db
    .select()
    .from(contentRevisions)
    .where(
      and(
        eq(contentRevisions.siteId, ctx.site.id),
        op ? eq(contentRevisions.operation, op) : undefined,
      ),
    )
    .orderBy(desc(contentRevisions.createdAt))
    .limit(200);
});
