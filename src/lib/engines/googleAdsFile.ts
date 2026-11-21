/** Google Ads offline conversion CSV (Data Manager / scheduled file import).
 * Header row first; conversion time carries its own time-zone offset. */
import { tzOffsetMinutes, zonedParts } from "./time";

export interface OfflineConversion { gclid?: string; gbraid?: string; wbraid?: string; hashedEmail?: string; hashedPhone?: string; conversionName: string; at: Date; valueMinor: number; currency: string; orderId?: string }

export function formatConversionTime(at: Date, timeZone: string): string {
  const { day, hhmm } = zonedParts(at, timeZone);
  const secs = String(at.getUTCSeconds()).padStart(2, "0");
  const off = tzOffsetMinutes(at, timeZone);
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return `${day} ${hhmm}:${secs}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export function buildOfflineCsv(rows: OfflineConversion[], timeZone: string): string {
  const header = ["Google Click ID", "GBRAID", "WBRAID", "Email", "Phone Number", "Conversion Name", "Conversion Time", "Conversion Value", "Conversion Currency", "Order ID"];
  const lines = [header.join(",")];
  for (const r of rows) {
    if (!r.gclid && !r.gbraid && !r.wbraid && !r.hashedEmail && !r.hashedPhone) continue;
    lines.push([r.gclid, r.gbraid, r.wbraid, r.hashedEmail, r.hashedPhone, r.conversionName, formatConversionTime(r.at, timeZone), (r.valueMinor / 100).toFixed(2), r.currency, r.orderId].map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}
