# ENTER-FLOW test procedures

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
