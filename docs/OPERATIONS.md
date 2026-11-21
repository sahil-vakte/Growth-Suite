# Backup and restore runbook

The recoverable unit is the database, uploaded files, encryption key and matching
application release. A database dump alone does not recover uploaded media or
encrypted integration credentials and authenticator secrets.

## Ownership and recovery targets

The deployment operator owns backup alerts and the restore drill. For an initial
small installation, take a daily backup with a 24-hour recovery-point target and
a one-hour recovery-time target. These are operational targets, not guarantees.
For paying clients, enable the database provider's continuous backups and
point-in-time recovery, plus independent encrypted exports. Keep at least 7 daily,
4 weekly and 3 monthly recovery points, subject to the client's retention policy.
Alert on a missing daily backup, failed checksum or failed monthly restore drill.

Keep an encrypted off-site copy in a separate account with restricted access and
deletion protection. Local files under `.local/` are for rehearsal only; they do
not survive loss of this workstation. Never commit backups or credentials.

## Before taking a consistent recovery point

1. Record the UTC time, Git commit, Node version, PostgreSQL server/client major
   version, database name, storage root/bucket and secret-manager key versions.
2. Put the application behind a maintenance response and stop all app replicas,
   workers and cron callers. This pauses uploads/deletions and queued side effects
   while the database and files are captured. The PostgreSQL server stays running.
3. Confirm no external writer is still updating the database or storage. For
   high-availability deployments, replace this maintenance procedure with tested
   coordinated database/storage snapshots and point-in-time recovery.
4. Install PostgreSQL client tools compatible with the server major version.
   Use a restricted backup role with read access to every application table and
   the `drizzle` migration schema. Configure `PGHOST`, `PGPORT`, `PGUSER` and
   `PGDATABASE`; use a protected `PGPASSFILE` or secret-manager injection for the
   password. Do not put passwords in command arguments, logs or shell history.

## Database and local storage backup (PowerShell)

Run from the repository with the PostgreSQL client tools on PATH. Set
`$sourceStorage` to the resolved `STORAGE_DIR` for this deployment. A fresh backup
directory is required; the commands deliberately do not overwrite an older set.

```powershell
$backupRoot = Join-Path (Resolve-Path '.local') ('backup-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))
$sourceStorage = (Resolve-Path 'storage').Path
New-Item -ItemType Directory -Path $backupRoot -ErrorAction Stop | Out-Null
pg_dump --format=custom --no-owner --no-acl --file (Join-Path $backupRoot 'database.dump')
if ($LASTEXITCODE -ne 0) { throw 'Database backup failed' }
pg_restore --list (Join-Path $backupRoot 'database.dump') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Database archive cannot be read' }
Copy-Item -LiteralPath $sourceStorage -Destination (Join-Path $backupRoot 'storage') -Recurse -ErrorAction Stop
Get-ChildItem -LiteralPath $backupRoot -Recurse -File |
  Get-FileHash -Algorithm SHA256 |
  Select-Object Path, Hash |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupRoot 'checksums.json')
```

Capture row counts for every application table and `drizzle.__drizzle_migrations`
as part of the manifest, along with the release and version information above.
Checksums detect accidental corruption; they do not encrypt or authenticate an
archive against a malicious change. Encrypt the set and verify the off-site copy
before declaring the backup successful. Restart app replicas, then workers/cron.

For S3-compatible storage, back up the entire tenant object namespace, including
originals and responsive variants. Enable versioning and retain the exact object
versions at the recovery point; replicate to an independently controlled backup
bucket/account. Record object keys, version IDs and checksums. Do not run a sync
with deletion against the only backup. An S3/R2 restore has not been rehearsed on
this workstation; the local-disk drill below is not evidence of cloud recovery.

## Key and configuration escrow

Store `ENCRYPTION_KEY` in a separate approved secret manager and retain the version
matching each backup. Losing this key loses access to encrypted credentials and
TOTP secrets. Generating a new key does not decrypt old records. Do not rotate it
without a separately tested re-encryption migration. Test that a second authorised
operator can retrieve the escrowed version during a drill.

Also preserve the deployment configuration and secret references for
`SESSION_SECRET`, `CRON_SECRET`, database/storage credentials, provider keys and
licence keys. Keep actual secrets out of the ordinary backup manifest. Reusing
`SESSION_SECRET` preserves valid sessions; changing it deliberately signs users
out. Rotate the cron secret on an isolated restore so production schedulers cannot
call it. Domain/DNS/TLS configuration and provider webhook registrations must be
recoverable from deployment records.

## Restore into an isolated target first

1. Obtain the matching release, dependency lockfile, database dump, file snapshot
   and key version. Verify archive checksums. Restore only trusted dumps.
2. Create a **new empty UTF-8 database** with a distinct name on a compatible
   PostgreSQL server. Confirm its resolved host and name are not the live target.
   Never use `--clean` or `--create` against the live database for a rehearsal.
3. Set `PGDATABASE` to that new target and restore:

   ```powershell
   pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname $env:PGDATABASE (Join-Path $backupRoot 'database.dump')
   if ($LASTEXITCODE -ne 0) { throw 'Restore failed; do not start the application' }
   ```

4. Copy backed-up storage into a **new empty directory**, or restore object
   versions into a separate bucket. Point `STORAGE_DIR`/storage configuration to
   this target. Compare every file checksum and all recorded table counts before
   running any tests that create data. Recreate deployment roles/grants explicitly
   because the portable dump omits ownership/ACLs.
5. Load the escrowed `ENCRYPTION_KEY`. Confirm decryption of an encrypted test
   setting or TOTP fixture without printing its plaintext. A wrong-key failure
   must stop the restore; do not clear encrypted fields to bypass it.
6. Use a separate port/hostname and `DATABASE_URL`; set `INTEGRATIONS_MODE=mock`,
   blank `REDIS_URL` and `SENTRY_DSN`, and a fresh `CRON_SECRET`. Do not start the
   worker or register live webhook endpoints. Run `npm ci`, `npm run typecheck`,
   `npm test`, `npm run build`, then `npm start -- --hostname localhost --port 3218`.
   Set `APP_URL` and `BASE_URL` to the isolated server before starting it and before
   `npm run test:smoke`. Smoke tests write synthetic data; never run them against
   the recovered production database before cutover.
7. Verify login, a media URL, an encrypted-setting round trip, tenant separation
   and the smoke suite. Record elapsed time and results. Stop the rehearsal server
   and retain/restrict or remove its sensitive artifacts under the retention policy.

## Production cutover and rollback

Pause traffic, workers and cron. Take a final recovery point of the old deployment.
Validate the restored target with read-only checks, using the matching release
first. Review queued jobs and provider idempotency before allowing side effects:
restoring an older database can replay a job whose external effect already happened.
Apply newer migrations only after the baseline restore is verified. Switch the
deployment's database/storage pointers and route traffic, then restore live
provider mode and enable one worker/cron source. Verify health, login and media.

Keep the old database/storage read-only until the agreed rollback window expires.
Rollback means switching both database and storage pointers back together; account
for writes accepted after cutover before doing so. Do not run old code against a
newer schema without a verified compatibility plan.

## Rehearsal record

The local PostgreSQL/disk rehearsal results are recorded in `BUILD-REPORT.md`.
Repeat after schema/storage/key changes and at least monthly in the deployment
environment. Provider point-in-time recovery, off-site recovery and secret-manager
access by a second operator require deployment-specific drills.

References: [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html),
[pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html), and
[Windows client binaries](https://www.postgresql.org/download/windows/).
