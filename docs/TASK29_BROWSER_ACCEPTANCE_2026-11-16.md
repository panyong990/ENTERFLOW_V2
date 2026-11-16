# Task 29 browser acceptance follow-up

2026-11-16 (Asia/Manila), `dev-phase`. **Task 29: PARTIAL / environment blocked.**
No browser acceptance case ran. Previous 579 backend, 70 frontend, 17 migration
fixture and 1 proxy passes remain prior evidence; none was rerun in this pass.
Task 28 remains PARTIAL/BLOCKED and its Migration 007 hold is unchanged.

## Actual local environment

Read-only checks were repeated outside the sandbox with approved execution as
`laptop-0m4mrkhv\stephanie`. This corrects the earlier environment limitation:
**Docker is installed and its engine is reachable**, not missing locally.
The earlier report accurately described its restricted process, not this account.

Evidence: [environment.json](evidence/task29-browser-2026-11-16/environment.json),
[read-only preflight script](evidence/task29-browser-2026-11-16/preflight.mjs),
[syntax results](evidence/task29-browser-2026-11-16/syntax.txt).

| Prerequisite | Fresh finding |
| --- | --- |
| Docker Desktop | `C:\Users\Stephanie\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`; client/server **29.9.2**, reachable |
| Context | `desktop-linux` exists and responds; `default` also listed |
| Exact authorized browser container | **Absent**: inspect exits 1, `no such object: enterflow-browser-test-2f90dcd2bbc8a779` |
| Existing containers | `enterflow-mysql-dev` healthy at loopback 3308; `enterflow-migrations-workflow-test` stopped at 3309; `enterflow-mysql84-validation` stopped at 3307; none is the browser target |
| Project Playwright | `@playwright/test`, `playwright`, `playwright-core`: **MODULE_NOT_FOUND** despite package declaration |
| Global Playwright | Not present in `npm list -g --depth=0` (only firebase-tools listed) |
| Chromium | Expected Stephanie-local Playwright cache, project local browser cache and checked standard Chromium executable locations absent; `PLAYWRIGHT_BROWSERS_PATH` unset |
| Protected fixtures | Both `client-browser-test.credentials.dpapi` and `admin-browser-test.credentials.dpapi` absent in Stephanie's `%LOCALAPPDATA%\EnterFlow`; no decryption attempted |

These findings apply to the checked local account/context/paths. They do not
prove that another machine, Docker context or archive lacks a recoverable
environment. No container was started/stopped, downloaded, reset or recreated.
No dependency or browser installation was attempted; no fixture was recreated.

## Isolated database identity and development exclusion

The **configured expected target**, confirmed from `browser-test/backend.mjs`, is:

- Container `enterflow-browser-test-2f90dcd2bbc8a779`, Task 19 label
  `enterflow.task19=2f90dcd2bbc8a779`, context `desktop-linux`.
- Database `enterflow_browser_test_2f90dcd2bbc8a779`, MySQL **8.4.13**,
  UUID `18cdba66-e12d-11f1-a58a-1ea1f4901bc5`.
- Image `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902`.
- MySQL TLS identity `MySQL_Server_8.4.13_Auto_Generated_Server_Certificate`;
  verified CA and certificate identity remain required.

**Live isolated database target: NOT CONFIRMED / unavailable.** The container is
absent; no database identity query was attempted. Do not call the configured name
a currently verified database. The development container's name/port is only
Docker metadata evidence, not a fresh query of its database contents.

Source inspection verifies these guards in the supported Playwright path:

1. Both configs launch `node browser-test/backend.mjs` and refuse reuse of an
   existing backend/frontend server (`reuseExistingServer: false`). Tests use
   only loopback API/frontend URLs. Do not change this or reuse development.
2. Before MySQL connection, the harness requires the exact container/name,
   label/image, running state, tmpfs MySQL storage without bind/volume mounts,
   and loopback-only binding. It never selects another discovered container.
