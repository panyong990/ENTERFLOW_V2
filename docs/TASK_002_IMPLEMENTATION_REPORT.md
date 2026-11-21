# Task 002 implementation report

> Runtime update, 2026-11-21: one authenticated Warehouse scenario and guarded
> three-record cleanup **PASSED** on the isolated run. Full Task 002 acceptance
> remains **INCOMPLETE** because the documented second fresh-run repeatability
> criterion has no evidence. See the [runtime acceptance report](TASK_002_RUNTIME_ACCEPTANCE_REPORT_2026-11-21.md).
> The implementation-only statements below retain their original historical scope.

Date: 2026-11-21 (Asia/Singapore)

Scope: implementation and offline validation of the approved isolated Inventory authentication/MySQL integration-test infrastructure. No runtime target, database, Docker resource, API process, account, grant, fixture, cleanup, or teardown operation was authorized or performed.

## Files created or modified

Modified:

- `.gitignore`
- `package.json`
- `backend/src/config/database.js`
- `backend/src/config/runtime-config.js`
- `backend/src/config/runtime-config.test.js`
- `docs/TESTING.md`

Created:

- `backend/src/config/integration-database-identity.js`
- `backend/src/config/integration-database-identity.test.js`
- `backend/test/support/integration-target.mjs`
- `backend/test/support/integration-target.test.mjs`
- `backend/test/support/inventory-schema-snapshot.mjs`
- `backend/test/support/inventory-schema-snapshot.test.mjs`
- `backend/test/fixtures/inventory-auth.fixture.mjs`
- `backend/test/fixtures/inventory-auth.fixture.test.mjs`
- `backend/test/integration-target.example.json`
- `backend/test/inventory-auth.mysql.integration.mjs`
- `backend/test/inventory-auth.mysql.integration.test.mjs`
- `docs/TASK_002_IMPLEMENTATION_REPORT.md`

The approved SQL snapshot, manifest, Task 003 documentation, frontend, development Compose file, migration sources, and credentials were not modified.

## Implemented components

### Runtime isolation

- Added explicit `INTEGRATION_TEST_RUNTIME=1` handling. Integration and browser modes cannot be combined.
- Integration mode skips `database/.env.dev`; `NODE_ENV=test` alone remains insufficient.
- Rejects `enterflow_db`, MySQL system schemas, ports 3306-3309, non-loopback database/API endpoints, mismatched run database names, non-UTC configuration, missing TLS identity, missing certificate/UUID pins, and invalid SQL-mode pins.
- The API child receives a newly built allowlisted environment. Inherited database variables and unrelated secrets are not copied.
- API startup now rechecks database name, MySQL 8.4.13, UUID, certificate digest, `lower_case_table_names=0`, UTC session time, and the exact approved SQL-mode set.

### Target identity and connection guards

- Validates the exact run ID/database, loopback endpoint, server version/UUID, TLS CA and peer-certificate digests, case mode, SQL modes, pinned image, container ID/name/label, tmpfs storage, no bind/volume mount, and exact port binding.
- Container inspection is externally supplied, identity-bound, and expires after 15 minutes. The implementation contains no Docker invocation or target-creation fallback.
- Every restricted connection factory requires an in-memory, phase-specific, expiring approval capability before connection.
- Connections use strict CA/name verification, `multipleStatements=false`, big-integer strings, and explicitly set the session time zone to UTC before identity verification.

### Grants and provisioner sequencing

- Implements semantic parsing/comparison of `SHOW GRANTS`; roles, extra scopes, extra privileges, and `GRANT OPTION` drift fail closed.
- Encodes the exact initializer, fixture, API, and cleanup matrices.
- Encodes the provisioner phases: database `CREATE, REFERENCES WITH GRANT OPTION` only for provisioning; the exact six-table delegation union only after schema creation; `USAGE` only and locked during runtime; temporary global `CREATE USER` plus exact-database `DROP` only for teardown.
- The scenario requires a reviewed runtime provisioner attestation showing exactly `USAGE`, no other grants, and `locked: true`. The provisioner credential is never accepted by the API/fixture scenario.
- Provisioning, grant application, account operations, and teardown are intentionally external; there is no CLI phase for them.

### Snapshot verification

