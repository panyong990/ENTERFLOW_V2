# Task 002 runtime acceptance report

Date: November 21, 2026 (Asia/Manila). Evidence review and documentation only.

**Final Task 002 acceptance status: INCOMPLETE.**

**Authorized run `3904feeb1f295fdd`: runtime scenario PASSED; guarded cleanup PASSED.**
The normal authenticated API-to-MySQL workflow is now demonstrated. Full Task 002
completion is not established: [plan section 8](TASK_002_ISOLATED_INTEGRATION_TEST_PLAN.md#8-tests-evidence-and-completion-criteria)
also requires owned cleanup/repeatability with a **second fresh run**. Only one
successful run ID is evidenced. The earlier rejected launcher attempt used this
same run ID and is not a successful repeatability run. Reporting approval does
not waive that completion criterion or authorize another run.

A separate November 21, 16-page handoff referenced in the requests was not
available among the supplied/repository Task 002 records. This report maps the
available plan, implementation/review records, explicit owner decisions, and
saved execution evidence; it does not invent additional handoff requirements.

## Verified target and permissions

| Item | Verified value |
| --- | --- |
| Run database | `enterflow_it_3904feeb1f295fdd` |
| Container | `enterflow-browser-recovery-29caa4ce81d64f02` |
| Container ID | `7e72accecadb1fd8eef9f778a784079c12c191458ed6400ff4dd44d586bcd6ca` |
| Docker context / network | `desktop-linux` / bridge |
| Ownership | Owner-approved Task 002 reassignment; original `enterflow.task29.recovery=29caa4ce81d64f02` label retained as provenance |
| MySQL endpoint / version | `127.0.0.1:62829` / `8.4.13` |
| Server UUID | `a215e14c-e577-11f1-9a57-52351ebcddc4` |
| Image | `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902` |
| Storage | `/var/lib/mysql` 1 GiB tmpfs; no persistent volume/bind mounts |
| TLS server identity | `MySQL_Server_8.4.13_Auto_Generated_Server_Certificate` |
| CA file SHA-256 | `017b15b6192e15bbe8166eedac13c3a13b16a92cecc816519c8186f30ff4ed43` |
| Server certificate SHA-256, DER | `9b0ba13a0f4261036d306deb4ae9c74588b61eaf3cfaf9e267191aff48abe42f` |
| Account host | Exact `172.17.0.1`; no wildcard run-account hosts |
| Connection settings | Explicit UTC session `+00:00`, driver timezone `Z`, `lower_case_table_names=0`; approved SQL-mode set matched |
| Test API | `127.0.0.1:43123`, exact loopback Origin |

Approved SQL modes: `IGNORE_SPACE`, `ONLY_FULL_GROUP_BY`, `STRICT_TRANS_TABLES`,
`NO_ZERO_IN_DATE`, `NO_ZERO_DATE`, `ERROR_FOR_DIVISION_BY_ZERO`,
`NO_ENGINE_SUBSTITUTION`.

The existing isolated administrator performed approved initial provisioning and
the later table grants; no delegated provisioner or new global privileges were
created. Runtime account self-grants and TLS/UTC identities were verified.

All names below are bound to `172.17.0.1`; all scopes are inside the run database.

| Account | Exact approved privileges |
| --- | --- |
| `it_3904feeb1f295fdd_init` | Database `CREATE, REFERENCES` only; literal underscores escaped with `partial_revokes=OFF` |
| `it_3904feeb1f295fdd_fixture` | `SELECT, INSERT`: `roles`, `units`, `users`, `materials` |
| `it_3904feeb1f295fdd_api` | `SELECT`: `users`, `materials`, `finished_goods`; `SELECT, INSERT, UPDATE`: `user_sessions` |
| `it_3904feeb1f295fdd_cleanup` | `SELECT`: the six preceding runtime/reference tables; `DELETE`: `user_sessions`, `materials`, `users` |

All four accounts require TLS and were unlocked after their applicable grants
were verified. No run account has `GRANT OPTION`. Cleanup did not revoke, lock,
or remove accounts. See [activation metadata](../backend/test/local/task-002/account-activation-1795247093599/after.local.json)
and [fresh self-grant checks](../backend/test/local/task-002/execution-preflight-1795248608876/account-self-grants.local.json).
Existing account secrets remain in the protected DPAPI source; they are loaded
into memory only. The generated Warehouse login password remained inside the
single combined scenario process. No standalone loader or persistent Warehouse
credential handoff was implemented. The API child received only API credentials.

## Live schema, HTTP, persistence, and cleanup evidence

| Acceptance item | Recorded result |
| --- | --- |
| Raw approved artifacts | SQL `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`; manifest `3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4`; LF-only approved bytes |
| Schema round trip | PASS for `roles`, `payment_terms`, `material_categories`, `units`, `filter_types`, `clients`, `users`, `user_sessions`, `product_specifications`, `materials`, `finished_goods` |
| Structural coverage | Complete canonical definitions, including columns, defaults/nullability, indexes, foreign keys, and CHECK constraints, matched all 11 approved hashes; object inventory found 11 base tables and no views/triggers/routines/events |
| Normalization | Only explicitly approved column/type/suffix charset expansions; each transformed whole table must match its existing approved hash. Earlier table-option AUTO_INCREMENT rule retained. No blanket charset removal |
| Pre-scenario baseline | All 11 tables empty; unused journal; available API port; target-bound, fresh administrator-managed attestation |
| Fixture transaction | One `warehouse` role, one `pcs` unit, one synthetic Warehouse employee, one unknown-stock material; captured decimal-string user/material IDs both `"1"` |
| Authentication | Real `POST /api/auth/login`: HTTP 200; approved Warehouse actor and cookie assertions passed |
| Session persistence | One unrevoked, unexpired session; ID `"1"`; stored hash matched SHA-256 of the received token in memory. Journal contains only the second digest and ownership timestamps |
| Inventory | Real authenticated `GET /api/inventory`: HTTP 200; exact owned material and required NULL/unknown fields; empty finished-goods array |
| Independent readback | Material values, one session, zero finished goods, and session activity not earlier than the recorded baseline passed |
| API shutdown | Existing bounded shutdown procedure returned successfully; API window ended and stopped evidence recorded; port 43123 independently verified released |
| Guarded cleanup | Restricted cleanup account deleted session `"1"`, material `"1"`, user `"1"` in dependency order; exactly one affected row each |
| Independent cleanup readback | Users/materials/sessions/finished goods: 0 each. `warehouse` / `Warehouse` role: 1; `pcs` / `Pieces` unit: 1, unchanged |
| Final journal | `cleaned`, `cleanup-complete`, cleanup `complete`, `cleanupPending=false`, `incomplete=false`; target/nonce/fixture/record ownership bindings preserved |

Scenario completed November 21 at **16:13:48 Manila time**; independent scenario
postflight at **16:14:56**. Guarded cleanup and independent cleanup verification
completed at **16:19:05**. These are historical observations, not new live checks
performed while preparing this report.

Primary evidence packet:
`backend/test/local/task-002/execution-preflight-1795248608876/`.

- [Preflight readiness](../backend/test/local/task-002/execution-preflight-1795248608876/readiness.local.json), [runtime attestation](../backend/test/local/task-002/execution-preflight-1795248608876/administrator-runtime.attestation.local.json), [schema evidence](../backend/test/local/task-002/execution-preflight-1795248608876/schema.evidence.local.json).
- [Explicit execution authorization](../backend/test/local/task-002/execution-preflight-1795248608876/execution.authorization.record.local.json), [process result](../backend/test/local/task-002/execution-preflight-1795248608876/execution.process-result.local.json), [sanitized scenario output](../backend/test/local/task-002/execution-preflight-1795248608876/execution.stdout.local.log).
- [Independent scenario postflight](../backend/test/local/task-002/execution-preflight-1795248608876/execution.postflight.local.json), [cleanup preflight](../backend/test/local/task-002/execution-preflight-1795248608876/cleanup.preflight.local.json), [cleanup result](../backend/test/local/task-002/execution-preflight-1795248608876/cleanup.result.local.json), [final journal](../backend/test/local/task-002/execution-preflight-1795248608876/ownership.journal.local.json).

The local packet is ignored, machine-local evidence. Keep it with this report;
the committed documentation alone is not a replacement for the live artifacts.
No password, login-usable hash, cookie, token, or credential-bearing SQL is
included in this report.

## Actual invocations and offline results

Executed scenario command, once for the successful packet:

```powershell
node backend/test/local/task-002/execution-preflight-1795248608876/execute-approved.mjs
```

This launcher called the existing `main(['--phase=execute-scenario'], environment)`
with separately approved `verify-grants`, read-only schema-preflight capability,
`load-fixtures`, and internal `execute-http` authorization. Exit 0; login and
inventory HTTP 200. It did not run cleanup automatically.

Cleanup was executed once in the approved owner process using an inline Node
ES-module invocation (`node --input-type=module`, script supplied on stdin):

```javascript
await main(['--phase=cleanup'], cleanupEnvironment);
```

This is the exact existing-runner function invocation, not a claim that an npm
cleanup command was executed. It returned `{ sessionsDeleted: 1,
materialDeleted: 1, userDeleted: 1 }`; an independent restricted connection then
verified remaining counts. No administrator credential was used for cleanup.
Schema checks called the existing `verifyApprovedSchemaRoundTrip` through an
ordered `SHOW CREATE TABLE`-only proxy; no initializer was rerun after the tables
had been created.

Relevant earlier offline verification commands (not rerun for this report):

```text
node --test backend/test/support/administrator-provisioning.test.mjs backend/test/support/integration-target.test.mjs
node --test --test-name-pattern='approved grants bind' backend/test/inventory-auth.mysql.integration.test.mjs
node --test backend/test/support/inventory-schema-snapshot.test.mjs backend/test/support/schema-charset-expansion.test.mjs
node --test --test-name-pattern='scenario rejects administrator|managed scenario attestation' backend/test/support/administrator-provisioning.test.mjs
```

Recorded results respectively: **19 passed**, **1 passed**, **27 passed**,
**3 passed**, with zero failures. These were focused offline checks at their
recorded code revisions, not additional live integration runs or a fresh full
suite. Earlier overlapping F1–F10 totals remain dated evidence in the
implementation/review reports and are not added to these counts.

## Earlier blocks and reconciliation

1. Target ownership and tmpfs preservation were reviewed before reassignment.
   The owner accepted archived Task 29 evidence and acknowledged that its former
   tmpfs database might be unrecoverable. Fresh UUID/TLS generation and the new
   pins were separately approved. No Task 29 database was reused as the run schema.
2. Delegated global `CREATE USER` conflicted with the authorized privilege scope.
   An explicitly approved administrator-managed procedure replaced it; new run
   accounts received no global privileges or delegation rights.
3. The first initialization guard rejected CRLF working-tree artifact bytes
   before DDL. Both exact LF artifacts were later restored, under explicit
   approval, from verified blobs at commit
   `9bdd541fea073a8a3c148c1c1b7b3e748f715dcc`. Approved digests were not changed.
4. All 11 CREATE statements then succeeded, but round-trip checks exposed
   redundant MySQL charset text. Stop-on-mismatch evidence was retained. An
   authorized all-table diagnostic identified 68 additional columns in six
   tables; the explicit, whole-table-hash-gated allowlist now covers those and
   the earlier eight columns in four tables. Later live verification passed 11/11.
5. Standalone fixture loading and a proposed cross-phase secret handoff were
   declined. The original combined, memory-only-password workflow was preserved.
6. [The earlier launcher packet](../backend/test/local/task-002/execution-preflight-1795247958529/execution.guard-diagnosis.local.json)
   was rejected before scenario entry because the credential guard treated the
   required non-secret attestation path as a credential. No fixtures, journal,
   or API were created by that attempt. The narrow exception and secret-rejection
   regression passed; a new packet and new explicit approval preceded the
   successful attempt. The failed packet remains failed and unchanged.
7. A request to delete five records was blocked before database access because
   role/unit deletion is outside the cleanup account and original contract.
   Separately approved three-record cleanup succeeded and retained those references.

Earlier conclusions that runtime/schema/HTTP/process behavior had never been
executed are superseded **for this normal successful run and cleanup** by the
linked live evidence. Historical defect findings and their original dates remain
intact. Live happy-path success does not turn earlier offline fault tests into
live crash, concurrency, expiry, or interruption tests.

## Remaining acceptance gaps and retained resources

- **Required second fresh run:** no successful second run ID/database exists in
  the reviewed evidence. Plan section 8 and step 11.12 explicitly require this
  repeatability proof. No waiver or replacement criterion has been inferred.
- The separately referenced 16-page handoff must be supplied/identified if it
  supersedes the available completion criteria. This report cannot certify unseen
  requirements.
- Abrupt process/host crash, injected failure/expiry, concurrent mutation,
  interrupted cleanup, and destructive teardown remain untested live. Normal
  process exit/port release is demonstrated; graceful internal pool draining was
  not separately instrumented. Production/cloud readiness and broader roles/APIs
  are outside this evidence.
- Container, run database, 11 tables, four restricted accounts, public CA material,
  protected account credentials, and the two reference rows are retained. No
  teardown is authorized by cleanup or this report. Evidence approvals expire;
  historical PASS records are not reusable runtime authorization.
- The retained role/unit mean this database is not an empty fixture baseline.
  Do not blindly rerun fixture insertion against it. Any second fresh run or
  separately reviewed completion-criterion change requires explicit approval.

## Database Change Report

| Stage | Reviewed / performed scope |
| --- | --- |
| Earlier approved provisioning | Created only the isolated run database and four TLS-bound accounts; initializer received database `CREATE, REFERENCES`; later 14 table grants and three unlocks activated the other roles |
| Earlier approved schema initialization | Created exactly the 11 approved tables; no migrations; later representation corrections changed verifier code only |
| Successful scenario | Inserted one row each in `roles`, `units`, `users`, `materials`, `user_sessions`; session activity updated; no stock reservation/deduction, audit, or unrelated business writes |
| Successful cleanup | Restricted account deleted only the owned session/material/user; transaction and exact predicates/readback passed; role/unit retained |
| This reporting task | Existing evidence and documentation only; no database connections, SQL, tests, source changes, account/grant/schema/data changes, Docker actions, or Git operations |

No migration was created/applied in Task 002. Development database changes: none;
no Task 002 connection to `enterflow_db`/port 3308. Migration 007 and its source,
history, and checksum were not accessed. Approved SQL/manifest hashes remain the
values above; this reporting task did not rewrite either artifact. Pending
approval concerns only missing repeatability work or an explicit criteria
revision, not an automatic next task.
