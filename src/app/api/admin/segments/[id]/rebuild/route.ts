import { segments } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { siteRow } from "@/lib/admin/rows";
import { rebuildSegment } from "@/lib/services/scheduler";

export const POST = adminRoute<{ id: string }>("audiences", async (ctx, _req, p) => {
  const seg = await siteRow(segments, p.id, ctx.site.id, "Audience");
  const n = await rebuildSegment(seg.id);
  return { ok: true, message: `${n} visitors are in this audience.` };
});
