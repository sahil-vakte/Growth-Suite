import { withApiLog } from "@/lib/apiLogging";
import { z } from "zod";
import { adminRoute, readJson } from "@/lib/api";
import { upsertLead } from "@/lib/services/leads";
import { normalisePhone, phoneKey } from "@/lib/engines/phone";
import { getSetting } from "@/lib/settings";
import { parseCsv } from "@/lib/admin/csv";

export const POST = withApiLog(
  "/api/admin/leads/import",
  "POST",
  adminRoute("crm", async (ctx, req) => {
    const b = z
      .object({
        csv: z.string().max(5_000_000),
        mapping: z.record(z.enum(["name", "phone", "email", "country_code", "custom", "ignore"])),
        dryRun: z.boolean().default(false),
      })
      .parse(await readJson(req));
    const [header, ...data] = parseCsv(b.csv);
    if (!header) return { imported: 0, duplicates: 0, skipped: 0 };
    const { defaultCountryCode } = await getSetting(ctx.site.id, "crm.defaults");
    const seen = new Set<string>();
    let imported = 0,
      merged = 0,
      skipped = 0,
      dupInFile = 0;
    for (const r of data.slice(0, 20_000)) {
      const rec: Record<string, string> = {};
      const custom: Record<string, string> = {};
      header.forEach((h, i) => {
        const role = b.mapping[h] ?? "ignore";
        const v = (r[i] ?? "").trim();
        if (role === "custom" && v) custom[h] = v;
        else if (role !== "ignore") rec[role] = v;
      });
      const phone = normalisePhone(
        rec.phone,
        rec.country_code?.replace(/\D/g, "") || defaultCountryCode,
      );
      if (!phone) {
        skipped++;
        continue;
      }
      const k = phoneKey(phone)!;
      if (seen.has(k)) {
        dupInFile++;
        continue;
      }
      seen.add(k);
      if (b.dryRun) {
        imported++;
        continue;
      }
      const { created } = await upsertLead(
        ctx.site.id,
        { name: rec.name, phone, email: rec.email || null, source: "import", customFields: custom },
        ctx.actor,
      );
      if (created) imported++;
      else merged++;
    }
    return {
      imported,
      merged,
      duplicatesInFile: dupInFile,
      skippedNoPhone: skipped,
      dryRun: b.dryRun,
    };
  }),
);
