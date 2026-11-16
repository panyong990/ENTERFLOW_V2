# Task 29 Gate D approval review

> **Subsequently approved and executed:** [Gate D results](TASK29_GATE_D_RESULTS.md).
> Initialization and read-only verification succeeded; the 28 tables, 69 rows,
> UNIQUE constraint and two protected exports are now verified. Browser tests
> remain unexecuted. The pre-execution findings/proposal below are historical.

2026-11-16 (Asia/Manila). `dev-phase`; all existing uncommitted work preserved.
This is the current assessment after the user completed recovery Gates A-C.
It supersedes older statements that the replacement container/pins or local
browser dependencies are absent. **Gate D and browser acceptance have not run.**

## Verified read-only findings

[Fresh environment evidence](evidence/task29-gate-d-review/environment.json)
was obtained as Stephanie through the existing strict-TLS recovery helper:

- Container `enterflow-browser-recovery-29caa4ce81d64f02` is running with the
  reviewed image/label, exact container ID, tmpfs storage and no bind/volume mount.
- Endpoint **127.0.0.1:53045**, MySQL **8.4.13**, server UUID
  `97bad1ef-e1a9-11f1-aeb9-1a284b41a26f`. Actual container ID, port and peer
  certificate SHA-256 fingerprint match the observed/reviewed manifest.
- Verified CA/signature, named TLS identity, authorized TLS socket and
  `@@require_secure_transport=1` checks passed. No verification was disabled.
- The seven-file activation is applied: `git apply --reverse --check` passes.
  This command only checks applicability; it does not reverse the patch.
- Playwright **1.56.1** resolves and its expected Chromium executable exists.
- Application database `enterflow_browser_recovery_29caa4ce81d64f02` is absent;
  its table inventory is empty. No prior initialization-report file exists.
- Both protected Admin/Client credential files are absent. Neither was created
  or decrypted. Only the existing recovery root secret was decrypted in memory
  to perform the approved read-only identity queries; it was not printed.

The supported browser launch path pins the exact replacement target and
overwrites DB settings, sets `BROWSER_TEST_RUNTIME=1` to skip `.env.dev`, and
forces loopback binding. The configs refuse existing-server reuse. Port 3308
is rejected. The development database was not contacted; its employee count
is user-reported and was not re-queried.

## Concrete Gate D proposal - NOT executed

Command after explicit approval, run as Stephanie from the project root:

```powershell
node browser-test/recovery/initialize-proposed.mjs --approved-initialize
```

The reviewed initializer rechecks the exact container/TLS/UUID and refuses an
existing schema, either existing protected fixture, or a prior initialization
attempt. The approval applies only to:

1. CREATE DATABASE `enterflow_browser_recovery_29caa4ce81d64f02` on
   **127.0.0.1:53045**; utf8mb4/utf8mb4_unicode_ci.
2. The **28 CREATE TABLE statements** in
   [schema.review.sql](../browser-test/recovery/schema.review.sql), plus the
   reviewed `users` UNIQUE constraint on `client_id`. No migrations or history
   markers execute. Tables:
   `roles`, `modules`, `role_modules`, `payment_terms`, `clients`, `users`,
   `client_applications`, `filter_types`, `product_specifications`, `order_stages`,
   `delivery_methods`, `orders`, `order_items`, `quotation_references`,
   `quotations`, `quotation_lines`, `quotation_costing`, `purchase_orders`,
   `production_stages`, `replacement_requests`, `job_orders`, `shipments`,
   `invoices`, `payments`, `notifications`, `notification_recipients`,
   `audit_events`, `user_sessions`.
3. **69 parameterized synthetic INSERTs in one fixture transaction**, as defined
   in [fixtures.proposed.mjs](../browser-test/recovery/fixtures.proposed.mjs):

| Table | Rows |
| --- | ---: |
| roles | 9 |
| modules | 6 |
| role_modules | 5 |
| payment_terms | 1 |
| filter_types | 1 |
| order_stages | 2 |
| delivery_methods | 1 |
| production_stages | 1 |
| clients | 4 |
| users | 7 |
| client_applications | 1 |
| audit_events | 1 |
| orders | 3 |
| product_specifications | 3 |
| order_items | 3 |
| quotation_references | 2 |
| quotations | 2 |
| quotation_lines | 2 |
| purchase_orders | 1 |
| job_orders | 1 |
| shipments | 1 |
| invoices | 1 |
| payments | 3 |
| notifications | 4 |
| notification_recipients | 4 |
| **Total** | **69** |

