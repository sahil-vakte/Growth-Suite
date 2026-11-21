/** Keep the current UTC month plus N complete prior months. Zero disables deletion. */
export function retentionMonths(value: string | undefined): number {
  if (value === undefined || value === "") return 12;
  if (!/^\d+$/.test(value) || Number(value) > 120)
    throw new Error("ANALYTICS_RETENTION_MONTHS must be an integer from 0 to 120");
  return Number(value);
}
export function retentionCutoff(months: number, now = new Date()): Date | null {
  if (!Number.isInteger(months) || months < 0 || months > 120 || !Number.isFinite(now.getTime()))
    throw new Error("Invalid retention policy");
  return months === 0
    ? null
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
}
