# Enter-Flow database foundation — Phase 1 draft

Prepared 2026-11-11. **Primary local development now uses Docker MySQL 8.4.13: enterflow-mysql-dev, enterflow_db, 127.0.0.1:3308. Installation and restart persistence verification passed.**
Use [DEVELOPMENT.md](DEVELOPMENT.md) for current connection and management commands. XAMPP and its same-named enterflow_db/enterflow_test_db remain untouched; the separate MySQL validation container on 3307 is preserved. Frontend and cloud resources are unchanged. Earlier phase documents record historical review/test states.

## Review package

- [Team SQL migration workflow: existing baseline, fresh installs and GitHub collaboration](TEAM_MIGRATIONS.md)
- [Permanent local Docker database — installed, connection and management guide](DEVELOPMENT.md)
- [Phase 5 permanent Docker development setup plan — awaiting approval](DEVELOPMENT_SETUP_PLAN.md)
- [Phase 3 executed validation report and readiness](PHASE3_VALIDATION.md)
- [MySQL 8.4 validation passed after approved reserved-identifier fix](MYSQL84_VALIDATION_FINAL.md)
- [Proposed MySQL 8.4 compatibility test plan — not executed](MYSQL84_TEST_PLAN.md)
- [Frontend analysis and unresolved requirements](FRONTEND_ANALYSIS.md)
- [Schema dictionary and relationships](SCHEMA.md) — every column, type, key and constraint; SQL is authoritative.
- [Private GCS integration design](STORAGE.md)
- [Revised Phase 2 readiness and approval decisions](PHASE2_REVIEW.md)
- [Table purposes and duplication review](TABLE_REVIEW.md)
- [Offline check results and current SQL hashes](STATIC_CHECKS.json); rerun with `python database/validate_drafts.py`
- `migrations/001_identity_catalog.sql`
- `migrations/002_orders_quotations.sql`
- `migrations/003_operations_billing.sql`
- `migrations/004_attachments_audit.sql`
- `seeds/001_reference_data.sql`

These are ordered, one-time migrations. They deliberately omit `IF NOT EXISTS`, database creation, `USE`, destructive SQL and environment-specific paths: mismatched existing tables must fail visibly. Apply only to the explicitly selected `enterflow_db`. Do not edit a migration after it has been applied; add a new numbered migration. `schema_migrations` records completion of each file and the reference seed. Use Git history and release file hashes to identify exact migration contents. There is no automatic migration runner in Phase 1.

## Phase 1 local observations (historical)

| Check | Observed without SQL |
| --- | --- |
| Checkout | `dev-phase`, not the brief's `development-phase`; no branch change made |
| Working tree before work | Existing tracked `node_modules/.vite/deps` changes; left alone |
| XAMPP installation | `C:/xampp/mysql/bin/mysql.exe` and `mysqld.exe` exist |
| Installed binary versions | Server `10.4.32-MariaDB`; client `Distrib 10.4.32-MariaDB` |
| Running server | `mysqld` process at `c:/xampp/mysql/bin/mysqld.exe`; TCP 3306 listening, PID 23360 at inspection |
| Configuration | `my.ini`: port 3306, data directory `C:/xampp/mysql/data`, `utf8mb4_general_ci` server default |
| Database existence | `C:/xampp/mysql/data/enterflow_db` directory exists. This is filesystem evidence only; live catalog, tables, contents, grants and runtime version are unverified |

During Phase 1 no authentication attempt or SQL query was made because SQL was not approved. Phase 3 subsequently authenticated and tested only the newly authorized enterflow_test_db, as recorded in PHASE3_VALIDATION.md. The main database remains unmigrated; a running process/listener alone does not verify a database connection.

## Compatibility and validation

Draft target: local MariaDB 10.4.32 and **Cloud SQL MySQL 8.4**, subject to confirming the project's intended cloud version. The syntax also targets MySQL 8.0.16+; earlier MySQL versions do not enforce these CHECK constraints. Cloud SQL has its own [supported version policy](https://docs.cloud.google.com/sql/docs/mysql/db-versions); select an offered version at provisioning time. See the [MySQL CHECK reference](https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html).

