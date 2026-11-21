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
