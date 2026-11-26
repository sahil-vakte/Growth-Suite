import { expect, it } from "vitest";
import { contentSecurityPolicy, cspOrigins } from "../src/lib/engines/csp";
it("requires nonces and blocks inline handlers/eval in production", () => {
  const policy = contentSecurityPolicy("abcdefghijklmnopqrstuvwx", false);
  const scripts = policy.split(";").find((s) => s.trim().startsWith("script-src "))!;
  expect(scripts).toContain("'nonce-abcdefghijklmnopqrstuvwx'");
  expect(scripts).not.toContain("'unsafe-inline'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).toContain("script-src-attr 'none'");
  expect(policy).toContain("object-src 'none'");
  expect(contentSecurityPolicy("abcdefghijklmnopqrstuvwx", true)).toContain("'unsafe-eval'");
});
it("rejects CSP injection and accepts only configured HTTPS origins", () => {
  expect(cspOrigins("https://analytics.example.com https://events.example.com:8443")).toEqual([
    "https://analytics.example.com",
    "https://events.example.com:8443",
  ]);
  for (const value of [
    "https://a.test; script-src *",
    "http://a.test",
    "https://user:pass@a.test",
    "https://a.test/path",
    "https://*.example.com",
  ])
    expect(() => cspOrigins(value)).toThrow();
  expect(() => contentSecurityPolicy("x';script-src *", false)).toThrow();
});
