import { randomBytes } from "node:crypto";

/** Sortable, URL-safe unique id: 10 chars of time + 12 chars of randomness. */
export function newId(): string {
  const time = Date.now().toString(36).padStart(10, "0");
  const rand = randomBytes(9).toString("base64url");
  return `${time}${rand}`;
}

/** Short human-friendly code (no ambiguous characters). */
export function shortCode(len = 6): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
