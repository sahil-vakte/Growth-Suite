import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";

export const SESSION_COOKIE = "gs_session";
export const SITE_COOKIE = "gs_site";
const secret = () => new TextEncoder().encode(env.sessionSecret);

export interface SessionClaims { uid: string; ver: number }

export async function signSession(c: SessionClaims, maxAgeSec = 60 * 60 * 24 * 7): Promise<string> {
  return new SignJWT({ ver: c.ver }).setProtectedHeader({ alg: "HS256" }).setSubject(c.uid)
    .setIssuedAt().setExpirationTime(`${maxAgeSec}s`).sign(secret());
}

export async function readSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.sub ? { uid: payload.sub, ver: Number(payload.ver ?? 0) } : null;
  } catch { return null; }
}