3. The connection explicitly selects the expected browser database with verified
   TLS, then compares database name, version and UUID before server startup.
4. It overwrites DB host/port/name/credentials and TLS settings for the verified
   container, sets `BROWSER_TEST_RUNTIME=1`, then imports the backend.
   `loadRuntimeEnvironment` skips `database/.env.dev` under that flag. Vite's
   existing proxy targets the harness's loopback backend, not a database.

There is no normal configuration fallback to `enterflow_db` in this launch path.
Using `npm run server`, a different config or arbitrary process overrides is not
the supported test procedure. This is **source-verified exclusion**, not a live
network/privilege proof: the harness uses root within its disposable container,
not a read-only or database-scoped SQL principal. No claim of absolute isolation
under arbitrary code/config tampering is made. Do not weaken any identity gate
to accommodate a newly created container; a replacement requires separate review.

## Checks completed safely

- Inspected both Playwright configs, backend harness, five spec files (eight
  cases), runtime loader, authentication/session services/middleware, relevant
  Admin/application/notification write paths and Vite proxy.
- Inspected Docker contexts/version/container names/status/ports and exact-name
  lookup; no container environment secrets or fixture contents were printed.
- Checked local/global package resolution and browser/fixture path existence.
- `node --check` passed on all **8** config/harness/spec files. Syntax validation
  does not resolve dependencies, launch Chromium or execute acceptance tests.
- No HTTP requests were sent to existing local servers, no backend was started,
  and no unknown service on ports 3000/5173 was treated as a test runtime.

The smoke case is designed for fresh unauthenticated contexts: database health
reads, fixture validation and initial-page rendering. It is not runnable here
without Playwright, Chromium, fixtures and the exact isolated runtime. Every
other case logs in; login inserts `user_sessions`, authenticated requests update
`last_activity_at`, and logout sets `revoked_at`. GET/UI read cases therefore
also require write approval. Closing a browser context does not revoke a session.

## Exact staged execution plan - prepared, NOT authorized or runnable yet

First have the environment owner identify whether the original approved Task 19
environment and protected fixture files can be recovered from an existing
authorized location. Do not repurpose development, the migration/validation
containers, start a stopped substitute or initialize a database. If the original
tmpfs environment was lost, recovery/replacement is new work requiring approval,
including a reviewed identity/fixture plan. Existing pinned UUID checks must not
be bypassed. No old setup script is implicit authorization to provision resources.

Dependency installation or a Chromium download also requires separate approval;
the prior failed Chromium install must not simply be retried. After the exact
environment/dependencies are restored through approved procedures:

1. Repeat the read-only preflight as Stephanie. Verify expected container
   image/label/storage/loopback binding, then perform the harness's strict TLS
   identity check and only `SELECT DATABASE(), VERSION(), @@server_uuid` on the
   isolated target. Keep credentials in memory; never output container Env.
2. Verify DPAPI fixture metadata without printing passwords/tokens/hashes. Confirm
   both client accounts, the browser Admin, `fixture.ids.employeeA/clientA`,
   expected client orders/notification counts and current unread state, baseline
   employee count, pending application/activity fixtures and directory names.
   Use bounded allowlisted reads, excluding migration/history/held files.
   Record nonsecret IDs and initial state for an approved write run. Missing
   rows or mismatched state are blockers, not permission to create/reset them.
3. Ensure ports 3000/5173 are available; do not terminate existing processes to
   free them without approval. Run only the exact configs below. Disable retries
   and use one worker to make state changes reviewable. Stop at the first failure.
4. Smoke first (read-only scope), then approve the table-specific write scope
   below before any authenticated case. The commands are to be run individually,
   after dependencies exist; they use the local CLI and cannot auto-download via
   `npx`. `--max-failures=1` stops remaining cases, not statements already committed.

