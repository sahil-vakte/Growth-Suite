import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { waBotRules } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { getSetting } from "@/lib/settings";
import { botRespond, type BotRule } from "@/lib/engines/waBot";

/** "Try it": what would the bot say? Nothing is sent. */
export const POST = adminRoute("whatsapp_business", async (ctx, req) => {
  const b = z
    .object({ text: z.string().max(1000), newChat: z.boolean().default(false) })
    .parse(await readJson(req));
  const settings = await getSetting(ctx.site.id, "whatsapp.bot");
  const rules = (await db
    .select()
    .from(waBotRules)
    .where(eq(waBotRules.siteId, ctx.site.id))) as unknown as BotRule[];
  return botRespond(
    rules,
    { ...settings, enabled: true },
    {
      text: b.text,
      isMedia: false,
      isNewChat: b.newChat,
      optedOut: false,
      repliesToday: 0,
      now: new Date(),
    },
  );
});
