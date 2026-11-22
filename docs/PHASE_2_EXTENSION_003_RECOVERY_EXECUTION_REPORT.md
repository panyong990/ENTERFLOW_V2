# Phase 2 extension 003 recovery execution — stopped

2026-11-22, Asia/Singapore. **FAILED AND STOPPED. The database is not ready for application activation.** The authorized documented recovery ran once. Its observer TLS connection failed before either table-lock window or ALTER. No alternate recovery, retry, backend configuration change or backend startup followed.

## Executed procedure and actual target

Read `docs/PHASE_2_EXTENSION_003_RECOVERY_PREPARATION.md` first. Initial Git inspection found the four existing recovery-preparation source/test/report changes; all were preserved. No source code was changed during this execution task.

Executed the documented fresh preflight and saved its complete output as `database/phase2-execution/activation-2026-11-22/recovery-preflight.json`. It returned exit 1 solely for the expected failed-history gate; installed stage-2 schema, original empty data, TLS, grants and instrumentation prerequisites passed. The lock-acquisition check remained unverified until execution.

Executed once, with the documented output capture:

```powershell
node database/migrate.mjs resume-003 --profile phase2 --env-file database/.env.phase2.migrations.local 2>&1 | Tee-Object -FilePath database/phase2-execution/activation-2026-11-22/resume-003.log
```

**Exit code: 1.** The execution log records:

- Exact Phase 2 database/server identity verified.
- All three extension SQL checksums revalidated.
- Fresh activation advisory lock acquired, result 1.
- All 40 original tables freshly read and empty.
- Exact original failed 003 history/timestamps/checksum, successful 001/002 entries, complete stage-2 metadata, grants, lock instrumentation and empty client_applications accepted by recovery prerequisites.
- `003_RECOVERY_VALIDATED` recorded before the conditional 003 marker transition.
- No `003_EXCLUSIVE_WINDOW_VERIFIED` event, no `003_LOCK_PATH_FAILED` event and no successful ALTER/completion event. The failure occurred while creating the observer, before the guarded table-lock function.

Verified target:

| Property | Actual result |
| --- | --- |
| Network/database | 127.0.0.1:62286 / enterflow_phase2_db |
| MySQL | 8.4.13 |
| Server UUID | 0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8 |
| MySQL hostname | 2acac2d1b606 |
| Account | root@%; connected user root@172.17.0.1 |
| Owner/preflight TLS | TLSv1.3, authorized; certificate IP 127.0.0.1 verified |
| Container | enterflow-phase2-mysql |
| Container ID | ed47d1d4b52e35585de492d4cd899915f6ff526a0c5f9fd6de7541558939f05a |
| Container configured hostname / binding | 2acac2d1b606 / 127.0.0.1:62286 -> 3306/tcp |

The container identity was confirmed with read-only `docker inspect` limited to ID, configured hostname and port bindings. The sandboxed Docker inspection was denied; an escalated read-only inspection succeeded. No environment variables, credentials or keys were printed.

## Read-only failure diagnosis and verification

Ran the existing preflight again, saving full ordered SQL and results to `recovery-failure-preflight.json`. Exit 1 remains expected for failed history. Compared the before/after reports offline; `recovery-failure-comparison.json` records:

| Check | Result |
| --- | --- |
| Full schema | PASS at stage 2; 43 tables, 39 triggers |
| `user_account.username` | Absent |
| `uq_user_account_username` | Absent |
| `client_applications.username` | Absent |
| `client_applications.active_username` / generated expression | Absent; no generated expression installed |
| `uq_client_application_active_username` | Absent |
| 001 and 002 history, checksums, timestamps and errors | Exactly unchanged; both applied |
| 003 checksum/start time | Unchanged; applied_at remains NULL |
| 003 current state/error | failed / HANDSHAKE_SSL_ERROR |
| Either 003 ALTER persisted | No; entire actual schema still matches the expected pre-003 structure |
| Original 40 P2B002 tables/data | Structure preserved; all original-column counts/digests unchanged, all 0 rows |
| client_applications | COUNT(*) = 0 |

The two 003 history transitions were framework operations: failed -> applying, followed by applying -> failed with the new error code. There was no manual history deletion, reinsertion or rewrite.

A separate **read-only** diagnostic reused the existing CLI connection setup and observer factory while replacing execution with identity SELECTs only. It did not invoke `runPhase2`, recovery, advisory locks, table locks or DDL. The owner connection succeeded with authorized TLSv1.3 and the exact target UUID; its connection ID was 13. The observer connection failed again with:

```json
{"code":"HANDSHAKE_SSL_ERROR","tlsFailure":{"code":"ERR_TLS_CERT_ALTNAME_INVALID","expectedIdentity":"127.0.0.1"}}
```

