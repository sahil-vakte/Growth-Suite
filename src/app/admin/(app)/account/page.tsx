import { requireAdmin } from "@/lib/auth/current";
import { ChangePasswordForm } from "@/components/admin/AuthForms";
export default async function Account() {
  const ctx = await requireAdmin();
  return (
    <div>
      <h1>My account</h1>
      <p className="muted">
        {ctx.user.name} · {ctx.user.email}
      </p>
      <ChangePasswordForm />
      <section className="card">
        <h2>Account security</h2>
        <p>Add an authenticator app and manage recovery codes.</p>
        <a className="btn" href="/admin/security">
          Manage two-factor authentication
        </a>
      </section>
    </div>
  );
}
