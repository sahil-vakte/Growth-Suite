import bcrypt from "bcryptjs";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { canAccess } from "@/lib/auth/permissions";
import { getSetting, isSettingKey, setSetting, type SettingKey } from "@/lib/settings";
import { settingFeature, MASK, isSecretKey } from "@/lib/admin/settingsAccess";
import { encrypt } from "@/lib/crypto";
import { audit } from "@/lib/history";
import { clearSiteCache } from "@/lib/tenant";

function mask(v: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, isSecretKey(k) ? (x ? MASK : "") : x]));
}

export const GET = adminRoute<{ key: string }>(undefined, async (ctx, _req, p) => {
  if (!isSettingKey(p.key)) throw new HttpError(404, "Unknown setting.");
  if (!canAccess(ctx.member, settingFeature[p.key])) throw new HttpError(403, "You do not have access to this setting.");
  return mask((await getSetting(ctx.site.id, p.key)) as Record<string, unknown>);
});

export const PUT = adminRoute<{ key: string }>(undefined, async (ctx, req, p) => {
  if (!isSettingKey(p.key)) throw new HttpError(404, "Unknown setting.");
  const key = p.key as SettingKey;
  if (!canAccess(ctx.member, settingFeature[key])) throw new HttpError(403, "You do not have access to this setting.");
  if (key.startsWith("integrations.") && ctx.member.role !== "admin" && !ctx.member.isPlatformAdmin) throw new HttpError(403, "Only admins can change integration settings.");
  const body = await readJson<Record<string, unknown>>(req);
  const current = (await getSetting(ctx.site.id, key)) as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!(k in current)) continue; // only known fields
    if (isSecretKey(k)) {
      if (v === MASK || v === undefined) continue; // unchanged
      if (v === "" || v === null) { next[k] = ""; continue; }
      next[k] = k.endsWith("PasswordHash") ? await bcrypt.hash(String(v), 10) : encrypt(String(v));
      continue;
    }
    const cur = current[k];
    if (typeof cur === "number") next[k] = Number(v);
    else if (typeof cur === "boolean") next[k] = v === true || v === "true";
    else if (typeof cur === "string") next[k] = String(v ?? "").slice(0, 20_000);
    else next[k] = v; // objects/arrays validated by shape below
    if (typeof cur === "object" && cur !== null && (typeof v !== "object" || v === null || Array.isArray(cur) !== Array.isArray(v))) throw new HttpError(422, `${k} has the wrong shape.`);
  }
  const saved = await setSetting(ctx.site.id, key, next as never);
  await audit(ctx.site.id, ctx.actor, "settings.update", "settings", key, { fields: Object.keys(next) });
  clearSiteCache();
  return mask(saved as Record<string, unknown>);
});
