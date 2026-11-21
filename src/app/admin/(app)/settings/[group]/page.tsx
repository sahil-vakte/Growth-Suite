import { notFound } from "next/navigation";
import { SettingsForm } from "@/components/admin/ui";

const groups: Record<string, { title: string; items: { key: string; title: string; help?: string }[] }> = {
  site: { title: "Header, footer & menu style", items: [
    { key: "site.design", title: "Site-wide theme & fonts", help: "Paste a theme ID and font set ID from Themes / Font sets. Pages can override them." },
    { key: "site.header", title: "Header", help: 'CTA buttons use the CTA object: {"label":"","type":"url|whatsapp|phone|form","value":"","target":"_self"}' },
    { key: "site.menu", title: "Menu design" },
    { key: "site.footer", title: "Footer", help: 'Social: [{"network":"Instagram","url":"https://…"}]. Legal links: [{"label":"Privacy policy","href":"/privacy"}]' },
    { key: "brand.guidelines", title: "Brand guidelines", help: "Colours, fonts, tone of voice, words to avoid. AI tools read this before writing or designing." },
  ] },
  capture: { title: "Floating CTA, spam guard & CRM defaults", items: [
    { key: "site.floatingCta", title: "Floating contact bar", help: "Set ctaId to a WhatsApp CTA ID / call CTA ID, and formId to a form ID." },
    { key: "forms.spamGuard", title: "Spam guard", help: "Held entries create no lead, no WhatsApp message and no ad conversion; the sender still sees the thank-you message." },
    { key: "crm.assignment", title: "Lead assignment", help: 'mode: "off" or "round_robin". userIds: the team members to share new leads between, e.g. ["user-id-1","user-id-2"] (IDs are on the Users page). New leads are given to them in turn.' },
    { key: "crm.defaults", title: "CRM defaults", help: "Country code used when a phone number is entered without one (44 = UK, 91 = India, 1 = US)." },
  ] },
  appointments: { title: "Booking settings", items: [{ key: "appointments.settings", title: "Appointment scheduler", help: "Time zone (e.g. Europe/London, Asia/Kolkata), slot length, minimum notice in minutes and how many days ahead people can book." }] },
};

export default async function SettingsGroup({ params }: { params: Promise<{ group: string }> }) {
  const g = groups[(await params).group]; if (!g) notFound();
  return <div><h1>{g.title}</h1><div className="grid cols-2" style={{ marginTop: "1rem" }}>{g.items.map((i) => <SettingsForm key={i.key} settingKey={i.key} title={i.title} help={i.help} />)}</div></div>;
}
