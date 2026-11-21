import { requireAdmin } from "@/lib/auth/current";
import SitesManager from "@/components/admin/SitesManager";

export default async function PlatformPage() {
  const ctx = await requireAdmin();
  if (!ctx.member.isPlatformAdmin) return <div className="alert error">Platform admins only.</div>;
  return <SitesManager />;
}
