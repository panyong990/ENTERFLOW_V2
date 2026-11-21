# Task 002 final implementation review

Date: 2026-11-21 (Asia/Singapore). Review only; the sole file created is this report. Existing implementation files and documentation were not corrected during this review.

## Decision

Confirmed source defects prevent runtime approval. The reported 34 focused and 53 configuration/lifecycle test passes are historical execution evidence; those suites were not repeated. Their coverage does not establish the missing safety properties below.

Reviewed the approved plan, provisioner correction, implementation report, root AGENTS.md, actual new modules and tests, and relevant tracked diffs. Severity High means a required write/ownership boundary is missing; Medium means required acceptance evidence or recovery behavior is incomplete. These are source findings, not observed live database failures.

## Confirmed findings

### F1 — High: cleanup never binds its journal to the connected target

- File/functions: `backend/test/inventory-auth.mysql.integration.mjs:221`, `cleanupPhase`; `backend/test/fixtures/inventory-auth.fixture.mjs:49`, `assertSafeJournal`, and line 173, `guardedCleanup`.
- Evidence: `createOwnershipJournal` stores `identityDigest`, but cleanup never recomputes or compares it. It does not require `journal.runId === identity.runId`; the journal contains no explicit database name. Its validator checks only version/state/run-ID syntax and secret-like key names, not the complete ownership structure. A journal from another target can pass validation and reach row deletion if IDs/markers coincide, for example after a copied/restored fixture.
- Plan violation: yes, section 4 requires target identity and journal agreement before deletes.
- Correction: validate the complete journal schema and required positive decimal-string IDs, database/run identity, fixture digest and timestamp fields; compare its target digest with the verified connection target before any cleanup query. Reject missing, changed, or foreign ownership evidence.

### F2 — High: API connections are verified only at startup

- File/functions: `backend/src/config/database.js:22`, exported pool, and line 39, `testDatabaseConnection`; `backend/src/config/integration-database-identity.js`, `verifyIntegrationDatabaseIdentity`.
- Evidence: the ordinary mysql2 pool is exported unchanged. The identity verifier and UTC session setup run only on the startup probe's single borrowed connection. Later `pool.execute` calls and `getConnection` acquisitions can establish other physical connections without the UUID/certificate/session check. `timezone: 'Z'` is a driver conversion setting, not server session initialization for every pooled connection.
- Plan violation: yes, sections 1–2 require verification for actual pool connections before their operations and UTC throughout.
- Correction: wrap integration-mode acquisitions/executions with verification and per-connection UTC setup; destroy rejected connections. Preserve ordinary development behavior. Test a replacement/new physical connection offline.

### F3 — High: schema/grant gates can be bypassed at phase boundaries

- File/functions: `backend/test/inventory-auth.mysql.integration.mjs:95`, `initializeSchemaPhase`; line 131, `runActualHttpScenario`; line 221, `cleanupPhase`.
- Evidence: initialization runs DDL without checking the initializer's own grants. Cleanup opens its credential and deletes without checking its grants. The scenario checks the four accounts using separate connections, closes those connections, then opens fixture/verifier connections without validating the grants of those actual connections. Role account identity is inferred from the returned grant statement rather than compared with a separately approved account/host identity.
- Plan violation: yes, section 2 requires exact account grants before permitted statements and explicit credential separation.
- Correction: bind each credential to an approved account/host and role; validate self-grants on the actual restricted connection before DDL/DML. Initialization must not require post-schema accounts to exist: verify the initializer independently at that stage.

### F4 — High: scenario accepts arbitrary table-hash evidence

- File/function: `backend/test/inventory-auth.mysql.integration.mjs:131`, `runActualHttpScenario`, especially line 140.
- Evidence: schema evidence is accepted when its header fields match and `hashes.length === 11`. The table names, ordering and individual hashes are never compared with the approved manifest. The scenario does not reload/validate the raw SQL/manifest or verify current table definitions before fixture writes. The object inventory proves names only. Eleven arbitrary entries pass this gate.
- Plan violation: yes, sections 3 and 5 require the approved raw digest and all table hashes before fixtures.
- Correction: load the approved artifacts before any target access, validate all 11 evidence entries exactly, bind evidence to the target and initialization instance, and verify schema drift through the approved initializer/admin boundary before fixtures. Do not broaden API privileges to solve this.

### F5 — High: expiry and phase enforcement end before the last mutations

- File/functions: `backend/test/support/integration-target.mjs:34`, `validateApprovalEnvelope`, line 48, `assertPhaseCapability`; fixture module `insertFixtureTransaction` and `guardedCleanup`; runner `runActualHttpScenario`.
- Evidence: the Symbol capability enforces phase/run/expiry when checked, but fixture/cleanup functions check only once on entry. A long operation may continue inserting/deleting after expiry. The HTTP capability is checked when opening the verifier, before child startup; it is not checked immediately before login, which creates a session. Approval phase strings are not restricted to an explicit known-phase allowlist.
- Plan violation: yes, approved operations require live phase-specific authorization.
- Correction: validate known phases and recheck authorization immediately before each state-changing boundary, including login and transaction commit; define safe rollback/stop behavior on expiry. Validate all required inputs before fixture writes.

### F6 — High: cleanup predicates are weaker than the approved ownership contract

- File/functions: `backend/test/fixtures/inventory-auth.fixture.mjs:88`, `createOwnershipJournal`; line 124, `reconcileFixtureOwnership`; line 173, `guardedCleanup`.
- Evidence: the journal omits active flags and most material NULL/provenance fields. Cleanup does not verify all those fields. Captured sessions are compared only by user ID and double hash, omitting recorded creation/expiry/activity/revocation state. Deletes are autocommitted as the loop proceeds; a later mismatch can leave partial cleanup. The API-stopped condition is not established by cleanup-only execution. Unrecorded-session windows allow an absent end time and compare six-digit MySQL timestamps with three-digit ISO strings lexically.
- Plan violation: yes, section 4 requires complete markers, timestamp windows, session-state checks, API shutdown and stop-on-mismatch before deletes.
- Correction: prevalidate the entire owned row/session set before mutation, compare timestamps as instants at consistent precision, require a bounded stopped-run window or explicit recovery proof, and enforce all approved predicates. Use a transaction or recoverable per-delete journal so interruption cannot create ambiguous partial cleanup.

