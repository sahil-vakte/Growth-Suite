import { withApiLog } from "@/lib/apiLogging";
import { z } from "zod";
import { chatTurn } from "@/lib/services/chatbot";
import { clientIp, noSite, pjson, rateLimited, siteFromRequest, tooMany } from "@/lib/public";

async function handlePOST(req: Request, { params }: { params: Promise<{ widgetId: string }> }) {
  const site = await siteFromRequest(req);
  if (!site) return noSite();
  if (await rateLimited(`chat:${clientIp(req)}`, 20, 60_000)) return tooMany();
  const p = z
    .object({
      message: z.string().min(1).max(1000),
      conversationId: z.string().max(64).nullable().optional(),
      visitorId: z.string().max(64).optional(),
      pageUrl: z.string().max(2000).optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return pjson({ error: "Please type a message." }, 400);
  try {
    return pjson(await chatTurn(site.id, (await params).widgetId, p.data));
  } catch (e) {
    return pjson({ error: e instanceof Error ? e.message : "Chat unavailable" }, 404);
  }
}

export const POST = withApiLog("/api/public/chat/[widgetId]", "POST", handlePOST);
