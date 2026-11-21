import { withApiLog } from "@/lib/apiLogging";
import { z } from "zod";
import { leads } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { siteRow } from "@/lib/admin/rows";
import { addActivity } from "@/lib/services/leads";

export const POST = withApiLog(
  "/api/admin/leads/[id]/notes",
  "POST",
  adminRoute<{ id: string }>("crm", async (ctx, req, p) => {
    const lead = await siteRow(leads, p.id, ctx.site.id, "Lead");
    const b = z
      .object({
        text: z.string().min(1).max(10_000),
        type: z.enum(["note", "call"]).default("note"),
      })
      .parse(await readJson(req));
    await addActivity(ctx.site.id, lead.id, b.type, b.text, undefined, ctx.actor);
    return { ok: true };
  }),
);
