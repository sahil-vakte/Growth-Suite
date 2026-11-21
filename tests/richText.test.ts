import { expect, it } from "vitest";
import { sanitizeHtml } from "../src/lib/site/sanitize";
import { bodySchema } from "../src/lib/admin/crud";
import { resources } from "../src/lib/admin/resources";
it("cleans rich-text content before persistence, preserving tables and image descriptions", () => {
  const input =
    '<h2 style="color:red">Hello</h2><table><tbody><tr><th>Plan</th><td>Basic</td></tr></tbody></table><img src="/uploads/test.webp" alt="Example" onerror="bad()"><script>bad()</script>';
  const cleaned = sanitizeHtml(input);
  expect(cleaned).toContain("<h2>Hello</h2>");
  expect(cleaned).toContain("<th>Plan</th>");
  expect(cleaned).toContain('alt="Example"');
  expect(cleaned).not.toMatch(/script|onerror|style=/);
  for (const [key, field] of [
    ["blog-posts", "html"],
    ["products", "description"],
  ]) {
    const resource = resources.find((r) => r.key === key)!;
    expect(bodySchema(resource, true).parse({ [field]: input })[field]).toBe(cleaned);
  }
});
