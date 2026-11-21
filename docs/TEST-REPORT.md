# Latest verification - 21 November 2026

- TypeScript: passed. ESLint: zero warnings. Prettier: passed.
- Local unit tests: 50 passed, 1 skipped (real Redis test runs in hosted CI).
- PostgreSQL integration: 1 passed (retention expiry, isolation and retry).
- Production build: passed; migrations and seed passed.
- HTTP smoke: 45/45 passed against localhost:3217.
- Headless Chromium: 10/10 passed, including mobile navigation and drawer keyboard focus.
- UI screenshots reviewed at desktop and mobile sizes.
- Hosted CI with real Redis previously passed all 41 tests before logging/retention additions; final combined run pending.
- Live Sentry/provider delivery not exercised without credentials.

---

# Test report

Run on 21 November 2026 02:36 UTC on a fresh PostgreSQL 16 database, Node v22.23.5, Next.js 15.5 production build, `INTEGRATIONS_MODE=mock` (no real messages, payments or AI calls).

**What “mock” means:** every external provider call is recorded instead of sent. The business logic, database writes, permissions, scheduling and webhooks all run for real. Live-provider tests are the next step (see docs/INTEGRATIONS.pdf).

```text
## 1. Type check
PASS — no TypeScript errors

## 2. Unit tests (business rules & security)
 RUN  v2.1.9 /home/claude/growth-suite
 ✓ tests/engines.test.ts (28 tests) 32ms
 ✓ tests/security.test.ts (6 tests) 8ms
 ✓ tests/batch1.test.ts (3 tests) 3ms
 Test Files  3 passed (3)
      Tests  37 passed (37)
   Start at  08:05:24
   Duration  982ms (transform 220ms, setup 0ms, collect 535ms, tests 43ms, environment 0ms, prepare 118ms)

## 3. Database migrations & seed (fresh database)
✓ Database migrations applied
✓ Seeded demo site "Demo Business" on localhost (service 00mwps…, 6 stages)

## 4. Production build
 ✓ Compiled successfully in 11.6s
 ✓ Generating static pages (48/48)

## 5. End-to-end test against the production server (mock integrations)
Smoke test → http://localhost:3000
  ✓ Health endpoint reports database up
  ✓ Public home page renders seeded sections
  ✓ Section audience rule shows the ad-specific hero
  ✓ Calculator page and sitemap/robots
  ✓ Unknown page returns 404
  ✓ Admin login rejects a wrong password
  ✓ Admin login works and sets an HttpOnly session cookie
  ✓ Admin pages require a session
  ✓ Cross-site POST is blocked (CSRF)
  ✓ Admin dashboard and CRM pages render
  ✓ Forms list and public form definition
  ✓ Visitor tracking records a page view with UTMs
  ✓ Form validation returns field errors
  ✓ Valid submission creates a lead with first-touch attribution
  ✓ Duplicate phone merges into the same lead
  ✓ Spam guard holds honeypot entries silently
  ✓ Scheduler sends the WhatsApp follow-up automation (mock)
  ✓ Cron endpoint rejects a wrong secret
  ✓ Stage change queues a Meta conversion and the worker sends it (mock)
  ✓ Notes and timeline
  ✓ WhatsApp click gets a Ref code; inbound message with Ref links the visit, bot answers
  ✓ STOP opts the contact out
  ✓ Chatbot answers from knowledge and turns a phone number into a lead
  ✓ Appointment slots and booking (double booking prevented)
  ✓ Shop checkout and payment (mock) marks the order paid
  ✓ Page builder: create page, add section, publish, view, history & restore
  ✓ Reserved addresses cannot be used as page slugs
  ✓ Pipeline stage with leads cannot be deleted
  ✓ AI assistant (MCP): read allowed, write blocked when read-only, token required
  ✓ Settings: secrets stored encrypted and masked on read
  ✓ Users: editor cannot open Users; role permissions enforced
  ✓ Analytics summary counts visitors and conversions
  ✓ GTM container export is valid JSON
  ✓ Lead data export (SAR) and CSV submissions export
  ✓ Review link accepts a customer review for moderation
  ✓ Every admin section and its API load without errors
  ✓ Public blog, shop, booking pages render
  ✓ Generic CRUD validates input (bad JSON, missing required field)
  ✓ Multi-tenant: new client site is isolated by domain and data
  ✓ Password reset: request, reset with link, old password stops working, link single-use
  ✓ Change own password requires the current password
  ✓ Round-robin assignment shares new leads between team members
  ✓ Pipeline board, owner change and leads CSV export
  ✓ Visual form builder page and server-side form validation
  ✓ Image upload is optimised to WebP in several sizes and served

45/45 checks passed
```
