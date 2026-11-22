# Extension 003 recovery preparation

2026-11-22, Asia/Singapore. **PREPARED; NOT EXECUTED.** No recovery write or extension execution occurred. Separate authorization is required before using `resume-003`.

## Initial inspection and actual database verification

Initial `git status --short`, `git status --porcelain=v1 -uall`, and `git diff --stat` were empty. There were no existing uncommitted changes. The separate-observer locking correction and its focused tests were already in the working tree at HEAD; they were inspected and preserved.

The existing read-only preflight was inspected before invocation:

```powershell
node database/migrate.mjs preflight --profile phase2 --env-file database/.env.phase2.migrations.local
```

The sandboxed attempt stopped during Windows DPAPI decryption, before any database connection. The same command then ran with approved escalation to permit existing credential decryption. It opened one certificate-verified TLSv1.3 connection to **127.0.0.1:62286 / enterflow_phase2_db**, MySQL **8.4.13**, server UUID **0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8**, hostname **2acac2d1b606**, internal port **3306**, account **root@%**, connected user **root@172.17.0.1**. Certificate IP identity 127.0.0.1 passed; fingerprint `DD:4C:C3:18:88:44:CB:2A:71:04:76:E2:D8:CF:BD:7D:F4:63:E9:E0:91:2A:04:43:95:7B:AD:1B:DA:60:DB:2A`.

| Verification | Fresh result |
| --- | --- |
| 001 `user_sessions` | Applied; full expected stage-1 structure present |
| 002 `client_applications` | Applied; full expected stage-2 structure present |
| 003 `username_support` | Failed; `ER_TABLE_NOT_LOCKED`; applied_at NULL |
| Either 003 ALTER took effect | No; full metadata exactly matches stage 2, including absence of added columns/indexes |
| `client_applications` contents | Exact COUNT(*) = 0 |
| Original P2B002 structure | Preserved; full metadata comparison passed; 43 total tables including extensions/history, 39 triggers |
| Original P2B002 data | All 40 original tables have 0 rows; each original-column snapshot digest is `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`, matching the empty activation snapshots |
| Grants | Existing required migration grants present; no grant changes |
| Lock instrumentation | Performance Schema=1, innodb_table_locks=1, MDL instrument YES, own connection thread visible |
| Live corrected lock acquisition | UNVERIFIED; no activation/table locks acquired |

Actual dedicated history, with UTC timestamps:

| File | State | started_at | applied_at | error_code |
| --- | --- | --- | --- | --- |
| 001_auth_sessions.sql | applied | 2026-11-21T21:10:31.168Z | 2026-11-21T21:10:31.222Z | NULL |
| 002_client_registration.sql | applied | 2026-11-21T21:10:31.226Z | 2026-11-21T21:10:31.294Z | NULL |
| 003_username_support.sql | failed | 2026-11-21T21:10:31.301Z | NULL | ER_TABLE_NOT_LOCKED |

All three actual checksums match the fixed manifest in `database/migration-phase2.mjs`. Preflight exited **1 / FAIL**, as expected: failed history deliberately blocks ordinary activation. This does not contradict the successful structural/data verification. Statement-history diagnostics returned no matching failures; the long-history consumer is disabled. No diagnostic settings were changed, and no new claim about the original failure sequence is inferred from the empty history buffer.

## Safeguards and narrowly scoped mechanism

`node database/migrate.mjs resume-003 --profile phase2 --env-file database/.env.phase2.migrations.local` is a new explicit, combined recovery-and-execution operation. **It is not a read-only preparation command. Do not run it under this task's authorization.** There is no standalone command that clears failure and leaves ordinary migration unlocked for later use.

On a subsequent authorized invocation it:

1. Uses the existing isolated environment, credential and verified TLS connection factory. Rejects any other endpoint/schema, wrong MySQL version or wrong server UUID. Rechecks fixed extension, bootstrap and baseline-evidence hashes without legacy discovery.
2. Acquires a **fresh** `GET_LOCK('enterflow:phase2:enterflow_phase2_db',0)` on the execution connection. An unavailable lock stops the invocation.
3. Validates the dedicated history object's complete structure before reading it. Requires exactly the three known entries in order, matching checksums, the exact timestamps above, applied 001/002 with NULL errors, and failed 003 with the exact original error and NULL applied_at.
4. Requires the entire schema to match stage 2, rejecting either partial ALTER, any full 003 installation or unrelated drift. Rechecks all 40 original tables are empty, existing grants, Performance Schema/MDL instrumentation, innodb_table_locks, owner-thread visibility and empty client_applications. No adoption or populated backfill is supported.
5. Logs `003_RECOVERY_VALIDATED` with the original history witness. Performs exactly one conditional framework UPDATE of the existing 003 row to `applying`, requiring its file, checksum, original start time, failed state, error and NULL applied_at still match. It requires one affected row, no warning and a durable commit before any DDL. It retains the original started_at/checksum/error at this transition. **No history row is deleted or reinserted; 001/002 receive no writes.**
6. Opens a distinct verified observer connection to the same Phase 2 UUID/schema/version. For **each** of 003's two reviewed ALTERs, obtains fresh WRITE locks on client_applications, user_account and the dedicated history table. The observer verifies the owner's granted EXPLICIT SHARED_NO_READ_WRITE metadata lock for client_applications. The owner then rechecks COUNT(*)=0 and performs that ALTER. Lock inspection never runs on the LOCK TABLES owner. Each window releases its locks; no reconnect or automatic retry is implemented.
7. Verifies full stage-3 metadata, closes the observer, marks only 003 applied with applied_at and error_code=NULL, and compares all original-column data snapshots before/after. Logs success only through the existing execution path. The advisory lock is released in finally; the CLI closes the execution connection.

