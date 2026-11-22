# Phase 2 migration 003 — corrected failure-state guard execution

2026-11-22, Asia/Singapore. **FAILED AND STOPPED.** The corrected recovery was executed exactly once. It stopped at the first observer metadata-lock verification, before either ALTER. No retry, alternate recovery, backend startup, application test or unrelated cleanup followed.

## Identity and fresh prerequisites

Git status/diffs and the three preparation/execution/TLS reports, current migration SQL, runner, TLS helper and focused recovery tests were inspected before modification. Existing uncommitted work was preserved.

Fresh independent owner/observer TLS verification passed before querying migration state: both full TLSv1.3 handshakes, CA authorized, explicit IP identity 127.0.0.1 accepted, distinct connection IDs 19/20, identical expected certificate fingerprint. Actual target was **127.0.0.1:62286 / enterflow_phase2_db**, MySQL **8.4.13**, UUID **0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8**, hostname **2acac2d1b606**, internal port 3306. The named target remains enterflow-phase2-mysql; this task verified server identity over its expected TCP endpoint and did not perform another Docker inspection.

Fresh read-only preflight then confirmed:

- Exactly the expected three dedicated history rows/checksums. 001/002 applied with their exact original start/applied timestamps and NULL errors; 003 failed with HANDSHAKE_SSL_ERROR, original started_at `2026-11-21T21:10:31.301Z`, applied_at NULL.
- Complete metadata matches stage 2: 40 baseline tables plus user_sessions, client_applications and dedicated extension history, and all 39 baseline triggers. All original columns/keys/indexes/CHECKs/FK actions and extension 001/002 structures match the pinned contract; no extra username columns/indexes or partial 003 effects.
- All 40 original-column row-count/digest snapshots remain unchanged and empty. client_applications COUNT(*)=0. History and data match the preceding failed-attempt evidence exactly.
- Existing grants, MDL instrument, Performance Schema, InnoDB table locks and own-thread visibility pass read-only checks.

Preflight exit 1 was expected solely because failed history prevents ordinary activation. Actual lock acquisition remained an execution-time gate.

## Minimal change and tests

Changed `database/migration-phase2.mjs` only at the two exact failure predicates: recovery history validation and conditional applying-marker UPDATE now require **HANDSHAKE_SSL_ERROR** instead of ER_TABLE_NOT_LOCKED. The historical explanatory comment about the original locking failure remains unchanged. No other error is accepted. Filename, checksum, timestamps, applied 001/002, stage-2 contract, empty data, identity, fresh activation lock, independent observer, pre-ALTER locks, failure markers and cleanup safeguards are retained.

Updated `database/migration-phase2-recovery.test.mjs` to model that exact error and reject the old error, arbitrary errors, a different failed migration, unexpected applying/applied status, changed timestamps/checksums, each of the five isolated partial username column/index effects, and wrong database/version/UUID. Existing focused cases cover prerequisite/data drift, zero-row conditional transition, observer failure and safe CLI routing.

```powershell
node --test --test-reporter=spec database/migration-phase2-recovery.test.mjs
```

**13 passed, 0 failed**, duration 683.7495 ms. This suite was rerun because its production failure predicate and fixtures changed. No unrelated test suite was rerun. `git diff --check` passed. Tests are offline protocol evidence; final database facts below come from live verification.

## One execution and verified final state

Executed once through the existing Phase 2 runner:

```powershell
node database/migrate.mjs resume-003 --profile phase2 --env-file database/.env.phase2.migrations.local 2>&1 | Tee-Object -FilePath database/phase2-execution/activation-2026-11-22/resume-003-corrected-guard.log
```

**Exit 1.** The log confirms exact target/source checksums, fresh activation advisory lock result 1, original data reads and the accepted HANDSHAKE_SSL_ERROR witness. Owner and observer connected successfully. LOCK TABLES returned without a reported warning, then the observer lock-count assertion failed:

```json
{"event":"003_LOCK_PATH_FAILED","step":"observer lock verification","code":"LOCK_GUARD_FAILURE","errno":null,"tableAlias":null}
```

The observer's SELECT did not establish exactly one granted EXPLICIT SHARED_NO_READ_WRITE lock for client_applications owned by the activation connection. The actual returned count/lock rows were not logged; this report does not infer the precise reason or claim a valid exclusive window. The owner-side locked count and ALTER were never reached. The generic assertion error has no driver code, so existing failure handling stored **PHASE2_FAILURE**. Existing UNLOCK/autocommit restoration, rollback/failure-marker commit, observer close, advisory release and owner close paths followed.

Fresh post-failure preflight and offline before/after comparison verify:

