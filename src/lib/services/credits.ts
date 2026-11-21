/** Prepaid AI / messaging credits per site (ledger). Amounts in minor units of the site currency. */
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiCreditLedger } from "@/db/schema";
import { complete, type AiRequest, type AiResult } from "../integrations/ai";
import { getSetting } from "../settings";

export async function balance(siteId: string): Promise<number> {
  const [last] = await db
    .select()
    .from(aiCreditLedger)
    .where(eq(aiCreditLedger.siteId, siteId))
    .orderBy(desc(aiCreditLedger.createdAt), desc(aiCreditLedger.id))
    .limit(1);
  return last?.balanceAfter ?? 0;
}

export async function adjustCredits(
  siteId: string,
  deltaMinor: number,
  reason: string,
  provider?: string,
) {
  return db.transaction(async (tx) => {
    // Serialise ledger writes per site
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"credits:" + siteId}))`);
    const [last] = await tx
      .select()
      .from(aiCreditLedger)
      .where(eq(aiCreditLedger.siteId, siteId))
      .orderBy(desc(aiCreditLedger.createdAt), desc(aiCreditLedger.id))
      .limit(1);
    const balanceAfter = (last?.balanceAfter ?? 0) + deltaMinor;
    if (deltaMinor < 0 && balanceAfter < 0) throw new InsufficientCredits();
    await tx.insert(aiCreditLedger).values({ siteId, deltaMinor, reason, provider, balanceAfter });
    return balanceAfter;
  });
}

export class InsufficientCredits extends Error {
  constructor() {
    super("Not enough credits. Please top up in AI Setup.");
  }
}

/** Run an AI request and charge credits by tokens used (mock runs are free). */
export async function runAi(siteId: string, req: AiRequest, reason: string): Promise<AiResult> {
  const { creditPerThousandTokensMinor } = await getSetting(siteId, "ai.settings");
  const res = await complete(req);
  if (res.provider !== "mock") {
    const cost = Math.max(
      1,
      Math.ceil(((res.inputTokens + res.outputTokens) / 1000) * creditPerThousandTokensMinor),
    );
    await adjustCredits(siteId, -cost, reason, res.provider);
  }
  return res;
}
