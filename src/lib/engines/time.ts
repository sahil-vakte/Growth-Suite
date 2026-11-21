/** Time-zone helpers using only Intl (no external libraries). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Convert a wall-clock time in a zone (YYYY-MM-DD, HH:MM) to a UTC Date. */
export function zonedToUtc(day: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let offset = tzOffsetMinutes(new Date(guess), timeZone);
  let result = guess - offset * 60000;
  const offset2 = tzOffsetMinutes(new Date(result), timeZone);
  if (offset2 !== offset) result = guess - offset2 * 60000;
  return new Date(result);
}

/** Wall-clock parts of a UTC instant in a zone. */
export function zonedParts(date: Date, timeZone: string): { day: string; hhmm: string; weekday: string } {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour}:${p.minute}`, weekday: p.weekday.toLowerCase().slice(0, 3) };
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Is a wall-clock HH:MM inside a window that may wrap past midnight (e.g. 21:00–09:00)? */
export function inWindow(hhmm: string, start: string, end: string): boolean {
  if (start === end) return false;
  return start < end ? hhmm >= start && hhmm < end : hhmm >= start || hhmm < end;
}
