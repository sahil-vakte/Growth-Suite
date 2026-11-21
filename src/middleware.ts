import { NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "@/lib/engines/csp";

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
    process.env.CSP_CONNECT_ORIGINS,
  );
  const headers = new Headers(request.headers);
  // Replace any caller-supplied values before Next renders its own scripts.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}
export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|uploads/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
