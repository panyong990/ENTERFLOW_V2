# ENTER-FLOW test procedures

> Task 002 runtime update, 2026-11-21: the authorized single Warehouse scenario
> and guarded cleanup **PASSED**; all 11 schema hashes matched. The documented
> second fresh-run criterion remains pending, so overall acceptance is
> **INCOMPLETE**. See the [runtime acceptance report](TASK_002_RUNTIME_ACCEPTANCE_REPORT_2026-11-21.md).
> Implementation-only and earlier runtime-pending statements below are historical;
> none of this documentation authorizes another run or resource teardown.

## Task 002 second-run configuration (offline preparation, 2026-11-21)

The second registered descriptor is `2f07518b9819d0c1`, generated with
`crypto.randomBytes(8)`, targeting only `enterflow_it_2f07518b9819d0c1`.
`backend/test/support/task002-run-descriptors.mjs` registers the two exact runs;
unknown IDs, edited descriptors, and cross-run database/path bindings fail closed.
The original default remains run `3904feeb1f295fdd`. Its completed evidence,
credentials, journal, and retained reference records were not changed.

Second-run local configuration is under
`backend/test/local/task-002/runs/2f07518b9819d0c1/`: `descriptor.json`,
`identity.reviewed.json`, and `evidence/packet.config.json`. These are configuration,
not fresh identity evidence or execution approval. The container/TLS pins are
unchanged and must be freshly revalidated before any authorized live operation.
The exact account host remains `172.17.0.1`.

Reserved paths below that directory are:

- Protected credentials: `administrator-managed-credentials/accounts.credentials.dpapi`.
- Journal: `evidence/ownership.journal.local.json`.
- Runtime attestation: `evidence/administrator-runtime.attestation.local.json`.
- Separate execution approval: `evidence/execution.approved.json`.

No credentials, journal, attestation, approval, database, or accounts were created.
The future provisioning entry point creates the credential directory with the
existing owner/SYSTEM ACL and DPAPI protections; it refuses existing paths.
Only the existing protected administrator source is reused, in memory.

After separately approved host verification and initial provisioning, invocation
uses `node backend/test/administrator-provisioning.mjs` with
`--descriptor-run-id=2f07518b9819d0c1`, the separately approved `--phase`, and an
`--approval-file` directly inside the second-run directory. Every phase retains
the exact target pins, fresh approval/host binding, collision checks, and grants.

After separately approved schema initialization, account activation, and fresh
runtime packet preparation, the future scenario launcher is:

```text
node backend/test/execute-prepared-scenario.mjs --descriptor-run-id=2f07518b9819d0c1
```

It requires the selected descriptor's approved envelope, fresh evidence, matching
protected role credentials, unused journal, and free loopback port. Port `43123`
is proposed only; availability has not been checked. The original combined runner
and cleanup implementation are reused; no persistent Warehouse password or
standalone fixture phase is introduced. Cleanup remains separately approved.

Focused offline verification: `node --test --test-reporter=dot
backend/test/support/task002-second-run.test.mjs
backend/test/support/administrator-provisioning.test.mjs` passed **24/24**.
These checks use injected connections, not MySQL. No live target or native
DPAPI/ACL behavior was tested. The separate 16-page handoff remains unavailable
as recorded in the runtime acceptance report; no additional requirements are
inferred. Overall acceptance remains **INCOMPLETE** until the second successful
scenario and guarded cleanup are evidenced.

Database Change Report: no live tables reviewed; proposed second-run database
and four restricted accounts remain unprovisioned. No schema/data/account/grant
changes or migrations were performed. Migration 007 and approved schema artifacts
were untouched. Next approval: fresh identity/host preflight and initial
administrator-managed provisioning for this exact second-run descriptor.

## Second-run empty inventory preparation (2026-11-21)

The administrator CLI now supports the read-only `inventory-empty` subphase only
with the explicit second-run descriptor. It validates the existing
`schema-initialization.approved.json` envelope before Docker access or DPAPI:
exact run, administrator, four account/host identities, administrator-managed
mode, only `initialize-schema`, and live expiry. This is a prerequisite collector;
it cannot initialize tables, provision accounts, or execute the scenario.

