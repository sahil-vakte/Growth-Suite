import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { apiClients } from "@/db/schema";
import { env } from "@/lib/env";
import { clientIp, rateLimited } from "@/lib/public";

/** OAuth 2.0 client-credentials grant: exchange client_id + client_secret for a 1-hour access token. */
export async function POST(req: Request) {
  if (rateLimited(`mcp-token:${clientIp(req)}`, 10, 60_000))
    return Response.json({ error: "slow_down" }, { status: 429 });
  const ct = req.headers.get("content-type") ?? "";
  const body = ct.includes("json")
    ? await req.json().catch(() => ({}))
    : Object.fromEntries(new URLSearchParams(await req.text()));
  if (body.grant_type && body.grant_type !== "client_credentials")
    return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
  const [c] = await db
    .select()
    .from(apiClients)
    .where(eq(apiClients.clientId, String(body.client_id ?? "")))
    .limit(1);
  if (!c || !c.active || !(await bcrypt.compare(String(body.client_secret ?? ""), c.secretHash)))
    return Response.json({ error: "invalid_client" }, { status: 401 });
  if (c.requireAdminApproval)
    return Response.json(
      {
        error: "access_denied",
        error_description: "This connection needs an admin to approve it in the admin panel.",
      },
      { status: 403 },
    );
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.id)
    .setAudience("mcp")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(env.sessionSecret));
  return Response.json({ access_token: token, token_type: "Bearer", expires_in: 3600 });
}
