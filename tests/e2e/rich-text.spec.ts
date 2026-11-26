import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("blog rich text supports formatting, links, images, tables and safe paste", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
      })
    ).ok(),
  ).toBeTruthy();
  const slug = `editor-${randomUUID().slice(0, 8)}`;
  const response = await page.request.post("/api/admin/r/blog-posts", {
    data: { title: slug, slug, status: "published", html: "<p>Start here</p>" },
  });
  expect(response.ok()).toBeTruthy();
  const post = await response.json();
  try {
    await page.goto("/admin/r/blog-posts");
    await page.getByRole("row").filter({ hasText: slug }).click();
    const editor = page.getByRole("textbox", { name: "Content", exact: true });
    await editor.fill("A clear heading");
    await page.getByLabel("Content text style").selectOption("2");
    await editor.press("End");
    await editor.press("Enter");
    await editor.pressSequentially("Read more");
    await editor.press("Shift+Home");
    await page.getByRole("button", { name: "Link", exact: true }).click();
    await page.getByLabel("Link address").fill("https://example.com/guide");
    await page.getByRole("button", { name: "Apply link" }).click();
    await editor.press("Control+End");
    await editor.press("Enter");
    await page.getByRole("button", { name: "Bullet list", exact: true }).click();
    await editor.pressSequentially("First item");
    await editor.press("Enter");
    await editor.pressSequentially("Second item");
    await editor.press("Enter");
    await editor.press("Enter");
    await page.getByRole("button", { name: "Table", exact: true }).click();
    await expect(editor.locator("table")).toHaveCount(1);
    await page.getByRole("button", { name: "Add row", exact: true }).click();
    await expect(editor.locator("tr")).toHaveCount(4);
    await editor.press("Control+End");
    await editor.press("ArrowDown");
    await editor.press("Enter");
    await editor.evaluate((el) => {
      const data = new DataTransfer();
      data.setData(
        "text/html",
        '<p style="color:red" onclick="evil()">Clean pasted text<script>evil()</script></p>',
      );
      data.setData("text/plain", "Clean pasted text");
      el.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
      );
    });
    await expect(editor).toContainText("Clean pasted text");
    const upload = await page.request.post("/api/admin/media/upload", {
      multipart: {
        file: {
          name: `${slug}.png`,
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=",
            "base64",
          ),
        },
      },
    });
    expect(upload.ok(), await upload.text()).toBeTruthy();
    await page.getByRole("button", { name: "Image", exact: true }).click();
    const library = page.getByRole("dialog", { name: "Media library" });
    await library.getByLabel("Search images").fill(slug);
    await library.getByRole("button", { name: slug, exact: true }).click();
    await page.getByLabel("Image description (alt text)").fill("A helpful diagram");
    await page.getByRole("button", { name: "Insert image" }).click();
    const saved = page.waitForResponse(
      (r) => r.url().endsWith(`/blog-posts/${post.id}`) && r.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const result = await saved;
    expect(result.ok(), await result.text()).toBeTruthy();
    const stored = await result.json();
    expect(stored.html).not.toMatch(/onclick|<script|style=/);
    expect(stored.html).toContain("<h2>A clear heading</h2>");
    expect(stored.html).toContain("<ul>");
    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { name: "A clear heading" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Read more", exact: true })).toHaveAttribute(
      "href",
      "https://example.com/guide",
    );
    await expect(page.getByAltText("A helpful diagram")).toBeVisible();
    await expect(page.locator(".s-prose table")).toBeVisible();
  } finally {
    await page.request.delete(`/api/admin/r/blog-posts/${post.id}`);
  }
});
