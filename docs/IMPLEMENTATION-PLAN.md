# Task 0.1 — browser regression coverage

Add Playwright configuration, browser fixtures and tests for login, page-builder
add/edit/reorder/publish, public forms, popups, chat, booking, CRM and social approval.
Use unique fixture names, real HTTP/database behaviour and mock provider adapters.
Fix accessible labels exposed by browser tests. No schema changes.
Validate typecheck, unit tests, migrations/seed, production build, smoke and Chromium.
Dependency: @playwright/test is required for the explicitly requested browser suite.
Reports/traces must stay ignored because they can contain session and form data.

## Tasks 0.2 and 0.3
Add a PostgreSQL-backed GitHub Actions job with all checks, plus the lint/format
commands it requires. Format the existing source and fix lint findings without
changing business behaviour. No schema changes. Run the full verification sequence.

## Shared UI foundation
Refresh admin navigation, login, dashboard and shared form/table styles; improve
mobile layouts, focus visibility and editing-drawer keyboard behaviour. Preserve
permissions and tenant theme settings. No schema changes. Validate all existing
checks plus desktop/mobile navigation and drawer keyboard browser tests.

## Task 0.4 — shared rate limiting
Add a bounded memory limiter and an atomic Redis adapter. Await the shared limiter
in all existing protected endpoints and replace the login-only process map.
Use HMAC keys to keep email/IP values out of Redis, fail closed on configured-store
outages, and use memory only when Redis is unconfigured. No schema changes.
Test window boundaries locally and two competing Node processes against Redis in CI.
The redis dependency is the maintained official Redis client; infrastructure is not
mocked by INTEGRATIONS_MODE, so CI can test shared limits with mock business providers.

## Task 0.5 — structured API error reporting
Wrap every API handler with request context and a generated request ID. Log only
an explicit allowlist (route template, site ID, method, status, request ID), never
request values, exception messages or SQL. Attach X-Request-ID to responses.
Add optional Sentry adapter with default integrations disabled and the same safe
fields; use recordMock when disabled/mock. Add tests for concurrency and privacy.
No schema changes. Dependencies pino and @sentry/node are required by the task.

## Task 0.6 — analytics retention
Add a nullable last-retention-run timestamp to sites and generate a new migration.
Schedule one idempotent daily job per site. Delete raw analytics in bounded batches,
scoped by site, keeping the current month plus configured complete prior months.
Zero disables retention. Add pure date/config tests and a real PostgreSQL isolation/
retry test, run after migrations in CI. Existing analytics queries stay unchanged.

## Task 0.8 - administrator two-factor authentication
Add encrypted account TOTP state, hashed single-use recovery codes and a per-site admin policy. Generate an additive migration. Gate both pages and APIs; enrolment revokes previous sessions. Test RFC vectors, concurrent replay prevention, account isolation and the browser setup/sign-in flow. No external provider or new dependency is needed.

## Task 0.9 - nonce-based CSP
Generate a new nonce in Next middleware and pass the policy to both rendering and the browser. Make HTML dynamic, nonce all JSON-LD/GTM scripts, propagate the nonce to GTM, and retain theme styling. Add optional validated HTTPS connect origins, policy unit tests and browser checks for hydration, nonce rotation, GTM and blocked injected scripts. No schema changes.

## Task 0.10 - backup and restore operations
Document consistent database/storage snapshots, separate key escrow, restore isolation, checksums, worker handling and cutover/rollback. Rehearse PostgreSQL custom-format dump/restore into a new database, copy local storage, compare all table counts/file hashes, verify restored-key decryption and run the smoke suite on a separate mock-mode server. No application or schema changes.
