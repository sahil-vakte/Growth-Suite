# Growth Suite — Product Scope & Rebuild Plan

Prepared by Claude for AB (Avrix Digital) · 21 November 2026
Source system audited: `angela.lipsindia.com` (admin access, read-only audit). Product name inside the system: **YAGOPS**.

> Status labels used in this document: **Confirmed** = seen directly in the system or its shipped documentation.
> **Inferred** = deduced from field names, migrations or network behaviour, not seen working. **New** = our own addition.

---

## 1. What the application is

YAGOPS is an **all-in-one "website + lead generation + marketing automation" platform for small and medium businesses**,
sold and operated by an agency (LipsIndia). It is built for the Indian market first (prices in ₹, Razorpay, Hindi
transcripts, +91 default) but is usable anywhere.

It has two halves (**Confirmed**):

| Half | What it is | Where it runs |
|---|---|---|
| **CMS ("client site")** | A PHP website builder and marketing admin installed **on each client's own domain/server**. Holds that client's pages, forms, leads, analytics and settings in its own MySQL database. | `client-domain.com/public/admin` |
| **AI Engine ("central brain")** | One central server run by the agency. Provides AI (Claude/OpenAI) with prepaid credits, the central CRM screens with single sign-on, WhatsApp Business sending/receiving through one shared Meta app, the scheduler that "ticks" every site, module licensing (signed statements), and software releases to every site. | `aiengine.lipsindia.com` |

So your instinct was right: it is installed on each customer's server and can then "handle most things" for that
customer — website, landing pages, lead capture, CRM, WhatsApp, social posting, ads tracking, SEO, AI content, shop,
appointments and more — while the agency controls AI credits, licences and updates centrally.

**Purpose (in revenue terms):** turn ad and organic traffic into leads, follow those leads up automatically
(WhatsApp, chatbot, calls), and feed real outcomes (qualified, enrolled, purchased) back to Meta and Google Ads so
ad spend optimises for revenue rather than form fills. The agency earns from setup, monthly fees, AI credits,
WhatsApp usage and paid add-on modules.

**Who uses it**
- **Agency/platform team** — installs sites, connects Meta assets, sells credits and modules, ships updates.
- **Business owner / admin** — full control of one site.
- **Editors / marketing staff** — pages, content, campaigns (admin-edited pages are locked to them).
- **Sales staff** — CRM only (leads, stages, notes, WhatsApp, calls).
- **Social executives / publishers / approvers** — social posting with an approval workflow.
- **Affiliate partners** — own portal to submit referrals and see commission (paid module).
- **AI assistants** — Claude/ChatGPT via an MCP connector with per-feature Off/Read/Write permissions.
- **Website visitors / customers** — see pages, popups, chat, forms, booking, shop, reviews.

---

## 2. Complete module inventory (all Confirmed unless marked)

### 2.1 Website & content
1. **Pages** — list with All/Published/Draft tabs, status filter, sort by last updated, last editor; create, duplicate,
   delete, publish/unpublish; drafts return 404 publicly but admins get a preview bar; pages last edited by an admin are
   locked for editors (editors duplicate instead); SEO title, description and JSON-LD schema per page; site-wide default
   theme and font set.
2. **Page Builder** — ordered sections per page; add, reorder, duplicate, hide, delete; structured editor for text,
   images (alt/title), videos and CTA buttons; every button can point at a URL, a form, a WhatsApp CTA or a call CTA;
   per-section theme/font/layout; **per-section audience rule** on URL parameters (e.g. show hero B only when
   `utm_content=offer-a`, remembered for the visit); copy/paste style JSON per page and per section.
3. **Sections library** — dozens of layout types (hero, accordion/FAQ, tabs, grid cards, icon cards, testimonials,
   pricing, comparison, sliders, video, bullets, CTA, galleries, process steps…). Layouts are installable **ZIP plug-ins**
   (`manifest.json`, `layout.php`, `install.sql`) that must follow 14 published *Layout Design Rules* (CTA object shape,
   image object shape, no hard-coded text, colour tokens, no external assets, accessibility, motion rules).
4. **AI layout generator** — describe or screenshot a section → AI produces an installable layout; preview, iterate,
   AI quality review, auto-fix, version history, Pending/Approved/Rejected.
