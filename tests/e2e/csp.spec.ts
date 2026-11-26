import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

test("fresh CSP nonces permit GTM and JSON-LD while blocking injected inline scripts", async ({
  browser,
  baseURL,
}) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const site = randomUUID(),
    pageId = randomUUID(),
    domain = `${site}.test`;
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { "x-forwarded-host": domain, "x-nonce": "attacker-supplied" },
  });
  const page = await context.newPage();
  try {
    await pool.query("INSERT INTO sites (id,name,domain) VALUES ($1,'CSP test',$2)", [
      site,
      domain,
    ]);
    await pool.query(
      "INSERT INTO pages (id,site_id,title,slug,status,schema_json) VALUES ($1,$2,'Policy test','policy-test','published',$3)",
      [
        pageId,
        site,
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Policy test",
        }),
      ],
    );
    await pool.query(
      "INSERT INTO settings (id,site_id,key,value) VALUES ($1,$2,'integrations.gtm',$3)",
      [randomUUID(), site, JSON.stringify({ containerId: "GTM-TEST123" })],
    );
    await page.route("https://www.googletagmanager.com/gtm.js**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: "window.__gtmLoaded = true;" }),
    );
    // Insert hostile markup into the HTML response, rather than using the privileged
    // browser automation execution context (which can bypass page script checks).
    await page.route("**/policy-test", async (route) => {
      const original = await route.fetch();
      await route.fulfill({
        response: original,
        body: (await original.text()).replace(
          "</head>",
          "<script>window.__injected = true;</script></head>",
        ),
      });
    });
    const response = await page.goto("/policy-test");
    const policy = response!.headers()["content-security-policy"];
    const nonce = policy.match(/'nonce-([^']+)'/)![1];
    expect(nonce).not.toBe("attacker-supplied");
    expect(policy).not.toContain("'unsafe-eval'");
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __gtmLoaded?: boolean }).__gtmLoaded))
      .toBe(true);
    const scripts = await page.locator("script").evaluateAll((nodes) =>
      nodes.map((node) => ({
        nonce: (node as HTMLScriptElement).nonce,
        type: node.getAttribute("type"),
      })),
    );
    expect(scripts.some((s) => s.type === "application/ld+json")).toBe(true);
    expect(scripts.filter((s) => s.nonce).every((s) => s.nonce === nonce)).toBe(true);
    expect(scripts.filter((s) => !s.nonce)).toHaveLength(1);
    expect(
      await page.evaluate(() => (window as unknown as { __injected?: boolean }).__injected),
    ).toBeUndefined();
    const next = await page.reload();
    expect(next!.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);
  } finally {
    await context.close();
    await pool.query("DELETE FROM settings WHERE site_id=$1", [site]);
    await pool.query("DELETE FROM pages WHERE site_id=$1", [site]);
    await pool.query("DELETE FROM sites WHERE id=$1", [site]);
    await pool.end();
  }
});
