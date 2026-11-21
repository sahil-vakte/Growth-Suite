import { env } from "@/lib/env";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <div className="card" style={{ width: "min(400px, 100%)" }}>
        <h1>{env.appName}</h1>
        <p className="muted">Sign in to manage your website and leads.</p>
        <LoginForm />
      </div>
    </div>
  );
}
