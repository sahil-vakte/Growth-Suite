import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { socialAccounts, socialPosts } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import {
  can,
  nextStatus,
  addUtm,
  captionWarnings,
  type PostAction,
  type PostStatus,
} from "@/lib/engines/social";
import { getSetting } from "@/lib/settings";
import { enqueue } from "@/lib/queue";

export const POST = adminRoute<{ id: string }>("social", async (ctx, req, p) => {
  const body = z
    .object({
      action: z.enum([
        "submit",
        "approve",
        "return",
        "schedule",
        "publish_now",
        "cancel",
        "retry",
        "withdraw",
      ]),
      note: z.string().max(1000).optional(),
      scheduledAt: z.string().optional(),
    })
    .parse(await readJson(req));
  const post = await siteRow(socialPosts, p.id, ctx.site.id, "Post");
  const rules = await getSetting(ctx.site.id, "social.rules");
  const actor = {
    id: ctx.user.id,
    isAdmin: ctx.member.role === "admin" || !!ctx.member.isPlatformAdmin,
    level: ctx.member.socialLevel,
    canApprove: ctx.member.socialApprove,
  };
  if (
    !can(
      actor,
      body.action as PostAction,
      { authorId: post.authorId, status: post.status as PostStatus },
      rules,
    )
  )
    throw new HttpError(
      403,
      "You cannot do that with this post. Executives send posts for approval; publishers or admins approve and publish.",
    );
  const [acct] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, post.accountId))
    .limit(1);
  if (
    ["approve", "schedule", "publish_now", "retry"].includes(body.action) &&
    acct?.status !== "verified"
  )
    throw new HttpError(409, "Verify the Facebook Page before publishing.");
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : post.scheduledAt;
  const status = nextStatus(body.action as PostAction, scheduledAt);
  let caption = post.caption;
  if (status === "publishing" || status === "scheduled") {
    if (rules.defaultHashtags)
      for (const tag of rules.defaultHashtags.split(/\s+/).filter(Boolean))
        if (!caption.includes(tag)) caption += ` ${tag}`;
    if (rules.utmTracking)
      caption = addUtm(
        caption,
        ctx.site.domain,
        post.platforms[0] ?? "facebook",
        rules.utmCampaign,
      );
  }
  await db
    .update(socialPosts)
    .set({
      status,
      caption,
      scheduledAt,
      returnNote: body.action === "return" ? (body.note ?? "") : post.returnNote,
      approverId: body.action === "approve" ? ctx.user.id : post.approverId,
      requestedAt: body.action === "submit" ? scheduledAt : post.requestedAt,
      history: [
        ...post.history,
        { at: new Date().toISOString(), by: ctx.actor, action: body.action, note: body.note },
      ],
    })
    .where(eq(socialPosts.id, post.id));
  if (status === "publishing")
    await enqueue("social.publish", { postId: post.id }, { siteId: ctx.site.id });
  const warnings = captionWarnings(caption, post.platforms);
  return {
    ok: true,
    message: `Post ${status.replace("_", " ")}.${warnings.length ? " Note: " + warnings.join(" ") : ""}`,
  };
});
