/** Smaller providers: web search (Serper), video rooms (Daily), social publishing (Meta Graph), storage (local disk / S3-compatible). */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env, isConfigured } from "../env";
import { callJson, recordMock } from "./http";
import { newId } from "../ids";

export async function webSearch(q: string, opts: { site?: string; afterDate?: string; num?: number } = {}): Promise<{ title: string; link: string; snippet: string; date?: string }[]> {
  const query = `${q}${opts.site ? ` site:${opts.site}` : ""}${opts.afterDate ? ` after:${opts.afterDate}` : ""}`;
  if (!isConfigured.search()) {
    recordMock("search", "query", { query });
    return [1, 2, 3].map((i) => ({ title: `Example question ${i} about ${q}`, link: `https://${opts.site ?? "example.com"}/q/${i}`, snippet: `Mock result ${i}. Add SERPER_API_KEY for real results.` }));
  }
  const r = await callJson<{ organic: { title: string; link: string; snippet: string; date?: string }[] }>("https://google.serper.dev/search", { method: "POST", headers: { "X-API-KEY": env.search.serperApiKey, "Content-Type": "application/json" }, body: JSON.stringify({ q: query, num: opts.num ?? 10 }) });
  return r.organic ?? [];
}

export async function createVideoRoom(name: string): Promise<{ url: string; mock?: boolean }> {
  if (!isConfigured.video()) { recordMock("video", "create_room", { name }); return { url: `https://meet.jit.si/gs-${name}`, mock: true }; }
  const r = await callJson<{ url: string }>("https://api.daily.co/v1/rooms", { method: "POST", headers: { Authorization: `Bearer ${env.video.dailyApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ name, properties: { exp: Math.floor(Date.now() / 1000) + 86400 } }) });
  return { url: r.url };
}

export async function publishToFacebook(pageId: string, pageToken: string, caption: string, mediaUrl?: string): Promise<{ id: string; mock?: boolean }> {
  if (env.forceMock || !pageToken) return recordMock("facebook", "publish", { pageId, caption, mediaUrl });
  const endpoint = mediaUrl ? `${pageId}/photos` : `${pageId}/feed`;
  const body = new URLSearchParams({ access_token: pageToken, ...(mediaUrl ? { url: mediaUrl, caption } : { message: caption }) });
  return callJson(`https://graph.facebook.com/${env.whatsapp.graphVersion}/${endpoint}`, { method: "POST", body });
}

export async function publishToInstagram(igUserId: string, token: string, caption: string, imageUrl: string): Promise<{ id: string; mock?: boolean }> {
  if (env.forceMock || !token) return recordMock("instagram", "publish", { igUserId, caption, imageUrl });
  const g = `https://graph.facebook.com/${env.whatsapp.graphVersion}`;
  const c = await callJson<{ id: string }>(`${g}/${igUserId}/media`, { method: "POST", body: new URLSearchParams({ image_url: imageUrl, caption, access_token: token }) });
  return callJson(`${g}/${igUserId}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: c.id, access_token: token }) });
}

/** Stores bytes at an exact key (used for image variants). */
export async function storeAt(key: string, data: Buffer, contentType: string): Promise<string> {
  if (env.s3.bucket && !env.forceMock) {
    await s3Put(key, data, contentType);
    return `${(env.s3.publicBaseUrl || `${s3Endpoint()}/${env.s3.bucket}`).replace(/\/$/, "")}/${key}`;
  }
  await mkdir(path.join(env.storageDir, path.dirname(key)), { recursive: true });
  await writeFile(path.join(env.storageDir, key), data);
  return `${env.publicUploadsBase}/${key}`;
}

/** Stores an upload and returns its public URL.
 * S3-compatible object storage (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO) when S3_BUCKET is set; local disk otherwise. */
export async function storeFile(siteId: string, filename: string, data: Buffer, contentType = "application/octet-stream"): Promise<{ url: string; key: string }> {
  const safe = filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80);
  const key = `${siteId}/${new Date().toISOString().slice(0, 7)}/${newId()}-${safe}`;
  if (env.s3.bucket && !env.forceMock) {
    await s3Put(key, data, contentType);
    const base = env.s3.publicBaseUrl || `${s3Endpoint()}/${env.s3.bucket}`;
    return { key, url: `${base.replace(/\/$/, "")}/${key}` };
  }
  const dir = path.join(env.storageDir, path.dirname(key));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(env.storageDir, key), data);
  return { key, url: `${env.publicUploadsBase}/${key}` };
}

const s3Endpoint = () => (env.s3.endpoint || `https://s3.${env.s3.region}.amazonaws.com`).replace(/\/$/, "");

/** Minimal AWS Signature V4 PUT (path-style), no SDK needed. */
async function s3Put(key: string, body: Buffer, contentType: string) {
  const { createHash, createHmac } = await import("node:crypto");
  const region = env.s3.region || "auto";
  const url = new URL(`${s3Endpoint()}/${env.s3.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(body).digest("hex");
  const headers: Record<string, string> = { host: url.host, "content-type": contentType, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonical = ["PUT", url.pathname, "", ...Object.keys(headers).sort().map((h) => `${h}:${headers[h]}`), "", signedHeaders, payloadHash].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const h = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d).digest();
  const signingKey = h(h(h(h(`AWS4${env.s3.secretAccessKey}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");
  const res = await fetch(url, { method: "PUT", body: new Uint8Array(body), headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${env.s3.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` } });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}
