import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/current";
import TwoFactorForm from "@/components/admin/TwoFactorForm";
export const dynamic = "force-dynamic";
export default async function SecurityPage() {
  const ctx = await getAdminContext(true);
  if (!ctx) redirect("/admin/login");
  return (
    <main style={{ maxWidth: 760, margin: "3rem auto", padding: "1rem" }}>
      <p className="eyebrow">Account security</p>
      <h1>Protect your account</h1>
      <TwoFactorForm
        enabled={!!ctx.user.totpSecretEnc}
        required={ctx.twoFactorRequired}
        siteRequired={ctx.site.requireAdminTwoFactor}
        canManage={ctx.member.role === "admin" || !!ctx.member.isPlatformAdmin}
        siteName={ctx.site.name}
      />
      <p>
        <a href="/admin">Back to workspace</a>
      </p>
    </main>
  );
}