### F7 — Medium: prepared-journal recovery misses the ordinary rollback case

- File/functions: fixture module `insertFixtureTransaction`, `reconcileFixtureOwnership`, and `guardedCleanup`.
- Evidence: IDs are journaled before commit. If commit fails and rollback succeeds, the prepared journal still contains IDs but both rows are absent. Reconciliation requires one user and one material whenever IDs exist and rejects the zero-row state. The no-op cleanup branch only handles journals without captured IDs. A crash after one cleanup delete similarly leaves a state that later cleanup cannot reconcile.
- Plan violation: yes, the plan explicitly requires zero matching rows in a prepared transaction to be treated as not committed.
- Correction: reconcile zero/complete/partial states independently of whether IDs were captured; safely recognize complete rollback, retain true ambiguity, and record cleanup progress for interrupted retries.

### F8 — Medium: runtime/provisioner evidence has incomplete freshness and identity binding

- File/functions: `backend/test/support/integration-target.mjs:167`, `validateProvisionerRuntimeAttestation`; runner `loadAuthorizedContext` and `runActualHttpScenario`.
- Evidence: provisioner `reviewedAt` is checked only for parseability, accepting arbitrarily old or future evidence. It lacks UUID/certificate binding. Repeated scenario context loads compare only run ID, so grants can be checked on a different target if local identity files change between reads while retaining that run ID. The raw connection factory selects the database before verifying server UUID, contrary to the plan's database-less identity preflight. Container metadata is supplied by a file and is not a live ownership check.
- Plan violation: yes for stale attestation, inconsistent target context and missing database-less preflight; externally supplied container evidence also requires an explicit trusted-operator handoff.
- Correction: freeze one validated identity/approval context for a phase, bind all evidence to its digest and bounded timestamps, reject target changes, and implement the approved initial connection without a selected database. Document the trusted local artifact boundary without claiming files prove current container state.

### F9 — Medium: HTTP assertions do not prove the approved acceptance conditions

- File/function: `backend/test/inventory-auth.mysql.integration.mjs:131`, `runActualHttpScenario`.
- Evidence: login checks success and role only, without user-ID/account identity equality. Cookie parsing extracts a first token without enforcing exactly one cookie or HttpOnly/SameSite/path attributes. Session readback does not assert future expiry. Inventory checks code and NULL quantity only, omitting exact ID, threshold/category/provenance/status values. Database readback checks a subset. Activity is compared with `apiStartedAt`, so the session's initial activity timestamp already satisfies the assertion even if GET never refreshes it. Required independent pre-login fixture/reference and empty-session readback is absent.
- Plan violation: yes, section 5's explicit acceptance assertions are incomplete.
- Correction: implement all documented fixture/actor/cookie/expiry assertions, compare exact material values with separate DB readback, and use the post-login activity baseline for the authenticated request. Test assertion failures with offline injected HTTP/DB adapters.

### F10 — Medium: child lifecycle and preflight can leave writes without usable execution evidence

- File/functions: runner `runActualHttpScenario`, `waitForApi`, `stopApi`, and `main`.
- Evidence: API port/CA child configuration is validated after fixture commit. Child `error` is not handled by the readiness promise. Requests have no timeout/abort signal. Signal handlers are installed only after fixture setup and removed before shutdown completes; no incomplete-run marker is persisted. `stopApi` uses a fixed five-second wait and provides no platform-specific graceful handoff. CLI collapses every error into `TASK_002_GUARD_REJECTED`, including errors after approved writes, and persists no failure-stage evidence.
- Plan violation: yes, sections 5–6 require preflight before writes, bounded shutdown, interrupted-run evidence and safe retained diagnostics.
- Correction: validate all input/output paths and child settings before mutation; handle spawn errors and bounded HTTP requests; retain interruption handling through shutdown; persist sanitized phase/stage and incomplete status. Treat cross-platform process behavior as a prerequisite to validate separately.

## Verified source properties and limits

- Integration mode explicitly bypasses dotenv development loading, rejects development database/ports and requires loopback settings. The child environment copies only an OS-variable allowlist plus explicit API settings. These positive checks do not remedy F2.
- TLS options retain CA and named-certificate verification; helper connections check version, UUID, peer certificate, case mode, SQL modes and UTC. The initial target-selection ordering remains F8.
- Grant constants match the approved four-account matrices and phase-bound six-table provisioner union. No provisioning/grant/teardown/Docker execution phase exists. Constant matrices alone do not enforce actual phase transitions; F3 and F8 describe the missing gates.
- The snapshot parser pins raw bytes, requires 11 ordered CREATE statements, preserves the approved normalization, and the initialization round-trip function compares each result with its manifest hash. F4 concerns the later consumption of that evidence.
- Recomputed SQL SHA-256: `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`. Recomputed manifest SHA-256: `3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4`. Both match the previously recorded artifacts. Neither was modified.
- The default CLI rejects a missing phase before runtime work. No test or command was repeated in this review. Existing tests cover basic pure guards but do not cover the failure/recovery cases above.
- FK cleanup queries include sessions, material approver references and finished-goods updater references; reference rows are checked after cleanup. The broader ownership and recovery gaps remain F1/F6/F7.
- Reviewed new modules contain no migration discovery/import or Docker execution path. Read-only scoped Git status/diff inspection preserved existing work. No claim of historical ownership for every pre-existing change is made.

## Unverified runtime prerequisites

