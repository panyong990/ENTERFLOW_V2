# Migration procedures and current safety hold

> **2026-11-16 closure evidence:** [Tasks 28/29 report](../docs/TASKS_28_29_CLOSURE_2026-11-16.md).
> Fresh fixture suite: **17 passed**, zero failures/skips. The existing safe
> deferred-history diagnostic correction was verified, not bypassed. Task 28
> remains **PARTIAL / BLOCKED for integrity reconciliation**. No database
> connections/queries/writes or held-file inspection occurred in this pass.
> Cloud execution is not supported by the current local-only CLI; target/TLS
> changes, isolated recovery verification and exact migration effects require
> a separately reviewed and authorized plan. Preserve all eight user-reported
> local employees, audits and existing data; do not migrate/baseline development.

Updated 2026-11-17 (documentation/evidence reconciliation only; no new tests).
Task 28 remains **PARTIAL**: local safeguards have recorded synthetic evidence;
live integrity verification is blocked, formal acceptance is outstanding, and
production prerequisites remain unverified.
This is the current migration safety guide. Historical
validation evidence is retained in [WORKFLOW_VALIDATION.md](WORKFLOW_VALIDATION.md)
and the completed local database setup record in [DEVELOPMENT.md](DEVELOPMENT.md).
The procedure labels below distinguish source-verified behavior from historical
execution evidence and future proposals.

## Current decision: do not run the migration framework

### Evidence reconciliation - 2026-11-17

Task 28 remains **PARTIAL / BLOCKED for live integrity acceptance**. This
documentation update records existing evidence only; it executes no tests,
Docker commands, database connections, or migration operations.

| Evidence stage | Recorded result | What it does not establish |
| --- | --- | --- |
| Offline synthetic migration-core verification | Earlier development result: 9 tests. Latest recorded migration-core result: `npm run db:test`, 17 passed, 0 failed, 0 skipped; underlying command `node --test database/migration-core.test.mjs`. These are separate stages, not 26 tests or a new execution. | Actual development database, schema, or migration-history integrity. Separate baseline-verifier tests do not change this migration-core count. |
| Approved Docker container identity inspection | `docker inspect enterflow-mysql-dev --format "Name={{.Name}} Image={{.Config.Image}} State={{.State.Status}}"` succeeded, exit 0; exact output recorded below. The initial sandbox attempt was denied access to Docker's named pipe; the authorized elevated retry succeeded. | MySQL connectivity, host-port mapping, database identity or contents, migration-history state, TLS identity, or integrity. |
| Proposed live metadata inspection | Offline source review identified a possible explicit-column SELECT of `file`, `state`, `method`, `started_at`, and `applied_at`; no query was executed. Exclude `checksum` and `error_code` at retrieval. | Authorization to connect, approval to retrieve deferred-row metadata, or full integrity verification. Filename ordering and timestamps alone do not prove actual execution order or SQL/schema correctness. |
| Actual live development migration-history integrity verification | **UNVERIFIED / BLOCKED** under the current restrictions. | No synthetic test or container identity result closes this acceptance gate. |

Exact output of the previously approved container inspection:

```text
Name=/enterflow-mysql-dev Image=mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902 State=running
```

This image digest identifies the container image; it is not a migration-history
checksum or evidence of database contents. The one-operation Docker approval
does not authorize subsequent Docker operations or any database access.

Before any proposed metadata inspection, obtain explicit approval for the exact
target, connection/TLS procedure, operator, SELECT statements, output columns,
and any deferred-row filename/status metadata. The documented development
endpoint is `127.0.0.1:3308`, database `enterflow_db`; its connection mapping and
database/server identity were not verified by the container check. Stephanie
remains the sole designated recovery operator; no alternate operator,
credential copying, or permission workaround is authorized.

The core's preflight is distinct from the CLI: the CLI opens its connection
before invoking the core, and normal history loading uses `SELECT *`. Neither
CLI status nor filtering protected fields after retrieval is an acceptable
metadata-only substitute. No CLI command is authorized here.

The historical checksum-inspection deviation disclosure elsewhere in these
records is preserved unchanged. It cannot be undone; formal disposition by the
responsible approver remains outstanding. Migration 007 and protected values
remain off-limits. Full Task 28 acceptance still requires sufficient authorized
live evidence and applicable formal/production acceptance gates; a metadata-only
inspection, even if later approved and successful, cannot alone close Task 28.