Sanitized evidence is in `recovery-observer-diagnostic.json`. This identifies the immediate blocker as certificate identity verification on the second connection. It does not establish why the first connection passes while the observer fails; no TLS bypass, certificate/configuration modification or speculative fix was attempted.

Two focused offline cases were rerun specifically because of the observed observer failure and the need to verify execution routing:

```powershell
node --test --test-reporter=spec --test-name-pattern='recovery observer|recovery CLI' database/migration-phase2-recovery.test.mjs
```

**2 passed, 0 failed.** They confirm synthetic observer failure stops before ALTER and ordinary retry remains blocked, and CLI routing preserves the Phase 2 connection requirements. These tests do not prove live observer TLS success. No unrelated suite was rerun. `git diff --check` passed.

## Backend and application connectivity outcome

**Backend database identity: not established; backend not started.** The actual identities above belong to the migration/preflight/diagnostic connections, not an application connection.

The user's backend configuration/startup step explicitly depends on verified Migration 003. That prerequisite failed. No separate runtime was configured or started, and no authentication, session, registration or approval operation was exercised. No successful application connectivity is claimed. Shared runtime configuration remains unchanged.

Remaining blockers: diagnose the observer's certificate-identity failure without weakening TLS; then prepare and authorize recovery appropriate to the **new** HANDSHAKE_SSL_ERROR state. The current resume command is intentionally bound to the original ER_TABLE_NOT_LOCKED marker and now rejects this state. Do not reuse it blindly, manually edit history, or invent another recovery procedure. Follow-up recovery and backend activation remain incomplete.

## Database Change Report

**Connections:** four successful authenticated connections to enterflow_phase2_db only: initial preflight, single recovery owner, post-failure preflight, and read-only diagnostic owner. Two additional observer connection attempts failed during TLS verification (one during recovery and one diagnostic reproduction); neither returned a usable authenticated observer. Existing TLS hook rejects failed identity verification before sending credentials. Successful connections closed through the CLI; failed connections were destroyed by the connection helper. No shared/restore database connection occurred.

**Read-only queries:** initial preflight executed 63 SELECT/SHOW statements; post-failure preflight executed 61 (the original-ER_TABLE_NOT_LOCKED-only two-query statement-history diagnostic was no longer selected). Their complete SQL lists are persisted in the respective JSON files. Both read current-schema Information Schema metadata, only the dedicated extension history and the three named checksums, hashes/counts of the 40 original tables, application count, current-user grants and lock instrumentation. The diagnostic owner issued exactly one identity SELECT (saved in its JSON); the failed diagnostic observer issued no application SQL. No original record values, credentials or private keys were exported.

**Recovery reads/session commands:** the runner read exact identity, current-schema metadata/cross-schema FK count, dedicated history/checksums, 40 original-column row-hash snapshots, Performance Schema/innodb_table_locks settings, the named MDL instrument, own-thread visibility, current-user grants, two empty application counts and the owner connection ID. It acquired/released `enterflow:phase2:enterflow_phase2_db` using GET_LOCK/RELEASE_LOCK. It set session time_zone='+00:00', the existing strict sql_mode, autocommit=1 and lock_wait_timeout=5. These are connection settings, not server/application configuration changes. After observer failure, existing error handling ran ROLLBACK and committed the failed marker. No LOCK TABLES, UNLOCK TABLES, observer metadata-lock verification SELECT or ALTER was reached in this attempt.

**Every database write performed:**

1. Conditional framework UPDATE of only the existing `003_username_support.sql` row in `_enterflow_phase2_extension_history`: state failed -> applying, with exact pinned checksum/start-time/original-error predicates. One row acknowledged and committed; original start time, checksum and original error retained at that transition.
2. Framework failure UPDATE of the same 003 row: state -> failed, error_code -> HANDSHAKE_SSL_ERROR, committed. Final state is verified by fresh SELECT; applied_at remains NULL.

**Executed migrations/schema changes:** the 003 recovery command was attempted once; **zero ALTERs and zero schema changes** occurred. Migration 003 did not apply. Extensions 001/002 were neither executed nor modified. No CREATE/DROP, reset/recreate/reseed, import, backfill, business-data INSERT/UPDATE/DELETE, session creation or registration write occurred.

**Protected/excluded:** shared enterflow_db/3308 and the restore comparison database were not connected to, read or modified. Migration 007, its history/checksum and the shared migration ledger were not accessed. No credentials, TLS settings, Docker resources, application configuration, runtime, grants or unrelated features changed. No stage/commit operation occurred.

**Files added this execution task:** this report plus `recovery-preflight.json`, `resume-003.log`, `recovery-failure-preflight.json`, `recovery-observer-diagnostic.json` and `recovery-failure-comparison.json` under the existing activation evidence directory. The pre-existing four preparation changes remain preserved. No execution source files were edited. Stop state: failed recovery diagnosed; no retry or dependent runtime activation performed.
