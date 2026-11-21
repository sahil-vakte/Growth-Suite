# Growth Suite — pending work & master prompt for Codex

This file has two parts:
1. **Pending work**: everything still to build before Growth Suite is a complete application, grouped into epics with acceptance criteria.
2. **Master prompt**: the instructions a coding agent (Codex, Claude Code, etc.) must follow while building it.

Codex reads `AGENTS.md` from the repository root automatically. You can also paste Part 2 into any coding agent with "Build epic X from AGENTS.md".

Background reading in this repo: `docs/SCOPE.md` (full product scope), `docs/BUILD-REPORT.md` (status per feature), `docs/TEST-REPORT.md` (last test run), `docs/audit/` (notes from the original system).

---

# PART 1 — Pending work

**Batch 1 completed (21 Nov 2026):** 0.7, 1.1, 1.2, 2.1, 3.1, 3.2, 6.7 are done and tested. 3.3 is partly done (owner, date and score filters and lead CSV export; campaign/ad group/keyword filters still to do). 3.10 is partly done (Facebook lead_id is sent; a Lead event for manually added leads is still to do). Rows marked ✅ below.

Priority: **P1** = needed for the first paying clients · **P2** = needed within 3 months · **P3** = growth / later.
Size: S (< 1 day) · M (1–3 days) · L (3–7 days) · XL (1–2 weeks).

## Epic 0 — Production hardening (P1)

| # | Task | Size | Done when |
|---|---|---|---|
| 0.1 ? | Browser end-to-end tests with Playwright for: login, page builder (add/edit/reorder/publish), form submit on the public site, popup shows and closes, chat widget conversation, booking flow, CRM lead detail, social approval flow | L | `npm run test:e2e` runs headless in CI and passes |
| 0.2 | CI pipeline (GitHub Actions): install, typecheck, lint, unit tests, build, start Postgres service, migrate, seed, smoke test, Playwright | M | Every PR runs the full pipeline; failures block merge |
| 0.3 | ESLint + Prettier config and fix all warnings | S | `npm run lint` clean |
| 0.4 | Shared rate limiting (Redis/Upstash adapter with in-memory fallback) for login, public forms, chat, track, MCP token | M | Limits hold across 2+ app instances (test with two processes) |
| 0.5 | Structured logging (pino) with request IDs; error tracking adapter (Sentry, optional via `SENTRY_DSN`) | M | Every API error is logged with site ID, route, request ID; no personal data in logs |
| 0.6 | Analytics events table partitioned by month (or retention job deleting raw events after N months, configurable) | M | Migration + job; queries unchanged |
| 0.7 ✅ | Password reset by email (token, 1-hour expiry, single use) and "change my password" screen | M | Flow tested; old sessions revoked after reset |
| 0.8 | Two-factor authentication (TOTP) for admin users, enforceable per site | L | Admin can require 2FA; recovery codes; tested |
| 0.9 | Content-Security-Policy header with nonces for inline scripts (GTM, JSON-LD) | M | CSP active in production without breaking GTM or the site runtime |
| 0.10 | Backups & restore runbook in `docs/OPERATIONS.md` (database, storage, ENCRYPTION_KEY) | S | Document exists and restore is rehearsed once |

## Epic 1 — Website & content (P1–P2)

| # | Task | Size | Done when |
|---|---|---|---|
| 1.1 ✅ | Image optimisation on upload: convert JPEG/PNG to WebP (sharp), keep original, store width/height, generate 3 responsive sizes; `srcset` in section images | M | Uploading a PNG produces WebP variants; Lighthouse image audit passes |
| 1.2 ✅ | Media picker modal in page builder (choose from library or upload) instead of pasting URLs | M | Image fields open the picker; alt text editable inline |
| 1.3 | Rich-text editor for blog posts and product descriptions (TipTap), output passed through `sanitizeHtml` | M | Headings, lists, links, images, tables; paste-cleaning |
| 1.4 | Mega-menu panels and icon menu design; drag-and-drop menu ordering with nesting | M | Menu screen supports nested drag-and-drop; mega panel renders on desktop and collapses on mobile |
| 1.5 | Header/footer layout choices (3 header designs, 3 footer designs) selectable in settings | M | Switching design changes the public site without code |
| 1.6 | Live page preview inside the builder (iframe of the draft page, refresh on save) | M | Editor shows preview side by side |
| 1.7 | **Declarative layout packs** instead of PHP-style code upload: a layout = JSON schema + a small set of composable React block primitives; install/uninstall via ZIP containing `manifest.json` + `schema.json` + `default.json` (no executable code) | XL | A new layout can be installed from a ZIP and used in the builder; ZIPs with code are rejected |
| 1.8 | AI layout generator: prompt or screenshot → a declarative layout pack (1.7), preview, iterate, AI quality review, versions, Pending/Approved/Rejected | XL | Generates installable packs; uses credits; mock mode returns a sample pack |
| 1.9 | Page/section style JSON copy-paste UI and per-section theme/font override pickers | S | Buttons in builder; values validated |
| 1.10 | Multi-language pages (per-site locales, translated page variants, `hreflang`) | L | A page can have EN and HI versions; correct hreflang tags |

