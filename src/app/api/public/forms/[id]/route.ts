import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { submitForm, submitSchema } from "@/lib/services/forms";
import { clientIp, noSite, pjson, rateLimited, siteFromRequest, tooMany } from "@/lib/public";

type P = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: P) {
  const site = await siteFromRequest(req); if (!site) return noSite();
  const { id } = await params;
  const [f] = await db.select({ id: forms.id, name: forms.name, fields: forms.fields, status: forms.status }).from(forms).where(and(eq(forms.id, id), eq(forms.siteId, site.id))).limit(1);
  if (!f || f.status !== "active") return pjson({ error: "Form not found" }, 404);
  return pjson({ id: f.id, name: f.name, fields: f.fields });
}

export async function POST(req: Request, { params }: P) {
  const site = await siteFromRequest(req); if (!site) return noSite();
  const ip = clientIp(req);
  if (rateLimited(`form:${ip}`, 20, 60_000)) return tooMany();
  const parsed = submitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return pjson({ error: "Invalid submission" }, 400);
  const { id } = await params;
  const r = await submitForm(site.id, id, parsed.data, ip);
  if (!r.ok) return pjson({ error: r.error, errors: "errors" in r ? r.errors : undefined }, r.status);
  return pjson({ ok: true, message: r.message, redirectUrl: r.redirectUrl });
}