After separate execution authorization and resolution of the approval blocker:

```text
node backend/test/administrator-provisioning.mjs --descriptor-run-id=2f07518b9819d0c1 --phase=inventory-empty --approval-file=backend/test/local/task-002/runs/2f07518b9819d0c1/schema-initialization.approved.json
```

It reuses Docker/TLS/UUID/version/SQL-mode/session-UTC validation, fixed protected
administrator DPAPI source, and fresh live administrator/connector-host checks.
Only parameterized, exact-schema metadata queries collect database existence,
base tables, views, triggers, routines, and events. Zero table/view objects proves
migration-ledger absence without reading a ledger or any application records.
Any unexpected object rejects empty-inventory acceptance. Success exclusively
creates `inventory-empty.observed.local.json` in the second-run directory, using
the existing administrator-inventory format; existing output is never replaced.

Preparation found the existing approval malformed: UTF-8 BOM rejected by
`readJsonArtifact`, plus triple backticks in the administrator and all four account
identities instead of exact single-backtick bindings. At
`2026-11-21T08:58:09.896Z`, its expiry `2026-11-21T09:18:29.4982196Z` was still
future. The file was preserved unchanged; no approval was replaced or renewed.
Execution remains blocked pending separately authorized correction/reissue and
read-only execution. No actual inventory or emptiness claim has been produced.

Focused offline command: `node --test --test-reporter=dot
backend/test/support/administrator-inventory.test.mjs
backend/test/support/administrator-provisioning.test.mjs
backend/test/support/task002-second-run.test.mjs` — **31/31 passed**. Coverage
includes exact schema filters, all object categories, ledger-object rejection,
malformed/expired/cross-run approvals, host mismatch, and mid-collection expiry.
Syntax check passed. Injected connections only; no Docker, DPAPI, or MySQL action.

Database Change Report: no live tables reviewed or database connections made;
no schema, data, account, grant, or migration changes proposed/performed.
Migration 007, approved artifacts, and first-run resources were untouched.
The separate 16-page handoff remains unavailable as recorded above.

## Task 002 administrator-managed provisioning (implementation only, 2026-11-21)

`backend/test/administrator-provisioning.mjs` is a separate guarded entry point
for run `3904feeb1f295fdd` / `enterflow_it_3904feeb1f295fdd`. No runtime approval
is created by its implementation. It never imports development configuration,
the application server, schema snapshots, fixtures, or migration code. No action
occurs on import; no phase/approval means rejection before target access.

After separate approval only, its invocation shape is:

```text
node backend/test/administrator-provisioning.mjs --phase=<approved-phase> --approval-file=backend/test/local/task-002/<reviewed-approval>.json
```

Phases are `verify-host` (read-only), `provision-accounts` (database/four accounts
only), and `attest-runtime` (read-only, for a later separately approved grant
phase). The approval object has exactly `scope`, `mode`, `runId`, `database`,
`identityDigest`, `phase`, `approvalId`, `approved`, `expiresAt`, and
`administratorAccount`; provisioning/attestation also require `accountHost` and
`hostEvidenceSha256`. Scope is `enterflow-task-002-inventory-auth`, mode is
`administrator-managed`. Identity digest is computed by the existing
`identityDigest` helper from the reviewed identity. Administrator account is the
exact pre-existing root account, never a new delegated account.

`verify-host` uses authenticated `USER()` on the verified TLS connection and
exclusively creates ignored `host.observed.local.json`. Only a literal IPv4/IPv6
origin is accepted. The owner must review that host and bind its evidence digest
(`hostEvidenceDigest`) into the next phase's approval. Evidence expires after
15 minutes; expired records must be preserved/archived by an explicitly scoped
operator action before capturing replacements. No automatic overwrite occurs.

