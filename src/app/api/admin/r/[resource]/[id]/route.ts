import { adminRoute, readJson } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth/current";
import { resourceByKey } from "@/lib/admin/resources";
import { deleteRow, getRow, updateRow } from "@/lib/admin/crud";
import { canAccess } from "@/lib/auth/permissions";

type P = { resource: string; id: string };
async function resolve(key: string) {
  const r = resourceByKey(key);
  if (!r) throw new HttpError(404, "Unknown section.");
  const ctx = await requireAdmin();
  if (!canAccess(ctx.member, r.feature))
    throw new HttpError(403, "You do not have access to this area.");
  return r;
}

export const GET = adminRoute<P>(undefined, async (ctx, _req, p) =>
  getRow(await resolve(p.resource), ctx, p.id),
);
export const PATCH = adminRoute<P>(undefined, async (ctx, req, p) =>
  updateRow(await resolve(p.resource), ctx, p.id, await readJson(req)),
);
export const DELETE = adminRoute<P>(undefined, async (ctx, _req, p) =>
  deleteRow(await resolve(p.resource), ctx, p.id),
);
