import { withApiLog } from "@/lib/apiLogging";
import { z } from "zod";
import { db } from "@/db";
import { clickLogs } from "@/db/schema";
import { shortCode } from "@/lib/ids";
import { clientIp, noSite, pjson, rateLimited, siteFromRequest, tooMany } from "@/lib/public";

/** Logs WhatsApp / call clicks. WhatsApp clicks get a Ref code appended to the message so the chat links back to the visit. */
async function handlePOST(req: Request) {
  const site = await siteFromRequest(req);
  if (!site) return noSite();
  if (await rateLimited(`click:${clientIp(req)}`, 30, 60_000)) return tooMany();
  const p = z
    .object({
      kind: z.enum(["whatsapp", "call"]),
      visitorId: z.string().max(64).optional(),
      pageUrl: z.string().max(2000).optional(),
      href: z.string().max(2000).optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return pjson({ error: "Bad click" }, 400);
  const refCode = p.data.kind === "whatsapp" ? shortCode(6) : null;
  await db.insert(clickLogs).values({
    siteId: site.id,
    kind: p.data.kind,
    pageUrl: p.data.pageUrl,
    visitorId: p.data.visitorId,
    refCode,
    source: p.data.href?.slice(0, 200),
  });
  return pjson({ ok: true, refCode });
}

export const POST = withApiLog("/api/public/click", "POST", handlePOST);
