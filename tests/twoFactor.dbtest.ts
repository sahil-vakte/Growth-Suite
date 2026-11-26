import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/db";
import { users } from "../src/db/schema";
import {
  beginTwoFactor,
  confirmTwoFactor,
  consumeSecondFactor,
} from "../src/lib/services/twoFactor";
import { totp } from "../src/lib/engines/totp";
afterAll(() => pool.end());
it("enrols with proof, revokes old sessions and consumes codes once across concurrent requests", async () => {
  const a = randomUUID(),
    b = randomUUID();
  try {
    await db.insert(users).values(
      [a, b].map((id) => ({
        id,
        name: "MFA test",
        email: `${id}@example.test`,
        passwordHash: "unused",
      })),
    );
    const secret = await beginTwoFactor(a, 1);
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(await confirmTwoFactor(b, 1, "123456")).toBeNull();
    expect(await confirmTwoFactor(a, 1, "invalid")).toBeNull();
    const code = totp(secret!, Math.floor(Date.now() / 30_000));
    const result = await confirmTwoFactor(a, 1, code);
    expect(result?.version).toBe(2);
    expect(result?.codes).toHaveLength(10);
    expect(await consumeSecondFactor(a, 2, code)).toBe(false);
    expect(await consumeSecondFactor(a, 1, result!.codes[0])).toBe(false);
    expect(await consumeSecondFactor(b, 1, result!.codes[0])).toBe(false);
    const attempts = await Promise.all([
      consumeSecondFactor(a, 2, result!.codes[0]),
      consumeSecondFactor(a, 2, result!.codes[0]),
    ]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
    const [stored] = await db.select().from(users).where(eq(users.id, a));
    expect(stored.totpSecretEnc).not.toContain(secret);
    expect(stored.recoveryCodeHashes).not.toContain(result!.codes[1]);
    expect(stored.recoveryCodeHashes).toHaveLength(9);
  } finally {
    await db.delete(users).where(inArray(users.id, [a, b]));
  }
});