```powershell
# Phase A: existing unauthenticated smoke only, after environment verification
node node_modules/@playwright/test/cli.js test --config=playwright.config.mjs tests/browser/environment.smoke.spec.mjs --workers=1 --retries=0 --max-failures=1

# Phase B: explicit isolated-database write approval required
node node_modules/@playwright/test/cli.js test --config=playwright.config.mjs tests/browser/client-portal.spec.mjs --workers=1 --retries=0 --max-failures=1
node node_modules/@playwright/test/cli.js test --config=playwright.admin.config.mjs tests/browser-admin/admin-auth.smoke.spec.mjs --workers=1 --retries=0 --max-failures=1
node node_modules/@playwright/test/cli.js test --config=playwright.admin.config.mjs tests/browser-admin/admin-portal.spec.mjs --workers=1 --retries=0 --max-failures=1
node node_modules/@playwright/test/cli.js test --config=playwright.admin.config.mjs tests/browser-admin/admin-remaining.spec.mjs --workers=1 --retries=0 --max-failures=1
```

### Acceptance inventory and proposed write scope

All eight cases below are existing source, not freshly discovered/executed by
Playwright. **None is presently ready for execution** because prerequisites are
missing. The phase-B approval target is exclusively the verified database
`enterflow_browser_test_2f90dcd2bbc8a779`, never `enterflow_db`.

| Spec / exact case | Assertions and planned writes | Tables requiring write approval |
| --- | --- | --- |
| `environment.smoke.spec.mjs`: local frontend and isolated backend smoke check | Health DB name/version; two protected client credentials; unauthenticated page and no page errors. No intended DB DML. | None; read-only identity/health scope only |
| `client-portal.spec.mjs`: authenticated Client Portal workflows, isolation, logout, and Demo Mode | Client A/B login, owned dashboard/orders/related reads and empty states; Client A mark-read; cross-client GET/PATCH must return 404; logout; Demo request isolation. | `user_sessions` INSERT/UPDATE; `notification_recipients` UPDATE of Client A's existing unread row (`read_at`); denied cross-client PATCH must not change its target |
| `admin-auth.smoke.spec.mjs`: Admin can authenticate against the isolated browser-test runtime | Login/dashboard/roles, safe projections, logout. | `user_sessions` INSERT/UPDATE only |
| `admin-portal.spec.mjs`: Admin Portal workflows operate against disposable fixtures only | Create named employee if absent; update fixture employee job title; sales to warehouse to sales; deactivate/reactivate; update client contact/profile and deactivate/reactivate; register/reject a uniquely named application; unauthenticated/client Admin denial and logout. | `users` INSERT/UPDATE; `clients` UPDATE; `client_applications` INSERT/UPDATE; `audit_events` INSERT; `user_sessions` INSERT/UPDATE, including fixture session revocation |
| `admin-remaining.spec.mjs`: Admin empty states render safely for empty API responses | Login then intercepted empty directories/requests/dashboard; no business mutation. | `user_sessions` INSERT/UPDATE |
| Same file: Admin directory API failures expose retry and recover without stale data | Login; intercepted 503 responses then real directory retry. | `user_sessions` INSERT/UPDATE |
| Same file: Admin pagination, filters, sorting, reset, and empty search behave correctly | Login; create enough specifically prefixed employees to reach 11 such employees; pagination/filters/empty searches/client sorting. | `users` INSERT (up to 11 employees); `audit_events` INSERT; `user_sessions` INSERT/UPDATE |
| Same file: Admin can approve a disposable registration application | Login; register uniquely named application; approve; verify linked client ID and audit activity. | `client_applications` INSERT/UPDATE; `clients` INSERT; `users` INSERT (one client login); `audit_events` INSERT; `user_sessions` INSERT/UPDATE |

For the full approved phase B, permit only those isolated fixture operations:
up to 12 new employee rows across both Admin specs if absent, one new approved
client/company and its account, two new uniquely named applications, corresponding
audit inserts and session changes. Requests read related order/payment/delivery
tables but do not intentionally write them. Do not grant blanket schema or table
deletion approval. Exact runtime IDs must be verified before the write run.
No migration, seed, baseline, grant, history edit or transfer is in this plan.

