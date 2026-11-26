import { withApiLog } from "@/lib/apiLogging";
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

export const GET = withApiLog(
  "/api/admin/r/[resource]/[id]",
  "GET",
  adminRoute<P>(undefined, async (ctx, _req, p) => getRow(await resolve(p.resource), ctx, p.id)),
);
export const PATCH = withApiLog(
  "/api/admin/r/[resource]/[id]",
  "PATCH",
  adminRoute<P>(undefined, async (ctx, req, p) =>
    updateRow(await resolve(p.resource), ctx, p.id, await readJson(req)),
  ),
);
export const DELETE = withApiLog(
  "/api/admin/r/[resource]/[id]",
  "DELETE",
  adminRoute<P>(undefined, async (ctx, _req, p) => deleteRow(await resolve(p.resource), ctx, p.id)),
);