The conditional transition prepared in code is:

```sql
UPDATE `_enterflow_phase2_extension_history`
SET state='applying'
WHERE file=? AND checksum=? AND state='failed'
  AND error_code='ER_TABLE_NOT_LOCKED'
  AND applied_at IS NULL AND started_at=?
```

Parameters are exclusively the pinned 003 filename/checksum and `2026-11-21T21:10:31.301Z`. This SQL is documentation of the framework operation, **not an instruction to run manual history SQL**. The explicit framework state transition itself remains pending approval.

Ordinary `migrate` and `status` continue to refuse the current failed history. Resume cannot replay 001/002: its validated applied count is exactly 2 and its loop covers only manifest entry 003. Failed/applying history following another error is not automatically cleared. Existing failure-marker and connection-loss behavior remains conservative; partial DDL requires another review.

## Corrected locking review and remaining risks

Source inspection confirms the corrected separate-observer identity checks, parameterized owner connection ID, fresh lock verification for each ALTER, owner-side empty counts and owner-side DDL, and observer/owner cleanup. The five previously completed focused locking tests were **not rerun**. No live test of the corrected locking path was attempted.

- MySQL DDL implicitly commits; the two ALTERs are not atomic together. First-ALTER persistence followed by second-ALTER failure can leave partial DDL. This recovery rejects that state; stop and inspect instead of rerunning.
- Another writer can enter between the two lock windows. The second locked empty check stops its ALTER if client_applications becomes populated. Arrange an approved quiet execution window for application writers and independent schema/history operators; advisory locks coordinate only cooperating runners. Snapshot reads and prerequisite reads are sequential, not a single consistent database snapshot.
- Observer metadata visibility and actual MySQL FK-related table locks remain execution-time gates. Existing grants/instrumentation pass read-only checks, but that does not prove the corrected live ALTER path will succeed. No permissions/configuration changes are authorized to bypass a failure.
- Lost marker/commit/DDL acknowledgements remain ambiguous. Stop on nonzero exit; do not retry or manually edit history. Existing failure handling can leave applying, failed or committed DDL requiring read-only diagnosis.
- The original failed witness is retained in the recovery log; the successful history row's error is cleared only upon completion. Preserve the original activation evidence and capture the subsequent recovery output. The current history schema does not provide an append-only attempt ledger; none is added here.
- This mechanism is intentionally bound to this empty P2B002 instance and exact failure timestamps/checksums. Any new original data, schema drift, different failure or changed successful history requires separate review. This is not application workflow, concurrency or authenticated API acceptance evidence.

## Subsequent operator instructions — pending authorization

After explicit authorization for both the recovery state transition and the two 003 ALTERs, inspect Git status and run fresh read-only preflight again:

```powershell
node database/migrate.mjs preflight --profile phase2 --env-file database/.env.phase2.migrations.local
```

At the currently verified state, exit 1 is expected solely for failed history; any other prerequisite failure requires investigation. Preserve that output, the original activation evidence and a recovery output log. Confirm the quiet execution window before proceeding.

Then run **once**, capturing stdout/stderr in a new log:

```powershell
node database/migrate.mjs resume-003 --profile phase2 --env-file database/.env.phase2.migrations.local 2>&1 | Tee-Object -FilePath database/phase2-execution/activation-2026-11-22/resume-003.log
```

Inspect `$LASTEXITCODE`. On failure, **stop** and perform read-only diagnosis; never use ordinary migrate, manual SQL, reset, or another resume invocation as an automatic retry. On success, run the read-only preflight again and require stage 3, all three history entries applied with matching checksums, 003 error NULL, original data preserved and client_applications empty. Preserve both verified exclusive-window events and the original-data-preserved event from the execution log. Do not switch application runtime or start another task automatically.

## Files and offline evidence

- `database/migrate.mjs`: adds the explicit Phase 2 CLI route.
- `database/migration-phase2.mjs`: adds the exact-failure guards, fresh prerequisite checks and conditional 003-only resume path; preserves the existing corrected locking functions.
- `database/migration-phase2-recovery.test.mjs`: seven new offline cases covering successful 003-only resume, unchanged 001/002, fresh lock before marker, unchanged ordinary retry refusal, history/checksum/timestamp/schema/data drift rejection, grants/instrumentation failures, zero-row conditional transition, observer failure and CLI routing/TLS configuration.
- This preparation report.