These are separate from confirmed defects: target/Docker availability, current container ownership, real certificates/UUID, actual MySQL grants, metadata visibility, MySQL 8.4.13 round-trip rendering, native Argon2 execution, live HTTP/session behavior, server clock agreement, Windows shutdown behavior, filesystem crash durability, and repeated successful cleanup. The administrator and explicit runtime authorizations remain required. No live evidence was gathered.

The implementation report's claim that no implementation blockers remain is superseded by this review. Correct the source defects and add targeted offline regressions before seeking runtime authorization.

## Database Change Report

Reviewed offline definitions and encoded operations for the approved 11-table closure, especially `roles`, `units`, `users`, `user_sessions`, `materials`, and `finished_goods`. Proposed development schema/data changes: none. Performed schema/data/account/grant changes: zero. Database connections/SQL executions: zero. Migrations created/applied: zero. Docker/container inspections or operations: zero. Backend/API/HTTP executions and cleanup/teardown: zero. Tests rerun: zero.

Only this requested report was created. No implementation/configuration/credential/schema/manifest file was changed. Existing uncommitted work was preserved. Migration 007 and its source, history and checksum were not accessed, inspected, enumerated, hashed, executed or modified. No next task or runtime operation was started.

NOT APPROVED — IMPLEMENTATION DEFECTS REQUIRE CORRECTION

## Continuation status — 2026-11-21

The implementation was re-inspected after the prior correction attempt. Findings below distinguish source behavior from what the offline tests demonstrate. Focused verification was rerun after the changes listed here; results are recorded at the end. Runtime behavior remains unverified.

### F1 — Cleanup journal target binding and structure

- Original defect: cleanup did not bind complete ownership evidence to the verified target.
- Status: **partially corrected during this continuation**. Existing `assertJournalTarget` binds run ID, database, full target identity digest, fixture digest, nonce, row IDs, and immutable fixture markers. This continuation added allowlisted top-level journal keys, required canonical journal fields, exact owned-record/session shapes, and validation of captured session IDs, digests, and timestamps.
- Files: `backend/test/fixtures/inventory-auth.fixture.mjs`, `backend/test/fixtures/inventory-auth.fixture.test.mjs`.
- Regression: focused fixture tests passed, including the new unexpected-field rejection test and the existing foreign-target cleanup guard.
- Remaining limitation: complete per-field validation of captured user/material records and a direct regression for a valid captured journal rebound to another database are still needed.

### F2 — Identity verification on API pool connections

- Original defect: only the startup connection was verified.
- Status: **corrected before this continuation** in `backend/src/config/integration-database-identity.js`: each pool acquisition and pool `execute`/`query` operation borrows a physical connection, sets UTC, verifies its database, server, UUID, TLS certificate, SQL mode, case mode, and timezone, and destroys a rejected connection.
- Files: existing implementation `backend/src/config/integration-database-identity.js`; no change in this continuation.
- Regression: `every acquisition verifies replacement connections and destroys rejected connections` passed in the focused suite.
- Remaining limitation: no live pool/MySQL behavior was exercised.

### F3 — Phase grants and approved account identity

- Original defect: role grants were not consistently verified on the actual connection or bound to an approved account/host.
- Status: **partially corrected**. Schema initialization and scenario fixture/API/verifier connections call `connectRole`, which checks exact grants on that connection. This continuation changed `verifyGrantPhase` to require and compare the separately approved account/host for each role rather than infer identity from the returned grants.
- Files: `backend/test/inventory-auth.mysql.integration.mjs`.
- Regression: focused guard/grant tests passed, but no new direct test drives the phase connection with mismatched approved account identity.
- Remaining limitation: phase grant operations remain unexecuted against MySQL.

### F4 — Approved schema evidence

- Original defect: arbitrary eleven-entry hashes could pass scenario preflight.
- Status: **corrected before and during this continuation**. The scenario reloads the pinned raw SQL/manifest, validates current `SHOW CREATE TABLE` round-trip hashes before fixture writes, and validates schema evidence against all ordered manifest table hashes and target identity. This continuation made the evidence object and each hash entry exact-shape inputs.
- Files: `backend/test/inventory-auth.mysql.integration.mjs`, `backend/test/support/inventory-schema-snapshot.mjs`, `backend/test/support/inventory-schema-snapshot.test.mjs`.
- Regression: new complete/altered/out-of-order/extra-field evidence assertions and existing snapshot tests passed.
- Remaining limitation: the live round trip and administrator object inventory are externally supplied/runtime checks and were not executed.

### F5 — Expiry and phase-specific authorization

- Original defect: approval could expire during long operations and unknown phases were accepted inconsistently.
- Status: **partially corrected before this continuation**. Known phases are allowlisted, capabilities are phase/run/expiry bound, and the fixture/cleanup mutation loops and commit boundaries recheck capabilities. The HTTP path checks the execute capability immediately before login and Inventory access.
- Files: existing `backend/test/support/integration-target.mjs`, `backend/test/fixtures/inventory-auth.fixture.mjs`, and `backend/test/inventory-auth.mysql.integration.mjs`; no change in this continuation.
- Regression: phase/expiry guard tests passed; no injected-clock test covers expiry between each individual mutation or during commit.
- Remaining limitation: interruption/expiry behavior during real database transactions is unverified.

### F6 — Cleanup predicates and interruption safety

- Original defect: cleanup omitted ownership predicates and could partially delete rows before discovering a mismatch.
- Status: **partially corrected before this continuation**. Cleanup now validates user/material markers, session hash digests and lifecycle timestamps, requires stopped API evidence when a window exists, checks inbound references, and wraps deletion in a transaction. A review of the current predicates still finds user/material fields that are not all rechecked by the final `DELETE` predicates, and interruption evidence is not independently proven by process supervision.
- Files: existing `backend/test/fixtures/inventory-auth.fixture.mjs`; no change in this continuation.
- Regression: fixture cleanup tests passed, but no test injects a late mismatch after an earlier delete or verifies rollback of a partially executed cleanup transaction.
- Remaining limitation: complete predicates and injected interruption/mismatch regressions remain required.

