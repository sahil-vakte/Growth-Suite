import { withApiLog } from "@/lib/apiLogging";
import { z } from "zod";
import { track } from "@/lib/services/tracking";
import { clientIp, noSite, pjson, rateLimited, siteFromRequest, tooMany } from "@/lib/public";

const schema = z.object({
  name: z.string().max(40),
  visitorId: z.string().regex(/^[a-zA-Z0-9]{16,64}$/),
  url: z.string().max(2000),
  referrer: z.string().max(2000).optional(),
  props: z.record(z.unknown()).optional(),
  ids: z.record(z.string().max(300).optional()).optional(),
});

async function handlePOST(req: Request) {
  const site = await siteFromRequest(req);
  if (!site) return noSite();
  if (await rateLimited(`track:${clientIp(req)}`, 120, 60_000)) return tooMany();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return pjson({ error: "Bad event" }, 400);
  try {
    const props = parsed.data.props
      ? JSON.parse(JSON.stringify(parsed.data.props).slice(0, 2000))
      : undefined;
    const ids = Object.fromEntries(
      Object.entries(parsed.data.ids ?? {}).filter(([, v]) => v),
    ) as Record<string, string>;
    await track({
      siteId: site.id,
      visitorId: parsed.data.visitorId,
      name: parsed.data.name,
      url: parsed.data.url,
      referrer: parsed.data.referrer,
      userAgent: req.headers.get("user-agent"),
      props,
      ids,
    });
    return pjson({ ok: true });
  } catch {
    return pjson({ error: "Rejected" }, 400);
  }
}

export const POST = withApiLog("/api/public/track", "POST", handlePOST);