5. **Common content** — save any section as a reusable template; insert into any page.
6. **Media library** — bulk upload with automatic WebP conversion, alt/title editing, public URL copy; PDF documents
   (≤25 MB).
7. **Favicon**.
8. **Content history** — automatic snapshot before every edit/delete, last 3 versions per item, who changed it (person
   or AI), filter edits/deletions, one-click restore (restore itself is undoable).
9. **Themes & fonts** — colour themes (JSON copy/paste, scan colours from layouts), font sets (Google Fonts or uploaded,
   up to 12 text roles), apply site-wide; **Brand Typography** guidelines file read by AI before designing.
10. **Menu, header, footer** — home page, nested links, mega-menu panels with icons, brand/logo, blog link, menu CTA,
    sticky option, full appearance controls; header layout with announcement strip, contact details and 2 CTAs; footer
    with brand text, address, contacts, social, sitemap and legal links.
11. **Blog** — posts with categories, pillar posts, focus keyword, meta description, FAQ, related posts, breadcrumbs,
    previous/next, BlogPosting/Breadcrumb/FAQ schema; `/blog` and `/blog/category/<slug>`; paste-to-HTML; rich editor.
    **AI blog writer**: two AI agents propose outlines → merge, pull "Google AI Mode" points, research questions, write
    with a chosen model; editable prompts with history/reset; runs as a background job; spends credits.

### 2.2 Lead capture
12. **Forms** — builder with field types, options, placeholders, column widths, conditional logic; **calculator mode**
    (formulas, prefix/suffix, live lookups); after-submit message or redirect; lead forwarding to verified emails and
    webhooks; optional **WhatsApp OTP**; test-form flag; embed code; **Form Designer** (templates, 13 colours, copy).
13. **Submissions** — by form/date, source page, CSV export (with ad-source columns), visitor journey per lead.
14. **Spam guard** — hidden honeypot field, minimum fill time, hourly limits per IP/phone/email, junk-text check; held
    entries create no lead, no WhatsApp, no ad conversion; restore or delete; master switch.
15. **WhatsApp click-to-chat** — multiple numbers; named CTAs with pre-written messages containing the page URL; buttons
    update everywhere when the CTA changes; click log. A reference code links the chat to the website visit.
16. **Click to Call** — default number + named call CTAs; click log; **dynamic number insertion** by source (Google Ads,
    Meta, utm_source, utm_medium, referrer, URL parameter), first matching rule wins, sticky for 30 days; data-layer event.
17. **Floating CTA bar** — WhatsApp / Call / Form buttons with position, colours and icons; WhatsApp chat card.
18. **Popups** — bottom banner or centre modal (bottom sheet on phones); image/colour background with tint; text layer;
    countdown (fixed end or per-visitor); button → form/WhatsApp/call/page/URL/download; delay; frequency
    (session/once/always); targeting with ALL/ANY conditions: URL, source, device, new/returning, paid traffic, UTMs,
    session count, time on page, scroll depth, **exit intent** (desktop cursor; mobile fast scroll-up; ignored first 3 s);
    audience segment; tracking of shown/closed/clicked.
19. **AI Chatbot** — multiple widgets (name, model, purpose, greeting, instructions, full look & feel, page scope and URL
    rules, knowledge filters, handoff to WhatsApp/phone/URL/form, collect name/email/phone); conversations with intent,
    lead score and status; **chats become CRM leads** (match phone, then email); training Q&A with CSV/Excel import and
    embeddings; reply templates; automation rules (score/intent/keyword/message count → action); intent groups with
    phrases and points.
20. **Appointments** — timezone, slot interval, minimum notice, booking window; services (duration, buffer, ₹ price);
    staff (email, phone, Google Calendar, weekly hours); linked booking form; bookings with status.

### 2.3 WhatsApp Business (official Cloud API)
21. **Connection** — site enters WhatsApp Business Account ID, fetches numbers, saves; live check with Meta. One shared
    platform Meta app; tokens stay on the central engine.
22. **Templates** — builder with live preview, text/media header, body, footer, buttons, variables with fallbacks,
    Meta rule checks, drafts, submit to Meta, sync status; map variables of external templates.
