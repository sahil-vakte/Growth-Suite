import { SettingsForm } from "@/components/admin/ui";
import WhatsAppConnect from "@/components/admin/WhatsAppConnect";
import { env } from "@/lib/env";

export default function WhatsAppPage() {
  return (
    <div>
      <h1>WhatsApp Business</h1>
      <p className="muted">
        Official WhatsApp Cloud API. Templates need Meta approval; bot replies do not, because the
        customer wrote first.
      </p>
      <div className="grid cols-2" style={{ marginTop: "1rem" }}>
        <WhatsAppConnect partnerId={env.whatsapp.partnerBusinessId} />
        <SettingsForm
          settingKey="whatsapp.bot"
          title="Auto-reply bot"
          help="Greeting for new chats, a fallback when nothing matches, an away message outside hours, and words that hand the chat to a person. The bot stays quiet for takeoverHours after a team member replies, never answers people who sent STOP, and stops at dailyCap."
        />
      </div>
    </div>
  );
}
