# Migration workflow validation — 2026-11-12

**Passed:** 4 Node unit tests, offline schema checks, and 16 MySQL 8.4.13 integration checks. See [machine-readable results](WORKFLOW_TEST_RESULTS.json) and [team instructions](TEAM_MIGRATIONS.md).

## Files

- Added `migrate.mjs`, `migration-core.mjs`, `.env.migrations.example`, `baseline.v1.json`, unit/integration tests, team guide and validation evidence under `database/`.
- Updated root `package.json`/`package-lock.json` with mysql2 and database commands; `.gitattributes` with SQL LF checkout rules; database ignore rules and README/DEVELOPMENT links.
- npm also updated the generated, already tracked `node_modules/.package-lock.json`; do not include generated `node_modules` changes in the team's source PR.
- All four original migration files and the reference seed remain **byte-for-byte identical** to the reviewed raw SHA-256 manifest. Runner checksums separately normalize line endings/BOM for team checkouts. No Compose or frontend source changes.

## Isolated execution results

Only `enterflow-migrations-workflow-test` on **127.0.0.1:3309** was used for SQL tests. Its dedicated persistent volume is `enterflow-migrations-workflow-test-data`. Both are retained. Each continuation used newly named test schemas; previous schemas/data were not reset or deleted. The test-only server's root account is available over its loopback port for the harness; do not copy its account configuration to development/production.

| Check | Result |
| --- | --- |
| Fresh migrations 001–004 in order, then reference seeds | PASS |
| Exact original schema: 70 tables, 562 columns, 141 FKs, 123 PK/unique constraints, 26 enforced CHECKs | PASS |
| All 126 required reference seed values and five legacy completion markers | PASS |
| Repeat migrate/seed/status preserves applied history | PASS |
| Real CLI using private env file, TLS and database-scoped migration account | PASS |
| Windows CRLF checksum compatibility | PASS |
| Edited or missing applied files rejected | PASS |
| Future 005 applied once; newly inserted earlier migration rejected | PASS |
| Existing manually applied schema verified and baselined without SQL replay | PASS |
| Existing synthetic business record preserved during adoption | PASS |
| Concurrent runner refused while another connection holds the lock | PASS |
| Schema drift rejected before history creation | PASS |
| Unseeded manual schema baselines, then safely loads seeds | PASS |
| Partial/unmarked seed data rejects baseline | PASS |
| Failed transactional seed rolls back DML and blocks retry | PASS |
| Partial DDL failure persists failure state, stops later files and blocks retry | PASS |

The extra runner history table makes **71 total tables** after adoption; it does not replace or redesign the original 70. Test fixtures live only in isolated test schemas or temporary fixture directories, never in the reviewed migration files.

Development/validation container IDs, start timestamps, images, mounts and published ports matched before/after. No SQL connections targeted port 3308, XAMPP, `enterflow_db`, or `enterflow_test_db`. No existing database was baselined automatically. No volumes/databases were deleted, no GCP resources created, and no Git commit/push/merge performed.

## Limits and next use

The real development database still requires its own backup, local migration-account provisioning and `npm run db:baseline` by its owner. Follow TEAM_MIGRATIONS.md. Baseline is deliberately strict; unexplained schema/seed differences must be reviewed, not accepted by editing the manifest.

MySQL DDL is not transactionally reversible. Failure markers prevent automatic replay; recovery remains a reviewed manual operation. Status checks file history, not arbitrary post-adoption schema drift. Keep manual DDL/data writes paused during migration/baseline. New migrations and business policies need their own review/tests. This local MySQL validation does not establish Cloud SQL deployment readiness or backend integration.

`npm audit` reported **9 advisories** in the existing project dependency tree (1 low, 1 moderate, 6 high, 1 critical). No automatic dependency/security upgrades were applied; those need separate frontend/toolchain review.
