# Task 001: permanent instructions and integration-test readiness

Date: 2026-11-19 (Asia/Singapore). Scope: instructions, relevant source inspection, read-only SQL, and a proposal only.

## Delivered and verified

Created root `AGENTS.md`; no existing root, nested, or checked ancestor AGENTS.md was found. The existing guidelines file is a commented template. Preserved the supplied requirements and existing documented architecture, Real/Demo separation, security, business, database, and Git safeguards. No application/configuration changes.

Reviewed Warehouse and Sales reports, Phase 1 resumption/business handoffs, testing guidance, Compose, runtime/TLS configuration, and relevant test entry points. The original 28-page handoff was unavailable at its recorded Stephanie Downloads path; targeted MSCPROJ PDF searches under the current user's Desktop, Downloads, and attachments found no copy. Requirements from that PDF were not independently reverified; the existing reports and explicit Task 001 instructions were used.

## Current database evidence

Used existing application credentials without printing them, strict CA/name-verified TLS, and a direct `mysql2/promise` connection. Ran SELECTs inside `START TRANSACTION READ ONLY`, ending with `ROLLBACK`; did not start the API or authenticate through it (session activity can write).

| Check | Current result |
| --- | --- |
| Database / server | `enterflow_db` / MySQL `8.4.13` |
| `materials` | 158 |
| `material_import_review` | 41 |
| `bom_templates` / `bom_template_lines` | 0 / 0 |
| Quantity + threshold statuses | 157 `provisional_sample` / `provisional_sample`; 1 `verified` / `verified` |
| Migration 008 | Exact file row recorded as `applied` |
| Material price provenance | Source `RAW MATERIALS COMPUTATION & LIST - LIST OF RAW MATS.pdf`; 117 `unreviewed`, 41 `needs_review` |
| Schemas visible to application account | `enterflow_db`, `information_schema`, `performance_schema` |

The only migration-ledger query was:

```sql
SELECT file,state FROM _enterflow_migration_history
WHERE file = 'migrations/008_inventory_material_master.sql';
```

No checksum, protected row, or whole-ledger query. The recorded applied state and expected material-column metadata were checked; this is not a full migration integrity attestation.

The historical zero-material snapshot is superseded by this live check. Stored `verified` status is not independent physical-count evidence. The source-aware import and 71-record MAIN catalog have different provenance/scopes; equal counts or row matching have not been established. Existing MAIN manifest/reconciliation artifacts, the raw-material source manifest, and the empty `config/material-catalog-ids.json` registry require a separate focused reconciliation task. No material-by-material comparison or reimport occurred. Prior persistence reports were not reproduced.

## Existing infrastructure and risks

| Infrastructure | Finding |
| --- | --- |
| `database/compose.dev.yaml` | Persistent development MySQL at loopback 3308, `enterflow_db`, named development volume. No test service. Do not reuse its volume or initialization for tests. |
| `backend/test/support/mock-database.js` | Fail-closed import hook replaces the database singleton; focused unit/mock HTTP tests inject doubles. These do not prove MySQL persistence. |
| `backend/test/support/isolated-mysql.js` and registration/client-application harnesses | Random isolated tmpfs container/schema, TLS and identity checks, restricted runtime account, ownership-checked cleanup. Startup enumerates/hashes/applies migrations and expects only 001-007; unsuitable as-is with Migration 008 and the protected-file restriction. Not run. |
| `browser-test/backend.mjs`, `browser-test/recovery/` | Existing identity-pinned Docker/TLS/UUID/browser approach and synthetic schema/fixture initialization. `identity.reviewed.json` and `created.local.json` are absent here. Its 28-table subset predates current inventory requirements and uses root for API runtime; cannot assume current compatibility or least privilege. |
| Legacy auth, auth-permission, client-identity and session `*.mysql.integration.js` | Import normal database pool, which loads `database/.env.dev`. Scripts write users/clients/sessions or depend on pre-existing fixture users. No isolated-target guard observed in these entry points. They can touch development data. Do not run directly. |
| `database/test-workflow.mjs` | Creates database/container resources, runs migration/seed operations and uses a fixed test port with relaxed TLS. Not an acceptable default runner. Not run. |
| Package scripts / environment | No unified test or guarded MySQL integration script. `db:test` is migration-core testing, not API persistence; `db:status`/migrate/seed are unsuitable under current restrictions. Runtime normally loads development variables; test mode alone does not prevent fallback. Migration credentials are separately templated, but target the same development database. |

Docker listing was blocked by filesystem access to Docker configuration; the escalated read-only listing was denied. No further Docker access attempted. Thus a running isolated environment is **unverified**, not proven absent. Application-visible schemas cannot rule out another server or schemas hidden by permissions. Historical browser acceptance reports do not prove availability on this machine.

## Smallest recommended setup (not implemented)