`quotation_costing`, `replacement_requests` and `user_sessions` remain empty
after initialization. The seven user rows are entirely synthetic (three
employees and four clients), separate from the eight real development employees.

4. Generate fresh random test passwords and Argon2id hashes in memory, then
   exclusively create these two DPAPI-encrypted files under Stephanie's profile,
   with current-user/SYSTEM file ACLs:
   `%LOCALAPPDATA%\EnterFlow\admin-browser-test.credentials.dpapi` and
   `%LOCALAPPDATA%\EnterFlow\client-browser-test.credentials.dpapi`.
   No real credentials/hashes/sessions/data are copied or printed.
5. Write/update the new nonsecret
   `browser-test/recovery/initialization-report.local.json`, recording completed
   table creation, acknowledged fixture commit and protected filenames. It is
   exclusively reserved before initialization; an existing attempt blocks retry.
6. After initialization, perform bounded read-only verification of target
   identity, the 28 tables/constraint definitions, exact fixture counts/baseline
   and protected credential metadata without exposing secrets.

DDL can commit partially. A failed fixture transaction is rolled back where
possible; earlier DDL remains. If credential export fails after fixture commit,
rows remain. Unknown commit outcomes require inspection, not blind retries.
Successful synthetic records/audits and protected files are retained. No reset,
drop, audit deletion, compensating cleanup, migrations or container recreation
is included in this approval.

**Not included:** unauthenticated smoke, login, authenticated reads or any
acceptance mutation. Smoke can be separately approved after Gate D verification.
Authenticated Client/Admin tests require a later separate approval covering
session INSERT/activity/revocation UPDATEs, notification read state, fixture
account changes, new applications/clients/employees and audit inserts, as listed
in [the acceptance inventory](TASK29_BROWSER_ACCEPTANCE_2026-11-16.md).

## Task 28 and Task 32 assessment

Task 28 remains **PARTIAL / BLOCKED for integrity reconciliation**. Existing
runner/source and diagnosis evidence distinguishes deliberately deferred history
from a proven content mismatch while still rejecting unverified integrity. No
new evidence resolves the actual held-file/history relationship. Under the
current hold there is no compliant content-verification/reconciliation path.
No history query, content inspection, migration CLI, baseline or migration ran.
Any later reconciliation requires a separately reviewed scope/authorization;
this Gate D approval must not be interpreted as changing the hold.

Task 29 remains **PARTIAL**. Fresh checks here are environment/TLS/metadata,
activation applicability and syntax validation of the new read-only helper.
Browser cases executed: **0**. The earlier 579 backend, 70 frontend, 17 migration,
1 proxy and 7 recovery test passes, build and dependency audit remain prior
evidence; no full suite/build/audit was rerun here.

Task 32 remains **PENDING verification**. The browser prerequisite blocker has
narrowed to initialization and acceptance authorization, but actual browser/
persistence evidence and migration integrity remain open. Dockerfiles still
pin Node 24.15.0/nginx; the previous build/unit checks do not verify those exact
runtime images, a deployed target, production TLS/secrets/network/rollback,
monitoring or operational ownership. No deployment or readiness smoke against
development/production was attempted. Existing conditional module-development
guidance is not production clearance. Admin visual redesign has not started.

## DATABASE CHANGE REPORT - this assessment only

- **Target:** isolated recovery instance `127.0.0.1:53045`, initial connection
  has no selected application database. Development not contacted.
- **Connection count:** 1. **Statements:** 3 read-only SELECTs:
  `SELECT VERSION(), @@server_uuid, DATABASE(), @@require_secure_transport`;
  exact-name `information_schema.SCHEMATA` lookup; exact-name
  `information_schema.TABLES` lookup. Query aliases are in the evidence/helper.
- **Tables affected:** none. Only server variables and information_schema metadata
  were read; no business table or migration history was queried.
- **Schema/data changes:** none. **Migrations created/applied:** none.
- **Container/protected-file changes:** none. Existing resources/pins preserved.
- **Pending:** the exact Gate D database/table/row/DPAPI scope above, followed by
  separately authorized smoke and authenticated acceptance. User approval required.

Files changed in this pass: added `browser-test/recovery/assess-readonly.mjs`,
environment evidence and this report; updated current pointers in testing,
handoff, tracker and recovery runbook. No application or fixture implementation
bug was fixed, no full suite repeated and no staging/commit/push/merge/reset/stash/
deployment performed. Stop here pending explicit Gate D authorization.