- All tables explicitly use InnoDB, `utf8mb4`, and portable `utf8mb4_unicode_ci`; this overrides the XAMPP default. No `utf8mb4_0900_*` collation, MariaDB sequences, system-versioning, native UUID types, generated-column tricks, JSON-specific functions, triggers, stored routines, definers or tablespaces.
- IDs/FKs are matching unsigned BIGINTs. Referenced composite keys are explicitly unique, including for MySQL 8.4. No file bytes, data URLs, or signed access URLs are stored. GCS object names are deliberately generated ASCII paths of at most 700 characters.
- Money uses `DECIMAL(15,2)`; unit costs/quantities use `DECIMAL(15,4)`; rates use explicit precision. API must use decimal arithmetic and an agreed rounding policy. Do not pass BIGINTs through JavaScript `Number`; serialize IDs as strings.
- `DATETIME(3)` event times are UTC by convention. Set connection timezone `+00:00`; use `DATE` for business dates and display using Asia/Manila. No zero dates. Production due dates are immutable after JO issuance in the API.
- CHECK, UNIQUE and composite FK constraints now enforce shared order/client ownership, at most one accepted signed copy per DR, and same-order accepted evidence for invoices. Authorization, balances, status transitions and due-date policy still require service transactions. Module grants seed frontend visibility only, not action permissions. See PHASE2_REVIEW.md for the constraint/backend boundary.
- MySQL/MariaDB DDL commits implicitly. A failed migration may leave tables even when no completion row exists. Do not assume rollback or rerun it blindly. Capture the error and inspect the approved target before preparing recovery.

Validation performed: offline checks plus successful Phase 3 execution of all four migrations/reference seed against enterflow_test_db on MariaDB 10.4.32. All 70 tables, 562 columns, 141 FKs, 123 primary/unique constraints and 26 CHECK definitions match; all seed values match; 81 targeted integrity cases passed and rolled back. The main database is unchanged. Cloud SQL MySQL, Node.js/backend/GCS integration and true concurrency remain untested; billing/cardinality decisions remain open. See PHASE3_VALIDATION.md for diagnostics and test counter side effects.

## Historical XAMPP setup procedure — not the active workflow

Retained for Phase 1 context only. Do not use these port-3306/XAMPP instructions for current development. The approved permanent Docker setup is complete on port 3308; no approval exists to migrate XAMPP. Use DEVELOPMENT.md instead.

1. Resolve the highlighted requirements and branch mismatch. If `development-phase` is required, select/create that branch with the project owner; preserve existing work. Review the SQL and obtain approval for live inspection and migrations.
2. Open XAMPP Control Panel and verify MySQL is started. Connect with an authorized database administrator using a password prompt (use the actual installation path if different):

   ```powershell
   $mysqlExe = 'C:\xampp\mysql\bin\mysql.exe'
   $dbAdmin = Read-Host 'Database administrator username'
   & $mysqlExe --host=127.0.0.1 --port=3306 --user=$dbAdmin --password --default-character-set=utf8mb4
   ```

3. **After SQL approval**, run this read-only preflight in that client:

   ```sql
   SELECT VERSION(), @@version_comment, @@port, @@sql_mode,
          @@character_set_server, @@collation_server;
   SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
     WHERE SCHEMA_NAME = 'enterflow_db';
   SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = 'enterflow_db' ORDER BY TABLE_NAME;
   ```

   Stop if there are any existing tables/views or other schema objects until their schema/data is reviewed. The draft assumes an empty existing schema. Do not modify or import over existing objects. If the database is absent, stop and report it; database creation is outside this task. Its default collation need not change because each table is explicit. Exit the client before using PowerShell commands below. PHASE2_REVIEW.md specifies the complete approved preflight, including strict mode and constraint enforcement.

4. Back up an existing approved target before any change. Choose an approved backup location outside Git; never add backup data to the repository. The command prompts for a password and exports only `enterflow_db`:

   ```powershell
   $dumpExe = 'C:\xampp\mysql\bin\mysqldump.exe'
   $backupFile = Join-Path $env:TEMP ('enterflow-before-phase1-' + (Get-Date -Format yyyyMMdd-HHmmss) + '.sql')
   & $dumpExe --host=127.0.0.1 --port=3306 --user=$dbAdmin --password --single-transaction --routines --triggers --events --result-file=$backupFile enterflow_db
   if ($LASTEXITCODE -ne 0) { throw 'Backup failed; stop.' }
   ```

   Verify the backup file is nonempty and protect it as private business data. Restore-test it in an approved disposable environment before relying on it. Pause schema writes during backup; `--single-transaction` does not make concurrent DDL safe.

