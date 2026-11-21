/** Image optimisation: every JPEG/PNG/WebP upload becomes WebP in up to three widths (never upscaled).
 *  Files are named <base>-full.webp, <base>-w480.webp, <base>-w960.webp so pages can build srcset without a lookup. */
import sharp from "sharp";
import { newId } from "../ids";
import { storeAt } from "../integrations/other";

import { IMAGE_MAX_WIDTH as MAX_WIDTH, IMAGE_WIDTHS as WIDTHS } from "../engines/srcset";
export { srcSetFor } from "../engines/srcset";

export async function optimiseImage(siteId: string, filename: string, data: Buffer) {
  const img = sharp(data, { failOn: "error" }).rotate(); // apply EXIF orientation, strip metadata
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error("Could not read the image size.");
  const safe =
    filename
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .slice(0, 60) || "image";
  const base = `${siteId}/${new Date().toISOString().slice(0, 7)}/${newId()}-${safe}`;
  const fullW = Math.min(meta.width, MAX_WIDTH);
  const full = await img
    .clone()
    .resize({ width: fullW, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const variants: Record<string, string> = {
    full: await storeAt(`${base}-full.webp`, full.data, "image/webp"),
  };
  for (const w of WIDTHS)
    if (w < fullW)
      variants[`w${w}`] = await storeAt(
        `${base}-w${w}.webp`,
        await img.clone().resize({ width: w }).webp({ quality: 80 }).toBuffer(),
        "image/webp",
      );
  return {
    url: variants.full,
    width: full.info.width,
    height: full.info.height,
    size: full.data.length,
    variants,
  };
}
