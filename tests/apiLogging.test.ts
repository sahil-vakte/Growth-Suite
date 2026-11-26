import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
const captured = vi.hoisted(() => ({ logs: [] as unknown[], reports: [] as unknown[] }));
vi.mock("pino", () => ({
  default: () => ({
    error: (event: unknown) => captured.logs.push(event),
    warn: (event: unknown) => captured.logs.push(event),
  }),
}));
vi.mock("../src/lib/integrations/errorTracking", () => ({
  reportApiError: async (event: unknown) => {
    captured.reports.push(event);
  },
}));
import { withApiLog } from "../src/lib/apiLogging";
import { setRequestSite } from "../src/lib/requestContext";
beforeEach(() => {
  captured.logs.length = 0;
  captured.reports.length = 0;
});
describe("API logging privacy and request isolation", () => {
  it("never serialises request or exception data and generates a safe request ID", async () => {
    const handler = withApiLog("/api/public/forms/[id]", "POST", async (_req: Request) => {
      setRequestSite("site-one");
      throw new Error("private@example.test password=top-secret SQL values");
    });
    const response = await handler(
      new Request("http://localhost/api/public/forms/private-id?email=private@example.test", {
        method: "POST",
        headers: { "X-Request-ID": "private@example.test", Authorization: "secret" },
        body: "private form values",
      }),
    );
    expect(response.status).toBe(500);
    expect(response.headers.get("X-Request-ID")).toMatch(/^[a-f0-9-]{36}$/);
    expect(captured.logs).toEqual([
      {
        event: "api.error",
        requestId: response.headers.get("X-Request-ID"),
        route: "/api/public/forms/[id]",
        method: "POST",
        siteId: "site-one",
        status: 500,
      },
    ]);
    expect(captured.reports).toEqual(captured.logs);
    expect(JSON.stringify(captured.logs)).not.toMatch(/private|secret|SQL|Authorization/);
  });
  it("keeps concurrent tenant context separate and omits success logs", async () => {
    const handler = withApiLog("/api/example", "GET", async (site: string) => {
      setRequestSite(site);
      await new Promise((r) => setTimeout(r, site === "a" ? 5 : 1));
      return Response.json({}, { status: 422 });
    });
    const [a, b] = await Promise.all([handler("a"), handler("b")]);
    expect(captured.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ siteId: "a", requestId: a.headers.get("X-Request-ID") }),
        expect.objectContaining({ siteId: "b", requestId: b.headers.get("X-Request-ID") }),
      ]),
    );
    expect(captured.reports).toHaveLength(0);
    const ok = withApiLog("/api/health", "GET", async () => Response.json({ ok: true }));
    expect((await ok()).status).toBe(200);
    expect(captured.logs).toHaveLength(2);
  });
  it("wraps every exported HTTP handler, including public and webhook routes", () => {
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = dir + "/" + entry.name;
        if (entry.isDirectory()) scan(path);
        else if (entry.name === "route.ts") {
          const source = readFileSync(path, "utf8");
          expect(source, path).not.toMatch(
            /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/,
          );
          for (const match of source.matchAll(
            /export const (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=\s*(\w+)/g,
          ))
            expect(match[2], path).toBe("withApiLog");
        }
      }
    };
    scan("src/app");
  });
});

it("preserves Next.js dynamic rendering control flow", async () => {
  const signal = Object.assign(new Error("dynamic render"), { digest: "DYNAMIC_SERVER_USAGE" });
  const handler = withApiLog("/sitemap.xml", "GET", async () => {
    throw signal;
  });
  await expect(handler()).rejects.toBe(signal);
  expect(captured.logs).toHaveLength(0);
});
