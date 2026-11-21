import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

function key(): Buffer {
  if (env.encryptionKey) {
    const k = Buffer.from(env.encryptionKey, "base64");
    if (k.length === 32) return k;
  }
  if (env.nodeEnv === "production") throw new Error("ENCRYPTION_KEY must be a 32-byte base64 value in production");
  return createHash("sha256").update(env.sessionSecret).digest();
}

/** AES-256-GCM for third-party tokens stored in the database. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(blob: string): string {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== "v1") throw new Error("Unknown ciphertext version");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

export const hmacHex = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const randomToken = (bytes = 24) => randomBytes(bytes).toString("base64url");
export const hashIp = (ip: string) => createHash("sha256").update(`${env.sessionSecret}:${ip}`).digest("hex").slice(0, 32);
