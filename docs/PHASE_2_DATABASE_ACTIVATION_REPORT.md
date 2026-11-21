# Phase 2 activation — partial application, stopped at 003

2026-11-22, Asia/Singapore. **Final result: INCOMPLETE / FAILED AND STOPPED.** Extensions 001 and 002 applied and verified. Extension 003 failed in its locking path with `ER_TABLE_NOT_LOCKED`, before either ALTER took effect. No retry, recovery write or history repair was performed.

## Verified target and prerequisites

- Endpoint/database: **127.0.0.1:62286 / enterflow_phase2_db**.
- Running container: `enterflow-phase2-mysql`, ID `ed47d1d4b52e35585de492d4cd899915f6ff526a0c5f9fd6de7541558939f05a`.
- Existing volume: `enterflow-phase2-data`, unchanged mount. Docker inspection only; no storage/container changes this task.
- Server: MySQL **8.4.13**, UUID **0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8**. Activation itself now checks this exact UUID before acquiring its execution lock.
- Fresh framework preflight: correct TLS/IP identity and trusted CA; P2B002 structure, grants and locking instrumentation prerequisites passed; stage 0, 40 tables and 39 triggers; extension tables/history absent. Actual table locking remained untested until activation.
- Phase 2 advisory lock: `enterflow:phase2:enterflow_phase2_db`; actual `GET_LOCK(...,0)` result **1**, recorded as `ACTIVATION_LOCK_ACQUIRED` in the execution log.

Exact extension contents were inspected. Their normalized SHA-256 checksums were verified by the fixed three-file manifest before execution:

| File | Verified checksum | SQL statements |
| --- | --- | --- |
| `001_auth_sessions.sql` | `ae15868de9bcc5205cdbe441357d57b5b091f8a36faee69465b327b22bf893fe` | 1 |
| `002_client_registration.sql` | `1b0c30a391d95822bf56cd26a5a7742d322efd4010c7639f3dab8adfb962ea27` | 1 |
| `003_username_support.sql` | `95c7f5715281bf5cf1c2543edbdb94783d51803159ce2bd2f976971ea50fe8b5` | 2 planned; neither ALTER took effect |

The extension SQL, P2B002 bootstrap and protected migration artifacts were not edited. No legacy migration/seed discovery occurred.

## Actual database changes and history

The framework created `_enterflow_phase2_extension_history`: `file` primary key, checksum, applying/applied/failed state, started/applied timestamps and error code. Each extension received its applying marker and commit before its execution path. Successful files were marked applied only after SQL, commit and metadata postconditions succeeded.

| Extension | Actual result | History state | Applied at, Asia/Singapore |
| --- | --- | --- | --- |
| 001 | `user_sessions` created; full metadata verified | `applied`, error null | 2026-11-22 05:10:31.222 +08:00 |
| 002 | `client_applications` created; full metadata verified | `applied`, error null | 2026-11-22 05:10:31.294 +08:00 |
| 003 | Locking path failed; no username ALTER effects | `failed`, `ER_TABLE_NOT_LOCKED`, applied_at null | Not applied; attempt started 05:10:31.301 +08:00 |

Fresh read-only queries retrieved and verified all three isolated history checksums after the failure. No history was deleted, fabricated, baselined, adopted or edited to force retry.

**001 objects created:** `user_sessions` with `id`, `user_id`, `token_hash`, `expires_at`, `created_at`, `last_activity_at`, `revoked_at`; unsigned BIGINT auto-increment PK `id`; unique `uq_user_sessions_token_hash`; indexes `ix_user_sessions_user_id`, `ix_user_sessions_expires_at`; FK `fk_user_sessions_user_account` to `user_account(user_id)`, delete RESTRICT. Token hash uses `ascii_bin`; remaining types, defaults, nullability, engine and collation match the reviewed SQL.

**002 objects created:** `client_applications` with `application_id`, `company_name`, `contact_person`, `email`, `phone`, `password_hash`, `application_status`, `reviewed_by_user_id`, `reviewed_at`, `review_note`, `created_client_id`, `created_user_id`, stored-generated `active_email`, and `submitted_at`. Verified primary key; unique keys `uq_client_application_active_email`, `uq_client_application_created_client`, `uq_client_application_created_user`; indexes `ix_client_application_review_queue` and `ix_client_application_reviewer`; FKs `fk_client_application_reviewer`, `fk_client_application_created_client`, `fk_client_application_created_user`; enforced CHECK `ck_client_application_review_state`. Types, defaults, nullable states, generation expression and key relationships match the reviewed SQL.

**003 objects not added:** `user_account.username`, `uq_user_account_username`, `client_applications.username`, stored-generated `active_username`, `uq_client_application_active_username`. Fresh stage-2 metadata comparison confirms these ALTER effects are absent, rather than assuming DDL rolled back. There were no workflow/application records inserted into the new tables by this task; `client_applications` was freshly counted at zero rows.

## Failure and stop behavior

Only one activation invocation ran. It printed APPLIED for 001 and 002, then stopped at 003 and exited **1**. Its failed marker persisted. The failing locking path returned **`ER_TABLE_NOT_LOCKED`**. No `003_EXCLUSIVE_WINDOW_VERIFIED` event was emitted; original ALTER effects are absent. The existing framework retained the driver error code, but not the complete driver error message/statement location, so the exact unlisted table/alias and failing lock-path statement remain **UNVERIFIED**. No lock or ALTER was rerun to investigate it.

