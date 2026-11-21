import { eq } from "drizzle-orm";
import { db } from "@/db";
import { socialAccounts } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { siteRow } from "@/lib/admin/rows";
import { env } from "@/lib/env";
import { callJson } from "@/lib/integrations/http";

/** Ownership check: the page's About text must contain the verification code (or a platform admin approves). */
export const POST = adminRoute<{ id: string }>("social", async (ctx, _req, p) => {
  const a = await siteRow(socialAccounts, p.id, ctx.site.id, "Account");
  let verified = ctx.member.isPlatformAdmin;
  if (!verified && env.meta.systemUserToken && !env.forceMock) {
    const page = await callJson<{
      about?: string;
      name?: string;
      instagram_business_account?: { id: string };
    }>(
      `https://graph.facebook.com/${env.whatsapp.graphVersion}/${a.pageId}?fields=about,name,instagram_business_account&access_token=${encodeURIComponent(env.meta.systemUserToken)}`,
    );
    verified = !!a.verifyCode && (page.about ?? "").includes(a.verifyCode);
    if (verified)
      await db
        .update(socialAccounts)
        .set({
          pageName: page.name ?? a.pageName,
          instagramId: page.instagram_business_account?.id ?? a.instagramId,
        })
        .where(eq(socialAccounts.id, a.id));
  } else if (!verified) verified = true; // mock mode
  if (!verified)
    return {
      ok: false,
      message: `Code not found yet. Add "${a.verifyCode}" to the Page's About text, wait a minute, then try again.`,
    };
  await db.update(socialAccounts).set({ status: "verified" }).where(eq(socialAccounts.id, a.id));
  return { ok: true, message: "Page verified. You can now post to it." };
});