| Verification | Final result |
| --- | --- |
| 003 history | failed; error_code=PHASE2_FAILURE; applied_at=NULL |
| 003 checksum | 95c7f5715281bf5cf1c2543edbdb94783d51803159ce2bd2f976971ea50fe8b5; matches reviewed SQL |
| 003 started_at | 2026-11-21T21:10:31.301Z; unchanged |
| user_account.username | Absent |
| uq_user_account_username | Absent |
| client_applications.username | Absent |
| client_applications.active_username / generated expression | Absent; expression not installed |
| uq_client_application_active_username | Absent |
| Full installed schema | PASS at stage 2; 43 tables, 39 triggers |
| 001/002 history and checksums | Exactly unchanged; both applied |
| Original 40 tables/data | Structure preserved; all 40 row counts/digests unchanged, 0 original rows |
| client_applications | 0 rows |
| Final identity | Same isolated database/version/UUID and verified TLS |

**Remaining blocker:** diagnose the first observer lock-count mismatch in a separately scoped task. The exact count and lock type/duration need evidence before proposing any correction. Do not weaken the assertion, manually edit history or rerun recovery. The corrected guard now intentionally rejects the new PHASE2_FAILURE state. Migration 003 remains incomplete; this report does not certify application readiness.

## Evidence/files

Added under `database/phase2-execution/activation-2026-11-22/`:

- `corrected-guard-tls.json` — fresh successful owner/observer TLS and actual identity.
- `corrected-guard-preflight.json` — fresh pre-recovery schema/history/data and complete SQL list.
- `resume-003-corrected-guard.log` — only execution attempt, original witness and failing lock gate.
- `corrected-guard-postflight.json` — fresh final schema/history/data and complete SQL list.
- `corrected-guard-comparison.json` — true for original-data and 001/002-history preservation.

This report was added; only the two source/test files described above were edited in this task. Prior reports/evidence/TLS changes remain preserved. No environment, certificate, Docker, application configuration, SQL source, dependency or protected artifact was edited. Nothing was staged or committed.

## Database Change Report — this task only

**Connections:** six authenticated, verified TLS connections, all to 127.0.0.1:62286/enterflow_phase2_db: two initial owner/observer read-only TLS probes, one preflight, recovery owner and observer, and one post-failure preflight. Observer was a separate verified connection on the same server. Probe/preflight/recovery success/failure cleanup closed the connections. No shared or restore connection occurred.

**Read-only SQL:** initial TLS probes issued four statements total (identity SELECT plus SHOW VARIABLES for ssl_ca/ssl_cert on each connection). Each preflight issued 61 SELECT/SHOW statements, with full ordered SQL saved in JSON: identity; ten current-schema Information Schema projections; cross-schema FK count; dedicated extension-history rows; three named checksum lookups; 40 original-column row-hash reads; client_applications count; SHOW GRANTS FOR CURRENT_USER(); and three lock-setting/instrument/thread queries. No protected/shared ledger was queried.

**Recovery reads:** exact target identity; same 11 schema/FK queries; dedicated history plus three known checksums; 40 original-column snapshots; Performance Schema/InnoDB settings, MDL instrument, owner-thread visibility, current-user grants; two unlocked client_applications counts; owner connection ID; observer database/version/UUID/connection ID; and the single parameterized Performance Schema metadata_locks JOIN threads count for the owner's client_applications EXPLICIT SHARED_NO_READ_WRITE lock. That last assertion failed before the locked count/ALTER. It is a read, not evidence that the required lock was present.

**Session/locking/transaction SQL:** fresh GET_LOCK and final RELEASE_LOCK for `enterflow:phase2:enterflow_phase2_db`; existing session time_zone, strict sql_mode, autocommit=1 and lock_wait_timeout=5 settings; autocommit=0; one `LOCK TABLES client_applications WRITE, user_account WRITE, _enterflow_phase2_extension_history WRITE`; cleanup UNLOCK TABLES and autocommit=1; applying-marker COMMIT; error ROLLBACK; failure-marker COMMIT. No second table-lock window was attempted. These are session/lock operations, not schema changes.

**Every write:** exactly two framework UPDATEs of the existing `003_username_support.sql` row in `_enterflow_phase2_extension_history`:

1. Conditional state failed -> applying, requiring exact filename/checksum, failed HANDSHAKE_SSL_ERROR, NULL applied_at and original started_at; one affected row acknowledged and committed.
2. Failure state -> failed with error_code=PHASE2_FAILURE, committed and confirmed by fresh SELECT.

001/002 history rows received no writes. No history rows were inserted or deleted. File/checksum/original start time were preserved.

**Migration DDL and data modifications:** 003 recovery attempted once; **zero ALTERs executed, zero schema changes**. No other migration executed. No business-data writes, populated backfill, import, seed, repair, reset/drop/recreation, restore, grant or server configuration changes. Reviewed data tables are the exact 40 pinned P2B002 tables; reviewed extension objects are user_sessions/client_applications and dedicated history. Row-level reads outside dedicated history were only hashed original records and application counts.

**Protected targets:** shared enterflow_db on 3308, enterflow_phase2_restore_p2b002, Migration 007 and its checksum/history were neither accessed nor changed. No legacy migration/seed discovery or entire protected migration-ledger read occurred. No backend startup, application operation, cleanup or commit. Stop point: single recovery failure verified; no retry.
