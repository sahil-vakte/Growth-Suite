import UsersManager from "@/components/admin/UsersManager";
import { requireAdmin } from "@/lib/auth/current";
export default async function UsersPage() { const ctx = await requireAdmin("users"); return <UsersManager selfId={ctx.user.id} />; }
