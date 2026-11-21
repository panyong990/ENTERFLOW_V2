# Phase 2 framework blocker fixes

2026-11-22, Asia/Singapore. Implementation and offline verification only. Live database execution remains unauthorized. Stephanie remains the sole designated recovery operator.

This implements the three blockers and test gaps in `docs/phase2-framework-review-2026-11-22/REVIEW.md`. That review, its diff and its fingerprints remain an unchanged historical snapshot of the preceding patch, not a diff of these fixes.

## Changed files

Modified:

- `database/migrate.mjs`
- `database/migration-phase2.mjs`
- `database/migration-phase2.test.mjs`

Created:

- `database/migration-phase2-tls.mjs`
- `database/migration-phase2-blockers.test.mjs`
- `database/test-fixtures/phase2-metadata.json`
- `database/test-fixtures/phase2-metadata.mjs`
- `database/test-fixtures/phase2-double.mjs`
- `docs/PHASE_2_FRAMEWORK_BLOCKER_FIX_REPORT.md`

No application file, application database configuration, protected SQL artifact, shared migration core, existing review package, credential or environment file was changed. Existing uncommitted work was preserved. No commit was made.

## Implementation

**TLS identity before authentication.** Phase 2 requires the explicit CA, `rejectUnauthorized: true` and mysql2 `verifyIdentity: true`. A per-connection hook verifies the TLS socket's encryption and authorization and invokes Node's `checkServerIdentity` before returning control to mysql2's credential dispatch. The extra check covers the installed driver's IP-specific identity gap; checking only after promise-based connection completion would occur after authentication. Default certificate identity is `127.0.0.1`; an optional, separately reviewed `DB_TLS_SERVER_NAME` selects the certificate hostname without changing the fixed connection endpoint. A connection cannot resolve unless the identity hook ran successfully. Invalid verification configuration stops before constructing a connection; TLS failures destroy that connection without retry. Installed mysql2 3.24.6's TLS callback/credential sequence was inspected as source; no handshake or network probe was run. Driver upgrades require reviewing this hook again.

**History validation before contents.** The runner validates the isolated history object's base-table type, InnoDB engine, collation, columns, primary key/index contract and absence of unexpected triggers before selecting any rows. It first retrieves filenames/states without checksums and validates the complete ordered prefix. Only then does it retrieve a checksum for each approved filename using a bound parameter. Unexpected views, malformed objects, unknown/deferred filenames, non-applied states, gaps and checksum mismatches stop execution. No protected/shared ledger is queried. Metadata comparisons now include index prefix length, visibility, type, direction and expression, alongside name, columns, order and uniqueness. Explicit standard-index expectations supplement the pinned historical evidence without modifying it.

**Enforced empty-table window for 003.** Before each of the two original ALTER statements, the runner disables session autocommit for the locked section and acquires WRITE table locks for `client_applications`, `user_account` and the isolated history table. It verifies a granted explicit `SHARED_NO_READ_WRITE` lock for the current connection in Performance Schema, then counts applications under that lock. Missing permission, missing instrumentation/visibility, a failed lock, warning or nonzero count stops before that ALTER. A bounded session metadata-lock wait is set for activation. The original SQL statements are executed unchanged. No reference prices, quantities, usernames or other historical values are generated.

Locks are reacquired and verified separately for each ALTER because ALTER can release table locks. The second emptiness check detects a writer entering between windows; in that case the first ALTER may remain committed, 003 is stopped, and its failure/applying marker prevents retry. Locks are released after each guarded statement; connection loss also releases server locks. No START TRANSACTION or reconnection is used inside the locked window. The marker is acknowledged and committed before any extension DDL. This adds lock/metadata-permission requirements and can block ordinary application access, including related tables implicitly locked by MySQL; Stephanie must review the activation window and privileges.

This follows MySQL's documented table-lock behavior, including related FK/trigger locking, ALTER lock release, and autocommit handling: [MySQL 8.4 LOCK TABLES](https://dev.mysql.com/doc/refman/8.4/en/lock-tables.html). The Performance Schema observation is a fail-closed verification in addition to the server-enforced lock, not a replacement for it.

**Configuration isolation and preserved shared behavior.** Phase 2 parses only its explicitly selected file into a frozen scoped configuration. It rejects conflicting inherited DB/TLS variables and does not mutate `process.env` or inherit omitted credentials/settings. The shared profile retains its existing environment loader, allowlists, TLS choices and legacy runner dispatch. Its migration core/discovery implementation was not changed. Connection-close failures now produce a bounded diagnostic rather than an unhandled driver object. No configuration file was loaded or changed during these tests; loader and CA input were synthetic.

