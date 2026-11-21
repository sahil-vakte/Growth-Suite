import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import { totp } from "../../src/lib/engines/totp";

test("required enrolment, recovery sign-in, tenant policy and old-session rejection", async ({
  browser,
  baseURL,
}) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const a = randomUUID(),
    b = randomUUID(),
    user = randomUUID(),
    editor = randomUUID();
  const email = `${user}@example.test`,
    password = `Test-${randomUUID()}!`;
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  try {
    await pool.query(
      "INSERT INTO sites (id,name,domain,require_admin_two_factor) VALUES ($1,'Secure workspace',$2,true),($3,'Optional workspace',$4,false)",
      [a, `${a}.test`, b, `${b}.test`],
    );
    const passwordHash = await hash(password, 10);
    await pool.query(
      "INSERT INTO users (id,email,name,password_hash) VALUES ($1,$2,'Two factor test',$3),($4,$5,'Editor test',$3)",
      [user, email, passwordHash, editor, `${editor}@example.test`],
    );
    for (const [u, s, role] of [
      [user, a, "admin"],
      [user, b, "admin"],
      [editor, a, "editor"],
    ])
      await pool.query("INSERT INTO memberships (id,user_id,site_id,role) VALUES ($1,$2,$3,$4)", [
        randomUUID(),
        u,
        s,
        role,
      ]);
    await ctx.addCookies([{ name: "gs_site", value: a, url: baseURL! }]);
    const signed = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(signed.ok()).toBeTruthy();
    const oldCookies = await ctx.cookies();
    expect((await page.request.get("/api/admin/users")).status()).toBe(401);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/security/);
    await page.getByLabel("Current password").fill(password);
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    const secret = await page.locator("code").innerText();
    await page
      .getByLabel("Authenticator code", { exact: true })
      .fill(totp(secret, Math.floor(Date.now() / 30_000)));
    await page.getByRole("button", { name: "Verify and enable" }).click();
    await expect(page.getByRole("heading", { name: "Save your recovery codes" })).toBeVisible();
    const codes = await page.locator("li code").allTextContents();
    expect(codes).toHaveLength(10);
    expect((await page.request.get("/api/admin/users")).ok()).toBeTruthy();
    const old = await browser.newContext({ baseURL });
    await old.addCookies(oldCookies);
    expect((await old.request.get("/api/admin/users")).status()).toBe(401);
    await old.close();
    const disabled = await page.request.post("/api/auth/two-factor", {
      data: { action: "disable", password, code: codes[0] },
    });
    expect(disabled.status()).toBe(403);
    await ctx.clearCookies();
    await page.goto("/admin/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Authenticator or recovery code").fill(codes[0]);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await ctx.addCookies([{ name: "gs_site", value: a, url: baseURL! }]);
    expect(
      (
        await page.request.post("/api/auth/two-factor", {
          data: { action: "policy", password, required: false },
        })
      ).ok(),
    ).toBeTruthy();
    const policies = await pool.query(
      "SELECT id,require_admin_two_factor FROM sites WHERE id = ANY($1)",
      [[a, b]],
    );
    expect(policies.rows.every((r) => !r.require_admin_two_factor)).toBe(true);
    await ctx.clearCookies();
    expect(
      (
        await page.request.post("/api/auth/login", { data: { email, password, code: codes[0] } })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post("/api/auth/login", { data: { email, password, code: codes[1] } })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await page.request.post("/api/auth/two-factor", {
          data: { action: "disable", password, code: codes[2] },
        })
      ).ok(),
    ).toBeTruthy();
    await ctx.clearCookies();
    expect(
      (await page.request.post("/api/auth/login", { data: { email, password } })).ok(),
    ).toBeTruthy();
    await pool.query("UPDATE sites SET require_admin_two_factor=true WHERE id=$1", [a]);
    await ctx.clearCookies();
    expect(
      (
        await page.request.post("/api/auth/login", {
          data: { email: `${editor}@example.test`, password },
        })
      ).ok(),
    ).toBeTruthy();
    expect((await page.request.get("/api/admin/r/pages")).ok()).toBeTruthy();
    expect(
      (
        await page.request.post("/api/auth/two-factor", {
          data: { action: "policy", password, required: false },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await ctx.close();
    await pool.query("DELETE FROM memberships WHERE user_id=ANY($1)", [[user, editor]]);
    await pool.query("DELETE FROM users WHERE id=ANY($1)", [[user, editor]]);
    await pool.query("DELETE FROM sites WHERE id=ANY($1)", [[a, b]]);
    await pool.end();
  }
});
