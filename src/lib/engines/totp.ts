import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function encodeBase32(bytes: Buffer): string {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += alphabet[(value >>> bits) & 31];
    }
  }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function decodeBase32(secret: string): Buffer {
  let bits = 0,
    value = 0;
  const out: number[] = [];
  for (const char of secret) {
    const n = alphabet.indexOf(char);
    if (n < 0) throw new Error("Invalid authenticator secret");
    value = (value << 5) | n;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 255);
    }
  }
  return Buffer.from(out);
}
/** RFC 6238: SHA-1, 30-second steps; eight digits available for RFC test vectors. */
export function totp(secret: string, step: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).padStart(digits, "0");
}
export function verifyTotp(
  secret: string,
  code: string,
  lastStep = -1,
  now = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30_000);
  for (const n of [step, step - 1, step + 1]) {
    if (n >= 0 && n > lastStep && timingSafeEqual(Buffer.from(totp(secret, n)), Buffer.from(code)))
      return n;
  }
  return null;
}
export const newTotpSecret = () => encodeBase32(randomBytes(20));
export const newRecoveryCodes = () =>
  Array.from({ length: 10 }, () => randomBytes(10).toString("hex"));
export const recoveryHash = (code: string) =>
  createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
export function needsTwoFactor(
  enrolled: boolean,
  siteRequires: boolean,
  isAdmin: boolean,
  verified: boolean,
): boolean {
  return (enrolled || (siteRequires && isAdmin)) && !verified;
}
