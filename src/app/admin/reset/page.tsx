import { ResetForm } from "@/components/admin/AuthForms";
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <div className="card" style={{ width: "min(400px,100%)" }}>
        <h1>Choose a new password</h1>
        {token ? (
          <ResetForm token={token} />
        ) : (
          <p>
            This link is missing its code. <a href="/admin/forgot">Ask for a new link</a>.
          </p>
        )}
      </div>
    </div>
  );
}
