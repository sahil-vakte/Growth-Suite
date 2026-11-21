import ModulesView from "@/components/admin/ModulesView";
import { requireAdmin } from "@/lib/auth/current";
export default async function ModulesPage() { const ctx = await requireAdmin("modules"); return <ModulesView platform={!!ctx.member.isPlatformAdmin} />; }