Migration 007 remains deferred and strictly off-limits. The runner now defers
migrations numbered 007 and later from filename metadata before opening or
reading their SQL; the isolated core test uses only temporary fixtures. This
removes the previous file-discovery blocker, but does not authorize database
access. The CLI still opens a database connection; `migrate` may execute
pending non-deferred migrations, while `status` still queries the database.
The core rejects `seed` and `baseline` before issuing database queries whenever
deferred migrations are present. However, `migrate.mjs` establishes its database
connection before invoking that core preflight. CLI `status`, `seed`, and
`baseline` are not safe under a no-database-connection restriction; neither is
`migrate`. Do not run a CLI command without separate target and operation
authorization. Do not manually import SQL, edit checksums/history, remove or
rename a file, or bypass discovery. This continuation did not open, read, hash,
or modify Migration 007, and did not access a database. The earlier Task 28
report preserves a prior broad-search deviation; that historical record is not
erased here.

## Runner behavior — VERIFIED FROM CODE

- Runner entry point: `database/migrate.mjs`; core behavior:
  `database/migration-core.mjs`.
- Runner history table: `_enterflow_migration_history`. It stores migration
  filename, normalized SHA-256 checksum, state (`applying`, `applied`, or
  `failed`), method (`execute` or `baseline`), start/applied timestamps, and a
  bounded error code. Legacy `schema_migrations` is consulted by the baseline
  verifier; it is not the current runner ledger.
- Hashing strips an initial UTF-8 BOM and normalizes CRLF/CR to LF before
  SHA-256. Applied history is compared with discovered files and checked for
  missing/changed files, non-applied states, and ordering gaps.
- Discovery validates and orders SQL filenames, but skips migrations numbered
  007 or later before `readFile`, checksum calculation, or SQL parsing. All
  such migration filenames are reported as `DEFERRED`; deferring later numbers
  as well prevents a later migration from running ahead of the held sequence.
  A history row for a deferred file is absent from the active file map. The
  runner now reports this explicitly as deferred history with integrity
  `UNVERIFIED`, and still blocks status/execution. This replaces the misleading
  generic missing/modified message without accepting the recorded checksum or
  accessing deferred SQL. Deferred `applying`/`failed` rows still require manual
  recovery. Active-file checksum, missing-file and ordering checks remain intact.
  The core loads history using `SELECT *`: avoiding a deferred checksum property
  in application logic does not prevent retrieval of that column from a real
  database. The normal CLI/status path is not an approved substitute for a
  restricted metadata-only inspection. Any future authorized method must exclude
  protected values at retrieval; no such inspection was performed here.
- After file discovery and the database identity query, a database-name-derived
  MySQL advisory lock is acquired with zero wait and released in `finally`.
  It does not protect discovery/checksum work, which occurs first. The CLI
  accepts only local `127.0.0.1` targets on port 3308 for development or 3309
  for the isolated migration-test target, and requires MySQL 8.4. It loads
  `.env.migrations` by default, not the application `.env.dev`.
- TLS is configured by the CLI. Source also contains a local self-signed
  certificate option that disables certificate validation when explicitly
  enabled. That option is not approved for this handoff; do not enable it.
  Future approved execution must use verified CA and identity settings.
- SQL parsing allowlists ordinary statements and rejects database switches,
  qualified identifiers, runner-history writes, integrity-control changes,
  executable comments, routines/delimiter syntax, and unsupported directives.
  This is a guardrail for reviewed project SQL, not a sandbox for hostile SQL.
- Baseline verification checks every manifest file against the discovered
  normalized digest, then compares canonical table, column, index, foreign-key,
  and CHECK metadata. It also refuses unexpected triggers, routines, or events;
  compares legacy `schema_migrations` versions with the expected ordered file
  set; and verifies reference-seed state. If the seed marker exists, each
  required manifest row must match exactly. Without that marker, every
  reference-seed table must be empty. Any mismatch stops before runner history
  is created. After all checks pass, baseline records eligible files in a
  transaction without replaying their SQL.
  These are implemented safeguards, not dedicated baseline-verifier acceptance
  evidence. The inspected 17-test synthetic suite does not provide dedicated
  execution coverage of `verifyBaseline`; live baseline adoption is unauthorized.
- Execution records `applying` before each file and marks `applied` only after
  statements and commit succeed. On failure, rollback and writing `failed` with
  a bounded error code are best-effort; if that ledger update also fails, the
  row can remain `applying`. Either non-`applied` state blocks automatic retry.
  MySQL DDL may implicitly commit, so rollback cannot undo a partial DDL file.
  Recovery requires investigation, backup review, and a separately authorized
  plan; do not edit history to force a retry.