The administrator credential comes only from the existing fixed Task 29 DPAPI
file, decrypted in memory under Stephanie's Windows SID. Four independent random
passwords are DPAPI-encrypted into a new ACL-restricted ignored
`administrator-managed-credentials/accounts.credentials.dpapi` before DDL.
Credential overrides, plaintext credential files, and raw SQL/error output are
forbidden. Success/failure output contains status codes only. DDL is not atomic:
any failure retains encrypted credentials and partial state for review; there is
no automatic retry, rollback, account alteration, or destructive recovery.

Initial provisioning grants only `CREATE, REFERENCES` on the exact run database
to `it_3904feeb1f295fdd_init` and unlocks it. The `_fixture`, `_api`, and `_cleanup`
accounts remain TLS-required, locked, and privilege-free. Existing database or
any account containing this run ID is a collision. No account receives global
privileges or `GRANT OPTION`. Database underscores are escaped when
`partial_revokes=OFF` and literal when ON; the setting is never changed.

For the later scenario, set `provisioningMode: "administrator-managed"` and the
exact `administratorAccount` plus four account/host bindings in its separately
approved envelope. The existing `ENTERFLOW_IT_PROVISIONER_ATTESTATION_FILE`
variable accepts a managed attestation from `attest-runtime`; it checks the four
unlocked accounts' exact grants and rejects extra run accounts. The managed
artifact contains `mode`, `runId`, `database`, `phase: "runtime"`, `identityDigest`,
`reviewedAt`, `administratorAccount`, `accounts`, `delegatedProvisionerCreated:
false`, and `administratorCredentialsExcluded: true`. It expires after 15 minutes
and is a trusted operator artifact, not independent proof of process isolation.
The scenario rejects administrator/provisioner credential inputs and mismatched
role usernames before opening its role connections; its API child still receives
only API credentials. Existing delegated attestations require their original
approval mode and validation. No fifth account is invented for managed mode.

Remaining runtime gates: read-only host observation/approval, native DPAPI/ACL
verification, approved provisioning, separate snapshot initialization and
post-schema table-grant approval, fresh evidence, and scenario execution approval.
No runtime operation is authorized by this documentation.

Implementation verification: 20 focused offline checks passed (administrator
safeguards, affected target helpers, and role-grant binding). No live transport,
DPAPI, or ACL operation was tested. Database Change Report: source workflows for
the four accounts and six future runtime tables reviewed; no live tables
accessed, schema/data/account/grant changes performed, or migrations created or
applied. Migration 007 and the approved snapshot/manifest were untouched.

## Task 002 isolated Inventory API/MySQL runner (implementation only)

The guarded command is:

```powershell
npm run test:mysql:inventory-auth -- --phase=<approved-phase>
```

It is intentionally unusable by default. With no phase it exits before reading target files, opening a network connection, starting the API, or performing a write. Every phase requires `INTEGRATION_TEST_RUNTIME=1`, a current phase-specific approval envelope, the reviewed target identity, a current single-container inspection artifact, and a CA whose raw-byte SHA-256 matches that identity. The inspection artifact has exactly `scope`, `runId`, `inspectedAt`, and `container`; `container` is one current Docker inspection object. It is rejected after 15 minutes, but the runner never invokes Docker to refresh it. Local approvals, identities, credentials, CA material, schema evidence and ownership journals belong under ignored `backend/test/local/task-002/` or `backend/certs/local/task-002/`; never commit or print them.

Implemented phases are `verify-target`, `verify-grants`, `initialize-schema`, `execute-scenario`, and `cleanup`. There is deliberately no provisioning, Docker-create, grant, account-create, database-create, teardown, migration, seed, or target-discovery phase. The target administrator performs approved provisioning and supplies reviewed evidence; the runner never invokes Docker or the legacy migration harness.

The non-secret identity shape is `backend/test/integration-target.example.json`. A local approval envelope has exactly `scope`, `approvalId`, `approved`, `runId`, `phases`, and `expiresAt`. Its `scope` is `enterflow-task-002-inventory-auth`; phases must name only the separately approved operations. `execute-scenario` is invoked only when the envelope includes `verify-grants`, `load-fixtures`, and `execute-http`. Cleanup is a separate invocation and requires a separate `cleanup` approval.