### Rollback, cleanup and repeatability

- There is **no suite-wide transaction or automatic database teardown** in these
  specs. Each successful API operation commits independently. Admin/app-review
  services use per-request transactions and rollback failed work; that cannot
  roll back earlier successful requests. Unknown commit outcomes must be checked
  by exact ID and not retried automatically.
- The employee role returns to sales and active returns to true if all steps
  succeed; the job title remains changed and revisions/timestamps/audits advance.
  Client activation returns to true; profile/revision/audit changes remain.
  Revoked sessions are not restored. If a test fails midway those compensating
  steps may never run. Never presume a starting state or force it back blindly.
- New employees, rejected/approved applications, approved client/account and
  audit records remain. Notification read state is intentionally changed and
  remains read. A subsequent Client run expects an unread row and may fail.
  Pagination expects a specific page count and can fail if retained fixtures
  change the total. The new application lookups inspect only the latest 10
  pending rows. A fixture review must precede every rerun.
- Some specs explicitly logout; `admin-remaining` cases and an auxiliary Client
  context do not. Browser/context closure does not delete/revoke server sessions;
  remaining sessions expire under existing timeouts.
- Proposed default for approval is **retain isolated synthetic records, sessions
  and audits after the run**, record exact state deltas and stop on failure. No
  SQL cleanup, notification reset, audit deletion or container reset is approved.
  Any compensating update, API logout beyond the existing specs, scoped deletion
  or restoration needs its own reviewed, explicit target/ID/scope approval.
  Never delete an audit trail or restore an entire database to clean tests.

## DATABASE CHANGE REPORT

| Action performed | Target | Tables affected | Queries/operations | Schema/data changes | Migrations created/applied | Authorization |
| --- | --- | --- | --- | --- | --- | --- |
| Docker metadata inspection | Local Docker `desktop-linux`; container names only | None | context ls, version, ps -a, exact container inspect/name; no docker exec | None / none | None / none | Approved read-only local checks |
| Source, dependency and filesystem checks | Offline source and local paths | None | Reads, package resolution, npm global inventory, fixture/cache existence and JS syntax checks; evidence files written | None / none | None / none | Current inspection scope; no install/decryption |
| Browser/database acceptance | Expected isolated target absent | None | NOT RUN; no server/harness started, no MySQL connection/query or HTTP probe | None / none | None / none | Prerequisites missing; authenticated tests require explicit table-scoped write approval |
| Development/other databases | Not contacted | None | No SQL, account changes, backups, resets, migrations or transfers | None / none | None / none | No writes authorized or performed |

**Real database connections/queries/writes: zero.** The eight real employees,
their audits, all business data and Migration 007/history remain untouched.
Account count is carried from the user, not newly queried. Real/Demo, RBAC,
authentication/session/TLS and account-transfer source were not modified.

## Status and next action

**Task 29 stays PARTIAL.** Fresh browser acceptance: **0 executed**, not a passing
or skipped Playwright run. The blockers are now precisely local: absent exact
Task 19 container, missing Playwright packages/browser and missing protected
fixtures. Docker access itself has been restored/confirmed through approved
read-only execution. No infrastructure was rebuilt.

Next: the environment owner should locate the original authorized environment
and protected fixtures. If it cannot be recovered, obtain explicit approval for
a separate minimal recovery/replacement and dependency plan; do not silently
provision substitutes or change UUID checks. After restoring prerequisites,
perform read-only smoke, then obtain approval for the phase-B table/fixture
writes and retained-state behavior above. The present request does not grant
those approvals. Task 32 remains pending verification.

Files changed in this follow-up: this report, its three evidence files, and
current pointers in TESTING, handoff and task tracker. Existing closure evidence
is preserved. No application/test implementation, lockfile, generated build,
account-transfer code or migration was changed. No commit/push/merge/deploy.
