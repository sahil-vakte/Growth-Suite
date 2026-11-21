# Growth Suite

A multi-tenant **website builder + lead generation + marketing automation** platform built with Next.js. It covers
the full scope of the audited YAGOPS system (see `docs/SCOPE.pdf`): pages and section builder, blog, forms with spam
protection and calculators, CRM with attribution and lead scoring, WhatsApp Business (templates, automations,
campaigns, auto-reply bot), Meta/Google conversion tracking, popups, chatbot, appointments, shop, social posting with
approvals, AI content tools, an AI-assistant (MCP) connector, affiliates and more.

One deployment serves many client websites (each matched by domain), or runs as a single self-hosted site.

---

## Quick start (local)

Requirements: Node.js 20.6+ and PostgreSQL 15+ (UTF-8 encoding).

```bash
cp .env.example .env              # then set DATABASE_URL, SESSION_SECRET, ENCRYPTION_KEY, CRON_SECRET, ADMIN_PASSWORD
npm install
npm run db:migrate                # creates all tables
npm run db:seed                   # creates the platform admin and a working demo site on "localhost"
npm run dev                       # http://localhost:3000  (admin: http://localhost:3000/admin)
npm run worker                    # in a second terminal: scheduler for automations, campaigns, social posts, conversions
```

Leave every third-party key blank to start: integrations run in **mock mode** (nothing leaves the server; calls are
recorded), so every feature can be clicked through. Add keys one at a time using `docs/INTEGRATIONS.pdf`.

For local development, set `APP_URL=http://localhost:3000` and `INTEGRATIONS_MODE=mock`.
The migration, seed, worker and smoke-test commands load `.env` automatically. Keep `.env`
private; only `.env.example` belongs in Git. Admin login uses `ADMIN_EMAIL` and `ADMIN_PASSWORD`
from your local `.env`.

## Production

**Docker (app + worker + PostgreSQL):**

```bash
cp .env.example .env              # fill in the core values
docker compose up -d --build
docker compose run --rm migrate   # migrations + first admin
```

**Serverless (e.g. Vercel):** set all environment variables, use a managed PostgreSQL, S3/R2 storage
(`S3_*` variables — local disk is not persistent on serverless), and call `POST /api/cron/tick` every minute with
`Authorization: Bearer $CRON_SECRET` from a scheduler.

Checklist before going live:
- `SESSION_SECRET`, `ENCRYPTION_KEY` (32 bytes base64 — the app refuses to start encrypted features without it in production), `CRON_SECRET` set and backed up
- `META_APP_SECRET` set (webhooks refuse unsigned calls in production)
- `INTEGRATIONS_MODE=auto`
- HTTPS in front (cookies are `Secure` when `APP_URL` is https)
- Database backups / point-in-time recovery on
- One worker process running (or the cron call)
- `SINGLE_SITE_MODE=true` only for single-website self-hosting

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js development / production build / production server |
| `npm run worker` | Background scheduler (every minute) |
| `npm run db:migrate` | Apply database migrations (`drizzle/`) |
| `npm run db:generate` | Create a new migration after changing `src/db/schema.ts` |
| `npm run db:seed` | Platform admin + demo site (idempotent) |
| `npm test` | Unit tests (engines, security, validation) |
| `npm run test:smoke` | End-to-end test against a running server |
| `npm run typecheck` | TypeScript check |

Pending work and the coding-agent instructions are in `AGENTS.md`.

## Architecture

```
src/
  app/
    (site)/            public websites: pages, blog, shop, booking, reviews, interview, video
    admin/             admin panel (login, dashboard, CRM, page builder, settings, generic resource screens)
    api/
      admin/           authenticated admin API (CSRF-checked, role-checked, site-scoped)
      public/          visitor endpoints: track, forms, click, chat, appointments, checkout, reviews
      webhooks/        WhatsApp Cloud API, Facebook Lead Ads (signature-verified)
      mcp/             AI-assistant connector (JSON-RPC MCP + OAuth client credentials)
      cron/tick        scheduler entry point
  db/schema.ts         data model (Drizzle ORM, PostgreSQL) — every business table carries siteId
  lib/
    engines/           pure business rules, fully unit-tested (spam guard, attribution, popup targeting,
                       call tracking, appointment slots, scoring, segments, automations, WhatsApp bot,
                       hashing, formulas, Google Ads file, licences, social approvals, affiliates)
    services/          leads, forms, tracking, WhatsApp, conversions, chatbot, appointments, shop,
                       AI studio, analytics, credits, scheduler
    integrations/      provider adapters with mock mode: WhatsApp, Meta CAPI, GA4, Razorpay, Stripe,
                       SMTP, Anthropic, OpenAI, Serper, Daily, Facebook/Instagram, S3 storage
    admin/             resource registry (one definition → list, form, validation, API), CRUD, hooks
    layouts/           built-in section layouts (CTA and image objects follow the layout rules)
  components/          admin UI and public site components (site runtime: tracking, popups, chat…)
scripts/               migrate, seed, worker, smoke test
tests/                 unit tests
docs/                  SCOPE.pdf, INTEGRATIONS.pdf, BUILD-REPORT.md, TEST-REPORT.md
```

