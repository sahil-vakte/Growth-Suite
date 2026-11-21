import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { decrypt, encrypt } from "../crypto";
import { newRecoveryCodes, newTotpSecret, recoveryHash, verifyTotp } from "../engines/totp";

/** Row locks make authenticator steps and recovery codes single-use, even across app instances. */
export async function consumeSecondFactor(userId: string, version: number, code: string) {
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user?.totpSecretEnc || user.status !== "active" || user.sessionVersion !== version)
      return false;
    const step = verifyTotp(decrypt(user.totpSecretEnc), code, user.totpLastStep);
    const hash = recoveryHash(code);
    if (step === null && !user.recoveryCodeHashes.includes(hash)) return false;
    await tx
      .update(users)
      .set(
        step !== null
          ? { totpLastStep: step }
          : {
              recoveryCodeHashes: user.recoveryCodeHashes.filter((h) => h !== hash),
            },
      )
      .where(eq(users.id, userId));
    return true;
  });
}

export async function beginTwoFactor(userId: string, version: number) {
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || user.totpSecretEnc || user.sessionVersion !== version) return null;
    const secret = newTotpSecret();
    await tx
      .update(users)
      .set({
        totpPendingSecretEnc: encrypt(secret),
        totpPendingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .where(eq(users.id, userId));
    return secret;
  });
}

export async function confirmTwoFactor(userId: string, version: number, code: string) {
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (
      !user ||
      user.totpSecretEnc ||
      user.sessionVersion !== version ||
      !user.totpPendingSecretEnc ||
      !user.totpPendingExpiresAt ||
      user.totpPendingExpiresAt.getTime() <= Date.now()
    )
      return null;
    const step = verifyTotp(decrypt(user.totpPendingSecretEnc), code);
    if (step === null) return null;
    const codes = newRecoveryCodes();
    const [updated] = await tx
      .update(users)
      .set({
        totpSecretEnc: user.totpPendingSecretEnc,
        totpPendingSecretEnc: null,
        totpPendingExpiresAt: null,
        totpLastStep: step,
        recoveryCodeHashes: codes.map(recoveryHash),
        sessionVersion: version + 1,
      })
      .where(eq(users.id, userId))
      .returning({ version: users.sessionVersion });
    return { codes, version: updated.version };
  });
}
