# Migration status deferral diagnosis

2026-11-16 (Asia/Manila). No database commands or bootstrap commands were run.
Migration 007 contents and its stored checksum were not accessed. Its known
filename is used only as an identifier in the supplied error and this report.

## Confirmed cause

`npm run db:status` invokes `database/migrate.mjs status`. The core runner:

1. Discovers filenames and defers migration numbers 007 and later **before**
   opening, hashing or parsing their SQL. They are not in the active file map.
2. Reads the selected database's migration history.
3. Previously compared every history row with the active file map, including
   history entries for intentionally deferred files.
4. For a deferred name, the map lookup has no result, so the generic
   missing/modified assertion fails before status lists active migrations/seeds.

The user's supplied error is consistent with a history row referencing the
deferred identifier. It does not prove that the file was modified, deleted or
successfully applied, or that its checksum actually differs. The old comparison
failed before checking the row's state. No live history inspection was done in
this investigation, so the actual row state/method and how it arose are not
independently verified.

This is a real verification blocker: recorded database history references a
migration that current policy does not allow the runner to verify. It is **not
proof of a genuine content-integrity mismatch**. A mismatch might exist; the
hold prevents deciding that. Do not turn this uncertainty into a passing check.

## Environment versus tracker logic

The tracker diagnostic explains the failure without requiring an environment
mismatch. The protected configuration files were compared in memory; only
nonsecret targets were printed. Both `.env.dev` and `.env.migrations` currently
select `127.0.0.1:3308/enterflow_db`, with no target overrides in the diagnostic
process environment. This does not establish which overrides, `--env-file`,
working directory or target were used in the earlier failing shell invocation.
The migration CLI loads `.env.migrations`; the application loads `.env.dev`.

Neither live history, schema, data nor Migration 007 needs to be accessed to
reproduce the code path. Tests use temporary synthetic files and mock rows.

## Compliant correction implemented

`database/migration-core.mjs` now identifies deferred history using filename
metadata and reports:

```text
Applied history references deferred migration: <filename>.
Integrity is UNVERIFIED while the hold remains; status/execution is blocked.
Do not alter history or lift the hold to bypass this check.
```

This remains an error/nonzero CLI result. It does not report success, skip a
record and continue, compare/approve its checksum, read held SQL, change the
deferral cutoff or repair database history. Deferred `failed`/`applying` rows
retain an explicit manual-recovery error. Active checksums, missing files,
ordering, advisory locking and failure/retry protections remain in place.
`seed` and `baseline` still reject deferred migrations before database calls
inside the core; the CLI itself opens a connection before invoking the core.

The misleading diagnostic is corrected; full live status remains intentionally
blocked. No policy-compliant code-only change can establish the held file's
content integrity without permission to inspect it. Do not rerun the CLI merely
to demonstrate the new message.

Changed in this continuation:

- `database/migration-core.mjs`: distinguish deferred history, keep rejection.
- `database/migration-core.test.mjs`: synthetic regression coverage.
- `database/TEAM_MIGRATIONS.md`: reconcile the current diagnostic.
- This report.

All pre-existing uncommitted work, including the unexecuted bootstrap proposal,
was preserved. No authentication, Demo/Real, account or portal code was changed.
The bootstrap proposal is not an existing approved employee seed and was not run.

## Seeds and existing employee accounts

The sole SQL file in `database/seeds` is `001_reference_data.sql`. Inspection
confirmed writes only to `roles`, `modules`, `role_modules`, `payment_terms`,
`filter_types`, `material_categories`, `units`, `delivery_methods`, `order_stages`,
`production_stages` and its reference-seed marker in `schema_migrations`.
It contains no employee/user inserts or credentials. The historical local setup
also explicitly recorded no application accounts. Frontend Demo entries are
not database account seeds. No approved repeatable employee-account seed was
found in these procedures; how the groupmates populated their working accounts
remains unknown. No claim is made about unseen private groupmate scripts.

Migrations and seeds execute their own SQL; they do not automatically copy
groupmates' database rows. Replaying the reference seed would not transfer
employee accounts and can conflict with existing reference records. A matching
Git branch does not replicate database contents. Any intentional legitimate
account transfer needs a separately reviewed, authorized transfer procedure;
no such transfer or shared connection is authorized here.

The status failure means that **complete validated status is unavailable**. It
does not make the seed's source purpose unknowable. A narrow, separately
authorized metadata query can establish a seed's recorded marker independently,
without reading any held history or checksum. For the explicitly approved
`enterflow_db` target, first verify its identity and table existence. If the
respective table exists, the proposed queries are:

```sql
SELECT file, state, method, applied_at
FROM _enterflow_migration_history
WHERE file = 'seeds/001_reference_data.sql';

SELECT version
FROM schema_migrations
WHERE version = 'seed_001_reference_data';
```

**These queries were NOT executed.** Missing runner history is possible after
a historical manual installation; a legacy marker alone is not checksum or
current-data verification. An applied seed marker is not evidence that employee
accounts exist. Verifying exact live reference rows would need an additional
bounded read-only comparison. Do not use baseline, seed, migrate, history edits
or hold changes to answer these questions.

## Safe tests and results

`node --test database/migration-core.test.mjs`: **14 passed, 0 failed,
0 skipped**, exit 0. `git diff --check`: passed (existing line-ending notices).

Before the correction, a new fixture test reproduced the original generic
missing/modified error; the 10-test intermediate suite passed. Final fixtures
verify the explicit unverified-history rejection for status/migrate, blocked
failed/applying entries, unchanged active mismatch/missing-file rejection in
both commands, normal seed marker reporting when no history references a
deferred file, and retained lock/deferral/failure protections.

Deferred fixture paths are temporary directories named with synthetic migration
identifiers; reading them as SQL would fail. Throwing checksum getters prove
the new branch does not access deferred fixture checksum metadata. No real
migration directory discovery, live SQL, CLI invocation, bootstrap execution,
database-writing test or Migration 007 inspection was performed.

## DATABASE CHANGE REPORT

- Database connections/queries: **zero** in this continuation.
- Inserts, updates, deletes, schema/history changes: **zero**.
- Migrations, seeds, baselines, resets, account creation: **none**.
- No credentials, password hashes, secrets or personal data disclosed.
- No commit, push, merge, deployment or discarded uncommitted changes.

## Remaining information and approvals

Obtain the nonsecret exact failing invocation, including any `--env-file` choice
and target overrides, plus the groupmates' actual account-provisioning procedure.
Separate authorization is needed if live database/seed-marker verification is
desired. The existing Migration 007 hold remains fully effective: content
verification or reconciliation requires its own explicit review/authorization;
neither deleting history nor enabling the file is proposed. No Admin creation
is proposed or executed as a remedy for this status blocker.