### F7 — Prepared-journal and interrupted-cleanup recovery

- Original defect: rollback with captured IDs and cleanup interrupted between deletes could be misclassified.
- Status: **partially corrected before this continuation**. Prepared journals with zero matching rows and cleanup-pending journals with zero remaining fixture rows can be treated as safe no-ops; cleanup itself is transactional. The focused suite currently covers only a prepared journal without captured IDs, not rollback after IDs are journaled or retry after successful deletion before the cleaned marker is persisted.
- Files: existing `backend/test/fixtures/inventory-auth.fixture.mjs`; no change in this continuation.
- Regression: the existing prepared/no-row test passed.
- Remaining limitation: the two required crash/retry states need focused regressions before this finding can be closed.

### F8 — Freshness and identity binding of runtime evidence

- Original defect: stale provisioner attestations and changing target context could be accepted.
- Status: **partially corrected before this continuation**. Provisioner attestations are time-bounded to 15 minutes and bind a digest of the complete target identity; the initial MySQL handshake has no selected database and selects the approved database only after server identity verification. Scenario inputs are loaded into a frozen context and ownership evidence uses the same identity digest.
- Files: existing `backend/test/support/integration-target.mjs`, `backend/test/inventory-auth.mysql.integration.mjs`; no change in this continuation.
- Regression: provisioner/target guard tests passed.
- Remaining limitation: container ownership and complete object inventory are trusted operator artifacts, not live-verified by this source. The external trust handoff still needs explicit runtime validation.

### F9 — HTTP, cookie, session, and persistence assertions

- Original defect: login actor, cookie attributes, fixture values, session lifecycle, and post-request activity were incompletely asserted.
- Status: **partially corrected before this continuation**. Current source checks exact actor identity, one session cookie with required attributes, future session expiry, pre-login empty session/finished-goods state, exact API material values/ID, and independent DB readback after the authenticated GET. The API activity assertion uses the post-login session activity baseline.
- Files: existing `backend/test/inventory-auth.mysql.integration.mjs`; no change in this continuation.
- Regression: guard test passed, but there are no offline injected HTTP/database adapter tests for assertion failures.
- Remaining limitation: actual HTTP and persistence assertions remain unexecuted and failure-path assertion tests are still needed.

### F10 — Child lifecycle and incomplete-run evidence

- Original defect: child configuration and failure handling could leave fixture writes without reliable execution evidence.
- Status: **unresolved**. Port/environment preflight, spawn errors, bounded fetches, and signal-driven stop behavior are present, but signal handlers are installed only after fixture writes, child termination is not platform-specific, and CLI errors still collapse to `TASK_002_GUARD_REJECTED` without a persisted failure stage/incomplete marker. The scenario can also retain open connections on pre-child failures.
- Files: `backend/test/inventory-auth.mysql.integration.mjs` requires correction and lifecycle/failure-injection tests.
- Regression: the guard-only test passed; no child lifecycle test exists.
- Remaining limitation: this finding blocks final offline approval.

## Continuation verification

Focused command:

```text
node --test backend/src/config/runtime-config.test.js backend/src/config/integration-database-identity.test.js backend/test/support/integration-target.test.mjs backend/test/support/inventory-schema-snapshot.test.mjs backend/test/fixtures/inventory-auth.fixture.test.mjs backend/test/inventory-auth.mysql.integration.test.mjs
```

Result after continuation changes: **36 passed, 0 failed, 0 skipped; exit 0**. The approved schema SQL and manifest were read-only; their unchanged digests were independently checked as `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf` and `3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4` respectively.

Task 002 affected configuration/lifecycle regression command:

```text
node --test backend/src/config/runtime-config.test.js backend/src/config/integration-database-identity.test.js backend/src/config/database-tls.test.js backend/src/config/database-ca.test.js backend/src/server-lifecycle.test.js
```

Result: **54 passed, 0 failed, 0 skipped; exit 0**.

Guard check: `npm.cmd run test:mysql:inventory-auth` exited 1 and emitted only `TASK_002_GUARD_REJECTED` before target access. Static `node --check` for the four changed runtime modules and `git diff --check` passed. The snapshot/manifest SHA-256 values above were confirmed by `Get-FileHash`.

No database, SQL, Docker, API, account/grant, fixture, migration, cleanup, or runtime operation was performed. Migration 007 was not accessed.

CORRECTIONS INCOMPLETE — REMAINING DEFECTS DOCUMENTED

## Final outstanding correction pass — 2026-11-21

This section supersedes the earlier continuation status above. It records offline source correction and regression evidence separately from runtime verification.

### F1 — Cleanup journal target binding

- **Source:** corrected. Journals require the exact run/database/identity digest, fixture digest and nonce, positive decimal-string IDs, complete user/material ownership records, and session evidence bound to the owned user. Cleanup loads rows by captured ID, then compares all fields before mutation.
- **Offline regression:** passed in `complete ownership journal cannot be rebound to a foreign database or target identity`; malformed records, another database, and another target identity are rejected.
- **Runtime:** not verified; no database was accessed.
- **Files:** `backend/test/fixtures/inventory-auth.fixture.mjs`, `backend/test/fixtures/inventory-auth.fixture.test.mjs`.

### F2 — API connection identity

- **Source:** corrected in the existing pool guard. Every actual pool acquisition is initialized to UTC and checked against the database, server UUID/version, TLS certificate, case mode, SQL mode, and timezone; rejected connections are destroyed.
- **Offline regression:** passed in `every acquisition verifies replacement connections and destroys rejected connections`.
- **Runtime:** real pool replacement behavior remains unverified.
- **Files:** no change in this pass; regression in `backend/src/config/integration-database-identity.test.js`.

### F3 — Grant account and host identity

