# ENTER-FLOW test procedures

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
