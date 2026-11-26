import { env } from "@/lib/env";
import LoginForm from "./LoginForm";
export default function LoginPage() {
  return (
    <main className="login-layout">
      <section className="login-story" aria-label="About Growth Suite">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            g
          </span>
          {env.appName}
        </div>
        <div>
          <p className="eyebrow">Your business, connected</p>
          <h2>
            A clearer view.
            <br />A better next step.
          </h2>
          <p>
            Bring your website, enquiries and customer conversations together in one organised
            workspace.
          </p>
          <ul>
            <li>Build pages that turn visits into enquiries</li>
            <li>Keep every customer conversation in view</li>
            <li>Make follow-up part of your everyday workflow</li>
          </ul>
        </div>
        <span className="small">Built for the people growing your business.</span>
      </section>
      <section className="login-form-area">
        <div className="login-card">
          <span className="eyebrow">Welcome back</span>
          <h1>Sign in to your workspace</h1>
          <p className="muted">
            Manage your website, stay close to your leads and keep things moving.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
