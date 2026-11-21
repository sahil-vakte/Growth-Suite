# Build report — what is in this delivery

Local setup verified on 21 November 2026: dependencies installed, private `.env`
configured, PostgreSQL migrated and seeded, production app and worker started.
CLI database/worker/smoke commands now load `.env`. Typecheck, 37 unit tests,
production build and 45 smoke checks passed. See `LOCAL-SETUP.md` for restart
instructions and the outstanding dependency audit findings.

Delivered 21 November 2026, updated after batch 1 the same day. Status labels:
- **Done** — built, and covered by the automated end-to-end test (`npm run test:smoke`) and/or unit tests.
- **Built** — built and working in mock mode; not yet exercised against the live provider or in a real browser test.
- **Partial** — the data model and API exist, but part of the feature (usually UI polish or one sub-flow) is missing.
- **Not built** — on the roadmap; listed so nothing is assumed.

Live-provider testing (real WhatsApp, Meta, Google, payments, AI) is the next step and needs the credentials in `docs/INTEGRATIONS.pdf`.

## Platform

| Area | Status | Notes |
|---|---|---|
| Multi-tenant sites (domain → site), platform admin “client sites” screen | Done | Unknown domains get 404; `SINGLE_SITE_MODE=true` for one-site self-hosting |
| Auth: sessions (HttpOnly, SameSite), bcrypt, login throttling, session revocation | Done | |
| Roles: admin / editor / sales; CRM access; social levels; AI-assistant access | Done | Editors cannot edit pages last edited by an admin |
| CSRF origin check, security headers, input validation (zod) | Done | |
| Encrypted secrets (AES-256-GCM), masked in admin | Done | |
| Audit log, content history (last 3 versions), restore | Done | |
| Postgres job queue + scheduler (`/api/cron/tick`, `npm run worker`) | Done | |
| Module licences (Ed25519, 14-day grace) | Built | Off unless `LICENCE_PUBLIC_KEY` is set |
| Rate limiting | Built | Per instance (memory); use Redis/edge limits at multi-instance scale |
| Password reset by email (single-use, 1-hour link) and change-my-password | Done | Resetting signs out every other session |
| Two-factor authentication, SSO | Not built | Roadmap phase 2 / 4 |
| Admin UI translations (i18n) | Not built | UI is British English |

## Website & content

| Area | Status | Notes |
|---|---|---|
| Pages: draft/published/archived, home page, SEO title/description, JSON-LD | Done | Drafts are 404 to the public, preview bar for admins |
| Page builder: add, reorder, duplicate, hide, delete, CTA picker, image fields | Done | |
| Per-section audience rule on URL parameters (remembered per visit) | Done | |
| 18 built-in section layouts (hero, features, steps, stats, testimonials, live reviews, FAQ + schema, pricing, CTA banner, form, gallery, video facade, logos, contact, latest blogs, products) | Done | |
| Common content (section templates) | Done | |
| Themes & font sets (Google Fonts), site-wide design | Built | |
| Menu, header, footer, announcement strip | Built | Mega-menu panels not built |
| Blog: posts, categories, pillar, FAQ, related, prev/next, schema, /blog routes | Done | |
| Media library: upload with content checks, automatic WebP in 3 sizes with srcset, media picker in the page builder; S3/R2 storage | Done | |
| Redirects with hit counts, robots.txt, XML sitemap | Done / Built | |
| AI layout generator (prompt/screenshot → layout), layout ZIP installers | Not built | New layouts are added in code (`src/lib/layouts`) — safer than uploading executable templates |

## Lead capture

| Area | Status | Notes |
|---|---|---|
| Visual form builder (fields, options, conditions, calculator with live formula test, after-submit settings) with server-side validation | Done | Colour/template form designer still to build |
| Spam guard (honeypot, timer, rate limits, junk text), held entries, restore as lead | Done | |
| Lead forwarding by email and webhook (SSRF-protected) | Built | |
| WhatsApp numbers & CTAs, click logging, Ref codes linking chats to visits | Done | |
| Click to call with dynamic number by source (sticky 30 days) | Built | Engine unit-tested; swap happens in the browser |
| Floating contact bar | Built | |
| Popups: centre/banner, countdown, ALL/ANY targeting, exit intent, frequency, segments | Built | Engine unit-tested; not browser-automated |
| AI chatbot: knowledge retrieval, intent scoring, chats → leads, automation rules | Done | CSV/Excel bulk import of training pairs not built |
| Appointments: services, staff hours, slots in site time zone, booking, no double booking | Done | Google Calendar sync not built |
| WhatsApp OTP verification on forms | Not built | Setting exists in form settings |

## CRM, attribution & ads

| Area | Status | Notes |
|---|---|---|
| Leads: search, stage filter, source filter, add, CSV import with mapping, duplicate by phone (E.164) | Done | |
| Lead detail: timeline, notes, call log, WhatsApp, journey, submissions, ad source, conversions | Done | |
| First-touch attribution (UTMs, click IDs within 90 days, landing page, device) | Done | |
| Lead scoring (platform defaults + site rules) | Done | Score shown in list |
| Lead owner, round-robin assignment, My leads / Unassigned filters, owner column | Done | |
| Pipeline board (drag a lead to another stage) | Done | |
| Lead filters (owner, date, score) and lead CSV export | Done | Campaign/ad group/keyword filter screen still to build |
| Conversion signals → Meta CAPI (hashed, with Facebook lead_id for lead-form leads), GA4 Measurement Protocol, Google Ads file | Done (Meta mock) / Built | |
| Google Ads offline CSV (password-protected, time-zone offsets) | Built | |
| GTM container export | Done | |
| Audiences: segment builder, rebuild, used by popups | Built | Pushing segment events to Meta/Google and Customer Match upload not built |
| Facebook Lead Ads webhook → CRM | Built | |
| GDPR: subject-access export, erasure | Done | Consent captured from consent fields |
| Push notifications / installable CRM app, voice notes, call recordings | Not built | New-lead banner uses polling |

