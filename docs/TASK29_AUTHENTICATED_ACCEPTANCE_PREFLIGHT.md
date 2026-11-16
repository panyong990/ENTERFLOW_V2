# Task 29 authenticated acceptance: read-only readiness and approval scope

> **Subsequently approved and executed:** [seven authenticated cases passed](TASK29_AUTHENTICATED_ACCEPTANCE_RESULTS.md).
> One attempt per command, no failures/unexecuted cases. Synthetic state retained;
> normal development restored. Read-only-only/no-execution statements below
> describe this earlier preflight and do not supersede the actual-results report.

2026-11-16 (Asia/Manila), `dev-phase`. **Preflight passed; authenticated tests
NOT RUN.** Ready only after explicit write/port-handoff approval. No missing-server
reinvestigation, frontend redesign, infrastructure rebuild or source fix occurred.

## Fresh readiness

- Existing recovery container `enterflow-browser-recovery-29caa4ce81d64f02`
  passes ownership/image/storage/loopback guards and reviewed identity checks.
- Target **127.0.0.1:53045**, database
  `enterflow_browser_recovery_29caa4ce81d64f02`, MySQL **8.4.13**, UUID
  `97bad1ef-e1a9-11f1-aeb9-1a284b41a26f`; reviewed container ID and certificate
  fingerprint match. Strict CA/named identity/authorized TLS and secure transport
  checks pass. No pin/security setting changed.
- Exact baseline retained: **28 tables, 69 synthetic rows, zero sessions,
  one audit row**. Protected Admin/Client credentials decrypt as Stephanie,
  match the target and stored Argon2id credentials, and retain private ACLs.
  No credential or hash was printed or exported.
- State-sensitive reads pass: Client A has **2 visible notifications, 1 unread**;
  Client B has **1 visible, 0 unread**; employee fixture **202** is active Sales;
  there are **3 synthetic employees** and **1 pending application**.
- Ports **3000 and 5173 are occupied** (observed PIDs **5380** and **23728**),
  matching the previously restored development backend/frontend. Neither was
  stopped, restarted, probed over HTTP or reconfigured during this preflight.
  Revalidate process identity before any later approved pause; do not trust stale
  PIDs or stop arbitrary port owners.
- Existing Playwright configs require those exact application ports and
  `reuseExistingServer: false`. Do not reuse development services, toggle that
  guard or redirect tests to development. Minimum action is an explicitly
  approved temporary pause of the two known development processes, not a new
  port/configuration/infrastructure design.
- Local CLI **discovery only** succeeded: one Client case and six Admin cases
  across four files. `--list` executed no test body, browser, login or web server.
  The earlier unauthenticated smoke's 1/1 pass is reused as historical evidence,
  not rerun or counted as fresh acceptance here.

Evidence: [38-SELECT verification](evidence/task29-authenticated-preflight/verification.json),
[state-sensitive fixture check](evidence/task29-authenticated-preflight/fixture-state.json),
[port inventory](evidence/task29-authenticated-preflight/listeners.json),
[Client discovery](evidence/task29-authenticated-preflight/client-discovery.txt),
[Admin discovery](evidence/task29-authenticated-preflight/admin-discovery.txt).

## Exact remaining execution order and proposed scope

**No execution authorized yet.** One proposed approval can cover the bounded
port handoff, all seven cases below, retained synthetic writes, read-only outcome
verification, and restoration of the normal development entry points afterward.

| Order | Existing spec / cases | Intended database writes, isolated target only |
| --- | --- | --- |
| 1 | `tests/browser/client-portal.spec.mjs` - 1 case: Client A/B authentication, own orders/related reads, empty states, notification mark-read, cross-client denial, logout and Demo isolation | `user_sessions` INSERT/activity/revocation UPDATE; `notification_recipients` UPDATE for Client A's unread row. Cross-client PATCH must return 404 without changing its target. |
| 2 | `tests/browser-admin/admin-auth.smoke.spec.mjs` - 1 case: Admin login/dashboard/roles/logout | `user_sessions` INSERT/UPDATE only |
| 3 | `tests/browser-admin/admin-portal.spec.mjs` - 1 case: Admin employee/client workflows, registration rejection, 401/403 checks/logout | `users` INSERT/UPDATE, `clients` UPDATE, `client_applications` INSERT/decision UPDATE, `audit_events` INSERT, `user_sessions` INSERT/activity/revocation UPDATE |
| 4 | `tests/browser-admin/admin-remaining.spec.mjs` - 4 cases: empty states, 503 retry/recovery, pagination/filter/sort/empty search, registration approval | Sessions in every case; pagination adds up to 11 `users`/audits; registration adds a `client_applications` row and approval updates it, creates one `clients` row and client `users` row, and inserts its audit. |

Precise business effects for the full successful run from this verified baseline:

- Up to **12 synthetic employees** created: one named workflow employee and up
  to 11 pagination employees. No real employee is in scope.
- Fixture employee **202**: profile/job title update, Sales -> Warehouse -> Sales,
  deactivate -> activate, revision/timestamp/audit changes and applicable session
  revocations. This is testing existing allowed role operations, not changing RBAC.
- Fixture client company **103** and its synthetic account: profile update,
  deactivate -> activate and audit/session effects under existing API behavior.
