import { and, eq } from "drizzle-orm";
import { jwtVerify } from "jose";
import { zodToJsonSchema } from "@/lib/mcp/schema";
import { db } from "@/db";
import { apiClients } from "@/db/schema";
import { env } from "@/lib/env";
import { allowedTools } from "@/lib/mcp/tools";
import { audit } from "@/lib/history";

/** MCP (Model Context Protocol) endpoint — JSON-RPC 2.0 over HTTP POST. Auth: Bearer access token from /api/mcp/token. */
const PROTOCOL = "2025-06-18";
const rpc = (id: unknown, result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
const rpcErr = (id: unknown, code: number, message: string, status = 200) =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });

async function client(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.sessionSecret), {
      audience: "mcp",
    });
    const [c] = await db
      .select()
      .from(apiClients)
      .where(and(eq(apiClients.id, String(payload.sub)), eq(apiClients.active, true)))
      .limit(1);
    return c ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const c = await client(req);
  if (!c)
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="mcp"', "Content-Type": "application/json" },
    });
  const msg = await req.json().catch(() => null);
  if (!msg || msg.jsonrpc !== "2.0") return rpcErr(null, -32600, "Invalid request", 400);
  const { id, method, params } = msg;
  const available = allowedTools(c.permissions);
  switch (method) {
    case "initialize":
      return rpc(id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: env.appName, version: "1.0.0" },
        instructions:
          "Website, CRM and content tools for one site. There are no delete tools; knowledge you add waits for human approval.",
      });
    case "notifications/initialized":
      return new Response(null, { status: 202 });
    case "ping":
      return rpc(id, {});
    case "tools/list":
      return rpc(id, {
        tools: available.map((t) => ({
          name: t.name,
          description: `${t.description} [${t.group}/${t.mode}]`,
          inputSchema: zodToJsonSchema(t.input),
          annotations: { readOnlyHint: t.mode === "read", destructiveHint: false },
        })),
      });
    case "tools/call": {
      const tool = available.find((t) => t.name === params?.name);
      if (!tool) return rpcErr(id, -32602, "Unknown tool or not allowed for this connection");
      const parsed = tool.input.safeParse(params?.arguments ?? {});
      if (!parsed.success)
        return rpc(id, {
          content: [
            {
              type: "text",
              text: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
            },
          ],
          isError: true,
        });
      try {
        const out = await tool.run({ siteId: c.siteId, actor: `assistant:${c.name}` }, parsed.data);
        await db.update(apiClients).set({ lastUsedAt: new Date() }).where(eq(apiClients.id, c.id));
        if (tool.mode === "write") await audit(c.siteId, `assistant:${c.name}`, `mcp.${tool.name}`);
        return rpc(id, {
          content: [{ type: "text", text: JSON.stringify(out, null, 2).slice(0, 100_000) }],
        });
      } catch (e) {
        return rpc(id, {
          content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
          isError: true,
        });
      }
    }
    default:
      return rpcErr(id, -32601, "Method not found");
  }
}
