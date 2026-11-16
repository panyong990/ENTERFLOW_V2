# Enter-Flow database foundation — Phase 1 draft

Prepared 2026-11-11. **Primary local development now uses Docker MySQL 8.4.13: enterflow-mysql-dev, enterflow_db, 127.0.0.1:3308. Installation and restart persistence verification passed.**
Use [DEVELOPMENT.md](DEVELOPMENT.md) for current connection and management commands. XAMPP and its same-named enterflow_db/enterflow_test_db remain untouched; the separate MySQL validation container on 3307 is preserved. Frontend and cloud resources are unchanged. Earlier phase documents record historical review/test states.

## Review package

- [Team SQL migration workflow: existing baseline, fresh installs and GitHub collaboration](TEAM_MIGRATIONS.md)
- [Permanent local Docker database — installed, connection and management guide](DEVELOPMENT.md)
- [Archived Phase 5 permanent Docker development setup plan — completed](DEVELOPMENT_SETUP_PLAN.md)
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

The following migration-file list and execution description are retained as historical Phase 1 documentation only. They do not authorize migration execution under the current migration safety hold. The original files were ordered one-time migrations; current migration-runner behavior and restrictions are documented in TEAM_MIGRATIONS.md.

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

## Historical XAMPP setup procedure — retired

This section preserves the historical Phase 1 approach, which assumed an empty
`enterflow_db` on XAMPP at port 3306. It proposed a schema preflight, a private
backup, manual ordered SQL imports through the MySQL command-line client or
phpMyAdmin, and post-import checks. Those steps are historical evidence only:
the executable commands and import instructions have been retired and must not
be reconstructed or run.

The current migration runner owns migration discovery, checksums, ordering,
history, locking, and failure handling. Its ledger is
`_enterflow_migration_history`; `schema_migrations` is consulted only during
baseline verification. Current verified behavior and any operation-specific
approval requirements are documented in [DEVELOPMENT.md](DEVELOPMENT.md) and
[TEAM_MIGRATIONS.md](TEAM_MIGRATIONS.md). This archived Phase 1 plan does not
authorize direct MySQL imports, phpMyAdmin imports, schema changes, or database
access. Historical Phase 2 validation results elsewhere are not current test
evidence.

## Future Express / Cloud Run configuration

PROPOSED FUTURE CONFIGURATION — NOT IMPLEMENTED OR DEPLOYED. The following describes design considerations only and does not authorize infrastructure provisioning or credential changes.

Use server-only environment configuration: `DB_HOST`, `DB_PORT`, `DB_NAME=enterflow_db`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_MAX`, `DB_SOCKET_PATH` (optional Cloud SQL connection route), `GCS_BUCKET`, `GOOGLE_CLOUD_PROJECT`, `NODE_ENV`, `FRONTEND_ORIGIN`. Define one validated configuration layer and a small connection pool per Cloud Run instance; bound total instances/connections to the Cloud SQL limit. Use a Cloud SQL connector or approved private networking/TLS; choose the connection route when deploying. Keep credentials out of frontend `VITE_*` variables, Git, migration files and logs. Use a separate migration identity; runtime needs only the required DML rights and must not run DDL on startup. Use Secret Manager/runtime identity in cloud and local ADC for GCS as documented in STORAGE.md. No backend or credentials are implemented here.

## Later migration / backups

PROPOSED FUTURE PROCEDURE — NOT EXECUTED OR AUTHORIZED. The following steps are planning guidance only. Separate owner approval and verified backup, staging, migration, and recovery procedures are required before execution.

1. Provision approved staging Cloud SQL MySQL and private staging storage separately. Reproduce schema from these migrations and reference seed first; do not import MariaDB system tables, physical data directories, routines or grant tables.
2. During an agreed write freeze, export **application data only**, excluding the seeded lookup tables and `schema_migrations`. Use `mysqldump --single-transaction --no-create-info --skip-triggers --skip-add-locks --skip-disable-keys --skip-comments --default-character-set=utf8mb4 --result-file=<private-path>` with `enterflow_db` and an explicit reviewed table list. Do not blindly import a full MariaDB DDL dump into MySQL. Restore in parent-before-child order or in an isolated import session with FK checks temporarily disabled followed by explicit orphan validation; re-enabling checks alone does not validate existing rows. No such commands have been executed.
3. Restore into staging with a compatible MySQL client. Compare row counts, PK/FK relationships, monetary sums, UTC dates, non-ASCII text, unique identifiers and GCS references; run workflow tests. Match migration hashes/ledger. Keep bucket/object references intact for the same environment. Copy objects and update references in a controlled mapping if moving between environments; never make development data public.
4. Enable approved automated Cloud SQL backups/PITR and verify restore procedures; coordinate object retention/versioning with database backups so referenced generations remain recoverable. Set retention/RPO/RTO with the owner. Schedule cutover, take final consistent export, verify, then redirect the backend. Retain a protected rollback backup and a time-bounded rollback plan; prevent writes to both databases at once.

No infrastructure, backup schedule, bucket, service account, connection, migration, or SQL execution is authorized by this draft alone.