- **Two new synthetic applications**: one rejected; one approved into **one new
  company and one client login**. Their decision/audit records remain.
- Client A notification read state becomes read. The account/notification fixture
  IDs and credentials are existing protected synthetic data, not recreated.
- Session inserts and activity/revocation updates accompany all logins and
  authenticated reads, including denial checks after authentication. Browser
  closure is not server-side logout; several cases leave sessions until expiry.
- Orders, products, quotations, PO/job/delivery/invoices/payments are read only
  during these cases. No schema, grant, migration, history, seed, direct SQL
  repair/delete/reset or development database write is included.

After approval, run these commands **individually**, as Stephanie, from the
project root after confirming only the approved development processes were
paused and the ports are free:

```powershell
node node_modules/@playwright/test/cli.js test --config=playwright.config.mjs tests/browser/client-portal.spec.mjs --workers=1 --retries=0 --max-failures=1
if ($LASTEXITCODE -ne 0) { throw 'Client failed: stop; no retry/reset' }
node node_modules/@playwright/test/cli.js test --config=playwright.admin.config.mjs tests/browser-admin/admin-auth.smoke.spec.mjs --workers=1 --retries=0 --max-failures=1
if ($LASTEXITCODE -ne 0) { throw 'Admin auth failed: stop; no retry/reset' }
node node_modules/@playwright/test/cli.js test --config=playwright.admin.config.mjs tests/browser-admin/admin-portal.spec.mjs --workers=1 --retries=0 --max-failures=1
if ($LASTEXITCODE -ne 0) { throw 'Admin workflows failed: stop; no retry/reset' }
node node_modules/@playwright/test/cli.js test --config=playwright.admin.config.mjs tests/browser-admin/admin-remaining.spec.mjs --workers=1 --retries=0 --max-failures=1
if ($LASTEXITCODE -ne 0) { throw 'Remaining Admin failed: stop; no retry/reset' }
```

The existing harness starts/verifies the isolated backend and Vite for each
command; Playwright manages its own test processes. Do not launch a development
backend for these tests. If anything fails, stop remaining test commands, record
actual results and bounded read-only state, and retain committed writes. Do not
retry, reset notifications or recreate fixtures. Restoring the approved normal
development servers afterward is a runtime port handoff, not database cleanup:

```powershell
# Only after the isolated test processes have released their ports:
node backend/src/server.js
# In the separate normal development terminal:
npm run dev -- --host 127.0.0.1 --port 5173
```

Normal backend startup performs its existing development identity/connectivity
SELECT; no development record or session write is authorized by restoration.
No Docker container, volume or persistent database is stopped/rebuilt.

## Retained state and verification limits

Successful API commits remain. No suite-wide rollback or cleanup exists; service
transactions roll back only their own failed requests. Failure may leave an
intermediate role/active state. Even success retains job-title changes,
revisions/timestamps, notifications, sessions, new entities and audit history.
Unknown commit outcomes require read-only inspection rather than blind retry.

Post-test verification must evaluate **expected deltas and exact synthetic IDs**,
not assert the initial 69 rows/zero sessions. The existing Gate D baseline verifier
is intentionally unsuitable as an unchanged post-authentication count assertion.
Client reruns expect the original unread notification; pagination expects a fixed
page count; application lookup considers the latest 10 pending rows. Do not
repair fixtures to force those assumptions after a partial run.

## DATABASE CHANGE REPORT - this preflight

| Target / action | Tables accessed/affected | Operations | Schema/data changes | Migrations created/applied | Pending approval |
| --- | --- | --- | --- | --- | --- |
| Pinned isolated database at 53045: existing verifier | All 28 expected synthetic tables counted; `users` and `client_applications` synthetic hash projections checked in memory; information_schema metadata read; no tables modified | 38 read-only SELECTs including strict server identity, counts, UNIQUE/constraint/CHECK metadata and exported synthetic password matching | None / none | None / none | Authenticated session/business writes not approved |
| Same isolated target: state-sensitive check | `notification_recipients`, `users`, `client_applications`; none modified | 4 SELECTs including identity; notification visibility/unread counts, employee 202 role/active and employee/pending totals | None / none | None / none | Same bounded future approval |
| Local port inventory and test discovery | No DB tables | OS listeners; local Playwright --list only; no server lifecycle operation or test execution | None / none | None / none | Pausing development processes not approved |
| Development database | Not contacted | No connection or query in this pass; prior eight-account/service evidence reused | None / none | None / none | No development writes proposed |

**Actual total: 2 isolated connections, 42 SELECTs, zero writes.** No login,
authenticated HTTP/browser action, migration/history access, secret disclosure,
credential/fixture change or cleanup. Migration 007 remains entirely untouched.
The development processes/accounts/audits/business data and all uncommitted work
remain preserved. No commit/push/merge/reset/stash/deploy, dependency install or
application/test/configuration code change occurred. Added this report/evidence
and a testing-guide pointer only.

**Task 29 remains PARTIAL.** Seven cases were discovered, **zero authenticated
cases executed**. Task 28 remains PARTIAL/BLOCKED; Task 32 pending. Stop here and
request **one explicit authorization for the temporary known-process port
handoff, the ordered seven-case/table-scoped isolated writes, retained-state
read-only verification and normal-server restoration described above**.