Required path variables are phase-specific:

- all phases: `ENTERFLOW_IT_APPROVAL_FILE`, `ENTERFLOW_IT_IDENTITY_FILE`, `ENTERFLOW_IT_INSPECTION_FILE`, `ENTERFLOW_IT_CA_FILE`;
- grant verification: four role-specific `ENTERFLOW_IT_<ROLE>_USER` and `_PASSWORD` values for `INITIALIZER`, `FIXTURE`, `API`, and `CLEANUP`;
- initialization: `ENTERFLOW_IT_EMPTY_OBJECT_INVENTORY_FILE`, `ENTERFLOW_IT_SCHEMA_EVIDENCE_FILE`, and initializer credentials;
- scenario: the schema-evidence file, `ENTERFLOW_IT_VERIFIED_OBJECT_INVENTORY_FILE`, `ENTERFLOW_IT_PROVISIONER_ATTESTATION_FILE`, `ENTERFLOW_IT_JOURNAL_FILE`, explicit `ENTERFLOW_IT_API_PORT`, and fixture/API/cleanup credentials;
- cleanup: the journal and cleanup credentials.

The provisioner runtime attestation must show exactly `USAGE`, no roles or other grants, and `locked: true`. Administrator object inventories are identity-bound to scope, run ID, database, UUID and certificate digest, expire after 15 minutes, and identify their stage as `empty` or `initialized`. The empty inventory contains no objects; the initialized inventory contains the exact 11 base tables and no views, triggers, routines, or events. The raw schema artifact must still hash to `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`; initialization uses exactly its 11 statements and verifies every manifest table hash.

The actual scenario creates the direct synthetic Warehouse fixture and keeps its plaintext password only in that process, starts the real backend with a newly constructed allowlisted environment, exercises login and Inventory read, independently reads session/material state, stops the backend, and leaves an ownership journal. It does **not** clean up automatically. Run `cleanup` only after separate approval; ambiguous ownership always retains the isolated target. Provisioning and database/container teardown remain external and separately approved.

Offline guard tests can be run without MySQL, Docker, the API, development configuration, or migration access:

```powershell
node --test backend/src/config/runtime-config.test.js backend/test/support/integration-target.test.mjs backend/test/support/inventory-schema-snapshot.test.mjs backend/test/fixtures/inventory-auth.fixture.test.mjs backend/test/inventory-auth.mysql.integration.test.mjs
```

Do not run the guarded integration command, legacy `*.mysql.integration.js` files, browser database harness, database CLI, or migration test/runner as a substitute. Runtime execution requires a new approval packet after implementation review.

## Latest stabilization execution — November 18, 2026

Actual focused groups: 125 security/auth, 214 workflows and 82 frontend passed; then explicit full safe **844 backend / 218 frontend** passed. Ancillary groups scanner/proxy/preparation/selected-planner: **12/2/13/3 passed**. Zero failures/skips/cancellations/todos in every test group, exits 0. Focused results overlap full suites. Build 2714 modules and fresh asset scan (0 unexplained) passed. Exact commands/membership/counts/exits: [execution report](stabilization/execution-2026-11-18/EXECUTION_REPORT.md) and [ledger](stabilization/execution-2026-11-18/execution-results.json).

**Security gate not passed:** npm audit exited 1 with 4 high affected package entries through one picomatch advisory; no dependency changes. External design-capture script retained under formal production-release hold. [Security disposition](stabilization/execution-2026-11-18/SECURITY_DISPOSITION.md). Current scan is [bundle-hashed dated evidence](stabilization/execution-2026-11-18/production-scan.json); older scanner JSON remains historical. No live database/browser/application services, migrations, imports, Docker or protected-file access. Full nine-role business/visual acceptance remains open.

## Current stabilization preparation — November 18, 2026

