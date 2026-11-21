/** Module licences: a signed statement { site, module, endsAt } (Ed25519). The app trusts only the public key.
 * Grace period: if the licence server cannot be reached, a previously verified licence keeps working for GRACE_DAYS. */
import { createPrivateKey, createPublicKey, sign, verify, generateKeyPairSync } from "node:crypto";

export const GRACE_DAYS = 14;
export interface LicencePayload { site: string; module: string; endsAt: string; issuedAt: string }

const b64u = (b: Buffer) => b.toString("base64url");

export function signLicence(payload: LicencePayload, privateKeyPem: string): string {
  const body = Buffer.from(JSON.stringify(payload));
  const sig = sign(null, body, createPrivateKey(privateKeyPem));
  return `${b64u(body)}.${b64u(sig)}`;
}

export function verifyLicence(statement: string, publicKeyPem: string): LicencePayload | null {
  const [b, s] = statement.split(".");
  if (!b || !s) return null;
  try {
    const body = Buffer.from(b, "base64url");
    const ok = verify(null, body, createPublicKey(publicKeyPem), Buffer.from(s, "base64url"));
    return ok ? (JSON.parse(body.toString()) as LicencePayload) : null;
  } catch { return null; }
}

export function licenceActive(p: LicencePayload | null, site: string, module: string, lastCheckedAt: Date, now = new Date()): boolean {
  if (!p || p.site !== site || p.module !== module) return false;
  if (new Date(p.endsAt) < now) return false;
  return now.getTime() - lastCheckedAt.getTime() <= GRACE_DAYS * 86_400_000;
}

export function generateLicenceKeys(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(), privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
}
