# Task 29 Gate D actual results

> **Later approved step:** [unauthenticated Gate E smoke passed](TASK29_UNAUTHENTICATED_SMOKE_RESULTS.md).
> One case passed without writes; Gate D baseline remains verified. No
> authenticated acceptance has executed. The Gate D account below is historical
> to its execution scope and remains unchanged.

2026-11-16 (Asia/Manila). Branch `dev-phase`. **Gate D completed successfully**
under the user's explicit, limited approval. Stopped before Gate E. No browser
smoke or authenticated acceptance was executed.

## Execution and verification

Ran `node browser-test/recovery/initialize-proposed.mjs --approved-initialize`
once as Stephanie, exit **0**. No initialization step failed; no retry, reset or
cleanup occurred. The existing container and reviewed pins were reused.

- Target: `enterflow_browser_recovery_29caa4ce81d64f02` at
  **127.0.0.1:53045**, MySQL **8.4.13**.
- Container: `enterflow-browser-recovery-29caa4ce81d64f02`.
- Server UUID: `97bad1ef-e1a9-11f1-aeb9-1a284b41a26f`.
- Exact container ownership/image/storage/loopback guards, reviewed port,
  CA/certificate signature, named identity, authorized TLS socket, peer
  fingerprint and secure transport checks passed before initialization and
  again during read-only verification. No security checks were weakened.
- Created one database, **28 InnoDB/utf8mb4_unicode_ci tables**, and the reviewed
  additional `users(client_id)` UNIQUE constraint. No migration ledger exists
  in the exact verified 28-table inventory.
- Committed **69 entirely synthetic records** in one fixture transaction.
- Fresh read-only verification passed, exit **0**, using 38 SELECT statements
  and no DML, login, HTTP or browser activity.

Evidence: [initializer result](evidence/task29-gate-d-execution/initialization.json)
and [live read-only verification](evidence/task29-gate-d-execution/verification.json).
The original local initialization report remains preserved.

## Verified per-table row counts

| Table | Rows |
| --- | ---: |
| roles | 9 |
| modules | 6 |
| role_modules | 5 |
| payment_terms | 1 |
| clients | 4 |
| users | 7 |
| client_applications | 1 |
| filter_types | 1 |
| product_specifications | 3 |
| order_stages | 2 |
| delivery_methods | 1 |
| orders | 3 |
| order_items | 3 |
| quotation_references | 2 |
| quotations | 2 |
| quotation_lines | 2 |
| quotation_costing | 0 |
| purchase_orders | 1 |
| production_stages | 1 |
| replacement_requests | 0 |
| job_orders | 1 |
| shipments | 1 |
| invoices | 1 |
| payments | 3 |
| notifications | 4 |
| notification_recipients | 4 |
| audit_events | 1 |
| user_sessions | 0 |
| **Total: 28 tables** | **69** |

All counts match the approved fixture plan. The seven isolated user rows are
three synthetic employees and four synthetic clients; they are unrelated to the
eight existing development employees. No session record was created.

Metadata verification found **28 PRIMARY KEYs, 60 FOREIGN KEYs, 32 UNIQUE
constraints and 13 CHECK constraints**. All CHECKs are enforced. These totals
include constraints already in the reviewed CREATE definitions; only one
additional ALTER/UNIQUE operation was authorized and executed. The specifically
added `uq_user_client_account` is unique on `client_id`, as approved. Verification
does not establish production schema parity or any held-migration integrity.

## Secure credential export

Created exclusively, without overwriting existing files:

- `%LOCALAPPDATA%\EnterFlow\admin-browser-test.credentials.dpapi`
- `%LOCALAPPDATA%\EnterFlow\client-browser-test.credentials.dpapi`

Both were decrypted only in memory as Stephanie for approved verification.
Database/container/UUID metadata matches the reviewed target. The Admin fixture
contains one account and the approved employee/client IDs; the Client fixture
contains two accounts. Each file has inheritance disabled and only Stephanie
and SYSTEM allow/FullControl entries.

New passwords were generated from 32 cryptographically random bytes and hashed
using the existing Argon2id implementation. All seven synthetic user hashes and
the pending synthetic application's hash have the expected Argon2id shape.
The three exported Admin/Client passwords were individually verified against
their stored hashes in memory. No password, hash, token, cookie or encrypted
credential contents were printed or copied into reports/source control.
The pre-existing protected recovery root secret was read in memory, not changed.

## DATABASE CHANGE REPORT

| Stage | Target / tables | Operations actually performed | Schema/data effects | Migrations | Authorization |
| --- | --- | --- | --- | --- | --- |
| Initialization checks | Reviewed isolated instance at 53045; information_schema metadata | Strict TLS/server identity SELECT, exact schema-absence SELECT, selected DB/UUID SELECT after database creation | No business record change from checks | None | Explicit Gate D approval |
| DDL | New exact database; all 28 tables listed above | CREATE DATABASE, 28 CREATE TABLE statements, one ALTER TABLE users ADD UNIQUE(client_id); session time zone/strict SQL mode SETs and select-database operation | One database/28 tables plus approved constraint created | No files applied or markers recorded | Explicit Gate D approval |
| Synthetic fixtures | 25 populated tables listed above | 69 parameterized INSERTs within BEGIN/COMMIT; no UPDATE/DELETE | 69 new synthetic rows, including one explicitly synthetic audit baseline; zero sessions | None | Explicit Gate D approval |
| Post-initialization verification | Same isolated instance, expected 28 tables and information_schema | 38 read-only SELECTs: identity, engine/collation/table inventory, 28 exact counts, UNIQUE/constraint/CHECK metadata, synthetic credential shape/password verification reads | No schema/data changes | None | Approved read-only verification |
| Development/other databases | `127.0.0.1:3308/enterflow_db` not contacted | No connection/query, provisioning/transfer, seed, migration, baseline, backup, reset or cleanup | No changes; eight employees, audits and business records preserved through zero access | None | No such actions authorized/performed |

Two explicit MySQL connections were used in this pass: initializer and verifier.
The initializer issues three explicit SELECTs plus the approved operations above;
the verifier issues 38 SELECTs (**41 application-issued SELECTs total**). Driver
handshake/database-selection protocol exchanges are not counted as SQL SELECTs.
No extra initialization, application API or browser operation was performed.

Local non-database changes: two DPAPI credential exports/private ACLs; original
nonsecret initialization report; new read-only verifier, evidence and this
report; current documentation pointers. No container lifecycle change or new
pin change. All committed schema/fixtures and audit history are retained. No
cleanup or rollback was needed. Migration 007 was not accessed; no migration
history was read, created, modified or falsified.

## Status and next approval

- **Gate D: COMPLETE** for the explicitly approved isolated initialization and
  verification scope.
- **Task 29: PARTIAL** - browser acceptance remains **NOT RUN**, not passed.
  No historical backend/frontend/build/security results were rerun or relabeled.
- **Task 28: PARTIAL/BLOCKED**, unchanged strict Migration 007 hold.
- **Task 32: PENDING verification**.

No application defect was found/fixed during Gate D. No business rules, RBAC,
Real/Demo, sessions/authentication or TLS implementation were changed. No
commit, push, merge, reset, stash or deployment occurred.

Stop here. The next narrowly scoped approval can authorize **only the existing
unauthenticated Gate E smoke test** (health/identity reads, credential metadata
validation and initial-page rendering on the isolated runtime). It does not
authorize login, authenticated GETs/session activity or fixture mutations.
After smoke, authenticated Client/Admin suites still require separate explicit
write approval per the existing acceptance inventory. Never rerun initialization
or reset the retained fixtures to proceed.
