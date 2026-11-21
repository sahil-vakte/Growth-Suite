import { setRequestSite } from "./requestContext";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError, requireAdmin, assertSameOrigin, type AdminContext } from "./auth/current";
import type { Feature } from "./auth/permissions";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  if (e instanceof ZodError)
    return json(
      {
        error: "Please check the highlighted fields.",
        issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      422,
    );
  const pg =
    (e as { cause?: { code?: string; detail?: string } })?.cause ??
    (e as { code?: string; detail?: string });
  if (pg?.code === "23505")
    return json(
      {
        error: `That already exists${pg.detail?.match(/\((\w+)\)=/)?.[1] ? ` (duplicate ${pg.detail.match(/\((\w+)\)=/)![1].replace("_", " ")})` : ""}. Use a different value.`,
      },
      409,
    );
  if (pg?.code === "23503")
    return json({ error: "This refers to something that no longer exists." }, 409);
  if (pg?.code === "22P02") return json({ error: "One of the values has the wrong format." }, 422);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

type Handler<P> = (ctx: AdminContext, req: Request, params: P) => Promise<Response | unknown>;

/** Wraps an admin API route: authentication, feature permission, CSRF origin check on mutations, JSON errors. */
export function adminRoute<P = Record<string, string>>(
  feature: Feature | undefined,
  handler: Handler<P>,
) {
  return async (req: Request, routeCtx: { params: Promise<P> }) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") await assertSameOrigin();
      const ctx = await requireAdmin(feature);
      setRequestSite(ctx.site.id);
      const out = await handler(ctx, req, (await routeCtx?.params) ?? ({} as P));
      return out instanceof Response ? out : json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}