23. **Variables** — automatic lead/form/page variables + custom variables.
24. **Automations** — triggers: form submitted, new lead, stage change, keyword received, appointment booked, WhatsApp
    verified, lead score reached; send now or after a wait; conditions re-checked when due; quiet hours; skip if they
    replied; daily limit; once per person; STOP respected; on/off; run history.
25. **Campaigns** — one template to a filtered group (stage, source, form, dates, verified, replied), throttled per
    minute, audience preview, test send, confirmed head-count, pause/resume/cancel, delivered/read/replied stats.
26. **Bot auto-replies** — keyword answers (exact/contains), handoff to a human, greeting, no-answer, away message by
    working hours, media reply; up to 5 attachments per answer (image, document, video, voice, sticker, location,
    contact, reply buttons, list, link button, carousel); quiet period after human reply; daily cap; "try it" sandbox;
    activity log; answers can fire ad-platform signals.
27. **Website chat** — on-site chat window that hands over to WhatsApp, with targeting, triggers and styling.

### 2.4 Social publishing
28. **Accounts** — share Meta assets with the platform's partner business ID; connect a Facebook Page (verify via
    About-text code or team approval); linked Instagram account.
29. **Create post** — photo or MP4 video to Facebook and/or Instagram, live preview, chunked upload, caption tools,
    9:16 → Reel, partial-failure handling, uploaded files library.
30. **Schedule, calendar & queue** — schedule for later, month calendar, coming up, history, change time / post now /
    cancel / retry; not sent if more than 6 hours late.
31. **Roles & approval** — executive / publisher / approver (separate switch) / admin; send for approval with requested
    time; approve now / at requested time / other time / return with note; audit trail; "publishers need approval" rule;
    WhatsApp alerts to approvers.
32. **Settings** — default hashtags, UTM link tracking for own-site links.

### 2.5 CRM, audiences & ads
33. **CRM** — central CRM with SSO; leads from every channel; search, stage filter, duplicate badge, new-lead banner and
    sound; add one or bulk CSV with column mapping; duplicates blocked by phone (never email); WhatsApp Ref code linking;
    lead detail with all fields, all submissions, ad source, visitor journey (multi-device), stage selector, timeline
    (notes, calls, WhatsApp, stage changes), voice-typed notes in 9 languages, WhatsApp verification, call recordings;
    editable stages (cannot delete a stage that still has leads); reply templates with `{{name}}`; push notifications;
    installable PWA. *Gap in original: no lead owner/assignment, score not shown.*
34. **Attribution** — first-touch UTMs, GCLID/GBRAID/WBRAID/FBCLID, Meta campaign/ad set, landing page, referrer, device,
    browser, GA client/session IDs, Meta fbp/fbc; click IDs kept from any visit in the last 90 days; never overwritten;
    own visitor cookie used to fill gaps across devices.
35. **Lead scoring** — points per signal per channel; platform defaults; unified score.
36. **Audience segments** — behaviour/CRM conditions with AND/OR groups, live count, funnel stage, look-back, refresh;
    push to Meta (event → Website Custom Audience) and Google (GTM event → GA4 audience); Google Customer Match file.
37. **Conversion signals** — rules "lead reaches stage X → send event Y with ₹ value" to Meta CAPI and/or GA4/Google Ads;
    also on appointment booked, WhatsApp verified, score reached, bot answer; SHA-256 hashed email/phone/name; once per
    lead per rule; queued with retries; test mode.
38. **Google Ads offline conversions** — via scheduled private CSV fetched by Google Ads Data Manager (password
    protected, time-zone offsets), log, 7-day counts, self-ticking setup checklist.
39. **Meta Pixel & CAPI** — pixel ID, token, test code, action→event mapping, browser/server deduplication health,
    exclusions (test pages and phone numbers). **Facebook Lead Ads** webhook, form mapping, fetch missed leads.
40. **GTM** — container ID and one-click export of a ready-made GTM container for all conversion events.
41. **Analytics** — users, sessions, conversions, conversion rate; device and source/medium performance; conversions by
    type (form/call/WhatsApp); top pages with scroll depth; event breakdown; audience reports; saved read-only SQL reports.

### 2.6 Social proof, engagement & commerce
42. **Live Audio testimonials** — share links, guided voice recording, custom fields, transcripts (original, English,
    Hindi), rating, approve/reject, display order.
