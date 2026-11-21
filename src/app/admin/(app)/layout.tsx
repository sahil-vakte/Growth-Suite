import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/current";
import { canAccess } from "@/lib/auth/permissions";
import { adminNav } from "@/lib/admin/nav";
import { env } from "@/lib/env";
import Sidebar from "@/components/admin/Sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  const groups = adminNav
    .map((g) => ({
      label: g.label,
      items: g.items.filter((i) =>
        (i.feature as string) === "platform"
          ? !!ctx.member.isPlatformAdmin
          : !i.feature || canAccess(ctx.member, i.feature),
      ),
    }))
    .filter((g) => g.items.length);
  return (
    <div className="shell">
      <Sidebar
        appName={env.appName}
        groups={groups}
        sites={ctx.sites}
        siteId={ctx.site.id}
        userName={ctx.user.name}
        role={ctx.member.isPlatformAdmin ? "platform admin" : ctx.member.role}
      />
      <main className="main">{children}</main>
    </div>
  );
}