## Epic 2 — Lead capture (P1–P2)

| # | Task | Size | Done when |
|---|---|---|---|
| 2.1 ✅ | Visual form builder (drag fields, edit properties, conditional rules, calculator formula editor with test values) replacing raw JSON | L | Non-technical user can build the seeded calculator form without JSON |
| 2.2 | Form designer: templates, 13 colour tokens, font set, eyebrow/headline/subhead/button label, copy/paste colours JSON | M | Design applies on public site |
| 2.3 | WhatsApp OTP verification on forms (authentication template; code entry step; `waVerified` set; `wa_verified` event emitted) | M | With `waOtp: true` a lead is only created after the correct code; mock mode shows the code in logs |
| 2.4 | Popup editor UI (visual condition builder instead of JSON; live preview of centre/banner) | M | All targeting conditions editable without JSON |
| 2.5 | Chatbot: CSV/Excel bulk import of training Q&A with column mapping; conversations screen (list, transcript, intent, score, CRM link); "Create leads from past chats" backfill button | M | Import 500 rows; conversations visible |
| 2.6 | Chatbot widget look & feel settings UI (colours, avatar, launcher images, panel width, radius, page scope rules) | M | All widget config editable in a form |
| 2.7 | Website chat window that hands over to WhatsApp (separate widget type: greeting, picture, corner, open triggers, snooze, URL-parameter targeting) | M | Visitor message opens WhatsApp with text + Ref code |
| 2.8 | Appointments: Google Calendar sync (service account or OAuth) — busy times block slots, bookings create events; booking confirmation + reminder emails/WhatsApp; customer cancel/reschedule link | L | Event appears in staff calendar; reminder sent 24h before |
| 2.9 | Appointment booking form builder link (extra questions on booking) | S | Extra fields saved on booking and lead |

## Epic 3 — CRM, audiences & ads (P1–P2)

| # | Task | Size | Done when |
|---|---|---|---|
| 3.1 ✅ | Lead owner assignment UI + round-robin auto-assignment rule + "My leads" filter | M | Assign from list and detail; round-robin tested |
| 3.2 ✅ | Kanban pipeline view (drag lead between stages → `changeStage`) | M | Drag triggers same events as dropdown |
| 3.3 ◐ | Lead list filters by campaign, ad group, keyword, date range, score; saved views; CSV export of leads | M | Filters combine; export respects filters |
| 3.4 | Google Ads ad-source enrichment (campaign/ad group/ad/keyword from ValueTrack URL parameters captured at landing) and "Ad source" card; backfill tool for older leads | M | Card shows values for a test click with ValueTrack params |
| 3.5 | Real-time new-lead notifications: web push (VAPID) + installable PWA for CRM (manifest, service worker, offline page) | L | Push received with browser closed |
| 3.6 | Notes by voice (Web Speech API, language selector incl. Hindi, Gujarati, Tamil…) | S | Dictation inserts text in note box |
| 3.7 | Calling provider integration (adapter: Twilio/Exotel) — click-to-call bridge, call logs, recordings attached to lead | L | Mock + one real adapter; recording plays on lead |
| 3.8 | Audience push: Meta (custom event on segment entry for Website Custom Audience), Google (dataLayer event while member → GA4 audience) | M | Events visible in Meta Test Events / GTM preview |
| 3.9 | Customer list sync: Meta custom audiences (hashed, adds & removals) and Google Customer Match daily file | L | Mock + live adapters; removals handled |
| 3.10 ◐ | Send Facebook `lead_id` for lead-ad leads in CAPI user_data; send `Lead` event for manually added leads | S | Payload unit-tested |
| 3.11 | Saved reports: report builder (dimensions, metrics, filters, date range) over analytics & leads — no raw SQL from users | L | Save, run, export CSV |
| 3.12 | Facebook Lead Ads: "Fetch missed leads now" (pull last 90 days per mapped form) and form mapping UI | M | Missing leads recovered without duplicates |
| 3.13 | Visual segment builder (condition groups UI instead of JSON) with live count | M | Count updates as conditions change |