New recovery suite: **6 passed** after one test-fixture correction; new CLI case run separately: **1 passed**. The first new-suite run was 5 pass/1 fail because the shared offline fixture represented stage 2.5 as stage 2; the new test now explicitly supplies the partial username column. The corrected suite rerun was justified by that failure. Commands:

```powershell
node --test --test-reporter=spec database/migration-phase2-recovery.test.mjs
node --test --test-reporter=spec --test-name-pattern='recovery CLI' database/migration-phase2-recovery.test.mjs
```

The new CLI case also rejects `resume-003` without the explicit Phase 2 profile before any shared environment load. That case alone was rerun after adding this early refusal guard and passed. These are synthetic offline protocol tests, not live recovery evidence. No previously completed suite or broad application test was rerun. `git diff --check` passed. No commit was created.

## Database Change Report — this preparation task only

**Connections:** one failed local DPAPI setup before connection; then exactly one authenticated TLS connection to 127.0.0.1:62286/enterflow_phase2_db, closed by the preflight CLI. Zero observer connections and zero shared/restore database connections. Offline tests use only synthetic sessions; they open no database sockets.

**Queries:** the successful preflight issued **63 read-only SQL statements**. Exact SQL is defined by the inspected `preflightPhase2`, `readPhase2Metadata` and `originalDataSnapshot` functions; the preflight tool output includes their complete ordered SQL list. Accounting:

| Queries | Number | Scope / content |
| --- | --- | --- |
| Identity SELECT | 1 | DATABASE(), VERSION(), server_uuid, hostname, port, CURRENT_USER(), USER() |
| Information Schema SELECTs | 10 | TABLES, COLUMNS, KEY_COLUMN_USAGE, TABLE_CONSTRAINTS, STATISTICS, CHECK_CONSTRAINTS, REFERENTIAL_CONSTRAINTS, TRIGGERS, ROUTINES, EVENTS; each restricted to DATABASE() |
| Cross-schema FK count SELECT | 1 | Current schema's KEY_COLUMN_USAGE only; no referenced data read |
| Dedicated extension-history SELECT | 1 | file,state,started_at,applied_at,error_code ordered by file; only `_enterflow_phase2_extension_history` |
| Parameterized dedicated-history checksum SELECTs | 3 | WHERE file=? for precisely 001_auth_sessions.sql, 002_client_registration.sql, 003_username_support.sql |
| Original-column row-hash SELECTs | 40 | One per pinned P2B002 baseline table, ordered by its primary key; SHA2(JSON_ARRAY(original columns)), only hashes returned; no sensitive records exported |
| Performance Schema failure diagnostics SELECTs | 2 | setup_consumers for the two statement-history consumers; events_statements_history_long scoped to CURRENT_SCHEMA=DATABASE(), errno 1100 and the original lock/verification SQL patterns, LIMIT 10 |
| Empty-table COUNT(*) SELECT | 1 | client_applications |
| SHOW GRANTS FOR CURRENT_USER() | 1 | Existing account only |
| Lock settings/instrument/thread SELECTs | 3 | performance_schema, session innodb_table_locks, session lock_wait_timeout; named MDL instrument; own thread visibility |

The 40 reviewed original tables are audit_event, client, client_receipt, client_receipt_file, client_user, cost_estimate, cost_estimate_material, delivery, delivery_item, delivery_method, delivery_receipt, document, filter_type, finished_good, inquiry, inquiry_item, job_order, job_order_item, job_order_stage, material_category, material_shortage_report, notification, payment_method, payment_transaction, production_plan, production_stage, production_stage_event, purchase_order, quotation, quotation_item, raw_material, role, sales_invoice, signed_delivery_receipt, stock_movement, stock_request, stock_request_item, unit_of_measure, user_account and waybill. Dedicated history plus extension-table metadata were also reviewed. No unrelated application data or protected ledger was queried.

**Database writes/modifications performed:** **none**. No DDL/DML, migration, history transition, import, backfill, seed, restore, repair, transaction command, SET, GET_LOCK, LOCK TABLES, grant or configuration command was executed. MySQL performs its ordinary connection/statement instrumentation; no administrative instrumentation changes were made.

**Proposed, not performed:** one conditional history UPDATE failed-to-applying for 003, the existing two reviewed 003 ALTER statements, then 003 completion/failure-marker UPDATEs through the framework under the prerequisites above. These require subsequent authorization. No new migration SQL file was created; no migration was applied.

**Protected/excluded:** Migration 007 and its checksum/history were not accessed or modified; no legacy discovery or entire shared ledger read. No 008 artifact inspection, shared or restore data access, reset/reseed/drop/recreation, Docker/resource change, credential/TLS/application configuration change, deployment or commit. Only the four listed workspace source/test/report files changed. Preparation ends here, before recovery writes and execution.
