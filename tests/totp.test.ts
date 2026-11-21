import { expect, it } from "vitest";
import {
  encodeBase32,
  needsTwoFactor,
  recoveryHash,
  totp,
  verifyTotp,
} from "../src/lib/engines/totp";
const secret = encodeBase32(Buffer.from("12345678901234567890"));
it("matches all RFC 6238 SHA-1 test vectors, including post-2038", () => {
  const vectors = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ] as const;
  for (const [time, expected] of vectors)
    expect(totp(secret, Math.floor(time / 30), 8)).toBe(expected);
});
it("accepts one adjacent step, rejects expired, malformed and replayed codes", () => {
  const now = 1_234_567_890_000,
    step = Math.floor(now / 30_000);
  expect(verifyTotp(secret, totp(secret, step), -1, now)).toBe(step);
  expect(verifyTotp(secret, totp(secret, step - 1), -1, now)).toBe(step - 1);
  expect(verifyTotp(secret, totp(secret, step + 1), -1, now)).toBe(step + 1);
  expect(verifyTotp(secret, totp(secret, step - 2), -1, now)).toBeNull();
  expect(verifyTotp(secret, totp(secret, step), step, now)).toBeNull();
  expect(verifyTotp(secret, "abcdef", -1, now)).toBeNull();
});
it("enforces enrolled users and required site administrators without affecting other roles", () => {
  expect(needsTwoFactor(true, false, false, false)).toBe(true);
  expect(needsTwoFactor(false, true, true, false)).toBe(true);
  expect(needsTwoFactor(false, true, false, false)).toBe(false);
  expect(needsTwoFactor(false, false, true, false)).toBe(false);
  expect(needsTwoFactor(true, true, true, true)).toBe(false);
  expect(recoveryHash("ABC ")).toBe(recoveryHash("abc"));
});
