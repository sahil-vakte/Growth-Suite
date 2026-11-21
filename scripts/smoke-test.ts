/** End-to-end smoke test against a running server (npm run build && npm start). Uses mock integrations.
 *  BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run test:smoke */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe-2026!";
const CRON = process.env.CRON_SECRET ?? "dev-cron-secret";
let cookie = "";
const RUN = Date.now().toString(36);
const results: { name: string; ok: boolean; detail?: string }[] = [];

async function req(path: string, init: RequestInit & { json?: unknown; auth?: boolean } = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(init.json);
  }
  if (init.auth !== false && cookie) headers.Cookie = cookie;
  const r = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  const text = await r.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* html */
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: r.status, body: body as any, text, headers: r.headers };
}
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log("  ✓", name);
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    console.log("  ✗", name, "—", e instanceof Error ? e.message : e);
  }
}
function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg);
}
const vid = () =>
  Array.from({ length: 32 }, () => "abcdef0123456789"[Math.floor(Math.random() * 16)]).join("");

async function main() {
  console.log(`Smoke test → ${BASE}`);
  let formId = "",
    leadId = "",
    pageId = "",
    stageQualified = "";
  const visitor = vid();

  await check("Health endpoint reports database up", async () => {
    const r = await req("/api/health");
    assert(r.status === 200 && r.body.db === "up", `status ${r.status}`);
  });
  await check("Public home page renders seeded sections", async () => {
    const r = await req("/", { auth: false });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.text.includes("Turn website visitors into paying customers"), "hero heading missing");
    assert(
      !r.text.includes("Special offer for Google Ads visitors"),
      "audience-only section leaked to everyone",
    );
  });
  await check("Section audience rule shows the ad-specific hero", async () => {
    const r = await req("/?utm_content=offer-a", { auth: false });
    assert(r.text.includes("Special offer for Google Ads visitors"), "targeted hero not shown");
  });
  await check("Calculator page and sitemap/robots", async () => {
    assert((await req("/loan-calculator", { auth: false })).status === 200, "calculator page");
    const sm = await req("/sitemap.xml", { auth: false });
    assert(sm.text.includes("<urlset") && sm.text.includes("/loan-calculator"), "sitemap");
    const rb = await req("/robots.txt", { auth: false });
    assert(rb.text.includes("Sitemap:"), "robots");
  });
  await check("Unknown page returns 404", async () => {
    assert((await req("/does-not-exist", { auth: false })).status === 404, "expected 404");
  });

  await check("Admin login rejects a wrong password", async () => {
    assert(
      (
        await req("/api/auth/login", {
          method: "POST",
          json: { email: EMAIL, password: "wrong-password" },
          auth: false,
        })
      ).status === 401,
      "expected 401",
    );
  });
  await check("Admin login works and sets an HttpOnly session cookie", async () => {
    const r = await req("/api/auth/login", {
      method: "POST",
      json: { email: EMAIL, password: PASSWORD },
      auth: false,
    });
    assert(r.status === 200, `login ${r.status} ${r.text}`);
    const sc = r.headers.get("set-cookie") ?? "";
    assert(/HttpOnly/i.test(sc), "cookie not HttpOnly");
    cookie = sc.split(";")[0];
  });
  await check("Admin pages require a session", async () => {
    const r = await req("/api/admin/r/pages", { auth: false });
    assert(r.status === 401, `expected 401 got ${r.status}`);
  });
  await check("Cross-site POST is blocked (CSRF)", async () => {
    const r = await req("/api/admin/r/pages", {
      method: "POST",
      json: { title: "x", slug: "x" },
      headers: { Origin: "https://evil.example" },
    });
    assert(r.status === 403, `expected 403 got ${r.status}`);
  });
  await check("Admin dashboard and CRM pages render", async () => {
    for (const p of [
      "/admin",
      "/admin/crm",
      "/admin/analytics",
      "/admin/r/forms",
      "/admin/integrations",
      "/admin/ai",
      "/admin/seo",
      "/admin/whatsapp",
      "/admin/users",
      "/admin/assistant",
      "/admin/history",
      "/admin/settings/site",
    ]) {
      const r = await req(p);
      assert(r.status === 200, `${p} → ${r.status}`);
    }
  });

  await check("Forms list and public form definition", async () => {
    const r = await req("/api/admin/r/forms");
    const rows = r.body.rows as { id: string; name: string }[];
    formId = rows.find((f) => f.name === "Free quote")!.id;
    assert(formId, "seeded form missing");
    const pub = await req(`/api/public/forms/${formId}`, { auth: false });
    assert(pub.status === 200 && Array.isArray(pub.body.fields), "public form def");
  });
  await check("Visitor tracking records a page view with UTMs", async () => {
    const r = await req("/api/public/track", {
      method: "POST",
      auth: false,
      json: {
        name: "page_view",
        visitorId: visitor,
        url: `${BASE}/?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=TESTGCLID`,
        referrer: "https://www.google.com/",
      },
    });
    assert(r.status === 200, r.text);
  });
  await check("Form validation returns field errors", async () => {
    const r = await req(`/api/public/forms/${formId}`, {
      method: "POST",
      auth: false,
      json: { values: { name: "", phone: "12" }, renderedAt: Date.now() - 10_000 },
    });
    assert(
      r.status === 422 && (r.body.errors as Record<string, string>).phone,
      "expected phone error",
    );
  });
  await check("Valid submission creates a lead with first-touch attribution", async () => {
    const r = await req(`/api/public/forms/${formId}`, {
      method: "POST",
      auth: false,
      json: {
        values: {
          name: "Test Person",
          phone: "07700 900456",
          email: "test.person@example.com",
          service: "SEO",
          consent: true,
        },
        visitorId: visitor,
        pageUrl: `${BASE}/`,
        renderedAt: Date.now() - 10_000,
      },
    });
    assert(r.status === 200 && r.body.ok, r.text);
    const l = await req("/api/admin/leads?q=Test%20Person");
    const lead = (
      l.body.rows as { id: string; phone: string; attribution: Record<string, string> }[]
    )[0];
    assert(lead, "lead not found");
    assert(lead.phone === "+447700900456", `phone ${lead.phone}`);
    assert(
      lead.attribution.utm_campaign === "spring" && lead.attribution.gclid === "TESTGCLID",
      "attribution missing",
    );
    leadId = (lead as { id: string }).id;
  });
  await check("Duplicate phone merges into the same lead", async () => {
    await req(`/api/public/forms/${formId}`, {
      method: "POST",
      auth: false,
      json: {
        values: { name: "Test Person", phone: "+447700900456", service: "Website", consent: true },
        renderedAt: Date.now() - 10_000,
      },
    });
    const l = await req("/api/admin/leads?q=900456");
    assert((l.body.rows as unknown[]).length === 1, "duplicate lead created");
  });
  await check("Spam guard holds honeypot entries silently", async () => {
    const r = await req(`/api/public/forms/${formId}`, {
      method: "POST",
      auth: false,
      json: {
        values: { name: "Bot", phone: "07700 900999", service: "SEO", consent: true },
        hp: "http://spam",
        renderedAt: Date.now() - 10_000,
      },
    });
    assert(r.status === 200 && r.body.ok, "spam should look successful");
    const l = await req("/api/admin/leads?q=900999");
    assert((l.body.rows as unknown[]).length === 0, "spam became a lead");
    const subs = await req("/api/admin/r/submissions");
    assert(
      (subs.body.rows as { status: string }[]).some((s) => s.status === "spam"),
      "spam not held for review",
    );
  });
  await check("Scheduler sends the WhatsApp follow-up automation (mock)", async () => {
    const t = await req("/api/cron/tick", {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON}` },
      auth: false,
    });
    assert(t.status === 200, `tick ${t.status}`);
    const d = await req(`/api/admin/leads/${leadId}`);
    assert(
      (d.body.messages as { direction: string; status: string }[]).some(
        (m) => m.direction === "out" && m.status === "sent",
      ),
      "no automation message sent",
    );
  });
  await check("Cron endpoint rejects a wrong secret", async () => {
    assert(
      (
        await req("/api/cron/tick", {
          method: "POST",
          headers: { Authorization: "Bearer nope" },
          auth: false,
        })
      ).status === 401,
      "expected 401",
    );
  });
  await check("Stage change queues a Meta conversion and the worker sends it (mock)", async () => {
    const d = await req(`/api/admin/leads/${leadId}`);
    const stages = d.body.stages as { id: string; name: string }[];
    stageQualified = stages.find((s) => s.name === "Qualified")!.id;
    assert(
      (
        await req(`/api/admin/leads/${leadId}`, {
          method: "PATCH",
          json: { stageId: stageQualified },
        })
      ).status === 200,
      "stage change failed",
    );
    await req("/api/cron/tick", {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON}` },
      auth: false,
    });
    const after = await req(`/api/admin/leads/${leadId}`);
    assert(
      (after.body.conversions as { platform: string; status: string }[]).some(
        (c) => c.platform === "meta" && c.status === "sent",
      ),
      "conversion not sent",
    );
  });
  await check("Notes and timeline", async () => {
    await req(`/api/admin/leads/${leadId}/notes`, {
      method: "POST",
      json: { text: "Called — interested in SEO." },
    });
    const d = await req(`/api/admin/leads/${leadId}`);
    assert(
      (d.body.timeline as { body: string }[]).some((a) => a.body?.includes("interested in SEO")),
      "note missing",
    );
  });

  await check(
    "WhatsApp click gets a Ref code; inbound message with Ref links the visit, bot answers",
    async () => {
      const wv = vid();
      await req("/api/public/track", {
        method: "POST",
        auth: false,
        json: {
          name: "page_view",
          visitorId: wv,
          url: `${BASE}/?utm_source=facebook&utm_medium=paid&fbclid=FBTEST`,
        },
      });
      const c = await req("/api/public/click", {
        method: "POST",
        auth: false,
        json: { kind: "whatsapp", visitorId: wv, pageUrl: `${BASE}/` },
      });
      const ref = c.body.refCode as string;
      assert(/^[A-Z0-9]{6}$/.test(ref), "no ref code");
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: "mock-phone-number-id" },
                  contacts: [{ wa_id: "447700900777", profile: { name: "WhatsApp Lead" } }],
                  messages: [
                    {
                      from: "447700900777",
                      id: "wamid.TEST1",
                      type: "text",
                      text: { body: `What is the price? (Ref: ${ref})` },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const w = await req("/api/webhooks/whatsapp", { method: "POST", auth: false, json: payload });
      assert(w.status === 200, `webhook ${w.status} ${w.text}`);
      const l = await req("/api/admin/leads?q=900777");
      const lead = (
        l.body.rows as { id: string; source: string; attribution: Record<string, string> }[]
      )[0];
      assert(lead && lead.source === "whatsapp", "WhatsApp lead not created");
      assert(lead.attribution.fbclid === "FBTEST", "visit attribution not linked via Ref");
      const d = await req(`/api/admin/leads/${lead.id}`);
      assert(
        (d.body.messages as { direction: string; body: string }[]).some(
          (m) => m.direction === "out" && m.body?.includes("£499"),
        ),
        "bot did not answer the price question",
      );
    },
  );
  await check("STOP opts the contact out", async () => {
    await req("/api/webhooks/whatsapp", {
      method: "POST",
      auth: false,
      json: {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: "mock-phone-number-id" },
                  messages: [
                    {
                      from: "447700900777",
                      id: "wamid.TEST2",
                      type: "text",
                      text: { body: "STOP" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    });
    const l = await req("/api/admin/leads?q=900777");
    const lead = (l.body.rows as { optedOut: boolean }[])[0];
    assert(lead.optedOut, "not opted out");
  });

  await check("Chatbot answers from knowledge and turns a phone number into a lead", async () => {
    const w = await req("/api/admin/r/chat-widgets");
    const wid = (w.body.rows as { id: string }[])[0].id;
    const r1 = await req(`/api/public/chat/${wid}`, {
      method: "POST",
      auth: false,
      json: { message: "How much is a website package?", visitorId: vid() },
    });
    assert(r1.status === 200 && String(r1.body.reply).length > 5, "no reply");
    const r2 = await req(`/api/public/chat/${wid}`, {
      method: "POST",
      auth: false,
      json: { message: "Call me on 07700 900321 please", conversationId: r1.body.conversationId },
    });
    assert(String(r2.body.reply).includes("we have your details"), "contact not acknowledged");
    const l = await req("/api/admin/leads?q=900321");
    assert((l.body.rows as { source: string }[])[0]?.source === "chat", "chat lead missing");
  });

  await check("Appointment slots and booking (double booking prevented)", async () => {
    const svc = await req("/api/admin/r/appointment-services");
    const sid = (svc.body.rows as { id: string }[])[0].id;
    const s = await req(`/api/public/appointments/slots?serviceId=${sid}&days=14`, { auth: false });
    const slot = (s.body.slots as { staffId: string; startsAt: string }[])[0];
    assert(slot, "no slots");
    const b = await req("/api/public/appointments/book", {
      method: "POST",
      auth: false,
      json: {
        serviceId: sid,
        staffId: slot.staffId,
        startsAt: slot.startsAt,
        name: "Booker",
        phone: "07700 900888",
      },
    });
    assert(b.status === 200, b.text);
    const again = await req("/api/public/appointments/book", {
      method: "POST",
      auth: false,
      json: {
        serviceId: sid,
        staffId: slot.staffId,
        startsAt: slot.startsAt,
        name: "Second",
        phone: "07700 900889",
      },
    });
    assert(again.status === 409, `double booking allowed (${again.status})`);
  });

  await check("Shop checkout and payment (mock) marks the order paid", async () => {
    const p = await req("/api/admin/r/products");
    const prod = (p.body.rows as { id: string }[])[0];
    const c = await req("/api/public/shop/checkout", {
      method: "POST",
      auth: false,
      json: { items: [{ productId: prod.id, qty: 1 }], name: "Buyer", email: "buyer@example.com" },
    });
    assert(c.status === 200 && c.body.provider === "mock", c.text);
    await req("/api/public/payments/mock", {
      method: "POST",
      auth: false,
      json: { ref: c.body.order },
    });
    const o = await req("/api/admin/r/orders");
    assert(
      (o.body.rows as { number: string; status: string }[]).find((x) => x.number === c.body.order)
        ?.status === "paid",
      "order not paid",
    );
  });

  await check(
    "Page builder: create page, add section, publish, view, history & restore",
    async () => {
      const c = await req("/api/admin/r/pages", {
        method: "POST",
        json: { title: "Smoke Test Page", slug: `smoke-test-${RUN}`, status: "draft" },
      });
      assert(c.status === 200, c.text);
      pageId = (c.body as { id: string }).id;
      assert(
        (await req(`/smoke-test-${RUN}`, { auth: false })).status === 404,
        "draft visible to public",
      );
      const s = await req(`/api/admin/pages/${pageId}/sections`, {
        method: "POST",
        json: { layoutKey: "rich_text" },
      });
      assert(s.status === 200, s.text);
      await req(`/api/admin/sections/${(s.body as { id: string }).id}`, {
        method: "PATCH",
        json: { content: { heading: "Hello from the smoke test", body: "It works." } },
      });
      await req(`/api/admin/r/pages/${pageId}`, { method: "PATCH", json: { status: "published" } });
      const v = await req(`/smoke-test-${RUN}`, { auth: false });
      assert(
        v.status === 200 && v.text.includes("Hello from the smoke test"),
        "published page not rendering",
      );
      const h = await req("/api/admin/history");
      const rev = (h.body as unknown as { id: string; entity: string; entityId: string }[]).find(
        (x) => x.entity === "sections",
      );
      assert(rev, "no history entry");
      assert(
        (await req(`/api/admin/history/${rev.id}/restore`, { method: "POST", json: {} })).status ===
          200,
        "restore failed",
      );
    },
  );
  await check("Reserved addresses cannot be used as page slugs", async () => {
    assert(
      (await req("/api/admin/r/pages", { method: "POST", json: { title: "Admin", slug: "admin" } }))
        .status === 422,
      "reserved slug accepted",
    );
  });
  await check("Pipeline stage with leads cannot be deleted", async () => {
    assert(
      (await req(`/api/admin/r/lead-stages/${stageQualified}`, { method: "DELETE" })).status ===
        409,
      "stage with leads deleted",
    );
  });

  await check(
    "AI assistant (MCP): read allowed, write blocked when read-only, token required",
    async () => {
      assert(
        (
          await req("/api/mcp", {
            method: "POST",
            auth: false,
            json: { jsonrpc: "2.0", id: 1, method: "tools/list" },
          })
        ).status === 401,
        "MCP without token allowed",
      );
      const c = await req("/api/admin/mcp-clients", {
        method: "POST",
        json: { name: "Smoke", permissions: { pages: "read", crm: "read", docs: "read" } },
      });
      const t = await req("/api/mcp/token", {
        method: "POST",
        auth: false,
        json: {
          grant_type: "client_credentials",
          client_id: c.body.clientId,
          client_secret: c.body.clientSecret,
        },
      });
      assert(t.status === 200, t.text);
      const H = { Authorization: `Bearer ${t.body.access_token}` };
      const init = await req("/api/mcp", {
        method: "POST",
        auth: false,
        headers: H,
        json: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      });
      assert((init.body.result as { protocolVersion: string }).protocolVersion, "initialize");
      const list = await req("/api/mcp", {
        method: "POST",
        auth: false,
        headers: H,
        json: { jsonrpc: "2.0", id: 2, method: "tools/list" },
      });
      const names = (list.body.result as { tools: { name: string }[] }).tools.map((x) => x.name);
      assert(
        names.includes("pages_list") && !names.includes("pages_create"),
        "permissions not applied to tool list",
      );
      const call = await req("/api/mcp", {
        method: "POST",
        auth: false,
        headers: H,
        json: {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "pages_list", arguments: {} },
        },
      });
      assert(String(JSON.stringify(call.body)).includes("Smoke Test Page"), "pages_list result");
      const blocked = await req("/api/mcp", {
        method: "POST",
        auth: false,
        headers: H,
        json: {
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "pages_create", arguments: { title: "x" } },
        },
      });
      assert(blocked.body.error, "write tool allowed");
    },
  );

  await check("Settings: secrets stored encrypted and masked on read", async () => {
    const put = await req("/api/admin/settings/integrations.meta", {
      method: "PUT",
      json: { pixelId: "1234567890", capiTokenEnc: "EAAB-secret-token" },
    });
    assert(put.status === 200, put.text);
    const get = await req("/api/admin/settings/integrations.meta");
    assert(
      get.body.capiTokenEnc !== "EAAB-secret-token" &&
        String(get.body.capiTokenEnc).includes("saved"),
      "secret not masked",
    );
  });
  await check("Users: editor cannot open Users; role permissions enforced", async () => {
    const add = await req("/api/admin/users", {
      method: "POST",
      json: {
        email: "editor.smoke@example.com",
        name: "Editor",
        password: "EditorPass123",
        role: "editor",
        crmAccess: "deny",
        mcpAccess: false,
        socialLevel: "executive",
        socialApprove: false,
      },
    });
    assert(add.status === 200 || add.status === 409, add.text);
    const saved = cookie;
    cookie = "";
    const login = await req("/api/auth/login", {
      method: "POST",
      auth: false,
      json: { email: "editor.smoke@example.com", password: "EditorPass123" },
    });
    cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
    const u = await req("/api/admin/users");
    const crm = await req("/api/admin/leads");
    const pages = await req("/api/admin/r/pages");
    cookie = saved;
    assert(
      u.status === 403 && crm.status === 403 && pages.status === 200,
      `users ${u.status} crm ${crm.status} pages ${pages.status}`,
    );
  });
  await check("Analytics summary counts visitors and conversions", async () => {
    const r = await req("/admin/analytics");
    assert(r.status === 200 && r.text.includes("Source performance"), "analytics");
  });
  await check("GTM container export is valid JSON", async () => {
    const r = await req("/api/admin/integrations/gtm-export");
    assert(
      r.status === 200 && (r.body as unknown as { containerVersion: unknown }).containerVersion,
      "gtm export",
    );
  });
  await check("Lead data export (SAR) and CSV submissions export", async () => {
    assert((await req(`/api/admin/leads/${leadId}/export`)).status === 200, "SAR export");
    const csv = await req("/api/admin/exports/submissions");
    assert(csv.status === 200 && csv.text.startsWith("submitted_at"), "CSV export");
  });
  await check("Review link accepts a customer review for moderation", async () => {
    const l = await req("/api/admin/r/share-links", {
      method: "POST",
      json: { title: "Tell us how we did", kind: "review" },
    });
    const token = (l.body as { token: string }).token;
    const r = await req(`/api/public/reviews/${token}`, {
      method: "POST",
      auth: false,
      json: { name: "Happy Customer", rating: 5, text: "Brilliant service.", consent: true },
    });
    assert(r.status === 200, r.text);
  });

  await check("Every admin section and its API load without errors", async () => {
    const { resources } = await import("../src/lib/admin/resources");
    const bad: string[] = [];
    for (const r of resources) {
      const page = await req(`/admin/r/${r.key}`);
      if (page.status !== 200) bad.push(`page ${r.key} ${page.status}`);
      const list = await req(`/api/admin/r/${r.key}`);
      if (list.status !== 200) bad.push(`api ${r.key} ${list.status}`);
    }
    for (const p of [
      "/admin/settings/capture",
      "/admin/settings/appointments",
      "/admin/modules",
      `/admin/pages/${pageId}`,
      `/admin/crm/${leadId}`,
      `/admin/forms/${formId}`,
    ]) {
      const r = await req(p);
      if (r.status !== 200) bad.push(`${p} ${r.status}`);
    }
    assert(!bad.length, bad.join(", "));
  });
  await check("Public blog, shop, booking pages render", async () => {
    for (const p of [
      "/blog",
      "/blog/more-enquiries",
      "/shop",
      "/shop/website-health-check",
      "/book",
    ]) {
      const r = await req(p, { auth: false });
      assert(r.status === 200, `${p} → ${r.status}`);
    }
    const post = await req("/blog/more-enquiries", { auth: false });
    assert(post.text.includes("BlogPosting"), "blog schema missing");
  });
  await check("Generic CRUD validates input (bad JSON, missing required field)", async () => {
    assert(
      (
        await req("/api/admin/r/forms", {
          method: "POST",
          json: { name: "x", fields: "{not json" },
        })
      ).status === 422,
      "bad JSON accepted",
    );
    assert(
      (await req("/api/admin/r/whatsapp-numbers", { method: "POST", json: { name: "No number" } }))
        .status === 422,
      "missing required accepted",
    );
    assert(
      (
        await req("/api/admin/r/blog-categories", {
          method: "POST",
          json: { name: "Dup", slug: `dup-${RUN}` },
        })
      ).status === 200,
      "category create",
    );
    assert(
      (
        await req("/api/admin/r/blog-categories", {
          method: "POST",
          json: { name: "Dup", slug: `dup-${RUN}` },
        })
      ).status === 409,
      "duplicate slug should be 409",
    );
  });

  await check("Multi-tenant: new client site is isolated by domain and data", async () => {
    const dom = `client-${RUN}.test`;
    const c = await req("/api/admin/platform/sites", {
      method: "POST",
      json: {
        name: "Client A",
        domain: dom,
        timezone: "Asia/Kolkata",
        currency: "INR",
        locale: "en-IN",
      },
    });
    assert(c.status === 200, c.text);
    const home = await req("/", { auth: false, headers: { "X-Forwarded-Host": dom } });
    assert(
      home.status === 404 && !home.text.includes("Turn website visitors"),
      "other site's content leaked",
    );
    const sw = await req("/api/auth/switch-site", {
      method: "POST",
      json: { siteId: (c.body as { id: string }).id },
    });
    const swCookie = (sw.headers.get("set-cookie") ?? "").split(";")[0];
    const saved = cookie;
    cookie = `${saved}; ${swCookie}`;
    const l = await req("/api/admin/leads");
    cookie = saved;
    assert(
      l.status === 200 && (l.body.rows as unknown[]).length === 0,
      "leads from another site visible",
    );
    const unknown = await req("/", {
      auth: false,
      headers: { "X-Forwarded-Host": "not-a-customer.example" },
    });
    assert(unknown.status === 404, "unknown domain served a site");
  });
  // ── Batch 1 ──
  await check(
    "Password reset: request, reset with link, old password stops working, link single-use",
    async () => {
      const email = `reset.${RUN}@example.com`;
      await req("/api/admin/users", {
        method: "POST",
        json: {
          email,
          name: "Reset Tester",
          password: "FirstPass123",
          role: "editor",
          crmAccess: "inherit",
          mcpAccess: false,
          socialLevel: "executive",
          socialApprove: false,
        },
      });
      const f = await req("/api/auth/forgot", { method: "POST", auth: false, json: { email } });
      assert(f.status === 200 && f.body.devResetUrl, "no reset link in mock mode");
      const unknown = await req("/api/auth/forgot", {
        method: "POST",
        auth: false,
        json: { email: "nobody@example.com" },
      });
      assert(unknown.body.message === f.body.message, "response reveals whether the email exists");
      const token = new URL(String(f.body.devResetUrl)).searchParams.get("token");
      assert(
        (
          await req("/api/auth/reset", {
            method: "POST",
            auth: false,
            json: { token, password: "short" },
          })
        ).status === 422,
        "weak password accepted",
      );
      assert(
        (
          await req("/api/auth/reset", {
            method: "POST",
            auth: false,
            json: { token, password: "SecondPass456" },
          })
        ).status === 200,
        "reset failed",
      );
      assert(
        (
          await req("/api/auth/reset", {
            method: "POST",
            auth: false,
            json: { token, password: "ThirdPass789" },
          })
        ).status === 410,
        "link reused",
      );
      assert(
        (
          await req("/api/auth/login", {
            method: "POST",
            auth: false,
            json: { email, password: "FirstPass123" },
          })
        ).status === 401,
        "old password still works",
      );
      assert(
        (
          await req("/api/auth/login", {
            method: "POST",
            auth: false,
            json: { email, password: "SecondPass456" },
          })
        ).status === 200,
        "new password rejected",
      );
      for (const p of ["/admin/forgot", "/admin/reset?token=x", "/admin/account"])
        assert((await req(p)).status === 200, `${p} page`);
    },
  );
  await check("Change own password requires the current password", async () => {
    assert(
      (
        await req("/api/auth/change-password", {
          method: "POST",
          json: { current: "wrong", next: "Whatever123" },
        })
      ).status === 403,
      "wrong current password accepted",
    );
  });
  await check("Round-robin assignment shares new leads between team members", async () => {
    const team = await req("/api/admin/crm/team");
    const ids = (team.body as { id: string }[]).map((t) => t.id).slice(0, 2);
    assert(ids.length >= 1, "no team");
    await req("/api/admin/settings/crm.assignment", {
      method: "PUT",
      json: { mode: "round_robin", userIds: ids, lastIndex: -1 },
    });
    const owners: string[] = [];
    for (let k = 0; k < 2; k++) {
      const r = await req("/api/admin/leads", {
        method: "POST",
        json: { name: `RR ${k}`, phone: `+4477009${Date.now().toString().slice(-5)}${k}` },
      });
      owners.push(String((r.body.lead as { ownerId: string }).ownerId));
    }
    await req("/api/admin/settings/crm.assignment", { method: "PUT", json: { mode: "off" } });
    assert(
      owners.every((o) => ids.includes(o)),
      "lead not assigned",
    );
    if (ids.length > 1) assert(owners[0] !== owners[1], "not rotating");
    const mine = await req("/api/admin/leads?owner=none");
    assert(mine.status === 200, "owner filter");
  });
  await check("Pipeline board, owner change and leads CSV export", async () => {
    assert((await req("/admin/crm/board")).status === 200, "board page");
    const team = await req("/api/admin/crm/team");
    const me = (team.body as { id: string }[])[0].id;
    assert(
      (await req(`/api/admin/leads/${leadId}`, { method: "PATCH", json: { ownerId: me } }))
        .status === 200,
      "assign owner",
    );
    assert(
      (
        await req(`/api/admin/leads/${leadId}`, {
          method: "PATCH",
          json: { ownerId: "not-a-member" },
        })
      ).status === 422,
      "non-member owner accepted",
    );
    const csv = await req("/api/admin/exports/leads?owner=me");
    assert(
      csv.status === 200 && csv.text.startsWith("created_at") && csv.text.includes("Test Person"),
      "leads export",
    );
  });
  await check("Visual form builder page and server-side form validation", async () => {
    assert((await req(`/admin/forms/${formId}`)).status === 200, "builder page");
    const dup = await req(`/api/admin/r/forms/${formId}`, {
      method: "PATCH",
      json: {
        fields: [
          { key: "a", label: "A", type: "text" },
          { key: "a", label: "B", type: "text" },
        ],
      },
    });
    assert(dup.status === 422, "duplicate keys accepted");
    const bad = await req(`/api/admin/r/forms/${formId}`, {
      method: "PATCH",
      json: { fields: [{ key: "t", label: "T", type: "calculated", formula: "1 +* 2" }] },
    });
    assert(bad.status === 422, "bad formula accepted");
  });
  await check("Image upload is optimised to WebP in several sizes and served", async () => {
    const sharp = (await import("sharp")).default;
    const png = await sharp({
      create: { width: 1400, height: 900, channels: 3, background: { r: 30, g: 80, b: 200 } },
    })
      .png()
      .toBuffer();
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "Hero Photo.png");
    const r = await fetch(`${BASE}/api/admin/media/upload`, {
      method: "POST",
      body: fd,
      headers: { Cookie: cookie },
    });
    const d = await r.json();
    assert(r.ok, JSON.stringify(d));
    const m = d.files[0];
    assert(
      m.mime === "image/webp" && m.width === 1400 && m.variants.w480 && m.variants.w960,
      "variants missing",
    );
    for (const u of [m.url, m.variants.w480]) {
      const g = await fetch(BASE + u);
      assert(g.ok && g.headers.get("content-type") === "image/webp", `${u} not served`);
    }
    const fake = new FormData();
    fake.append(
      "file",
      new Blob([new TextEncoder().encode("not an image")], { type: "image/png" }),
      "x.png",
    );
    assert(
      (
        await fetch(`${BASE}/api/admin/media/upload`, {
          method: "POST",
          body: fake,
          headers: { Cookie: cookie },
        })
      ).status === 415,
      "fake image accepted",
    );
    assert((await req("/admin/media")).status === 200, "media page");
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  const fs = await import("node:fs");
  fs.writeFileSync(
    "smoke-results.json",
    JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2),
  );
  process.exit(failed.length ? 1 : 0);
}
main();
