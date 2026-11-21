import { db } from "@/db";
import { media } from "@/db/schema";
import { adminRoute } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { storeFile } from "@/lib/integrations/other";
import { optimiseImage } from "@/lib/services/images";

const LIMITS: Record<string, { kind: string; max: number }> = {
  "image/jpeg": { kind: "image", max: 10e6 }, "image/png": { kind: "image", max: 10e6 }, "image/webp": { kind: "image", max: 10e6 }, "image/gif": { kind: "image", max: 10e6 },
  "application/pdf": { kind: "document", max: 25e6 }, "video/mp4": { kind: "video", max: 400e6 }, "audio/mpeg": { kind: "audio", max: 25e6 }, "audio/webm": { kind: "audio", max: 25e6 },
};
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8, "image/png": (b) => b.subarray(0, 4).toString("hex") === "89504e47",
  "image/webp": (b) => b.subarray(8, 12).toString() === "WEBP", "image/gif": (b) => b.subarray(0, 3).toString() === "GIF",
  "application/pdf": (b) => b.subarray(0, 4).toString() === "%PDF", "video/mp4": (b) => b.subarray(4, 8).toString() === "ftyp",
  "audio/mpeg": (b) => b.subarray(0, 3).toString() === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0), "audio/webm": (b) => b.subarray(0, 4).toString("hex") === "1a45dfa3",
};

/** Multipart upload; the file content is checked against its declared type (not just the extension). */
export const POST = adminRoute("media", async (ctx, req) => {
  const fd = await req.formData();
  const files = fd.getAll("file").filter((f): f is File => typeof f !== "string");
  if (!files.length) throw new HttpError(422, "Choose at least one file.");
  const out = [];
  for (const f of files.slice(0, 20)) {
    const rule = LIMITS[f.type];
    if (!rule) throw new HttpError(415, `${f.name}: this file type is not allowed.`);
    if (f.size > rule.max) throw new HttpError(413, `${f.name} is too large.`);
    const buf = Buffer.from(await f.arrayBuffer());
    if (!MAGIC[f.type]?.(buf)) throw new HttpError(415, `${f.name} does not look like a real ${f.type} file.`);
    const title = f.name.replace(/\.[^.]+$/, "");
    if (rule.kind === "image" && f.type !== "image/gif") {
      let opt;
      try { opt = await optimiseImage(ctx.site.id, f.name, buf); } catch { throw new HttpError(415, `${f.name} could not be read as an image.`); }
      const [m] = await db.insert(media).values({ siteId: ctx.site.id, kind: "image", url: opt.url, title, mime: "image/webp", size: opt.size, width: opt.width, height: opt.height, variants: opt.variants }).returning();
      out.push(m); continue;
    }
    const stored = await storeFile(ctx.site.id, f.name, buf, f.type);
    const [m] = await db.insert(media).values({ siteId: ctx.site.id, kind: rule.kind === "audio" ? "document" : rule.kind, url: stored.url, title, mime: f.type, size: f.size }).returning();
    out.push(m);
  }
  return { ok: true, files: out };
});