Use the [controlled regression plan](stabilization/REGRESSION_PLAN.md), [exact 102-file inventory](stabilization/test-inventory.json) and [88-file worktree reconciliation](stabilization/WORKTREE_RECONCILIATION.md). Preparation did not rerun the major suites/build/browser/live workflows. Earlier 844/216 full-suite counts below remain historical; the accepted Operations correction later added two frontend regressions. Current full aggregate totals require execution, not arithmetic inference. Plan records layered test overlap, source-only coverage, missing interaction/persistence evidence and excluded environment-dependent harnesses. No database/migration/Docker/protected-file access is authorized by older commands or reports below.

Saved scanner current-scan.json refers to an older, now absent bundle. Preserve it as historical; retain a new dated current-build scan in the next run. The committed index.html also includes an external design-capture script outside the local JS marker gate; review before production acceptance. [Findings and dispositions](stabilization/WORKTREE_RECONCILIATION.md).

## November 18 production scanner and major safe regression refresh

Latest scoped execution: **844 backend tests across 67 files**, **216 frontend tests across 35 files**, **12 scanner regressions**, **2 synthetic auth/proxy regressions**, **13 inventory-preparation regressions**, **3 selected legacy planner tests**; every final group has zero failures/skips and exit 0. Groups and exact commands: [current handoff](asset-scanner/HANDOFF_REPORT.md), [machine-readable file membership](asset-scanner/regression-results.json). Do not add earlier focused/historical counts to these results.

Initial frontend run: 212 passed, 3 failed (obsolete cancellation-unavailable/no-pagination expectations). Reconciled those contracts to the already implemented authenticated workflow, retaining security/history/terms checks and adding an executable cancellation adapter test; final 216 passed. No production workflow was disabled to satisfy assertions.

Production build passes (existing large-chunk/Node deprecation warnings). Scanner passes with zero unexplained findings after occurrence-specific catalog validation and production-only exclusion of demo address defaults; all 132 deny markers retained. [67-finding evidence](asset-scanner/baseline-findings.csv).

These are source/unit/adapter/mock-HTTP suites, not actual accounts, browser acceptance or live persistence. MySQL integration scripts, all migration suites/CLI, Docker/browser database harnesses and the standalone synthetic MySQL-protocol TLS fixture were NOT RUN. The existing database import hook blocked accidental live pool access. Section 24 preparation artifacts were only freshness-checked, not regenerated. No protected Migration 007 access occurred.

Older task-specific and environment evidence below remains historical; it does not override current execution scope or authorization restrictions.

> **Task 29 authenticated acceptance COMPLETE:** [actual execution and retained state](TASK29_AUTHENTICATED_ACCEPTANCE_RESULTS.md).
> Fresh: **7 passed, 0 failed, 0 unexecuted**, four single-attempt commands, one
> worker/zero retries. Existing isolated fixtures retained at 28 tables/116 rows.
> Development servers restored and health/eight active employees verified.
> Task 29 is complete for the agreed scope using prior unit/build/security
> evidence; no full-suite rerun or production-readiness claim. Stop after Task 29.

> **Latest authenticated acceptance preflight:** [readiness and single next approval](TASK29_AUTHENTICATED_ACCEPTANCE_PREFLIGHT.md).
> Isolated pins/TLS/28-table/69-row baseline and protected fixtures pass. Seven
> authenticated cases discovered only; none executed. Development occupies ports
> 3000/5173 and was left running. Temporary port handoff and documented isolated
> session/business writes require explicit approval. Task 29 remains PARTIAL.

> **Fresh unauthenticated Gate E smoke: PASSED** - [results and database report](TASK29_UNAUTHENTICATED_SMOKE_RESULTS.md).
> Existing smoke ran once: 1 passed, exit 0, one worker/zero retries. Before/after
> read-only checks passed: 28 tables/69 rows, zero sessions, one audit row.
> No writes or authenticated cases. Task 29 remains PARTIAL; separate approval
> required for the state-changing Client/Admin acceptance scopes.

> **Gate D actual result:** [execution and read-only verification](TASK29_GATE_D_RESULTS.md).
> Approved isolated initialization succeeded: 28 tables, 69 synthetic rows,
> users(client_id) UNIQUE and both protected exports verified. Zero sessions.
> Gate E smoke/authenticated tests NOT RUN; separate approval required. Task 29
> remains PARTIAL. Development and Migration 007 untouched.

