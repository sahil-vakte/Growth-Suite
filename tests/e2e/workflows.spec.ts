import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { randomUUID, randomInt } from "node:crypto";

const email = process.env.ADMIN_EMAIL!;
const password = process.env.ADMIN_PASSWORD!;
const uid = () => randomUUID().slice(0, 8);
const phone = () => "+4477" + String(Date.now()).slice(-8);
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
async function create(request: APIRequestContext, resource: string, data: object) {
  const response = await request.post(`/api/admin/r/${resource}`, { data });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("login rejects bad credentials and protects admin pages", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/admin/crm");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form [role=alert]")).toContainText("not correct");
  await login(page);
  expect((await context.cookies()).some((c) => c.httpOnly)).toBeTruthy();
  await context.close();
});

test("page builder adds, edits, reorders and publishes sections", async ({
  page,
  browser,
  baseURL,
}) => {
  const slug = `browser-${uid()}`;
  const record = await create(page.request, "pages", { title: slug, slug, status: "draft" });
  try {
    await page.goto(`/admin/pages/${record.id}`);
    await page.getByRole("button", { name: "+ Add", exact: true }).click();
    await page.getByRole("button", { name: /Hero.*text and image/i }).click();
    const heading = page
      .locator(".field")
      .filter({ has: page.locator("label", { hasText: /^Heading$/ }) })
      .locator("input");
    await heading.fill("Built in a real browser");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "+ Add", exact: true }).first().click();
    await page.getByRole("button", { name: /Numbers strip/ }).click();
    await expect(page.locator("ol > li")).toHaveCount(2);
    const reordered = page.waitForResponse(
      (r) => r.url().endsWith("/reorder") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Move up", exact: true }).nth(1).click();
    expect((await reordered).ok()).toBeTruthy();
    await page.reload();
    await expect(page.locator("ol > li").first()).toContainText("Numbers strip");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
    const visitor = await browser.newContext({ baseURL });
    const publicPage = await visitor.newPage();
    await publicPage.goto(`/${slug}`);
    await expect(
      publicPage.getByRole("heading", { name: "Built in a real browser" }),
    ).toBeVisible();
    await visitor.close();
  } finally {
    await page.request.delete(`/api/admin/r/pages/${record.id}`);
  }
});

test("public form submits and appears in CRM", async ({ page, browser, baseURL }) => {
  const name = `Browser enquiry ${uid()}`;
  const visitor = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": `198.18.${randomInt(256)}.${randomInt(1, 255)}` },
  });
  const publicPage = await visitor.newPage();
  await publicPage.goto("/");
  const form = publicPage.locator("form.s-form").first();
  await form.getByLabel("Your name").fill(name);
  await form.getByLabel("Phone").fill(phone());
  await form.getByLabel("Email", { exact: true }).fill(`${uid()}@example.test`);
  await form.getByLabel("What do you need?").selectOption("Website");
  await form.getByLabel("I agree").check();
  // Exercise the real minimum-fill-time spam protection.
  await publicPage.waitForTimeout(3100);
  await form.getByRole("button", { name: "Get my free quote" }).click();
  await expect(publicPage.getByRole("status")).toContainText("Thank you");
  await page.goto("/admin/crm");
  await page.getByRole("textbox", { name: /Search/ }).fill(name);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await visitor.close();
});

test("targeted popup opens and closes with Escape", async ({ page, browser, baseURL }) => {
  const name = `Browser offer ${uid()}`;
  const popup = await create(page.request, "popups", {
    name,
    layout: "center",
    content: { headline: name, body: "A useful offer" },
    design: {},
    targeting: {
      match: "all",
      conditions: [{ field: "url", op: "contains", value: "browser-popup" }],
    },
    frequency: "session",
    delaySec: 0,
    active: true,
  });
  try {
    const visitor = await browser.newContext({ baseURL });
    const publicPage = await visitor.newPage();
    await publicPage.goto("/?browser-popup=1");
    await expect(publicPage.getByRole("dialog", { name })).toBeVisible();
    await publicPage.keyboard.press("Escape");
    await expect(publicPage.getByRole("dialog", { name })).toBeHidden();
    await publicPage.reload();
    await expect(publicPage.getByRole("dialog", { name })).toBeHidden();
    await visitor.close();
  } finally {
    await page.request.delete(`/api/admin/r/popups/${popup.id}`);
  }
});

test("chat widget sends a conversation and minimises", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat", exact: true }).click();
  const chat = page.getByRole("dialog", { name: "Ava" });
  await chat.getByLabel("Message", { exact: true }).fill("What do your website packages include?");
  const reply = page.waitForResponse(
    (r) => r.url().includes("/api/public/chat/") && r.request().method() === "POST",
  );
  await chat.getByRole("button", { name: "Send", exact: true }).click();
  const response = await reply;
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.conversationId).toBeTruthy();
  await expect(chat.getByText(data.reply, { exact: true })).toBeVisible();
  await chat.getByRole("button", { name: "Minimise chat" }).click();
  await expect(chat).toBeHidden();
});

test("booking selects a slot and confirms", async ({ page }) => {
  await page.goto("/book");
  await page
    .getByRole("button", { name: /^\d{2}:\d{2}/ })
    .first()
    .click();
  await page.getByLabel("Name", { exact: true }).fill(`Browser booking ${uid()}`);
  await page.getByLabel("Email", { exact: true }).fill(`${uid()}@example.test`);
  await page.getByLabel("Phone", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("status")).toContainText("You are booked in");
});

test("CRM lead detail saves a note and stage", async ({ page }) => {
  const response = await page.request.post("/api/admin/leads", {
    data: { name: `Browser CRM ${uid()}`, phone: phone() },
  });
  expect(response.ok()).toBeTruthy();
  const { lead } = await response.json();
  await page.goto(`/admin/crm/${lead.id}`);
  const note = `Follow up tomorrow ${uid()}`;
  await page.getByLabel("Note", { exact: true }).fill(note);
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText(note, { exact: true })).toBeVisible();
  await page.getByLabel("Stage", { exact: true }).selectOption({ label: "Qualified" });
  await expect(page.getByText("Stage updated.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Stage", { exact: true }).locator("option:checked")).toHaveText(
    "Qualified",
  );
});

test("social draft is submitted, returned and approved for scheduling", async ({ page }) => {
  const name = `Browser social ${uid()}`;
  const account = await create(page.request, "social-accounts", { pageId: uid(), pageName: name });
  const verified = await page.request.post(`/api/admin/social-accounts/${account.id}/verify`);
  expect(verified.ok()).toBeTruthy();
  const post = await create(page.request, "social-posts", {
    accountId: account.id,
    caption: name,
    platforms: ["facebook"],
    scheduledAt: new Date(Date.now() + 86400_000).toISOString(),
  });
  try {
    await page.goto("/admin/r/social-posts");
    await page.getByLabel("Search", { exact: true }).fill(name);
    const row = page.getByRole("row").filter({ hasText: name });
    await row.getByRole("button", { name: "Send for approval" }).click();
    await expect(row).toContainText("pending_approval");
    await row.getByRole("button", { name: "Return", exact: true }).click();
    await expect(row).toContainText("returned");
    await row.getByRole("button", { name: "Send for approval" }).click();
    await row.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(row).toContainText("scheduled");
  } finally {
    await page.request.delete(`/api/admin/r/social-posts/${post.id}`);
    await page.request.delete(`/api/admin/r/social-accounts/${account.id}`);
  }
});
