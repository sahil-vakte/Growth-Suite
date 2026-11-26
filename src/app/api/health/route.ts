import { withApiLog } from "@/lib/apiLogging";
import { sql } from "drizzle-orm";
import { db } from "@/db";

async function handleGET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}

export const GET = withApiLog("/api/health", "GET", handleGET);