## WhatsApp Business

| Area | Status | Notes |
|---|---|---|
| Connect account (fetch numbers, live check) | Built | |
| Templates: create, Meta rule checks, submit | Built | Media headers not built |
| Automations: triggers, delays, quiet hours, re-checked conditions, caps, once per person, STOP | Done | |
| Campaigns: audience filters, preview, throttled sending, pause/cancel, stats | Built | Test-send to own number not built |
| Auto-reply bot: keywords, greeting, fallback, away hours, handoff, takeover pause, daily cap, try-it | Done | Rich attachments (buttons, lists, media) stored but sent as text only |
| Inbound webhook (signature-verified), status updates, STOP opt-out | Done | |
| Staff replies (template any time, free text within 24 h) | Built | |
| Website chat window that opens WhatsApp | Partial | Floating WhatsApp button only |

## Social, AI, proof, shop, affiliates

| Area | Status | Notes |
|---|---|---|
| Social posting: accounts with verification code, drafts, approval workflow, roles, scheduling, 6-hour lateness rule, UTM tagging, hashtags | Built | Publishing uses image URL/text; chunked video upload, Reels, image padding and WhatsApp approval alerts not built |
| Knowledge Brain: add text/URL, chunks wait for approval, embeddings | Built | File/PDF upload with AI Vision not built |
| Business interview link (typing + voice in Chrome/Edge) | Built | |
| AI studio: credits ledger, buy credits (credited only after the payment webhook confirms), content generator, blog writer, AI page builder | Built | Runs in mock mode until an AI key is added |
| Market trends tool, Q&A generator screens | Not built | QnA finder via search API is built |
| Reviews: share links, moderation, live reviews section | Done | Voice testimonials with transcription not built |
| Video sessions (Daily or Jitsi link) | Built | |
| Shop: products, checkout (Razorpay/Stripe/mock), webhooks, stock, buyer → lead | Done (mock) | Basket for multiple products: API supports it, UI buys one product |
| Affiliates: partners, referrals, commissions, payouts (four-eyes), versioned terms | Partial | Admin side only; partner portal and automatic commission on conversion not built |
| AI assistant connector (MCP): 22 tools, Off/Read/Write per area, no delete tools | Done | OAuth client-credentials only; Claude.ai/ChatGPT custom connectors may need the full OAuth authorisation-code flow (roadmap) |

## Where to start reading the code
- Business rules: `src/lib/engines/*` (pure functions, unit-tested)
- Lead pipeline: `src/lib/services/leads.ts`, `forms.ts`, `whatsapp.ts`, `conversions.ts`, `scheduler.ts`
- Admin resources (one definition drives list, form, validation, API): `src/lib/admin/resources.ts`
- Data model: `src/db/schema.ts`

## Task 0.1 ? browser regression suite

Done: headless Chromium covers login, page-builder add/edit/reorder/publish,
public form and CRM capture, popup dismissal, chat, booking, lead notes/stages,
and social submit/return/approve. Playwright has CI-safe serial execution, retries
and failure traces. No schema changes. Typecheck, 37 unit tests, migrations/seed,
build, 45 smoke checks and 8 browser tests passed.

## Tasks 0.2 / 0.3 ? automated checks

0.3 Done: ESLint and Prettier configured, source formatted and lint findings fixed.
Typecheck, lint (zero warnings), formatting, 37 unit tests, migrations/seed,
production build, 45 smoke checks and 8 browser tests pass locally.
0.2 Built: GitHub Actions runs the full sequence with isolated PostgreSQL and mock
integrations on pull requests and main pushes. Hosted run and required-check
enforcement are being verified; not marked complete yet. No schema changes.

0.2 verified: GitHub Actions run 44869048837 passed on Ubuntu/PostgreSQL 16.
The Verify application status check is required on main, including administrators.

## Shared UI foundation

Implemented: refreshed login, dashboard cards, searchable/collapsible navigation,
compact mobile menu, shared form/table styling, responsive builder columns,
keyboard-accessible resource rows and focus-managed editing drawers. Public
controls retain tenant colours with clearer focus and touch targets. Desktop and
mobile screenshots reviewed. Typecheck, lint, build, 37 unit tests, 45 smoke checks
and 10 browser tests passed. Feature-specific UI work remains in the roadmap.

## Task 0.4 ? shared rate limiting

Built: atomic Redis sliding windows across login, forms, chat, tracking, MCP token
and existing protected routes; bounded memory fallback when REDIS_URL is blank.
Keys use HMAC; Redis outages fail closed; operations have timeouts. No migration.
Local: 40 unit tests passed, one Redis integration test skipped because no local
Redis is configured. Hosted CI runs that test with two competing Node processes.
Typecheck, lint, formatting, production build and 45 smoke checks passed.