These are verified code properties, not current database state. They were not
executed or database-verified in this task. Historical workflow test results
are labeled in [WORKFLOW_VALIDATION.md](WORKFLOW_VALIDATION.md) and are not
current results.

## Development and test procedure — PARTIALLY VERIFIED

Recorded evidence has separate development stages: an earlier run of
`node --test database/migration-core.test.mjs` passed 9 synthetic tests. The
latest recorded result is `npm run db:test` (the same underlying Node command):
**17 passed, 0 failed, 0 skipped**, Node.js v24.21.0, as recorded in the
[local closure report](../docs/TASKS_28_32_FINAL_LOCAL_CLOSURE.md). Do not add the
counts together. No tests were executed in this documentation reconciliation.
Neither result establishes actual database or migration-history integrity.

The discovery change is implemented in `migration-core.mjs`. The focused test
`node --test database/migration-core.test.mjs` passed using temporary fixtures
only: deferred fixture paths are directories, so an accidental SQL read would
fail; a mock database confirms `migrate` submits only active fixture SQL and
acquires/releases the advisory lock. The same test confirms `seed` and
`baseline` reject deferred migrations before any core database call; this does
not test or bypass the CLI's earlier connection establishment. This focused
test does not discover the real migration directory. The database integration
scripts were not run; the workflow script stops before Docker setup when
deferred migrations exist, and the Migration 007 test stops before Docker or
database operations when its target remains deferred. Its checksum report
labels scope as active migrations and reference seeds only.

These are source-level and isolated-test results, not database execution
evidence. Do not run the CLI as part of this task: it opens a database
connection, and no database was accessed. Before any future development/test
migration:

1. Review the deferred-version cutoff and active file set; changing the cutoff
   requires explicit approval and a focused code review. Preserve checksum
   verification, SQL allowlisting, baseline verification, target/TLS guards,
   advisory locking, failure markers, and no-automatic-retry behavior.
2. Keep discovery tests on synthetic temporary fixtures. Prove deferred paths
   are not opened, hashed, parsed, or applied; do not discover the real
   migration directory in tests.
3. Review the exact approved file set, isolated target identity, schema effects,
   backup/recovery needs, and least-privilege DDL identity. Never use the
   browser-test database for schema-development work.
4. Only after code review, fixture tests, target review, and separate
   authorization, execute the explicitly reviewed set. Stop on mismatch or
   error; do not repair history or retry automatically.

Database execution, target review, and production procedures remain proposed
and unverified.

## Outstanding acceptance and operator gates

- Live migration-history integrity is **UNVERIFIED / BLOCKED** pending exact
  target, operation, permitted evidence, and operator authorization. Synthetic
  success does not close this gate. If protected-content restrictions prevent
  sufficient verification, retain the gap rather than bypassing the hold.
- The earlier broad-search checksum-inspection deviation remains part of the
  record and cannot be undone. Formal disposition by the responsible approver
  is outstanding; this reconciliation does not grant acceptance or a waiver.
- Stephanie remains the sole designated recovery operator under the integration
  handoff. No alternate operator, identity/permission workaround, or credential
  copying is authorized. Earlier approvals do not override current restrictions.
- Current restrictions prohibit database connections/queries, Docker operations,
  migrations, baseline/seed execution, protected migration/checksum inspection,
  and any history or checksum alteration. This document grants no execution
  authorization. Local documentation and synthetic evidence are separate from
  recovery and production acceptance.

## Production migration prerequisites — PROPOSED / NOT EXECUTED

Production migration work is not configured. Before any future production
change, require a selected platform, approved change window and owner, verified
production server/database identity, a tested restorable backup, documented
forward-recovery plan for partially committed DDL, separate least-privilege DDL
account, verified TLS CA and certificate identity, reviewed migration contents
and effects, explicit approval for the exact migration set, post-change
schema/data checks, and application smoke checks. Do not put migration
execution in container startup or assume DDL rollback restores prior state.

## Migration 007 disposition

Deferred. This continuation did not open or read its SQL or checksum, access its
history, modify it, or execute it. The prior Task 28 report records an earlier
broad-search deviation; preserve that record. Do not change its history or use
the hold as a reason to weaken integrity controls. The runner now defers
migration numbers 007 and later before SQL file access; changing that cutoff
requires explicit approval.