**Key design choices**
- Multi-tenant by `siteId` on every row; tenant resolved by domain (public) or session (admin).
- Postgres-backed job queue (`FOR UPDATE SKIP LOCKED`) with retries and back-off; safe with many workers.
- Every external call goes through an adapter with a mock fallback, so the app runs and tests without credentials.
- Secrets in the database are AES-256-GCM encrypted; admin forms never display them again.
- Content history snapshots every edit/deletion (last 3 versions) with one-click restore.
- No delete tools for AI assistants; knowledge they add waits for human approval.

## Default demo login

After `npm run db:seed`: `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (defaults `admin@example.com` /
`ChangeMe-2026!` — change immediately).

## Automated checks

Run `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm test`.
Install Chromium with `npx playwright install chromium`, then run `npm run build`
and `npm run test:e2e`. Playwright starts a production server when needed, or reuses
an existing local server. `E2E_BASE_URL` overrides the browser test address.
Use a seeded test database: smoke/browser checks create synthetic records.

GitHub Actions runs the complete sequence on pull requests, including a real Redis
service and a two-process shared-limit test. The `Verify application` check is
required before merging to `main`.

Set `REDIS_URL` on every production app instance to share rate limits. Use the same
`SESSION_SECRET` across instances; keys are HMAC hashes. Blank `REDIS_URL` uses a
bounded in-memory fallback suitable for one local instance. A configured store
outage fails closed. Redis is infrastructure and remains active in mock integration
mode. Configure your reverse proxy to replace incoming forwarded-IP headers.

## Logs and analytics retention

API responses include `X-Request-ID`. Error logs contain only that ID, a source-code
route template, HTTP method/status and the resolved site ID (null when unresolved).
Request values, SQL and exception messages are not logged. Optional `SENTRY_DSN`
reports the same metadata; mock integration mode records it locally instead.

`ANALYTICS_RETENTION_MONTHS` defaults to 12. The daily scheduler keeps the current
UTC month plus that many complete prior months, deleting older raw events in
batches of 1,000. Set 0 to disable deletion, or an integer up to 120. Analytics
queries are unchanged; historical raw events outside the retention window will no
longer be available. Lead records are unaffected. Run the worker or cron endpoint
for retention jobs to execute. Run `npm run test:db` after migrations to verify
retention isolation and retry safety against a test PostgreSQL database.

### Two-factor authentication
Open My account > Manage two-factor authentication. Enter your password, add the displayed time-based setup key to an authenticator and verify a code. Save the ten single-use recovery codes shown once. Enabling or disabling signs out other sessions. Site administrators can require enrolment for their site's administrators; editor and sales roles remain optional. Encrypted secrets require the same backed-up ENCRYPTION_KEY after restore. Codes follow RFC 6238 (SHA-1, six digits, 30 seconds); setup expires after ten minutes. No provider keys or external service is used.

### Browser Content-Security-Policy
Every HTML response is dynamically rendered with a fresh script nonce. GTM and JSON-LD carry the nonce; GTM propagates it to loaded tags. Production blocks inline event handlers and eval. Themes still use inline CSS; HTTPS images, media and frames support uploaded/external site content. Known Google/Meta/payment/video connections are allowed; add other explicit HTTPS origins through CSP_CONNECT_ORIGINS. GTM Custom JavaScript variables requiring eval are intentionally unsupported: use supported templates instead. Do not cache HTML across requests at a CDN because each response has its own nonce. The browser test intercepts only the external GTM payload, proving bootstrap/nonce behaviour without sending analytics to a real container.
References: https://nextjs.org/docs/app/guides/content-security-policy and https://developers.google.com/tag-platform/security/guides/csp

### Rich-text content
Blog Content and product Description fields use TipTap with headings, lists, links, images from the media library, tables and undo/redo. Pasted HTML keeps supported formatting while custom styling and unsafe content are removed. The server sanitises saved HTML, and public pages sanitise it again. Product edits now create content-history snapshots. No additional environment variables are required.
