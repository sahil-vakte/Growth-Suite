import { cookies } from "next/headers";
import { z } from "zod";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { SITE_COOKIE } from "@/lib/auth/session";

export const POST = adminRoute(undefined, async (ctx, req) => {
  const { siteId } = z.object({ siteId: z.string() }).parse(await readJson(req));
  if (!ctx.sites.some((s) => s.id === siteId))
    throw new HttpError(403, "You are not a member of that site.");
  (await cookies()).set(SITE_COOKIE, siteId, { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
});
