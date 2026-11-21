import { and, eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { apiClients } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { randomToken } from "@/lib/crypto";
import { permsSchema } from "@/lib/admin/schemas";

export const PATCH = adminRoute<{ id: string }>("integrations", async (ctx, req, p) => {
  const b = z.object({ permissions: permsSchema.optional(), active: z.boolean().optional(), requireAdminApproval: z.boolean().optional(), rotate: z.boolean().optional() }).parse(await readJson(req));
  const [c] = await db.select().from(apiClients).where(and(eq(apiClients.id, p.id), eq(apiClients.siteId, ctx.site.id))).limit(1);
  if (!c) throw new HttpError(404, "Connection not found.");
  const { rotate, ...rest } = b; let secret: string | undefined;
  const patch: Record<string, unknown> = { ...rest };
  if (rotate) { secret = randomToken(32); patch.secretHash = await bcrypt.hash(secret, 10); }
  await db.update(apiClients).set(patch).where(eq(apiClients.id, c.id));
  return { ok: true, ...(secret ? { clientSecret: secret, message: "New secret generated. Update it in your assistant." } : {}) };
});

export const DELETE = adminRoute<{ id: string }>("integrations", async (ctx, _req, p) => {
  await db.delete(apiClients).where(and(eq(apiClients.id, p.id), eq(apiClients.siteId, ctx.site.id)));
  return { ok: true };
});