1. First inventory existing Docker test resources read-only with permission. If an existing disposable target passes ownership, image/version, loopback endpoint, UUID, TLS, storage, schema and credential checks, reuse it. Do not create another container by default.
2. Reuse the existing browser identity-verification approach in a small API/MySQL runner. Use explicit test-only variables/credentials; bypass development `.env.dev` loading only through an explicit validated test entry point. Abort before application import or any write if identity/configuration is missing or differs. Reject `enterflow_db`, development endpoints, system schemas and unexpected targets; a database-name prefix alone is insufficient.
3. Separate initializer/admin and restricted runtime credentials. Runtime grants cover only approved fixture tables/actions in the isolated schema, with no development grants or DDL privileges. Do not reuse development passwords. Keep secrets ignored and out of logs.
4. After approval, initialize an empty owned test schema from an explicitly reviewed schema snapshot and allowlisted reference data. Reuse the recovery schema/fixture pattern, extended only for required current dependencies and Migration 008 effects. Do not run the migration runner, read Migration 007, or fabricate its ledger/checksum. Preserve existing constraints/business rules; document snapshot coverage and drift limits. Reuse a compatible existing schema when possible.
5. Run one authenticated local API fixture flow, then verify SQL read-back and a separate API read after restart. Include authentication/session/audit writes in approval scope. Start with an inventory metadata edit using synthetic materials; no stock reservation/deduction. Keep GCS disabled; unrelated database tests need no bucket/cloud configuration.
6. For repeatability, use a fresh owned schema/run identifier and deterministic synthetic fixtures on a verified disposable target. Cleanup only test-owned state with identity checks repeated before cleanup; close servers/pools first. Never reset shared development or an existing groupmate test environment. Container removal is appropriate only when the run created and owns it; failed setup must retain diagnostics without broad cleanup.

Proposed implementation files/configuration for Task 002 (final scope depends on existing-target verification):

- Add `backend/test/support/integration-target.mjs`: explicit test configuration, identity/privilege checks and fail-closed guards; reuse existing TLS/CA helpers.
- Add `backend/test/mysql-api.integration.mjs`: guarded initializer/API runner, fixture lifecycle, persistence/read-back and guarded cleanup.
- Add `backend/test/fixtures/integration-schema.sql` and `integration-reference-data.mjs`: reviewed minimal current-schema snapshot and synthetic/reference fixture plan; no migration ledger.
- Add `database/.env.test.example` with test-only keys; ignore actual test secrets in `.gitignore`.
- Update `backend/src/config/runtime-config.js` to support explicit test environment isolation without development fallback, and `runtime-config.test.js` to verify rejection paths.
- Add a guarded `test:mysql:integration` entry in `package.json`; update `docs/TESTING.md` with exact setup/run/cleanup commands and historical-runner warnings.
- If no safe target exists, separately approve adapting the existing tmpfs container lifecycle. `database/compose.dev.yaml` needs no change; do not mount the development volume.

Approval needed before implementation/setup: read-only Docker availability verification; exact target/schema snapshot/reference fixtures and grants; isolated schema/account/fixture writes, authenticated API/session/audit test writes, and narrowly owned cleanup. Container creation/removal only if a reusable target is unavailable and separately approved. No protected Migration 007 access or development writes proposed.

## Validation and Database Change Report

- Checked initial Git status: one pre-existing untracked integration assessment report, preserved. Only `AGENTS.md` and this readiness note are added by Task 001. No runtime tests/build needed for documentation-only changes; no state-changing suite run.
- Final validation: `git diff --check` passed; explicit checks of both new untracked files passed whitespace validation and mandatory AGENTS.md content assertions. Final Git status contains only those two additions and the preserved assessment report.
- SQL reviewed: `materials`, `material_import_review`, `bom_templates`, `bom_template_lines`; Migration 008 row only in `_enterflow_migration_history`; metadata in `information_schema.COLUMNS` and `SCHEMATA`. Inspected Migration 008 source only among newer migrations.
- Schema/data changes performed: **none**. Proposed: isolated test-only schema/fixtures/accounts after approval; no development changes.
- Migrations created/applied: **none**. Migration 007 contents, checksum and history were not accessed or modified.
- No credential changes, imports, stock writes, Docker mutations, cloud operations or Git history operations.
- Remaining gates: Docker target availability and original handoff source are unverified; isolated setup/persistence acceptance is pending. Current development counts and Migration 008 recorded status are verified. Do not claim full runtime isolation acceptance yet.

Exact next task: **Task 002 — Verify/reuse an owned isolated MySQL target, implement the guarded test runner and approved current-schema synthetic fixtures, and demonstrate one authenticated API write with SQL persistence/read-back and safe repeatable cleanup.** Proceed only after the target and write/cleanup scope are approved. Task 002 has not started. Task 003 should separately reconcile the 158 imported records with the 71 authoritative MAIN records without blind imports.
