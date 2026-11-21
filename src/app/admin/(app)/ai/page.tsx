import AiStudio from "@/components/admin/AiStudio";
import { requireAdmin } from "@/lib/auth/current";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AiPage() {
  const ctx = await requireAdmin("ai");
  const pageList = await db.select({ id: pages.id, title: pages.title }).from(pages).where(eq(pages.siteId, ctx.site.id));
  return <AiStudio pages={pageList} currency={ctx.site.currency} />;
}