The exact Phase 2 endpoint guard remains `127.0.0.1:62286 / enterflow_phase2_db`. The immutable extension allowlist, normalized checksums, 001 → 002 → 003 order, pinned P2B002 prerequisites, isolated history, zero-wait advisory lock, SQL-warning handling, applying/failure markers and stop-on-failure rules remain. Legacy migrations/seeds are not discovered. There is still no adoption, automatic retry, seed, backup, restore or destructive recovery operation.

## Offline evidence

Independent table/column/key/index/CHECK and username fixtures were authored separately from the production metadata builder. The test decoder does not import that builder. Expected stage 0/1/2/3 contracts are compared with these independent fixtures; database doubles return the independent contract rather than the production expected result. These are reviewed synthetic expectations, not claimed live MySQL output.

The durable double separates persistent schema/ledger state from per-session transactional buffers, models rollback and commits, and can disconnect before or after an operation persists. New sessions demonstrate that applying/failed markers block retry, while a fully persisted applied marker is accepted only with matching metadata/checksum. Tests cover lost applying-marker responses, DDL responses, completion-update responses, final completion-commit responses, history creation, unavailable failure-marker writes after disconnect, and partial 003 outcomes. Real disk durability, MySQL DDL normalization and certificate handshakes remain outside offline evidence.

Exact commands, in execution order:

```powershell
node --test --test-reporter=spec database/migration-phase2-blockers.test.mjs
```

Initial focused implementation: **61 tests passed**, 0 failed, cancelled, skipped or todo; exit 0; reported duration 1355.3427 ms. These were new blocker tests, distinct from the existing 61-case suite.

```powershell
node --test --test-reporter=spec database/migration-phase2-blockers.test.mjs database/migration-phase2.test.mjs
```

After configuration isolation: **123 tests passed** (62 focused cases plus 61 existing framework regressions), 0 failed, cancelled, skipped or todo; exit 0; reported duration 1385.5026 ms. The existing suite was rerun once because the core, CLI and test-double protocol changed. It now obtains extension metadata from the independent fixtures. Shared-profile regressions include valid 3308/3309 dispatch and rejection of mismatched names and Phase 2's port in the shared path; all use connection/runner doubles rather than invoking legacy discovery.

```powershell
node --test --test-reporter=spec --test-name-pattern="TLS|certificate|hostname|CLI close failure" database/migration-phase2-blockers.test.mjs
```

After the final TLS construction guards and close-error handling: **11 selected tests passed**, 0 failed, cancelled, skipped or todo; exit 0; reported duration 140.5789 ms. Two of these are new guards, taking the focused source suite to 64 cases. The full combined suite was not rerun after these narrowly scoped edits; the affected TLS/close cases were selected instead. Counts across stages overlap and must not be summed as independent tests. No test failed in this task. The 324 application tests were not rerun.

Coverage also includes invalid history views/columns/engines/triggers before any content read, deferred/unknown history before checksum retrieval, same-name index property drift, untracked 001 refusal, writer exclusion under each lock, a writer entering between ALTERs, unverifiable lock visibility/permission, composed CLI-to-real-Phase-2-core dispatch with synthetic connections, wrong targets, malformed CLI flags, missing environment/CA, failed connections/close, ambient environment conflicts and immutable file parsing. Temporary fixtures were retained; no cleanup ran. No build, lint, browser, Docker or application runtime command was run.

## Remaining live gates

- Stephanie's independent review and explicit approval of the revised patch and proposed operations. The code is not authorization to run any CLI command.
- Separately approved credential and CA/certificate identity input. Nothing was created, copied, decoded or inspected here.
- Authorized identity/schema preflight, verified backup/recovery plan and approval for activation, including session SET, LOCK/UNLOCK and Performance Schema SELECT operations. Actual grants and lock instrumentation are unknown. The profile stops if it cannot verify its lock window; it does not enable instrumentation or grant privileges.
- Operator review of actual MySQL 8.4.13 metadata representation and lock behavior under the approved procedure. Offline tests cannot establish those live facts.
- If 001 is already installed without matching isolated history, this runner still refuses adoption/replay. Its actual installed state was not inspected. Any adoption needs a separate reviewed plan; no fabricated history or destructive reset is permitted.

## Database Change Report

Database connections: **none**. Actual database queries/writes: **none**. Migrations/extensions/seeds executed: **none**. Schema/data changes: **none**. Credentials, environment files and database configuration changes: **none**. Backups, restores and cleanup: **none**. The new SQL guards were exercised only as strings through offline test doubles. No migration SQL was created or applied. Existing extension SQL and P2B002 were read only as pinned prerequisites/fixtures; no protected Migration 007/008 SQL, checksums or history was accessed. Completed Q01/Q02 work, existing backups, protected artifacts and database contents remain unchanged. No application switch, deployment, commit or next task occurred.