43. **Live Reviews** — written reviews by link with custom fields and moderation.
44. **Video sessions** — video calls with guest link, linked to a lead, usage and video credits.
45. **Shop** — products (₹ price, compare-at, SKU, stock, status, images); orders with buyer, amount, status, payment ID.

### 2.7 SEO
46. **Off-page** — QnA Finder (search Quora/Reddit etc. since a date with own search API keys), Instagram search.
47. **On-page** — URLs & titles overview, redirects with hit counts, robots.txt editor with preset, XML sitemap, one-click
    image optimisation.

### 2.8 AI & knowledge
48. **Knowledge Brain** — mandatory business context, knowledge brief, add from files/URLs/text, AI Vision for scans,
    extracted chunks with approval and embeddings, categories (Business Info, Competitor, Market Intel, Q&A).
49. **Business Interview** — private 14-day link; owner answers by typing or voice, one question at a time, attachments.
50. **Generate content & Output library** — FAQs, USPs, ad copy, sections, sales story, emails; statuses; reuse.
51. **Market trends & Q&A generator** — AI research questions, recent web search, findings approved into knowledge.
52. **AI Page Builder** — writes every section of a page from keyword, tone, goal and an uploaded brochure.
53. **AI Setup & credits** — engine connection, system checks, credit balance per provider, buy credits with Razorpay.

### 2.9 Platform & administration
54. **Users** — role (admin/editor), status, CRM access (inherit/allow/deny), AI-assistant access, social level and
    approve switch, last login.
55. **AI assistant connector (MCP)** — ~220 tools in 26 feature groups, Off/Read/Write per group, OAuth client ID/secret,
    rotate/deactivate, optional "require admin sign-in to approve", no delete tools, read-only SQL for analytics,
    AI-added knowledge waits for human approval.
56. **Modules (licensing)** — paid add-ons unlocked per domain until an end date; signed statement from the engine;
    checked twice a day; 14-day offline grace; nothing deleted on expiry.
57. **Affiliates (paid module)** — partners, one-time password links, self-registration with OTP, referrals with deal
    value and owner change, commission rules (percentage/fixed, windows, hold days, minimum payout) versioned as
    published terms, approvals, payouts with four-eyes "mark paid", partner portal.
58. **Updates & installers** — database migrations, build a release on the master site, apply on client sites; layout
    and menu pack installers (ZIP).
59. **Product documentation** — Feature Map, MCP Coverage, Retargeting Guide, CRM Review, WhatsApp Guide, Layout Rules,
    AI skill kits.
60. **Web scraper** — scrape URLs, download history.

### 2.10 Technology observed (Confirmed/Inferred)
nginx 1.25 · PHP (server-rendered admin, `.php` endpoints) · MySQL (utf8mb4) · 244 migrations · signed HMAC-style
requests between CMS and engine (**Inferred** algorithm) · PWA CRM · Meta Graph/Cloud API · GA4 Measurement Protocol ·
Google Ads Data Manager file import · Razorpay · Google Calendar · Google Fonts · Claude & OpenAI.

---

## 3. Scale — how many users to plan for

The audited install is a small demo site (7 pages, 2 admins, 2 forms). Real scale comes from the business model:
**one platform serving many client businesses.** We plan for:

| Horizon | Client sites | Staff users | Leads stored | Tracked events / month | WhatsApp messages / month |
|---|---|---|---|---|---|
| Launch (0–6 months) | 10–50 | 50–250 | 50k | 5M | 100k |
| Year 1 | 200–500 | 1–2.5k | 1M | 100M | 2M |
| Year 3 | 2k–5k | 10–25k | 20M | 2B | 40M |

Peak load is driven by **public traffic** (page views, tracking events, form posts) rather than admin users —
roughly 50–200 requests/second per 1,000 sites at peak, burstier during ad campaigns. Admin traffic is small.

**Design decisions this drives (New):**
1. **One multi-tenant platform instead of one install per client.** Every record carries a `siteId`; sites are
   resolved by domain. This removes per-server updates, licence checks and "apply updates" entirely. A
   **self-host mode** (single site) is kept for clients who insist on their own server.