Framework failure handling attempted rollback, persisted the failed marker, and released its activation lock best-effort before closing the connection. A rollback does not reverse the committed 001/002 DDL; those objects remain installed intentionally. A subsequent ordinary activation must reject the failed 003 history. Resolving the locking path and defining controlled recovery of that failed attempt is required before resuming; no repair or safeguard bypass occurred in this task.

## Post-failure verification and data preservation

Read-only framework verification returned:

- Correct UUID, MySQL version and TLS identity: **PASS**.
- Stage-2 metadata contract: **PASS**, **43 tables and 39 triggers**: original 40 plus sessions, applications and isolated history.
- All original schema objects match P2B002; 001/002 columns, nullability/defaults/generated expression, PK/UQ/CHECK/index/FK details match the expected stage-2 contract.
- Isolated history integrity: expected overall **FAIL**, because 003 is failed; 001/002 are applied, and all recorded file checksums match the reviewed manifest.
- Application-table row prerequisite: **PASS**, actual `client_applications` row count **0**.

Before any DDL, under the acquired activation advisory lock, the framework selected deterministic hashes of every original P2B002 row using only the original columns and primary-key order. Only row hashes/counts were returned, not sensitive record contents. This also excludes the proposed username column from the comparison.

Fresh after-failure snapshots were compared offline with that actual before snapshot: **all 40 original tables have identical row counts and aggregate SHA-256 digests**. Actual total original rows were **0 before and 0 after**. This is a current observation, not a copied historical count. Original P2B002 records and structure remain intact; unknown inventory quantities were not populated or converted to zero.

## Commands, evidence and files

Fresh read-only preflight before activation (exit 0, PASS WITH EXCEPTIONS for unacquired execution locks):

```powershell
node database/migrate.mjs preflight --profile phase2 --env-file database/.env.phase2.migrations.local
```

One activation invocation (exit 1):

```powershell
node database/migrate.mjs migrate --profile phase2 --env-file database/.env.phase2.migrations.local
```

Then the same **preflight** command ran read-only to inspect the failure (exit 1, expected failed history); **migrate was not retried**.

Evidence created:

- `database/phase2-execution/activation-2026-11-22/activation.log` — original execution output including UUID, file checksums, successful advisory lock, before-data hashes, APPLIED entries and failure. PowerShell Tee output is UTF-16.
- `database/phase2-execution/activation-2026-11-22/post-failure-preflight.json` — fresh TLS/identity, stage-2 schema comparison, actual isolated history/checksums/error code, query list and after-data hashes; UTF-8 with BOM.
- `database/phase2-execution/activation-2026-11-22/preservation-comparison.json` — actual before/after data comparison, true for all 40 original tables, plus actual history states.
- `docs/PHASE_2_DATABASE_ACTIVATION_REPORT.md` — this report.

Framework files modified for activation evidence: `database/migration-phase2.mjs` (UUID guard, lock/checksum witness logging, original-column data snapshots) and `database/migration-phase2-preflight.mjs` (read-only failed-history and data-preservation evidence). Test doubles in `database/migration-phase2.test.mjs` and `database/test-fixtures/phase2-double.mjs` were aligned with that protocol; three targeted cases were added in `database/migration-phase2-blockers.test.mjs`.

Exact focused offline verification before the single live activation:

```powershell
node --test --test-reporter=spec --test-name-pattern="activation record verifies|activation rejects unexpected|activation refuses a changed" database/migration-phase2-blockers.test.mjs
```

**3 passed, 0 failed/cancelled/skipped/todo**, exit 0; duration 289.6073 ms. These exercise only the newly added evidence guards; they did not establish that the real locking path would succeed. No completed application suite or broad framework suite was rerun. No further execution test or mutation was attempted after the actual 003 failure.

## Complete Database Change Report

**Connections:** three authenticated, certificate-verified framework sessions to the isolated target: fresh preflight, single activation and read-only post-failure preflight. Docker identity inspection was read-only. No shared/restore connection.

**Reads:** identity/TLS-associated metadata, Information Schema schema verification, allowed isolated history/checksums/error code, grants and lock instrumentation, 40-table before/after original-row hash reads, and empty application counts. No protected migration history/007/008 access. Sensitive values were not exported.

**Schema changes performed:** CREATE isolated extension-history table; CREATE `user_sessions` from exact 001; CREATE `client_applications` from exact 002. **No 003 ALTER effect** and no other original-table schema change. No indexes/constraints were dropped.

**Data writes performed:** three isolated-history INSERT markers; UPDATE of 001 and 002 to applied; UPDATE of 003 to failed with `ER_TABLE_NOT_LOCKED`. **No business-data INSERT/UPDATE/DELETE**, backfill, reference seed, inventory count, BOM, price, allocation or historical event was generated.

**Session/locking operations:** Phase 2 advisory lock acquired with result 1; session time zone, SQL mode, autocommit and metadata-lock timeout set by the approved framework; attempted 003 explicit WRITE-lock path failed; rollback/failure-marker handling and lock release/disconnect followed. Actual successful 003 exclusive lock window was not verified. These are distinct from schema/business-data changes.

**Not performed:** retry, history repair, adoption, reset, reseed, drop, backup, restore, cleanup, credential/TLS/grant/server configuration change, Docker/container/volume change, application/runtime switch, deployment or commit. Existing uncommitted work and protected artifacts remain preserved.

**Stop point:** activation is incomplete. Preserve the current applied 001/002 objects and failed 003 marker. Do not switch the application runtime or report all extensions as successfully applied.
