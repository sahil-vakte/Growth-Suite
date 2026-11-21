# Local setup — 21 November 2026

Dependencies installed from `package-lock.json`. A local PostgreSQL runtime and
persistent database live in the ignored `.local/` directory on this workstation.
The active database is `growth_suite_local`, using UTF-8. Existing migrations
and demo seed have been applied; no new schema migration was required.

Open http://localhost:3217 or http://localhost:3217/admin/login.
Use `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env` to sign in. Core secrets were
generated locally; provider credentials remain blank and integrations use mock
mode. Neither credentials nor database contents are committed.

After restarting Windows, run these commands from the repository in separate terminals:

```powershell
node --env-file=.env .local/database.mjs
npm start -- --hostname localhost --port 3217
npm run worker
```

The database helper is workstation-local. On another machine, install PostgreSQL
15+ with UTF-8, create a database, and follow the README setup instructions.
Ports 3000 and 3100 are used by other applications on this workstation.

Validation: typecheck passed; 37 unit tests passed; migrations and seed passed;
production build passed; 45 smoke checks passed against port 3217. Earlier smoke
attempts hit other applications on occupied ports and are not validation of this app.

`npm ci` reported 14 dependency vulnerabilities (7 moderate, 5 high, 2 critical),
including development dependencies. The production-only audit reported 5
(1 moderate, 4 high). Dependency upgrades remain outstanding and require their
own compatibility review before production deployment.
