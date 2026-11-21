import { withApiLog } from "@/lib/apiLogging";
import { db } from "@/db";
import { leadStages, memberships, sites } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { clearSiteCache } from "@/lib/tenant";
import { audit } from "@/lib/history";

import { siteSchema } from "@/lib/admin/schemas";

export const GET = withApiLog(
  "/api/admin/platform/sites",
  "GET",
  adminRoute(undefined, async (ctx) => {
    if (!ctx.member.isPlatformAdmin) throw new HttpError(403, "Platform admins only.");
    return db.select().from(sites);
  }),
);

/** Creates a client site with default pipeline stages and makes the creator its admin. */
export const POST = withApiLog(
  "/api/admin/platform/sites",
  "POST",
  adminRoute(undefined, async (ctx, req) => {
    if (!ctx.member.isPlatformAdmin) throw new HttpError(403, "Platform admins only.");
    const b = siteSchema.parse(await readJson(req));
    try {
      Intl.DateTimeFormat("en-GB", { timeZone: b.timezone });
    } catch {
      throw new HttpError(422, "Unknown time zone (use e.g. Europe/London or Asia/Kolkata).");
    }
    const [site] = await db
      .insert(sites)
      .values({
        ...b,
        domain: b.domain.toLowerCase().replace(/^www\./, ""),
        aliases: b.aliases.map((a) => a.toLowerCase()),
      })
      .returning();
    await db.insert(memberships).values({
      siteId: site.id,
      userId: ctx.user.id,
      role: "admin",
      mcpAccess: true,
      socialLevel: "publisher",
      socialApprove: true,
    });
    await db.insert(leadStages).values(
      ["New", "Contacted", "Qualified", "Interested", "Won", "Lost"].map((name, i) => ({
        siteId: site.id,
        name,
        position: i,
        isWon: name === "Won",
        isLost: name === "Lost",
      })),
    );
    clearSiteCache();
    await audit(site.id, ctx.actor, "sites.create", "sites", site.id);
    return site;
  }),
);