> **Current Gate D assessment:** [verified target and exact pending writes](TASK29_GATE_D_APPROVAL_REVIEW.md).
> Replacement pins/TLS verified at loopback 53045; Playwright 1.56.1 and Chromium
> available. Schema and protected fixtures absent; initialization not executed.
> One isolated connection/three SELECTs, no writes. Gate D approval required;
> smoke/authenticated acceptance remain separately gated. Task 29 PARTIAL.

> **Replacement preparation:** [minimal recovery runbook](TASK29_MINIMAL_RECOVERY_PLAN.md)
> and `browser-test/recovery/` contain an inactive 28-table/69-row synthetic plan,
> exact gated commands and offline validation. The user now confirms local
> Docker/Playwright/Chromium availability. No replacement, protected credentials,
> active pins or DB records were created/changed. Recovery and acceptance require
> separate approvals; Task 29 remains PARTIAL.

> **Latest browser follow-up:** [Task 29 environment and acceptance plan](TASK29_BROWSER_ACCEPTANCE_2026-11-16.md).
> Docker 29.9.2 is reachable as Stephanie in `desktop-linux`. The exact Task 19
> container is absent; Playwright, checked Chromium caches and protected fixtures
> remain unavailable. Eight browser cases were reviewed; none ran. Task 29 stays
> PARTIAL. No full suites were repeated, databases accessed or software installed.
> Authenticated read checks also update sessions and require write approval.

## Current execution and portable commands - 2026-11-16

See [the current closure report](TASKS_28_29_CLOSURE_2026-11-16.md) and its
linked logs. Fresh on Node v24.21.0/npm 11.19.0: **579 backend**, **70 frontend**,
**17 migration-fixture**, and **1 synthetic auth-proxy** tests passed, with zero
failures/skips/cancellations/todos in the final runs. Production build passed;
106 JS syntax checks passed; npm audit reported zero known vulnerabilities.
Browser and real-database suites were not run. Task 29 remains **PARTIAL**.

The old directory-form commands below fail before discovery on this Node 24
environment. Use explicit test-file lists from the repository root in PowerShell:

```powershell
$backendFiles = @(rg --files backend/src -g '*.test.js')
node --import ./backend/test/support/mock-database.js --test @backendFiles
$frontendFiles = @(rg --files src/app -g '*.test.mjs')
node --test @frontendFiles
node --test database/migration-core.test.mjs
node --import ./backend/test/support/mock-database.js --test tests/auth-login.integration.test.mjs
npm run build
npm audit --json --ignore-scripts
```

The existing import hook replaces the eager database singleton before evaluation
and throws on accidental live queries. Backend tests inject mocks; no credentials,
CA files or real database are needed. Do not remove the hook to resolve a test
failure. Stop and record failures. Check command exit codes individually.

The sandbox blocked esbuild directory resolution during the first frontend/build
attempts; approved retries outside it passed. Audit also required approved network
access after its initial failure. Existing useLayoutEffect SSR and build chunk-size
warnings remain. Exact Docker-pinned Node 24.15.0 is not verified by Node 24.21.0.

`@playwright/test` cannot be resolved in the current installation. Docker and
required protected browser fixtures are unavailable to the executing process.
Do not install Chromium again, request Chrome Computer Use, start the harness
against development, or create/reset a database. First restore/verify the approved
isolated environment through authorized procedures and approve its test writes.

## Historical testing record (superseded freshness claims)

This guide records repository test entry points, fresh Task 29 unit-test
results, and historical environment diagnostics separately. The root package
has no unified `test` script.

## Prerequisites

- Do not retry the Playwright Chromium installation as part of this update; a
  prior installation attempt stalled during extraction. Do not copy or display
  any `.env` file while preparing tests.
- This verification ran with Node.js v26.13.0 and npm. The backend container is
  built with Node 24.15.0; this task did not verify the suites on Node 24, so
  that runtime-version difference remains visible.
- Frontend unit tests use Node's built-in test runner. Backend unit and HTTP
  tests use Node's built-in test runner and mocks; they do not need MySQL.
