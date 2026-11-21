import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { canAccess, type Member } from "@/lib/auth/permissions";

/** Team members who can work leads (for owner pickers). */
export const GET = adminRoute("crm", async (ctx) => {
  const rows = await db
    .select({ m: memberships, u: users })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.siteId, ctx.site.id));
  return rows
    .filter(
      ({ m, u }) =>
        u.status === "active" &&
        canAccess(
          {
            role: m.role as Member["role"],
            crmAccess: m.crmAccess as Member["crmAccess"],
            socialLevel: m.socialLevel as Member["socialLevel"],
          },
          "crm",
        ),
    )
    .map(({ u }) => ({ id: u.id, name: u.name, email: u.email }));
});
