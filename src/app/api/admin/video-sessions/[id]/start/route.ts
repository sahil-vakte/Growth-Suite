import { withApiLog } from "@/lib/apiLogging";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videoSessions } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { siteRow } from "@/lib/admin/rows";
import { createVideoRoom } from "@/lib/integrations/other";
import { env } from "@/lib/env";

export const POST = withApiLog(
  "/api/admin/video-sessions/[id]/start",
  "POST",
  adminRoute<{ id: string }>("video", async (ctx, _req, p) => {
    const v = await siteRow(videoSessions, p.id, ctx.site.id, "Session");
    const room = v.roomUrl ? { url: v.roomUrl } : await createVideoRoom(v.guestToken.toLowerCase());
    await db
      .update(videoSessions)
      .set({ roomUrl: room.url, status: "live" })
      .where(eq(videoSessions.id, v.id));
    return { ok: true, message: `Room ready. Guest link: ${env.appUrl}/video/${v.guestToken}` };
  }),
);