## Epic 4 — WhatsApp Business (P1–P2)

| # | Task | Size | Done when |
|---|---|---|---|
| 4.1 | Template builder UI: header (text/image/video/document), body with variable chips, footer, buttons (quick reply, URL, phone), live phone preview, variable mapping with fallbacks, sync status from Meta | L | Build, check, submit, see status update via webhook |
| 4.2 | Rich bot replies: send attachments (image, document, video, audio, location, contact), reply buttons (max 3), list messages (max 10), link button, carousel | L | Each type sends correctly (mock payload unit-tested; live test on a number) |
| 4.3 | Campaign test-send to own number; confirmed head-count step; delivered/read/replied stats from status webhooks | M | Stats update from webhook events |
| 4.4 | Unified inbox in CRM: conversation list, unread counts, reply box (24-hour window rules), templates, assign to user | L | Two staff can work the inbox; handoff pauses bot |
| 4.5 | Meta Embedded Signup (client connects their WhatsApp account inside the app) | L | New client connects without manual partner sharing |
| 4.6 | Message pricing/credit charge per sent WhatsApp message (deduct from site credits; block when empty, with warning) | M | Ledger entries per message |

## Epic 5 — Social posting (P2)

| # | Task | Size | Done when |
|---|---|---|---|
| 5.1 | Composer UI like Meta's: account picker, media upload (photo JPEG/PNG/WebP, MP4 video with chunked/resumable upload), caption with emoji picker and "insert link/phone/WhatsApp", character counter, live FB/IG preview | XL | Executive can create a post with a 200 MB video |
| 5.2 | Instagram rules: 9:16 video → Reel; non-supported aspect ratios padded onto a canvas (never cropped); container status polling until published | L | Posts publish to both; partial failure handled |
| 5.3 | Calendar & queue: month calendar, coming up, history, change time, post now, cancel, retry | M | All actions respect role permissions |
| 5.4 | WhatsApp alerts to approvers and writers (templates, retries ×3, drop after 24h) | M | Alert sent on submit/approve/return |
| 5.5 | Uploaded files library with "delete files already posted" | S | Files in use cannot be deleted |
| 5.6 | MCP tools: social drafts (as executive only, send for approval) | S | Assistant cannot publish |

## Epic 6 — AI & knowledge (P2)

| # | Task | Size | Done when |
|---|---|---|---|
| 6.1 | Knowledge upload from files (PDF, DOCX, XLSX, TXT, images) with text extraction; AI Vision for scanned PDFs/images | L | Chunks created, waiting for approval |
| 6.2 | Knowledge brief + business context editor (summary, location, tags; "generate with AI") | S | Used in every AI prompt |
| 6.3 | Market Trends tool: AI research questions → web search last 30–120 days → findings → approve → embed | L | Findings saved as knowledge + output |
| 6.4 | Q&A Generator screen: topic + location → real questions (Quora/Reddit via search) → answer → approve → embed | M | Q&A pairs feed chatbot |
| 6.5 | Blog AI writer v2: two-agent outlines + merge, "Google AI Mode" points step, editable prompts with history/undo/reset, background job with progress | L | Refreshing the page keeps progress |
| 6.6 | Vector search at scale: pgvector column + index instead of JSON embeddings | M | Retrieval < 100 ms with 50k chunks |
| 6.7 ✅ | Credit purchase completion: Razorpay/Stripe webhook adds credits (currently only mock adds instantly) | S | Paid top-up appears in ledger once |
| 6.8 | Business interview: attachments (≤10 MB), conversation mode (reads question aloud, "done" to save), editable question list, answers → "Send to Knowledge" | M | End-to-end on Chrome |

## Epic 7 — Social proof, video, shop (P2)

