import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

const TYPES: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".webm": "audio/webm", ".m4a": "audio/mp4" };

/** Serves locally stored uploads (use S3/CDN in production). Path traversal is blocked. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const root = path.resolve(env.storageDir);
  const file = path.resolve(root, ...parts);
  if (!file.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const s = await stat(file); if (!s.isFile()) throw new Error();
    const ext = path.extname(file).toLowerCase();
    const headers: Record<string, string> = { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" };
    if (ext === ".svg") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'";
    return new Response(new Uint8Array(await readFile(file)), { headers });
  } catch { return new Response("Not found", { status: 404 }); }
}