- Hashes the complete raw SQL bytes with no normalization and requires `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf` in both manifest fields.
- Rejects a BOM, CR/CRLF, missing/extra final LF, changed bytes, manifest/order drift, additional SQL, non-`CREATE TABLE` statements, and anything other than the exact 11 allowlisted definitions.
- Executes only one parsed statement at a time with multiple statements disabled when a future `initialize-schema` capability is supplied.
- Implements the approved table-option AUTO_INCREMENT normalization and requires all 11 `SHOW CREATE TABLE` hashes.
- Requires fresh administrator inventories bound to run/database/UUID/certificate identity: empty before initialization and exact 11 tables with no views, triggers, routines, or events before scenario execution.
- Does not import migration code, read a migration directory, create a ledger, or run migrations/seeds.

### Fixture ownership and cleanup

- Generates the exact synthetic Warehouse employee, `warehouse`/`pcs` references, unknown-stock material, in-memory 43-character password, and application Argon2id hash.
- Writes no plaintext password, password hash, cookie, raw token, stored token hash, credential, or private key to the journal/evidence.
- Uses a durable `prepared` journal before fixture SQL, records generated IDs before commit, commits the single InnoDB fixture transaction, then marks it `committed`.
- Records session ID and a second SHA-256 digest of the stored token hash, never the cookie or stored hash.
- Cleanup is a separate approved phase. It revalidates identity and complete immutable markers, handles prepared/no-commit recovery, rejects partial/duplicate/mismatched state, deletes sessions before the user, checks all inbound user FKs, uses exact ID-and-marker predicates, verifies zero-row readback, preserves and verifies `warehouse`/`pcs`, and persists `cleaned` state.
- Ambiguous ownership retains the target; there is no truncate, prefix cleanup, disabled FK enforcement, automatic teardown, or automatic cleanup after the HTTP scenario.

### Actual HTTP scenario implementation

- Implements direct fixture setup followed by the actual backend child process, `POST /api/auth/login`, cookie/session persistence readback, authenticated `GET /api/inventory`, independent material/session/finished-goods readback, and clean backend shutdown.
- The plaintext password remains only in the one scenario process. The API child receives only API credentials; the verifier uses the cleanup credential.
- The scenario requires current schema evidence, administrator object inventory, exact grants, and dormant-provisioner evidence before fixture insertion.
- This scenario was implemented but intentionally not executed.

### Guarded command and documentation

- Added `npm run test:mysql:inventory-auth -- --phase=<approved-phase>`.
- Supported phases are only `verify-target`, `verify-grants`, `initialize-schema`, `execute-scenario`, and `cleanup`.
- Added exact operator inputs, phase boundaries, ignored local paths, offline test command, and warnings to `docs/TESTING.md`.
- Added ignored paths for local Task 002 approvals, identities, evidence, journals, and CA material.

## Offline validation performed

Focused Task 002 command:

```text
node --test backend/src/config/runtime-config.test.js backend/src/config/integration-database-identity.test.js backend/test/support/integration-target.test.mjs backend/test/support/inventory-schema-snapshot.test.mjs backend/test/fixtures/inventory-auth.fixture.test.mjs backend/test/inventory-auth.mysql.integration.test.mjs
```

Result: **34 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo; exit 0**.

Affected configuration/lifecycle regression command:

```text
node --test backend/src/config/runtime-config.test.js backend/src/config/integration-database-identity.test.js backend/src/config/database-tls.test.js backend/src/config/database-ca.test.js backend/src/server-lifecycle.test.js
```

Result: **53 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo; exit 0**. Counts overlap the focused command and must not be added.

Static checks: `node --check` passed for all seven changed/created runtime modules; `package.json` and the target example parsed as JSON; scoped `git diff --check` passed.

Guard evidence:

- `npm.cmd run test:mysql:inventory-auth` exited 1 with only `TASK_002_GUARD_REJECTED`.
- `npm.cmd run test:mysql:inventory-auth -- --phase=verify-target` without runtime/approval inputs exited 1 with only `TASK_002_GUARD_REJECTED`.
- The PowerShell `npm` shim was blocked by local execution policy before Node ran; `npm.cmd` was used for both meaningful guard checks.

The guard checks opened no database/network connection, started no API, and performed no Docker or SQL operation.

## Implemented but intentionally not executed

