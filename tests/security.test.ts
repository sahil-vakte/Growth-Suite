import { describe, it, expect, beforeAll } from "vitest";
import { sanitizeHtml } from "@/lib/site/sanitize";
import { parseCsv } from "@/lib/admin/csv";
import { isPrivateIp, assertPublicUrl } from "@/lib/net";
import { validateSubmission, type FormField } from "@/lib/services/forms";
import { canAccess } from "@/lib/auth/permissions";

beforeAll(() => {
  process.env.SESSION_SECRET = "unit-test-secret-0123456789abcdef";
});

describe("HTML sanitiser", () => {
  it("removes scripts, event handlers and javascript: links", () => {
    const out = sanitizeHtml(
      `<p onclick="x()">Hi <a href="javascript:alert(1)">x</a><script>alert(1)</script><img src="/a.png" onerror="bad()"><a href="https://ok.com" target="_blank">ok</a></p>`,
    );
    expect(out).not.toMatch(/script|onclick|onerror|javascript/i);
    expect(out).toContain('<img src="/a.png">');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});

describe("CSV parser", () => {
  it("handles quotes, commas, CRLF and BOM", () => {
    expect(parseCsv('﻿name,phone\r\n"Smith, Jo","+44 7700 900123"\r\n"Say ""hi""",123\n')).toEqual([
      ["name", "phone"],
      ["Smith, Jo", "+44 7700 900123"],
      ['Say "hi"', "123"],
    ]);
  });
});

describe("SSRF protection", () => {
  it("blocks private and loopback addresses", async () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.1.1",
      "172.16.0.1",
      "169.254.169.254",
      "::1",
    ])
      expect(isPrivateIp(ip)).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    await expect(assertPublicUrl("http://127.0.0.1/admin")).rejects.toThrow();
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("http://user:pass@8.8.8.8/")).rejects.toThrow();
  });
});

describe("Crypto", () => {
  it("encrypts and decrypts tokens; tampering is detected", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const c = encrypt("EAAB-secret");
    expect(c).not.toContain("EAAB");
    expect(decrypt(c)).toBe("EAAB-secret");
    const parts = c.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
});

describe("Form validation", () => {
  const fields: FormField[] = [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "phone", label: "Phone", type: "tel", required: true },
    { key: "plan", label: "Plan", type: "select", options: ["A", "B"] },
    {
      key: "extra",
      label: "Extra",
      type: "text",
      required: true,
      showIf: { field: "plan", equals: "B" },
    },
    { key: "total", label: "Total", type: "calculated", formula: "{qty} * 10" },
    { key: "qty", label: "Qty", type: "number" },
    { key: "consent", label: "Consent", type: "consent", required: true },
  ];
  it("normalises, validates options and conditional fields, calculates formulas", () => {
    const ok = validateSubmission(
      fields,
      { name: " Jo ", phone: "07700900123", plan: "A", qty: "3", consent: true },
      "44",
    );
    expect(ok.errors).toEqual({});
    expect(ok.values).toMatchObject({ name: "Jo", phone: "+447700900123", total: 30 });
    const bad = validateSubmission(
      fields,
      { name: "Jo", phone: "07700900123", plan: "B", consent: false },
      "44",
    );
    expect(Object.keys(bad.errors).sort()).toEqual(["consent", "extra"]);
    expect(
      validateSubmission(fields, { name: "x", phone: "1", plan: "Z", consent: true }, "44").errors,
    ).toHaveProperty("plan");
  });
});

describe("Role permissions", () => {
  it("separates admin, editor and sales", () => {
    expect(
      canAccess({ role: "editor", crmAccess: "inherit", socialLevel: "executive" }, "users"),
    ).toBe(false);
    expect(
      canAccess({ role: "editor", crmAccess: "inherit", socialLevel: "executive" }, "content"),
    ).toBe(true);
    expect(canAccess({ role: "editor", crmAccess: "allow", socialLevel: "executive" }, "crm")).toBe(
      true,
    );
    expect(canAccess({ role: "sales", crmAccess: "inherit", socialLevel: "none" }, "crm")).toBe(
      true,
    );
    expect(canAccess({ role: "sales", crmAccess: "inherit", socialLevel: "none" }, "content")).toBe(
      false,
    );
    expect(canAccess({ role: "admin", crmAccess: "deny", socialLevel: "publisher" }, "crm")).toBe(
      false,
    );
  });
});
