import { requireAdmin } from "@/lib/auth/current";
import { env } from "@/lib/env";
import { SettingsForm, ActionForm } from "@/components/admin/ui";

export default async function Integrations() {
  const ctx = await requireAdmin("integrations");
  const base = env.appUrl;
  return (
    <div>
      <h1>Integrations</h1>
      <p className="muted">Keys are stored encrypted. Every integration works in mock mode until its keys are added — nothing is sent anywhere until then.</p>
      <div className="grid cols-2" style={{ marginTop: "1rem" }}>
        <div className="card"><h3 style={{ marginTop: 0 }}>Webhook addresses to give Meta</h3>
          <p className="small">WhatsApp Cloud API: <code>{base}/api/webhooks/whatsapp</code></p>
          <p className="small">Facebook Lead Ads: <code>{base}/api/webhooks/facebook-leads</code></p>
          <p className="small">Razorpay: <code>{base}/api/public/payments/razorpay</code> · Stripe: <code>{base}/api/public/payments/stripe</code></p>
          <p className="small">Google Ads offline file (set mode to “file”): <code>{base}/api/public/google-ads/{ctx.site.id}</code></p>
          <p className="small">Scheduler (every minute, header Authorization: Bearer CRON_SECRET): <code>{base}/api/cron/tick</code></p>
          <a className="btn" href="/api/admin/integrations/gtm-export">Download GTM container</a>
        </div>
        <ActionForm title="Send a Meta test event" endpoint="/api/admin/integrations/meta-test" fields={[]} submitLabel="Send test Lead event" help="Uses your Pixel ID, Conversions API token and test event code below." />
        <SettingsForm settingKey="integrations.gtm" title="Google Tag Manager" help="Container ID, e.g. GTM-ABC1234. The tag loads on every public page." />
        <SettingsForm settingKey="integrations.ga4" title="Google Analytics 4" help="Measurement ID (G-…) and a Measurement Protocol API secret, used to send CRM stage outcomes to GA4 → Google Ads." />
        <SettingsForm settingKey="integrations.meta" title="Meta Pixel & Conversions API" help="Keep mode on “test” until you have checked events in Events Manager, then set “live”." />
        <SettingsForm settingKey="integrations.facebookLeads" title="Facebook Lead Ads" help="Page ID and a Page access token with leads_retrieval. formMap links Facebook form IDs to your form names." />
        <SettingsForm settingKey="integrations.googleAdsOffline" title="Google Ads offline conversions" help="mode: off | file. With “file”, Google Ads fetches the CSV above with the username and password you set here." />
      </div>
    </div>
  );
}
