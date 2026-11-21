import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { apiClients } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { randomToken } from "@/lib/crypto";
import { GROUPS } from "@/lib/mcp/tools";
import { audit } from "@/lib/history";
import { permsSchema } from "@/lib/admin/schemas";

export const GET = adminRoute("integrations", async (ctx) => ({
  groups: GROUPS,
  clients: (await db.select().from(apiClients).where(eq(apiClients.siteId, ctx.site.id))).map(
    ({ secretHash: _s, ...c }) => c,
  ),
}));

/** Creates a connection. The secret is shown once and stored only as a hash. */
export const POST = adminRoute("integrations", async (ctx, req) => {
  if (ctx.member.role !== "admin" && !ctx.member.isPlatformAdmin && !ctx.member.mcpAccess)
    throw new HttpError(403, "You are not allowed to connect AI assistants.");
  const b = z
    .object({ name: z.string().min(1).max(80), permissions: permsSchema })
    .parse(await readJson(req));
  const clientId = `gs_${randomToken(9)}`;
  const secret = randomToken(32);
  await db.insert(apiClients).values({
    siteId: ctx.site.id,
    name: b.name,
    clientId,
    secretHash: await bcrypt.hash(secret, 10),
    permissions: b.permissions,
  });
  await audit(ctx.site.id, ctx.actor, "mcp.client_create", "api_clients", clientId);
  return {
    clientId,
    clientSecret: secret,
    message: "Copy the secret now — it will not be shown again.",
  };
});
