# Permanent local MySQL development database

**Installed and verified:** MySQL 8.4.13 in `enterflow-mysql-dev`, database `enterflow_db`, endpoint **127.0.0.1:3308**, persistent volume `enterflow-mysql-dev-data`. This is the primary local Enter-Flow development database. XAMPP and the separate validation container on 3307 are unchanged.

## Installation result

- All four validated migrations and reference seed applied successfully, without migration errors or warnings.
- Exact schema match: **70 tables, 562 columns, 141 FKs, 123 primary/unique constraints, 26 enforced CHECKs**.
- Exact seed match: 126 reference rows and five ledger entries; all other 59 tables empty. No business fixtures or fake application accounts were inserted.
- `enterflow_app` authenticated through the published host port using TLS and can read all 70 tables/ledger. It has only SELECT, INSERT, UPDATE and DELETE on enterflow_db.*, no grant option, global privileges or assigned roles. It has no schema-management privileges.
- The new container was restarted. Its ID, server UUID, named data volume, complete schema, seeds and application-account access persisted. Final health: healthy. The validation container's ID, start time, image, port binding and mount matched before/after exactly.
- No 81-case compatibility test repetition: the image/SQL were unchanged; installation and persistence were verified directly.

Machine-readable evidence: [installation.json](development/installation.json), [actual schema metadata](development/phase3_metadata.json). The image is pinned to `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902`.

## Credentials and backend connection

Real credentials are in **database/.env.dev**, Git-ignored and restricted by Windows ACL to the current Windows user and SYSTEM. Do not commit, print, share or copy them into React/VITE_* variables. The committed `.env.dev.example` is only a blank template. Docker initialization uses MYSQL_ROOT_PASSWORD; the future backend uses:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3308
DB_NAME=enterflow_db
DB_USER=enterflow_app
DB_PASSWORD=<read privately from database/.env.dev>
DB_POOL_MAX=5
DB_TIMEZONE=Z
DB_SOCKET_PATH=
```

The file is not automatically loaded by a future backend: configure server-side environment loading explicitly. Root is for administration/migrations inside the container, not backend runtime. Changing the MYSQL_ROOT_PASSWORD environment value does not change an already-initialized MySQL account; password rotation requires a deliberate SQL/configuration update.

Use a MySQL 8.4/caching_sha2_password-capable management client with the endpoint/account above. The backend account can inspect/edit application data but cannot run DDL. For local TLS, use an appropriate CA/driver configuration if certificate verification is enabled; the image generates its own local certificates. The recorded connection probe used encrypted transport. No Node.js backend has been implemented or tested yet.

Later, keep business logic independent of the connection factory: supply Cloud SQL connector/private TCP/socket configuration, database identity, pool bounds and runtime secrets through server configuration. Preserve UTC dates, string BIGINT IDs and decimal-safe money handling. Uploaded file bytes remain in private **Google Cloud Storage**, with only metadata/references in MySQL. No GCP resources or credentials were configured.

## Start, stop and restart

Run from the existing workspace root in your Windows account. These commands select only the development Compose project:

```powershell
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml start --wait
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml stop
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml restart
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml ps
```

Data stays in the named volume across stop/restart. `unless-stopped` restarts the container when Docker starts, except after an explicit stop. Do not use `down -v`, volume removal/pruning, global cleanup or test-database reset commands. If a resource differs from the recorded identity, stop and inspect it rather than reinstalling over it.

Read-only identity/health and complete baseline schema/seed checks:

```powershell
python database/dev_mysql.py status
python database/dev_mysql.py verify
```

The baseline `verify` command expects only the initial seeds; after genuine business data exists, nonzero business tables are expected and require a data-aware check. The helper refuses to reinstall over existing resources/secrets. Administrative SQL shell (password prompt, no password in arguments):

```powershell
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml exec mysql mysql --protocol=socket --user=root -p enterflow_db
```

## Backups

With the development container running:

```powershell
python database/dev_mysql.py backup
```

This checks the recorded container/image/UUID/mount/port, dumps **only enterflow_db** using a single transaction and binary-safe UTF-8 output, and writes a new timestamped SQL file plus hash metadata under Git-ignored `database/backups/`. Passwords are sent through stdin and are not part of the dump or command arguments. The SQL file receives a private Windows ACL. Store a separate protected copy according to your backup policy. Pause concurrent DDL during a backup. A failed/partial output must not be used for restore.

Backup creation and restore were not performed as setup tests; persistence was tested by restart and exact metadata/seed comparison.

## Restoring a backup

**Restore overwrites tables/data and requires explicit approval.** Never use it to test persistence or target XAMPP/validation. First confirm status, validate the backup SHA-256 against its metadata and review that the trusted dump contains only enterflow_db application objects, with no schema switches, other-database writes, account/grant changes or global settings. Use a dump produced by the target-only backup command; do not blindly import an arbitrary server dump. Stop backend writes, take a current backup, then run the reviewed restore manually:

```powershell
python database/dev_mysql.py status
$restoreFile = 'database/backups/<approved-backup>.sql'
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Get-Content -LiteralPath $restoreFile -Raw -Encoding UTF8 |
  docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml exec -T mysql sh -c 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --protocol=socket --user=root --database=enterflow_db --default-character-set=utf8mb4 --batch --show-warnings'
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; stop and inspect partial state.' }
```

Do not add --force. After restore, validate schema/ledger, row counts, financial totals, FKs/orphans and intended application behavior; re-enabling FK checks alone does not validate restored rows. No automatic recovery/drop/recreate is supplied. Backend/MySQL connection accounts are outside application-only dumps; manage their credentials separately.

## Future migrations

Create a new ordered migration; never rewrite/reimport migrations already applied here. Review it, back up the development target, check schema_migrations and apply only the next unapplied file with the administrative identity, using the same target-checked, stop-on-error import pattern in DEVELOPMENT_SETUP_PLAN.md. Include a unique completion marker only after its statements succeed. Do not run DDL with enterflow_app. DDL can commit partially; report failures and plan recovery before retrying. Validate schema changes in an authorized isolated environment before production deployment.

## Persistence evidence

The setup recorded the same server UUID and named volume before/after a restart, rechecked every schema definition and seed value, and successfully authenticated the backend account through host port 3308 again. You can inspect the mount without exposing credentials:

```powershell
docker --context desktop-linux inspect enterflow-mysql-dev --format '{{json .Mounts}}'
docker --context desktop-linux volume inspect enterflow-mysql-dev-data
```

A named volume provides persistence, not a backup. Do not remove or replace it without a reviewed recovery plan.
