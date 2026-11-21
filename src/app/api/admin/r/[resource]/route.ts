import { adminRoute, readJson } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth/current";
import { resourceByKey } from "@/lib/admin/resources";
import { createRow, listRows } from "@/lib/admin/crud";
import { canAccess } from "@/lib/auth/permissions";

async function resolve(key: string) {
  const r = resourceByKey(key);
  if (!r) throw new HttpError(404, "Unknown section.");
  const ctx = await requireAdmin();
  if (!canAccess(ctx.member, r.feature)) throw new HttpError(403, "You do not have access to this area.");
  return r;
}

export const GET = adminRoute<{ resource: string }>(undefined, async (ctx, req, p) => {
  const r = await resolve(p.resource);
  const u = new URL(req.url);
  const filters: Record<string, string> = {};
  u.searchParams.forEach((v, k) => { if (k.startsWith("f.")) filters[k.slice(2)] = v; });
  return listRows(r, ctx, { search: u.searchParams.get("q") ?? undefined, page: Number(u.searchParams.get("page") ?? 1), pageSize: Number(u.searchParams.get("pageSize") ?? 25), filters });
});

export const POST = adminRoute<{ resource: string }>(undefined, async (ctx, req, p) => {
  const r = await resolve(p.resource);
  return createRow(r, ctx, await readJson(req));
});
