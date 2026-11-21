/** Creates the platform admin and a demo site with working content. Safe to run more than once. */
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import * as s from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { builtinLayouts } from "../src/lib/layouts/registry";
import { embed } from "../src/lib/integrations/ai";

const domain = process.env.DEFAULT_SITE_DOMAIN ?? "localhost";
const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "ChangeMe-2026!";
const L = (k: string) => structuredClone(builtinLayouts.find((l) => l.key === k)!.defaultContent);

async function main() {
  let [user] = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  if (!user) [user] = await db.insert(s.users).values({ email, name: "Platform Admin", passwordHash: await hashPassword(password), isPlatformAdmin: true }).returning();
  let [site] = await db.select().from(s.sites).where(eq(s.sites.domain, domain)).limit(1);
  if (site) { console.log(`✓ Site ${domain} already exists — nothing to seed.`); return; }
  [site] = await db.insert(s.sites).values({ name: "Demo Business", domain, timezone: "Europe/London", currency: "GBP", locale: "en-GB" }).returning();
  const sid = site.id;
  await db.insert(s.memberships).values({ siteId: sid, userId: user.id, role: "admin", mcpAccess: true, socialLevel: "publisher", socialApprove: true });

  const stages = await db.insert(s.leadStages).values([
    { siteId: sid, name: "New", color: "#2563eb", position: 0 }, { siteId: sid, name: "Contacted", color: "#7c3aed", position: 1 },
    { siteId: sid, name: "Qualified", color: "#0891b2", position: 2 }, { siteId: sid, name: "Interested", color: "#d97706", position: 3 },
    { siteId: sid, name: "Won", color: "#16a34a", position: 4, isWon: true }, { siteId: sid, name: "Lost", color: "#64748b", position: 5, isLost: true },
  ]).returning();
  await db.insert(s.themes).values({ siteId: sid, name: "Default blue", isDefault: true, palette: { primary: "#1d4ed8", primary_text: "#ffffff", accent: "#f59e0b", bg: "#ffffff", surface: "#f1f5f9", text: "#0f172a", text_secondary: "#475569", border: "#e2e8f0" } });
  await db.insert(s.fontSets).values({ siteId: sid, name: "Inter", isDefault: true, slots: { font1: { family: "Inter", weight: 800, role: "Headings" }, font2: { family: "Inter", weight: 400, role: "Body" } } });

  const [form] = await db.insert(s.forms).values({ siteId: sid, name: "Free quote", fields: [
    { key: "name", label: "Your name", type: "text", required: true, width: "half" }, { key: "phone", label: "Phone", type: "tel", required: true, width: "half" },
    { key: "email", label: "Email", type: "email" }, { key: "service", label: "What do you need?", type: "select", options: ["Website", "Advertising", "SEO", "Other"], required: true },
    { key: "message", label: "Anything else?", type: "textarea" }, { key: "consent", label: "I agree to be contacted about my enquiry.", type: "consent", required: true },
  ], settings: { successMessage: "Thank you — we will call you within one working day.", forwardEmails: [], webhooks: [], submitLabel: "Get my free quote" } }).returning();
  const [calc] = await db.insert(s.forms).values({ siteId: sid, name: "Loan repayment calculator", fields: [
    { key: "amount", label: "Loan amount (£)", type: "number", required: true, width: "third" }, { key: "rate", label: "Interest rate (%)", type: "number", required: true, width: "third" }, { key: "years", label: "Term (years)", type: "number", required: true, width: "third" },
    { key: "monthly", label: "Estimated monthly repayment", type: "calculated", formula: "round(pmt({rate}/100/12, {years}*12, {amount}), 2)", prefix: "£" },
    { key: "name", label: "Name", type: "text", required: true, width: "half" }, { key: "phone", label: "Phone", type: "tel", required: true, width: "half" },
  ], settings: { successMessage: "Thanks — an adviser will confirm your figures.", submitLabel: "Send me this quote" } }).returning();

  const [wa] = await db.insert(s.whatsappNumbers).values({ siteId: sid, name: "Sales", countryCode: "44", number: "7700900123", isDefault: true }).returning();
  const [waCta] = await db.insert(s.whatsappCtas).values({ siteId: sid, numberId: wa.id, name: "General enquiry", message: "Hi! I'd like to know more. I was looking at {page_url}" }).returning();
  const [call] = await db.insert(s.callCtas).values({ siteId: sid, name: "Main line", phone: "+44 20 7946 0000", isDefault: true, sourceRules: [{ type: "google_ads", phone: "+44 20 7946 0001" }] }).returning();
  const waButton = { label: "Chat on WhatsApp", type: "whatsapp", value: "447700900123", target: "_blank", wa_message: waCta.message };
  const callButton = { label: "Call us", type: "phone", value: call.phone, target: "_self", wa_message: "" };

  const [home] = await db.insert(s.pages).values({ siteId: sid, title: "Home", slug: "home", status: "published", isHome: true, seoTitle: "Demo Business — more enquiries from your website", seoDescription: "Websites, ads and follow-up that turn visitors into customers.", lastEditedBy: email, lastEditedRole: "admin" }).returning();
  const hero = { ...L("hero_split"), eyebrow: "Growth for small businesses", heading: "Turn website visitors into paying customers", subheading: "Landing pages, WhatsApp follow-up and ad tracking in one place.", bullets: ["Reply to every lead in minutes", "See which ads bring revenue"], primaryCta: { label: "Get a free quote", type: "form", value: form.id, target: "_self", wa_message: "" }, secondaryCta: waButton };
  await db.insert(s.sections).values([
    { siteId: sid, pageId: home.id, position: 0, layoutKey: "hero_split", content: hero },
    { siteId: sid, pageId: home.id, position: 1, layoutKey: "hero_split", content: { ...hero, heading: "Special offer for Google Ads visitors" }, audienceRule: { param: "utm_content", op: "equals", value: "offer-a" }, visible: true },
    { siteId: sid, pageId: home.id, position: 2, layoutKey: "stats", content: L("stats") },
    { siteId: sid, pageId: home.id, position: 3, layoutKey: "features_grid", content: L("features_grid") },
    { siteId: sid, pageId: home.id, position: 4, layoutKey: "steps", content: L("steps") },
    { siteId: sid, pageId: home.id, position: 5, layoutKey: "testimonials", content: L("testimonials") },
    { siteId: sid, pageId: home.id, position: 6, layoutKey: "faq", content: { ...L("faq"), items: [{ q: "How quickly will you reply?", a: "Within one working day, usually much sooner." }, { q: "Do you work outside the UK?", a: "Yes — we work with clients in the UK, Europe and India." }] } },
    { siteId: sid, pageId: home.id, position: 7, layoutKey: "form_embed", content: { ...L("form_embed"), formId: form.id } },
    { siteId: sid, pageId: home.id, position: 8, layoutKey: "cta_banner", content: { ...L("cta_banner"), primaryCta: waButton, secondaryCta: callButton } },
  ]);
  const [calcPage] = await db.insert(s.pages).values({ siteId: sid, title: "Loan calculator", slug: "loan-calculator", status: "published", seoDescription: "Work out your monthly repayment.", lastEditedBy: email, lastEditedRole: "admin" }).returning();
  await db.insert(s.sections).values({ siteId: sid, pageId: calcPage.id, position: 0, layoutKey: "form_embed", content: { ...L("form_embed"), heading: "Loan repayment calculator", text: "Enter your figures to see an estimate.", formId: calc.id } });
  await db.insert(s.menuItems).values([{ siteId: sid, label: "Home", href: "/", position: 0 }, { siteId: sid, label: "Loan calculator", href: "/loan-calculator", position: 1 }, { siteId: sid, label: "Book", href: "/book", position: 2 }, { siteId: sid, label: "Shop", href: "/shop", position: 3 }]);
  await db.insert(s.settings).values([
    { siteId: sid, key: "site.header", value: { enabled: true, logoLabel: "Demo Business", announcement: "Free website review this month", phone: call.phone, cta1: { label: "Get a quote", type: "form", value: form.id, target: "_self" } } },
    { siteId: sid, key: "site.menu", value: { sticky: true, design: "classic", blog: { enabled: true, label: "Blog" }, cta: { label: "", type: "url", value: "", target: "_self" } } },
    { siteId: sid, key: "site.footer", value: { brandText: "Websites and follow-up that bring in customers.", address: "1 Example Street\nLondon", phone: call.phone, email: "hello@example.com", social: [], legalLinks: [{ label: "Privacy policy", href: "/privacy" }], copyright: "" } },
    { siteId: sid, key: "site.floatingCta", value: { enabled: true, position: "right", whatsapp: { on: true, ctaId: waCta.id, bg: "#25D366" }, call: { on: true, ctaId: call.id, showNumber: false, bg: "#0f172a" }, form: { on: false, formId: "", bg: "#2563eb" } } },
    { siteId: sid, key: "whatsapp.connection", value: { wabaId: "100000000000001", phoneNumberId: "mock-phone-number-id", displayNumber: "+44 7700 900000", status: "connected", quality: "GREEN" } },
    { siteId: sid, key: "whatsapp.bot", value: { enabled: true, greeting: "Hi! Thanks for messaging Demo Business. How can we help?", fallback: "Thanks — a member of the team will reply shortly.", handoffWords: ["agent", "person", "human"], handoffReply: "Connecting you to the team now.", takeoverHours: 12, dailyCap: 300, hours: { on: false, start: "09:00", end: "18:00", days: ["mon", "tue", "wed", "thu", "fri"], tz: "Europe/London" } } },
  ]);
  const [tpl] = await db.insert(s.waTemplates).values({ siteId: sid, name: "enquiry_thanks", category: "UTILITY", status: "approved", components: { body: "Hi {{1}}, thanks for your enquiry. We will call you within one working day. Reply here if you have any questions.", footer: "Reply STOP to opt out" }, variableMap: { "1": "{{first_name|there}}" } }).returning();
  await db.insert(s.waAutomations).values({ siteId: sid, name: "Thank new web leads", trigger: "form_submitted", triggerValue: null, templateId: tpl.id, delayMinutes: 0, active: true, quietHours: null });
  await db.insert(s.waBotRules).values({ siteId: sid, name: "Prices", keywords: ["price", "cost", "how much"], replyText: "Our packages start from £499. Would you like a free quote? Just reply with your name.", priority: 1 });
  await db.insert(s.conversionSignals).values([{ siteId: sid, trigger: "stage", triggerValue: "Qualified", platform: "meta", eventName: "QualifiedLead", valueMinor: 0, currency: "GBP" }, { siteId: sid, trigger: "stage", triggerValue: "Won", platform: "google_ads_file", eventName: "Won", valueMinor: 150000, currency: "GBP" }]);
  await db.insert(s.chatWidgets).values({ siteId: sid, name: "Website assistant", active: true, config: { botName: "Ava", greeting: "Hi, I'm Ava. Ask me anything about our services.", instructions: "Be helpful and concise.", model: "auto", position: "right", themeColor: "#1d4ed8", collect: { name: true, email: true, phone: true }, handoff: {}, pageScope: { pageIds: [], urlRules: [] } } });
  const facts = ["Our website packages start from £499 and include hosting for the first year.", "We reply to every enquiry within one working day, Monday to Friday 9am to 6pm UK time.", "We work with small businesses in the UK, Europe and India, mainly in professional services, clinics and education."];
  const vecs = await embed(facts);
  await db.insert(s.knowledgeChunks).values(facts.map((t, i) => ({ siteId: sid, text: t, status: "approved", embedding: vecs[i], useFor: ["chatbot", "content"] })));
  const [svc] = await db.insert(s.appointmentServices).values({ siteId: sid, name: "Free 30-minute consultation", durationMinutes: 30, bufferMinutes: 10 }).returning();
  await db.insert(s.staff).values({ siteId: sid, name: "Alex", email: "alex@example.com", weeklyHours: { mon: [["09:00", "17:00"]], tue: [["09:00", "17:00"]], wed: [["09:00", "17:00"]], thu: [["09:00", "17:00"]], fri: [["09:00", "13:00"]] } });
  await db.insert(s.products).values({ siteId: sid, name: "Website health check", slug: "website-health-check", shortDescription: "A full review of your website with a prioritised action list.", priceMinor: 4900, compareAtMinor: 9900, currency: "GBP", stock: 100, status: "active", sku: "WHC-1" });
  await db.insert(s.blogPosts).values({ siteId: sid, title: "Five ways to get more enquiries from your website", slug: "more-enquiries", status: "published", publishedAt: new Date(), authorName: "Demo Business", metaDescription: "Simple changes that turn more visitors into leads.", html: "<p>Most websites lose enquiries in the same places. Here is how to fix them.</p><h2>1. Make the next step obvious</h2><p>Every page needs one clear button.</p><h2>2. Reply fast</h2><p>Leads go cold within hours. Use WhatsApp follow-up.</p>", faq: [{ q: "How long does this take?", a: "Most fixes take less than a day." }] });
  await db.insert(s.reviews).values({ siteId: sid, kind: "text", name: "Priya S.", rating: 5, text: "We doubled our enquiries in two months.", status: "approved", fields: { city: "Leicester" } });
  console.log(`✓ Seeded demo site "${site.name}" on ${domain} (service ${svc.id.slice(0, 6)}…, ${stages.length} stages)`);
  console.log(`  Admin: ${email} / ${process.env.ADMIN_PASSWORD ? "(from ADMIN_PASSWORD)" : password}  →  /admin/login`);
}

main().then(() => pool.end()).catch((e) => { console.error(e); pool.end(); process.exit(1); });