5. Only for an approved empty `enterflow_db`, apply from the workspace root, in order. This is native PowerShell piping to the batch client; there is no shell input-redirection dependency. No `--force`: stop at the first error. Password is requested for each client invocation.

   ```powershell
   $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
   $dbFiles = @(
     'database/migrations/001_identity_catalog.sql',
     'database/migrations/002_orders_quotations.sql',
     'database/migrations/003_operations_billing.sql',
     'database/migrations/004_attachments_audit.sql',
     'database/seeds/001_reference_data.sql'
   )
   foreach ($dbFile in $dbFiles) {
     Get-Content -LiteralPath $dbFile -Raw -Encoding UTF8 |
       & $mysqlExe --host=127.0.0.1 --port=3306 --user=$dbAdmin --password --database=enterflow_db --default-character-set=utf8mb4 --show-warnings
     if ($LASTEXITCODE -ne 0) { throw "Stopped on $dbFile. Review partial DDL before recovery." }
   }
   ```

   Alternative: select `enterflow_db` in phpMyAdmin, import each of the five files individually in that exact order, and inspect errors/completion rows after every file. Never import into the server root or another schema.

6. With approval, verify completion and reference counts:

   ```sql
   SELECT DATABASE();
   SELECT version, applied_at FROM enterflow_db.schema_migrations ORDER BY version;
   SELECT COUNT(*) AS roles FROM enterflow_db.roles;                 -- 9
   SELECT COUNT(*) AS filter_types FROM enterflow_db.filter_types;   -- 16
   SELECT COUNT(*) AS production_stages FROM enterflow_db.production_stages; -- 9
   SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = 'enterflow_db'
       AND (ENGINE <> 'InnoDB' OR TABLE_COLLATION <> 'utf8mb4_unicode_ci'); -- none
   ```

   Expect five completion rows and 70 tables. Follow PHASE2_REVIEW.md for complete column/key/seed checks and the approval scope for rollback-only ownership/receipt tests against the existing enterflow_db. A rollback-only business-fixture test may still advance AUTO_INCREMENT counters; do not silently reseed them. No additional database will be created in this task. Later target-MySQL validation remains separate. Initial staff account creation must hash an operator-supplied password server-side; there are no seeded login credentials.

## Future Express / Cloud Run configuration

Use server-only environment configuration: `DB_HOST`, `DB_PORT`, `DB_NAME=enterflow_db`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_MAX`, `DB_SOCKET_PATH` (optional Cloud SQL connection route), `GCS_BUCKET`, `GOOGLE_CLOUD_PROJECT`, `NODE_ENV`, `FRONTEND_ORIGIN`. Define one validated configuration layer and a small connection pool per Cloud Run instance; bound total instances/connections to the Cloud SQL limit. Use a Cloud SQL connector or approved private networking/TLS; choose the connection route when deploying. Keep credentials out of frontend `VITE_*` variables, Git, migration files and logs. Use a separate migration identity; runtime needs only the required DML rights and must not run DDL on startup. Use Secret Manager/runtime identity in cloud and local ADC for GCS as documented in STORAGE.md. No backend or credentials are implemented here.

## Later migration / backups

1. Provision approved staging Cloud SQL MySQL and private staging storage separately. Reproduce schema from these migrations and reference seed first; do not import MariaDB system tables, physical data directories, routines or grant tables.
2. During an agreed write freeze, export **application data only**, excluding the seeded lookup tables and `schema_migrations`. Use `mysqldump --single-transaction --no-create-info --skip-triggers --skip-add-locks --skip-disable-keys --skip-comments --default-character-set=utf8mb4 --result-file=<private-path>` with `enterflow_db` and an explicit reviewed table list. Do not blindly import a full MariaDB DDL dump into MySQL. Restore in parent-before-child order or in an isolated import session with FK checks temporarily disabled followed by explicit orphan validation; re-enabling checks alone does not validate existing rows. No such commands have been executed.
3. Restore into staging with a compatible MySQL client. Compare row counts, PK/FK relationships, monetary sums, UTC dates, non-ASCII text, unique identifiers and GCS references; run workflow tests. Match migration hashes/ledger. Keep bucket/object references intact for the same environment. Copy objects and update references in a controlled mapping if moving between environments; never make development data public.
4. Enable approved automated Cloud SQL backups/PITR and verify restore procedures; coordinate object retention/versioning with database backups so referenced generations remain recoverable. Set retention/RPO/RTO with the owner. Schedule cutover, take final consistent export, verify, then redirect the backend. Retain a protected rollback backup and a time-bounded rollback plan; prevent writes to both databases at once.

No infrastructure, backup schedule, bucket, service account, connection, migration, or SQL execution is authorized by this draft alone.
