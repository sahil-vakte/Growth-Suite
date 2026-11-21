import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, SESSION_COOKIE } from "@/lib/auth/session";
import { errorResponse, json } from "@/lib/api";
import { audit } from "@/lib/history";
import { env } from "@/lib/env";

const attempts = new Map<string, { n: number; at: number }>();

export async function POST(req: Request) {
  try {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string().min(1).max(200) })
      .parse(await req.json());
    const key = `${email.toLowerCase()}|${req.headers.get("x-forwarded-for") ?? ""}`;
    const a = attempts.get(key);
    if (a && a.n >= 5 && Date.now() - a.at < 15 * 60_000)
      return json({ error: "Too many attempts. Please wait 15 minutes and try again." }, 429);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
      .limit(1);
    const ok =
      user && user.status === "active" && (await verifyPassword(password, user.passwordHash));
    if (!ok) {
      attempts.set(key, {
        n: (a && Date.now() - a.at < 15 * 60_000 ? a.n : 0) + 1,
        at: Date.now(),
      });
      return json({ error: "Email or password is not correct." }, 401);
    }
    attempts.delete(key);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const token = await signSession({ uid: user.id, ver: user.sessionVersion });
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env.appUrl.startsWith("https"),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    await audit(null, user.email, "auth.login");
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