- **Source:** corrected. Grant checks on each phase connection compare `SHOW GRANTS` to the explicitly approved account/host and that role’s exact allowlist.
- **Offline regression:** passed in `approved grants bind the actual phase connection to the approved account and host`.
- **Runtime:** real grants were not inspected.
- **Files:** `backend/test/inventory-auth.mysql.integration.mjs`, `backend/test/inventory-auth.mysql.integration.test.mjs`.

### F4 — Approved schema evidence

- **Source:** corrected. Scenario preflight reloads the pinned SQL/manifest, requires the ordered 11 table hashes and exact evidence shape, and rechecks live `SHOW CREATE TABLE` hashes before fixture writes.
- **Offline regression:** passed for exact hashes, order, extra fields, and changed target identity.
- **Runtime:** the MySQL schema round trip and external administrator inventory were not executed.
- **Files:** `backend/test/support/inventory-schema-snapshot.mjs`, `backend/test/support/inventory-schema-snapshot.test.mjs`, `backend/test/inventory-auth.mysql.integration.mjs`.

### F5 — Approval expiry and phase enforcement

- **Source:** corrected. Fixture operations recheck live phase/run/expiry before each statement and before commit; the HTTP phase is checked immediately before login and the authenticated request. Unknown phases remain rejected.
- **Offline regression:** injected-time tests cover expiry during fixture mutations, immediately before commit, and at the login request gate; all passed.
- **Runtime:** transaction rollback on a live MySQL target remains unverified.
- **Files:** `backend/test/support/integration-target.mjs`, `backend/test/fixtures/inventory-auth.fixture.mjs`, their tests, and `backend/test/inventory-auth.mysql.integration.mjs` with its test.

### F6 — Complete cleanup predicates and interruption safety

- **Source:** corrected. Cleanup validates the complete user/material/session set and inbound references before deleting; delete predicates repeat all ownership fields and timestamp values. MySQL timestamp comparison preserves six-digit fractional precision. Cleanup is transactional and requires completed API-stop evidence whenever an API window exists.
- **Offline regression:** exact ownership marker tests, microsecond timestamp tests, and a late-mismatch transaction rollback test passed.
- **Runtime:** SQL predicate behavior and actual process-stop evidence remain unverified.
- **Files:** `backend/test/fixtures/inventory-auth.fixture.mjs`, `backend/test/fixtures/inventory-auth.fixture.test.mjs`.

### F7 — Interrupted-run recovery

- **Source:** corrected. Recovery distinguishes a prepared transaction with no rows, a committed cleanup whose rows are gone, fully owned rows, and partial/ambiguous remnants. Cleanup intent is persisted before deletion; transactions prevent partial committed deletes.
- **Offline regression:** captured-ID rollback, cleanup retry before the cleaned marker, and partial-remnant rejection tests passed.
- **Runtime:** crash consistency against MySQL and the filesystem remains unverified.
- **Files:** `backend/test/fixtures/inventory-auth.fixture.mjs`, `backend/test/fixtures/inventory-auth.fixture.test.mjs`.

### F8 — Freshness and target evidence

- **Source:** corrected for offline-verifiable evidence. Provisioner attestations have a bounded timestamp and complete target identity digest; phase operations use a frozen validated context. The initial MySQL handshake does not select a database before checking server identity.
- **Offline regression:** stale, future, and changed-target attestations are rejected. Identity changes across journal/schema evidence are also rejected.
- **Runtime:** the Docker/container ownership and complete object-inventory artifacts remain a trusted-operator handoff and are not proof of live ownership. These remain separate runtime prerequisites.
- **Files:** `backend/test/support/integration-target.test.mjs`, `backend/test/support/inventory-schema-snapshot.test.mjs`, `backend/test/fixtures/inventory-auth.fixture.test.mjs`.

### F9 — HTTP, cookie, session, and persistence assertions

- **Source:** corrected. Assertions check actor identity, exactly one valid cookie with required attributes, future session expiry, exact API material projection, full independent database material fields, session activity, and independent counts.
- **Offline regression:** injected assertion tests reject wrong login identity, duplicate/malformed cookies, absent attributes, expired sessions, bad activity, altered material values, and inconsistent readback.
- **Runtime:** no HTTP request or database persistence was executed.
- **Files:** `backend/test/inventory-auth.mysql.integration.mjs`, `backend/test/inventory-auth.mysql.integration.test.mjs`.

### F10 — Child lifecycle and incomplete-run evidence