| # | Task | Size | Done when |
|---|---|---|---|
| 7.1 | Voice testimonials: record in browser (MediaRecorder), upload, transcribe (OpenAI Whisper adapter) in original language + English + Hindi, rating, approve, display order, audio testimonial section layout | L | Recorded review plays on site with transcript |
| 7.2 | Video sessions: link to lead, usage minutes from provider webhook, buy video credits | M | Minutes recorded |
| 7.3 | Shop basket (multiple products), coupon codes, order emails, refunds via provider API, order detail screen | L | Multi-item order paid and refunded in test mode |

## Epic 8 — Affiliates module (P3)

| # | Task | Size | Done when |
|---|---|---|---|
| 8.1 | Partner portal: `/partner/login`, register (closed / approval / open), OTP by WhatsApp or email, password reset, dashboard (links, referrals with masked names, earnings, rules in plain words), add a lead | XL | Partner can sign up, share link, see referral |
| 8.2 | Referral capture: `?ref=CODE` cookie (window from terms) → lead gets "Referred by" card | M | Attribution respects window |
| 8.3 | Automatic commission on conversion stage using terms version in force at referral time; hold days; approve/reject; payouts built from approved commissions; CSV download | L | Unit + E2E tests for full cycle |

## Epic 9 — Platform & SaaS (P2–P3)

| # | Task | Size | Done when |
|---|---|---|---|
| 9.1 | Custom domains automation: domain verification (TXT record), SSL via Cloudflare for SaaS or Caddy on-demand TLS, status in platform screen | L | Client domain goes live without manual server work |
| 9.2 | Subscription billing for clients (plans, Stripe/Razorpay subscriptions, trial, dunning, plan limits enforced: sites, users, contacts, messages) | XL | Plan limits block over-use with clear messages |
| 9.3 | Agency / white-label console: agency brand, logo, colours, own domain for admin | L | Admin shows agency brand |
| 9.4 | Admin UI translations (i18n catalogues; en-GB first, hi-IN second); currency/locale formatting everywhere | L | Switch language per user |
| 9.5 | MCP full OAuth 2.1 (authorisation code + PKCE, dynamic client registration, consent screen with admin approval) so Claude.ai/ChatGPT custom connectors work | L | Connect from Claude.ai as a custom connector |
| 9.6 | More MCP tools to match scope (themes, footer, popups, call CTAs, appointments, WhatsApp templates/automations, audiences, SEO, shop, content history restore) — still no delete tools | L | Tool list documented in `docs/MCP.md` |
| 9.7 | Email marketing channel (lists from segments, templates, campaigns, unsubscribe, bounce handling) | XL | Campaign sent via SMTP/provider with unsubscribe |
| 9.8 | SSO (SAML/OIDC) for agency staff | L | Login via Google Workspace / Microsoft |
| 9.9 | Data residency: per-site region routing to EU/IN/US databases | XL | Site data stays in its region |

## Human tasks (not for Codex)
- Meta Business verification, app review, Tech Provider status; WhatsApp number and payment method.
- Create real accounts and keys listed in `docs/INTEGRATIONS.pdf`; switch each integration from mock to live and run the live checklist below.
- Privacy policy, terms, data-processing agreement for clients.

### Live integration checklist (run after keys are added)
1. WhatsApp: connect number, approve a template, form submit → template arrives on phone; reply "price" → bot answers; "STOP" → opted out.
2. Meta CAPI: test event visible in Events Manager; lead to Qualified → QualifiedLead visible with good match quality.
3. GA4: stage outcome visible in DebugView; key event imported into Google Ads.
4. Google Ads file: Data Manager fetch succeeds, rows accepted.
5. Payments: Razorpay and Stripe test purchase → order paid via webhook.
6. Email: lead forward email received, passes SPF/DKIM.
7. AI: chatbot answers from approved knowledge; credits deducted.
8. Social: post photo to FB + IG from a verified page.

---

# PART 2 — Master prompt for Codex

You are a senior full-stack engineer completing **Growth Suite**, a multi-tenant website builder, lead generation and marketing automation platform. The codebase already works and is tested. Your job is to build the pending epics in Part 1 to production quality **without breaking anything that already works**.

## Read first
1. `README.md` (setup, architecture), `docs/SCOPE.md` (what the product must do), `docs/BUILD-REPORT.md` (status per feature), this file.
2. `src/db/schema.ts` (data model), `src/lib/admin/resources.ts` (resource registry), `src/lib/services/leads.ts` (lead pipeline), `src/lib/engines/*` (business rules).

