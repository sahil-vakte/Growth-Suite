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