- **Source:** corrected. Ports, child environment, executable/CA paths, credentials, and journal destination are validated before fixture writes. Signal handlers are installed before journal/fixture mutation and remain active through shutdown/evidence finalization. Spawn/early-exit/readiness failures, bounded HTTP requests, shutdown escalation, open connection closure, and durable sanitized failure-stage/recovery state are handled. CLI output distinguishes guard rejection, runtime failure, scenario-incomplete, and cleanup-incomplete outcomes. The child is the direct Node process (no shell); Node documents `SIGTERM` and `SIGKILL` termination behavior on Windows in its [child process documentation](https://nodejs.org/api/child_process.html).
- **Offline regression:** spawn error, early exit, readiness timeout, HTTP timeout, shutdown failure, setup/post-commit interruption, and durable sanitized incomplete-run evidence tests passed.
- **Runtime:** Windows process behavior and the complete API scenario remain unexecuted. A failed bounded shutdown leaves cleanup blocked because stopped evidence is absent.
- **Files:** `backend/test/inventory-auth.mysql.integration.mjs`, `backend/test/inventory-auth.mysql.integration.test.mjs`, `backend/test/support/integration-run-lifecycle.mjs`, `backend/test/support/integration-run-lifecycle.test.mjs`, and `backend/test/fixtures/inventory-auth.fixture.mjs`.

## Final offline verification

Focused Task 002 command:

```text
node --test backend/test/support/integration-run-lifecycle.test.mjs backend/test/fixtures/inventory-auth.fixture.test.mjs backend/test/inventory-auth.mysql.integration.test.mjs backend/test/support/integration-target.test.mjs backend/test/support/inventory-schema-snapshot.test.mjs backend/src/config/integration-database-identity.test.js backend/src/config/runtime-config.test.js
```

Result: **56 passed, 0 failed, 0 skipped; exit 0**.

Affected existing regression command:

```text
node --test backend/src/config/runtime-config.test.js backend/src/config/integration-database-identity.test.js backend/src/config/database-tls.test.js backend/src/config/database-ca.test.js backend/src/server-lifecycle.test.js
```

Result: **54 passed, 0 failed, 0 skipped; exit 0**. Counts overlap and are not additive. The no-approval guard check `npm.cmd run test:mysql:inventory-auth` exited 1 with `TASK_002_GUARD_REJECTED` before target access. Syntax checks and `git diff --check` passed.

Approved SQL SHA-256 remains `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`; manifest SHA-256 remains `3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4`. Both artifacts are unchanged.

### Final Database Change Report

Offline definitions reviewed: the approved 11-table snapshot; runtime fixture and readback scope remains the approved six tables. Schema/data/account/grant changes proposed or performed: none. Database connections or SQL statements executed: none. Migrations created/applied: none. Docker, API, database-fixture, database-cleanup, deployment, or other runtime operations: none. Offline tests created only in-memory fixture values and temporary journal files outside the database. Migration 007 and its source, history, and checksum were not accessed, inspected, enumerated, hashed, executed, or modified. Task 003 artifacts were not changed.

OFFLINE CORRECTIONS COMPLETE — READY FOR FINAL APPROVAL REVIEW

## Independent final approval review — 2026-11-21

This review independently inspected the current Task 002 source and offline regression implementations, the original plan and pre-implementation technical review, the implementation report, and the working-tree state. The historical test results of 56 and 54 passing tests were not rerun. Relevant Task 002 implementation and test files are untracked in the current working tree, so `git diff` contains no patch for those files; this review evaluated their current filesystem contents directly. No Task 003 content was inspected.

### F1 — Cleanup journal target binding: RUNTIME VERIFICATION REQUIRED

Offline source and regression evidence supports the correction: journal structure and ownership records are constrained, captured IDs and fixture markers are checked, and tests reject malformed and foreign-target journals. Cleanup selects captured IDs and validates ownership before deletion. Live database behavior was not exercised, so runtime transaction and persistence behavior remains unverified.

### F2 — API connection identity: RUNTIME VERIFICATION REQUIRED

The pool guard checks each acquired physical connection and destroys a rejected connection. The replacement-connection regression exercises the failure condition by returning a mismatched connection and asserting rejection/destruction. This is meaningful offline evidence; real pool/MySQL behavior remains unverified.

### F3 — Grant account and host identity: RUNTIME VERIFICATION REQUIRED

The phase grant verifier compares grants on the phase connection against the separately approved account/host and role-specific allowlist. Its regression covers a mismatched identity/grant failure. Actual server grants were not inspected, so runtime verification is still required.

### F4 — Approved schema evidence: NOT APPROVED

The source pins the raw SQL digest and table order, but `parseApprovedCreateStatements` takes each `expectedShowCreateSha256` directly from `manifest.tables[index].sha256`; it checks only that the value has SHA-256 syntax. It does not pin the raw manifest digest or independently derive and compare the expected table hashes from the approved SQL. `validateSchemaEvidence` then validates evidence against those manifest-sourced values. The test that hashes each SQL statement and compares it with the manifest is a successful-path test assertion; it does not make the production parser enforce that relationship. A changed manifest with valid replacement hashes can therefore change what production accepts while the SQL digest remains approved. This is an offline source defect in the approved schema evidence chain. The live `SHOW CREATE TABLE` round trip is also unverified, but that runtime gap is not the reason for this status.

### F5 — Approval expiry and phase enforcement: RUNTIME VERIFICATION REQUIRED

Known phases and phase/run/expiry checks are present. Offline injected-time regressions exercise expiry at fixture mutation/commit gates and the HTTP request gate, and rejection is asserted. Actual database rollback and transaction behavior at expiry remain runtime-only and unverified.

### F6 — Complete cleanup predicates and interruption safety: PARTIALLY APPROVED

The source validates ownership and inbound references before deletion, repeats ownership fields in delete predicates, preserves fractional timestamp precision, and executes cleanup transactionally. Offline tests cover ownership and timestamp mismatches. The described late-mismatch rollback regression exercises `runCleanupTransaction` with a generic callback that mutates and then throws; it does not drive the real cleanup query sequence or prove that a late ownership/session mismatch is discovered before the implementation’s deletes. Thus rollback mechanics have useful unit evidence, but the critical cleanup failure condition is not meaningfully covered end-to-end at the offline function level. Live process-stop evidence is also unverified.

### F7 — Interrupted-run recovery: RUNTIME VERIFICATION REQUIRED

Recovery source distinguishes prepared/no-row, cleanup-pending/no-row, fully owned, and partial remnants, and persists cleanup intent before transactional deletion. The offline regressions cover captured-ID recovery, retry before the cleaned marker, and partial-remnant rejection. Actual crash consistency across MySQL commit and filesystem journal persistence remains unverified.

### F8 — Freshness and target evidence: RUNTIME VERIFICATION REQUIRED

Offline guards bind provisioner evidence to freshness and target identity, and tests reject stale, future-dated, or changed-target evidence. The code also verifies server identity before selecting the requested database. The external container ownership and complete object inventory attestations have not been validated against a live target; that remains a separate runtime prerequisite.

### F9 — HTTP, cookie, session, and persistence assertions: RUNTIME VERIFICATION REQUIRED

The assertion functions check actor identity, cookie shape and attributes, session expiry/activity, material projection, readback values, and counts. Offline negative-path assertions reject malformed or inconsistent values, so the guards are meaningfully tested. No HTTP exchange or persisted database readback was performed; those requirements remain runtime-only.

### F10 — Child lifecycle and incomplete-run evidence: RUNTIME VERIFICATION REQUIRED

Lifecycle source handles spawn/readiness/HTTP/shutdown failures, signal-driven interruption, connection closure, and durable sanitized incomplete-run evidence. Offline lifecycle regressions inject failure states and check the resulting failure/recovery records. Windows child-process behavior and orchestration against the complete API scenario remain unverified and require separate runtime authorization.

### Independent evidence and limits

- Read-only SHA-256 verification matched the approved SQL digest `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf` and manifest digest `3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4`.
- The recorded 56-test and 54-test results are treated as historical evidence only; no tests or broad suites were rerun.
- No database, SQL, Docker, API, account/grant, fixture, cleanup, or deployment operation was performed. Migration 007 was not accessed. Only this review document was updated.

TASK 002 NOT APPROVED — OFFLINE DEFECTS REMAIN

## Final independent F4 assessment — 2026-11-21

The latest F4 regression correction is approved offline. The production parser checks `APPROVED_MANIFEST_SHA256` against raw manifest bytes before its own JSON parse, then independently derives each table hash from the pinned SQL with the existing `showCreateSha256` normalization and checks manifest name, order, and hash. The runner passes the verified snapshot statements to schema round-trip and evidence validation; `validateSchemaEvidence` compares evidence against each statement's derived `expectedShowCreateSha256`.

All altered-manifest test cases use the current `(sqlBytes, manifestBytes)` API and confirm each mutation is valid JSON before invoking the parser. They require the exact manifest-digest rejection message. The whitespace-only valid-JSON mutation would otherwise pass the manifest contract and all table checks if the digest gate were removed, so its exact-message assertion would fail. For hash/name/order/count mutations, the exact error assertion also fails if the digest gate is bypassed and a later validation error is returned. The separate evidence test verifies authentic statement-derived evidence is accepted and evidence changed to a later arbitrary manifest-object hash is rejected; the approved snapshot test independently compares every returned expected hash to the existing SQL normalization.

No F4 offline defect remains. The live `SHOW CREATE TABLE` round trip and runtime schema-evidence/persistence behavior have not been verified. The existing F6 status and overall Task 002 decision above were not changed by this F4-only review.

F4 OFFLINE REGRESSION PROOF APPROVED — RUNTIME VERIFICATION REQUIRED

## F4/F6 blocker correction review — 2026-11-21

This section supersedes the F4 and F6 statuses and conclusion in the independent review above. Only the F4 schema evidence support/tests and the F6 fixture test were changed. The approved SQL snapshot, manifest, and unrelated completed corrections were preserved.

### F4 — Approved schema evidence: corrected

`backend/test/support/inventory-schema-snapshot.mjs` now pins the manifest raw-byte SHA-256 to `3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4`. The parser accepts raw manifest bytes and verifies that digest before parsing; `loadApprovedSnapshot` passes the raw bytes through. For each approved SQL statement, the parser derives its expected table hash with the existing `showCreateSha256` / `canonicalizeShowCreate` behavior, then requires the derived table name, order, and hash to match the manifest. Returned statements and downstream schema evidence validation use the derived hash. No new normalization behavior was introduced. The approved SQL digest remains pinned to `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`.

The regression `snapshot parser rejects BOM, CRLF, changed bytes, extra SQL, and manifest drift` now rejects changed raw manifest bytes, a validly formatted altered table hash, altered table names/order, and additional or missing table entries. The approved snapshot test also derives and compares every table hash. Because the manifest digest is pinned, altered manifest variants fail at the raw-byte authentication gate before per-entry validation.

### F6 — Real cleanup sequence: corrected

`backend/test/fixtures/inventory-auth.fixture.test.mjs` replaces the generic transaction-callback rollback test with `guarded cleanup rolls back a late ownership mismatch and retry preserves ambiguous rows`. A controlled in-memory connection adapter receives the actual `guardedCleanup` query sequence. It verifies transaction begin, user/material/session ownership reads and dependency checks, allows the owned session delete inside the transaction, then simulates a late material ownership mismatch at the material delete. The real cleanup path rejects; rollback restores the session and leaves user/material/session rows present, while the journal remains committed and cleanup-pending. The test then changes the material ownership marker and retries: real reconciliation rejects the ambiguous ownership before any delete query, and rollback leaves all rows present. No database connection or SQL execution against a real target was used.

### Verification and limits

Focused F4/F6 command:

```text
node --test backend/test/support/inventory-schema-snapshot.test.mjs backend/test/fixtures/inventory-auth.fixture.test.mjs
```

Result: **17 passed, 0 failed, 0 skipped; exit 0**.

Focused Task 002 command:

```text
node --test backend/test/support/integration-run-lifecycle.test.mjs backend/test/fixtures/inventory-auth.fixture.test.mjs backend/test/inventory-auth.mysql.integration.test.mjs backend/test/support/integration-target.test.mjs backend/test/support/inventory-schema-snapshot.test.mjs backend/src/config/integration-database-identity.test.js backend/src/config/runtime-config.test.js
```

Result: **56 passed, 0 failed, 0 skipped; exit 0**.

Read-only hashing confirmed the approved SQL and manifest digests remain unchanged at the values above. The offline adapter verifies transaction orchestration and query-path safety, not MySQL's actual transaction semantics or concurrent-write behavior. The schema round trip, authenticated HTTP/persistence flow, container ownership, and Windows child behavior remain unverified runtime requirements. No database, SQL, Docker, API, fixture, cleanup, migration, or deployment operation was performed; Migration 007 and Task 003 artifacts were not accessed.

F4 AND F6 CORRECTED — READY FOR INDEPENDENT FINAL REVIEW

## Final independent approval review — 2026-11-21

This section supersedes the preceding F4/F6 correction conclusion. I re-inspected the current source, regression implementations, implementation report, original plan, and pre-implementation technical review. The recorded 17/17 and 56/56 test results were used as historical evidence and were not rerun. Read-only hashing confirmed the approved SQL digest is `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf` and the manifest digest is `3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4`.

### F1 — Cleanup journal target binding: RUNTIME VERIFICATION REQUIRED

Current source binds the full journal identity and validates ownership records. The regression rejects foreign database/target identity, malformed ownership records, and partial or mismatched rows. Offline safeguards remain intact. Persisted journal/database behavior has not been exercised against MySQL.

### F2 — API connection identity: RUNTIME VERIFICATION REQUIRED

The pool guard validates each acquired physical connection and destroys rejected connections. The replacement-connection test asserts a foreign replacement is rejected and destroyed. Live pool behavior remains unverified.

### F3 — Grant account and host identity: RUNTIME VERIFICATION REQUIRED

The phase verifier compares grants against the explicitly approved account/host and expected role grants. Its regression rejects mismatched host/account bindings and extra grants. Actual server grants remain unverified.

### F4 — Approved schema evidence: PARTIALLY APPROVED

Production source now authenticates the exact raw manifest bytes, derives per-table hashes from the pinned SQL using the established `showCreateSha256` normalization, checks each manifest table name/order/hash, and returns the derived hashes used by schema evidence validation. SQL and manifest digests match the approved values above.

The altered-manifest negative assertions are not discriminating against the previous defect. They pass raw `Buffer` values to the prior parser, whose API expected an already parsed object; that implementation throws because manifest properties are absent, so the `assert.throws` assertions pass without detecting its trust of altered manifest hashes. The positive parser test would fail against the old implementation, but that does not make the altered-hash/name/order/count negative cases catch the original vulnerability. Thus the current source correction is verified, while the required negative-path regression proof is incomplete. The SQL/manifest round trip against MySQL remains runtime-only.

### F5 — Approval expiry and phase enforcement: RUNTIME VERIFICATION REQUIRED

Offline injected-clock tests cover phase expiry and unknown phases; fixture tests exercise rollback on expiry during mutation and at the commit boundary, and the HTTP phase gate rejects expired capability. Live transaction behavior remains unverified.

### F6 — Complete cleanup predicates and interruption safety: RUNTIME VERIFICATION REQUIRED

The regression invokes real `guardedCleanup` through the controlled adapter. It exercises transaction start, user/material/session ownership reads and inbound-reference checks, allows the session delete in the transaction, injects a failed material delete, and asserts rollback restores all rows. The committed/cleanup-pending journal remains recoverable. A retry with an altered material marker is rejected before any delete query. This is meaningful offline coverage of the real cleanup sequence; MySQL transaction and concurrency semantics, and real process-stop evidence, remain unverified.

### F7 — Interrupted-run recovery: RUNTIME VERIFICATION REQUIRED

Offline regressions cover captured-ID rollback, cleanup retry states, and rejection of partial remnants. Filesystem/MySQL crash consistency remains unverified.

### F8 — Freshness and target evidence: RUNTIME VERIFICATION REQUIRED

Offline tests reject stale/future/changed-target attestations and container mismatch, while source checks target identity before selecting the requested database. Actual container ownership and administrator object inventory evidence remain runtime prerequisites.

### F9 — HTTP, cookie, session, and persistence assertions: RUNTIME VERIFICATION REQUIRED

Negative-path assertion tests reject wrong actor, duplicate/malformed cookie, missing attributes, expired session, bad activity, altered material values, and independent readback drift. No authenticated HTTP request or database persistence was performed.

### F10 — Child lifecycle and incomplete-run evidence: RUNTIME VERIFICATION REQUIRED

Offline tests cover spawn/readiness failures, bounded shutdown, interruption, and persisted sanitized incomplete-run state. Windows process behavior and full scenario orchestration remain unverified.

No database, SQL, Docker, API, account/grant, fixture, cleanup, or deployment operation was performed. Migration 007 and Task 003 artifacts were not accessed. Only this review document was updated.

## F4 regression proof correction — 2026-11-21

This update supersedes the F4 regression-coverage assessment above. The F4 production implementation was not changed. F6's assessment was not changed.

The altered-manifest tests now call `parseApprovedCreateStatements(bytes, manifestBytes)` with the current raw-byte API. Each replacement is first confirmed to remain syntactically valid JSON, then the test requires the exact error message `Manifest raw-byte digest does not match approval.` Cases cover whitespace-only byte drift, a validly formatted altered hash, altered table name, reversed table order, reordered entries, and missing or extra entries. The whitespace-only mutation is the discriminating control: the JSON content remains identical, so bypassing/removing the raw-byte digest gate would allow parsing to succeed and fail the exact-error assertion. The other mutations likewise assert the digest error rather than accepting a TypeError, missing property, or downstream parser error.

A separate schema evidence test builds evidence from parsed statement hashes, confirms it validates, then changes the separately retained manifest object's hash. Evidence built from the authenticated statement hash continues to validate, while evidence changed to the arbitrary manifest value is rejected. Together with the existing per-statement assertion against `showCreateSha256(statement.sql.slice(0, -1))`, this verifies evidence follows the SQL-derived statement hashes.

Verification:

```text
node --test backend/test/support/inventory-schema-snapshot.test.mjs
```

Result: **6 passed, 0 failed, 0 skipped; exit 0**.

```text
node --test backend/test/support/inventory-schema-snapshot.test.mjs backend/test/fixtures/inventory-auth.fixture.test.mjs
```

Result: **18 passed, 0 failed, 0 skipped; exit 0**. The broader Task 002 focused suite was not rerun because only F4 regression tests and this review section changed.

Read-only hashes remain SQL `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf` and manifest `3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4`. No runtime operations were performed.

F4 REGRESSION PROOF CORRECTED — READY FOR FINAL INDEPENDENT REVIEW

TASK 002 NOT APPROVED — OFFLINE DEFECTS REMAIN
