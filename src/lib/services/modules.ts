/** Paid add-on modules. In multi-tenant mode the platform issues licences directly; in self-host mode the
 * signed statement is verified with LICENCE_PUBLIC_KEY (Ed25519) and honoured for 14 days offline. */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { moduleLicenses } from "@/db/schema";
import { HttpError } from "../auth/current";
import { env } from "../env";
import { licenceActive, signLicence, verifyLicence } from "../engines/licence";

export const MODULES = [
  { key: "affiliates", name: "Affiliates & partner portal" },
  { key: "social_posting", name: "Social posting" },
  { key: "video", name: "Video sessions" },
] as const;

export async function moduleActive(siteId: string, moduleKey: string): Promise<boolean> {
  if (!env.licencePublicKey) return true; // licensing disabled (single-owner deployments)
  const [l] = await db
    .select()
    .from(moduleLicenses)
    .where(and(eq(moduleLicenses.siteId, siteId), eq(moduleLicenses.moduleKey, moduleKey)))
    .limit(1);
  return (
    !!l &&
    licenceActive(verifyLicence(l.statement, env.licencePublicKey), siteId, moduleKey, l.checkedAt)
  );
}

export async function requireModule(siteId: string, moduleKey: string) {
  if (!(await moduleActive(siteId, moduleKey)))
    throw new HttpError(
      402,
      "This module is not unlocked for this website. Ask your provider to unlock it.",
    );
}

/** Platform side: issue (sign) a licence. Requires LICENCE_PRIVATE_KEY. */
export async function issueLicence(siteId: string, moduleKey: string, endsAt: Date) {
  if (!env.licencePrivateKey)
    throw new HttpError(400, "LICENCE_PRIVATE_KEY is not configured on this server.");
  const statement = signLicence(
    {
      site: siteId,
      module: moduleKey,
      endsAt: endsAt.toISOString(),
      issuedAt: new Date().toISOString(),
    },
    env.licencePrivateKey,
  );
  await db
    .insert(moduleLicenses)
    .values({ siteId, moduleKey, endsAt, statement })
    .onConflictDoUpdate({
      target: [moduleLicenses.siteId, moduleLicenses.moduleKey],
      set: { endsAt, statement, checkedAt: new Date() },
    });
}
