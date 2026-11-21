import { withApiLog } from "@/lib/apiLogging";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { json } from "@/lib/api";

async function handlePOST() {
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
}

export const POST = withApiLog("/api/auth/logout", "POST", handlePOST);