2. **Stateless Next.js app servers** behind a load balancer/CDN — scale horizontally.
3. **PostgreSQL** with row-level tenant scoping, composite indexes on `(siteId, createdAt)`; analytics events in a
   partitioned table (monthly partitions), later moved to ClickHouse/BigQuery at ~1B rows.
4. **Background job queue** (Postgres-backed now, Redis/SQS later) for WhatsApp sends, automations, conversions,
   social posts, AI jobs — with retries, back-off and idempotency keys.
5. **Object storage** (S3/R2) + CDN for media.
6. **Provider adapters** for every third party with a mock mode, so the system runs and tests without credentials.

---

## 4. Going global (New)
- **Languages:** admin UI strings in message catalogues (English UK first; Hindi, Arabic later; RTL-ready CSS).
- **Currencies:** every money field stored as integer minor units + ISO currency (original is ₹-only).
- **Payments:** Razorpay (India) and Stripe (rest of world) behind one adapter.
- **Time zones:** UTC storage; site time zone + user time zone for display, scheduling, quiet hours.
- **Phone numbers:** E.164 storage; duplicate detection on normalised number (original uses last 10 digits, which
  breaks outside India).
- **Data protection:** GDPR/UK GDPR, India DPDP Act 2023, US state laws — consent banner, consent stored per lead,
  data export and erasure per lead, data-processing agreement, data residency option (EU/IN/US region).
- **Messaging rules:** WhatsApp opt-in records, STOP handling, quiet hours per recipient time zone, TCPA/PECR caution
  for calls and SMS.

## 5. Security & compliance (New, beyond original)
Hashed passwords (bcrypt), signed session cookies (HttpOnly, Secure, SameSite), CSRF protection on mutations,
role- and permission-based access per module, audit log of every admin action, rate limiting on public endpoints,
encrypted third-party tokens at rest (AES-256-GCM), secret rotation, two-factor authentication (roadmap Phase 2),
SSO/SAML for agencies (Phase 4), daily backups with point-in-time recovery, separate staging and production.

## 6. Improvements over the original (New)
- Lead **owner/assignment** and round-robin routing; lead score shown in the CRM (both missing in original).
- Email marketing channel (original has none beyond forwarding).
- Proper multi-currency/multi-country support.
- One platform, zero per-site updates.
- Unified inbox for WhatsApp, chat and email (original has no WhatsApp chat screen in the CRM).
- Customer-list sync to Meta (not built in original).

## 7. Roadmap

| Phase | Weeks | Contents | Outcome |
|---|---|---|---|
| **1 — Core (MVP)** | 1–8 | Multi-tenant base, auth & roles, pages & section builder, themes, menu/header/footer, forms + spam guard, leads/CRM with stages and timeline, attribution & tracking, WhatsApp/call CTAs, floating CTA, popups, analytics basics, SEO on-page, media | Sell to first 10 clients |
| **2 — Automation** | 9–16 | WhatsApp Business (templates, automations, campaigns, bot), conversion signals (Meta CAPI, GA4), lead scoring, audiences, appointments, chatbot v1, 2FA | Revenue features that justify monthly fee |
| **3 — AI** | 17–24 | Knowledge Brain, AI blog writer, content generator, AI page builder, chatbot with knowledge, credits & billing, MCP connector | AI credits revenue stream |
| **4 — Growth** | 25–36 | Social posting with approvals, shop & payments, affiliates, live reviews/audio, video sessions, SEO off-page, Google Ads offline file, agency (white-label) console, SSO | Agency resale & enterprise |
| **5 — Scale** | 37+ | Analytics warehouse, regions, mobile apps, marketplace for layouts | 1,000+ sites |

**What this delivery contains:** the Phase 1 core, plus most of Phases 2–4 at engine, API and admin level. `docs/BUILD-REPORT.md` lists, feature by feature, what is done and tested, what works in mock mode only, and what is still to build. `docs/TEST-REPORT.md` has the latest test run.

## 8. Risks & open questions
- Meta WhatsApp/Business verification takes days and needs a verified business; plan this first.
- Google Ads offline import requires the conversion actions to exist before data is sent.
- AI costs must be metered per site from day one (credits ledger is included).
- Legal: build our own layouts, copy and branding; do not reuse YAGOPS code, documents or design assets.
