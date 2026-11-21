/** Affiliate commission calculation from the published terms in force when the referral entered. */
export interface CommissionRules { type: "percent" | "fixed"; percent?: number; fixedMinor?: number; holdDays: number; minPayoutMinor: number; conversionStage: string }

export function commissionFor(rules: CommissionRules, dealValueMinor: number): number {
  if (rules.type === "fixed") return Math.max(0, rules.fixedMinor ?? 0);
  return Math.max(0, Math.round((dealValueMinor * (rules.percent ?? 0)) / 100));
}

export function availableAt(convertedAt: Date, rules: CommissionRules): Date {
  return new Date(convertedAt.getTime() + rules.holdDays * 86_400_000);
}

export function payoutEligible(approvedMinor: number[], rules: CommissionRules): boolean {
  return approvedMinor.reduce((a, b) => a + b, 0) >= rules.minPayoutMinor;
}

/** Four-eyes rule: the admin who approved a payout cannot also mark it paid. */
export function canMarkPaid(approvedBy: string | null, actor: string): boolean {
  return !!approvedBy && approvedBy !== actor;
}