- Live target/container/TLS/UUID verification.
- `SHOW GRANTS` verification against real accounts.
- Schema initialization and MySQL `SHOW CREATE TABLE` round trip.
- Fixture transaction and journal persistence against MySQL.
- Backend startup and actual HTTP login/Inventory scenario.
- Independent MySQL readback.
- Cleanup-only flow.
- All provisioning, account/grant, Docker, database-drop, and container-teardown operations; these remain external and separately approved.

## Remaining runtime prerequisites

No implementation blocker remains. Runtime review must still approve and supply an existing isolated target, fresh Docker inspection artifact, identity/CA pins, phase-specific approval envelope, externally provisioned least-privilege accounts, fresh administrator object inventories, dormant-provisioner attestation, ignored credentials/evidence paths, and an explicit loopback API port. Docker availability and actual MySQL behavior remain unverified because runtime access was prohibited.

## Database Change Report

- Offline table definitions reviewed: the approved 11-table snapshot. Runtime DML scope encoded for `roles`, `units`, `users`, `user_sessions`, `materials`, and `finished_goods` only.
- Application database/schema changes proposed or performed: **none**.
- Isolated database/schema changes performed: **none**.
- Data changes performed: **none**.
- Database connections or SQL statements executed: **none**.
- Accounts/grants created, changed, or inspected live: **none**.
- Migrations created/applied: **none**.
- Docker/infrastructure operations: **none**.
- Backend/API processes started: **none**.
- Frontend changes: **none**.
- Git history operations: **none**. Only scoped read-only status/diff validation was used; no commit, push, reset, clean, stash, restore, merge, rebase, or branch operation occurred.
- Existing uncommitted and groupmate work was preserved.
- Protected Migration 007, its source, history, and checksum were not accessed, inspected, enumerated, hashed, executed, modified, or validated.

IMPLEMENTATION COMPLETE — READY FOR IMPLEMENTATION REVIEW

## Continuation note — 2026-11-21

The later `TASK_002_FINAL_IMPLEMENTATION_REVIEW.md` supersedes the earlier statement above that no implementation blocker remains. During the continuation, journal shape validation and exact schema-evidence validation were strengthened, and grant verification was bound to approved account/host identities. Focused offline tests now report 36 passed; affected configuration/TLS/CA/server-lifecycle regressions report 54 passed. The guarded package command without approval exited 1 with `TASK_002_GUARD_REJECTED` before target access.

The final implementation review still records unresolved or partially verified cleanup predicate/recovery, injected HTTP assertion, account-phase regression, and child lifecycle/incomplete-run evidence work. Task 002 is therefore not ready for runtime approval. The approved 11-table SQL snapshot and manifest were not changed. Their SHA-256 values remain `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf` and `3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4`.

### Continuation Database Change Report

Tables reviewed were limited to offline definitions and source workflows for the approved 11-table snapshot, with no database connection or SQL execution. Schema/data/account/grant changes proposed or performed: none. Migrations created/applied: none. Docker/API/runtime operations: none. Migration 007 and its source/history/checksum were not accessed, inspected, enumerated, hashed, executed, or modified.

## Final offline correction pass — 2026-11-21

The final correction pass documented in `TASK_002_FINAL_IMPLEMENTATION_REVIEW.md` supersedes the earlier continuation status. Offline-correctable F1–F10 findings now have source corrections and focused offline regression evidence. Remaining limits are runtime-only prerequisites: actual MySQL/schema/HTTP/persistence behavior, container ownership attestations, and Windows process behavior have not been verified. The current decision is **OFFLINE CORRECTIONS COMPLETE — READY FOR FINAL APPROVAL REVIEW**; this is not runtime execution approval.

The pass changed only Task 002 runner/support/fixture code and focused tests plus the Task 002 reports. The approved SQL and manifest remain byte-for-byte unchanged. Final focused results: 56 passed; affected configuration/TLS/CA/server-lifecycle results: 54 passed (overlapping suites). The guarded command without approval rejected before target access. No database connection/SQL, Docker, API, account/grant, database fixture, database cleanup, migration, or deployment operation was performed. Offline tests used in-memory fixtures and temporary journal files. Migration 007 and Task 003 artifacts were untouched.

### Final Database Change Report

Offline definitions reviewed: approved 11-table snapshot and encoded six-table fixture/readback workflow. Schema/data/account/grant changes proposed or performed: none. Database connections/SQL executions: zero. Migrations created/applied: zero. Docker/API/runtime operations: zero. Migration 007 and its source, history, and checksum were not accessed, inspected, enumerated, hashed, executed, or modified.
