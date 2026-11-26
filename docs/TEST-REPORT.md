# Latest verification - 21 November 2026

- TypeScript, ESLint (zero warnings), Prettier, production build, migrations and seed: passed.
- Local unit tests: 56 passed; 1 Redis integration test runs in hosted CI.
- PostgreSQL integration: 2 passed (retention and concurrent two-factor recovery-code consumption).
- HTTP smoke: 45/45 passed against localhost:3217.
- Headless Chromium: 13/13 passed, including MFA, CSP, rich text and mobile/keyboard workflows.
- Desktop/mobile UI screenshots reviewed.
- Hosted CI through Epic 0 passed: run 44873052961, including real Redis. Final rich-text commit will run the same pipeline.
- Isolated restore: all 74 tables and 36 files verified, encryption-key round trip passed, restored server smoke 45/45.
- Live provider delivery, cloud-storage restore and off-site recovery were not exercised without deployment credentials.

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