## Stack (do not change without being asked)
Next.js 15 App Router · React 19 · TypeScript strict · PostgreSQL + Drizzle ORM (`casing: "snake_case"`) · zod · jose sessions · bcryptjs · Vitest · plain CSS (`src/app/globals.css`, `src/app/(site)/site.css`). No Prisma, no Tailwind, no UI kit unless an epic says so. New dependencies only if they are well-maintained and necessary; say why in the PR.

## Non-negotiable rules
1. **Multi-tenancy:** every business table has `siteId`; every query filters by the current site (`ctx.site.id` in admin, `siteFromRequest` in public routes). Never trust a site ID from the client. Add a test proving isolation for any new table.
2. **Admin API:** wrap routes in `adminRoute(feature, handler)` (auth, permission, CSRF origin check, JSON errors). Validate every body with zod. Use `siteRow()` to load rows. Route files may only export HTTP handlers and Next config — put shared code in `src/lib`.
3. **Public API:** use `siteFromRequest`, `rateLimited`, zod validation, and never reveal whether other data exists.
4. **Third parties:** every external call goes through an adapter in `src/lib/integrations/*` with a **mock mode** (record via `recordMock`) used when keys are missing or `INTEGRATIONS_MODE=mock`. Verify webhook signatures. Store per-site secrets with `encrypt()`; never return them to the browser (use the `…Enc` naming so settings are masked).
5. **Background work:** use the job queue (`enqueue`, `registerHandler`) or the scheduler `tick()`; jobs must be idempotent and retry-safe.
6. **Business rules as pure functions** in `src/lib/engines/` with unit tests in `tests/`. Services orchestrate; UI stays thin.
7. **Data changes:** edit `src/db/schema.ts`, run `npm run db:generate` to create a migration in `drizzle/`, never edit old migrations. Migrations must be backwards-compatible (add columns nullable or with defaults).
8. **Content safety:** snapshot editable content before update/delete (`snapshot()`), write `audit()` entries for admin actions, sanitise any stored HTML with `sanitizeHtml`, protect outbound user-supplied URLs with `assertPublicUrl`.
9. **Privacy:** no personal data in logs; hash email/phone with `src/lib/engines/hashing.ts` for ad platforms; respect `optedOut` and STOP everywhere; keep GDPR export/erasure covering any new personal-data table.
10. **AI assistants (MCP):** never add delete tools; anything an assistant adds to knowledge stays `pending` until a person approves.
11. **UX:** British English, plain words for non-technical users, every form has labels, errors say how to fix the problem, keyboard accessible, works on mobile. Money is stored in minor units with an ISO currency; times are UTC in the database and shown in the site time zone.
12. **Do not** remove or weaken existing tests; do not change the public behaviour covered by `scripts/smoke-test.ts` unless the epic requires it (then update the test).

## How to work
- Pick **one task** at a time from Part 1 in priority order (P1 first, Epic 0 first), unless told otherwise.
- Before coding, write a short plan in the PR description: files to change, schema changes, tests to add.
- Keep changes small and focused; one task per PR/commit series.
- After each task run, in this order, and fix everything before moving on:
  ```bash
  npm run typecheck
  npm test
  npm run db:migrate && npm run db:seed
  npm run build
  npm start &            # then:
  npm run test:smoke
  ```
- Add or extend tests: unit tests for new engines, smoke-test checks (or Playwright once 0.1 exists) for new user flows.
- Update `docs/BUILD-REPORT.md` (status line for the feature), `.env.example` (new variables with comments) and `docs/INTEGRATIONS.pdf` source notes if a new provider is added.

## Definition of done (every task)
- Acceptance criteria in Part 1 met.
- Typecheck, unit tests, build, smoke test (and Playwright when present) all green.
- Works in mock mode with no keys set; works with real keys when provided.
- Site isolation, permissions, validation and audit in place.
- Docs and `.env.example` updated; no secrets committed.

## Report back after each task
1. What you built (2–4 lines).
2. Files changed and any migration added.
3. Test results (counts).
4. Anything you could not finish or verify, and why.

Skip tasks marked ✅. Start with **Epic 0, task 0.1**, unless the user names a different epic or task.