- Browser tests require the exact isolated Task 19 Docker container, Docker
  context `desktop-linux`, a loopback-only port mapping, expected database,
  MySQL version and UUID, valid TLS CA/name verification, and the local DPAPI
  fixture files under `%LOCALAPPDATA%\EnterFlow`. Never substitute a
  development or production database or bypass the identity checks.
- Playwright and its Chromium browser must be available after dependency
  setup. Credentials must remain DPAPI-protected and must never be printed.

## Backend suite

From the repository root:

```powershell
node --test backend/src
```

This recursively discovers the backend `*.test.js` files. The fresh Task 29
result is **579 passed, 0 failed, 0 skipped**. Node's test summary is the
pass/fail record; a nonzero exit code or any `fail`, `cancelled`, or unexpected
`skip` must be reported. This is not the separate real-MySQL integration
harness.

## Frontend suite

From the repository root:

```powershell
node --test src/app
```

This recursively discovers the frontend `*.test.mjs` files. The fresh Task 29
result is **64 passed, 0 failed, 0 skipped**. An existing React server-render
`useLayoutEffect` warning was noted in earlier test evidence; preserve it in
reports when observed until its source is separately reviewed.

The combined fresh result is **643 passed, 0 failed, 0 skipped**. These supplied
results are distinct from the historical environment diagnostics below.

## Browser suites and order

Browser tests were **NOT RUN** for this Task 29 update. The isolated Task 19
browser-test container was unavailable, Chromium installation had previously
stalled, and the required DPAPI fixtures were unavailable. Do not retry the
browser installation or substitute another database/environment.

After those prerequisites are restored and backend startup is authorized for
the confirmed target, the documented order is Client smoke/preflight, full
Client suite, then Admin suite:

```powershell
npm run test:browser:smoke
npm run test:browser
npm run test:browser:admin:smoke
```

The first command runs the environment smoke spec. The second runs all specs
under `tests/browser`; the third uses `playwright.admin.config.mjs` and runs all
specs under `tests/browser-admin` despite the historical `:smoke` script name.
Playwright's configured `browser-test/backend.mjs` checks the container name,
Task 19 label, pinned image, running state, tmpfs data directory, absence of
bind/volume mounts, loopback-only port, MySQL database/version/UUID, and TLS
certificate identity before starting the API server. The smoke spec also
checks database name/version and the Client DPAPI credential metadata. Admin
specs check Admin credential metadata. Browser tests may write only to this
dedicated disposable browser database. Never point the harness at development
or production.

Execution order is therefore backend unit suite, frontend unit suite, Client
browser smoke/preflight, Client browser suite, Admin browser suite. Stop on a
failure and record the exact command, exit code, pass/fail/skip/todo counts,
and safe error summary. Do not include passwords, tokens, cookies, raw
environment output, or DPAPI values.

## Database and backend startup limitations

Backend startup was not completed: it requires a database connection and
confirmation of the intended database target. No database connection or query
was performed. No database or migration command was run for this Task 29
evidence update. Refer to [TEAM_MIGRATIONS.md](../database/TEAM_MIGRATIONS.md)
for current migration safeguards and authorization requirements.

## Fresh Task 29 test results

| Command | Result |
| --- | --- |
| `node --test backend/src` | 579 passed, 0 failed, 0 skipped |
| `node --test src/app` | 64 passed, 0 failed, 0 skipped |
| Combined | 643 passed, 0 failed, 0 skipped |

## Historical diagnostics and remaining limitations

- Browser tests were not run. Earlier environment preflight found the isolated
  Task 19 browser-test container unavailable; no browser suite completed.
- Chromium installation previously stalled during extraction. Do not retry it
  as part of this update.
- Required Client/Admin DPAPI fixtures were unavailable.
- Backend startup did not complete because it requires a database connection
  and confirmation of the intended database target.
- No database connection or query was performed; no database was used or
  changed.
- Earlier `npm ci`, Playwright executable, and browser-preflight diagnostics are
  historical environment results, not fresh Task 29 test results.
