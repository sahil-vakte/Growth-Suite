import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { commissions, payouts } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import { canMarkPaid } from "@/lib/engines/affiliates";
import { audit } from "@/lib/history";

export const POST = adminRoute<{ id: string }>("affiliates", async (ctx, req, p) => {
  const { action, reference } = z
    .object({ action: z.enum(["approve", "mark_paid"]), reference: z.string().max(200).optional() })
    .parse(await readJson(req));
  if (ctx.member.role !== "admin" && !ctx.member.isPlatformAdmin)
    throw new HttpError(403, "Only administrators manage payouts.");
  const po = await siteRow(payouts, p.id, ctx.site.id, "Payout");
  if (action === "approve") {
    if (po.status !== "draft") throw new HttpError(409, "Only draft payouts can be approved.");
    await db
      .update(payouts)
      .set({ status: "approved", approvedBy: ctx.actor })
      .where(eq(payouts.id, po.id));
  } else {
    if (po.status !== "approved") throw new HttpError(409, "Approve the payout first.");
    if (!canMarkPaid(po.approvedBy, ctx.actor))
      throw new HttpError(403, "A different administrator must mark this payout as paid.");
    await db
      .update(payouts)
      .set({ status: "paid", paidBy: ctx.actor, reference: reference ?? po.reference })
      .where(eq(payouts.id, po.id));
    await db
      .update(commissions)
      .set({ status: "paid" })
      .where(and(eq(commissions.payoutId, po.id)));
  }
  await audit(ctx.site.id, ctx.actor, `payouts.${action}`, "payouts", po.id);
  return {
    ok: true,
    message:
      action === "approve"
        ? "Payout approved. Another administrator can now mark it paid."
        : "Payout marked as paid.",
  };
});
