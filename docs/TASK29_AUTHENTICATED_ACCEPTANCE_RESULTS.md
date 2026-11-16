# Task 29 authenticated acceptance - actual results

2026-11-16 (Asia/Manila), `dev-phase`. **7 PASSED / 0 FAILED / 0 UNEXECUTED.**
All seven approved existing cases ran once, in order, on the reviewed isolated
environment with one worker, zero retries and stop-on-first-failure enabled.
No test failed or was rerun. Normal development services were restored afterward.

## Actual test results

| Order | Existing spec | Passed | Failed | Unexecuted | CLI exit | CLI duration |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `tests/browser/client-portal.spec.mjs` | 1 | 0 | 0 | 0 | 12.3s |
| 2 | `tests/browser-admin/admin-auth.smoke.spec.mjs` | 1 | 0 | 0 | 0 | 8.3s |
| 3 | `tests/browser-admin/admin-portal.spec.mjs` | 1 | 0 | 0 | 0 | 13.0s |
| 4 | `tests/browser-admin/admin-remaining.spec.mjs` | 4 | 0 | 0 | 0 | 19.2s |
| **Total** | **Four commands, seven cases** | **7** | **0** | **0** | **All 0** | |

Fresh evidence: [summary](evidence/task29-authenticated-execution/summary.json),
[Client output](evidence/task29-authenticated-execution/01-client/playwright.log),
[Admin authentication](evidence/task29-authenticated-execution/02-admin-auth/playwright.log),
[Admin workflows](evidence/task29-authenticated-execution/03-admin-workflows/playwright.log),
[remaining Admin](evidence/task29-authenticated-execution/04-admin-remaining/playwright.log).
Each attempt directory also records the exact command, exit code and its own
Playwright artifact directory. A single-attempt wrapper rejects existing attempt
directories and redacts protected test credentials before retaining/displaying
text evidence. Existing specs/configuration/assertions were not modified.

Passed coverage includes Client A/B login, owned dashboard/order/document/
production/delivery/invoice/payment reads, empty states, notification mark-read,
cross-client denial, logout and Demo isolation; Admin login/dashboard/roles;
employee creation/profile/role/activation operations; client account operations;
application rejection/approval; unauthenticated/client Admin denial; intercepted
empty/error responses and recovery; pagination, filtering, sorting and search.

**Application defects exposed: none. Application code fixes: none.** Only
terminal `NO_COLOR`/`FORCE_COLOR` warnings appeared. Initial PowerShell process
metadata checks required collection/JSON timestamp precision corrections before
pausing; their guards stopped before process changes. These were diagnostic
command issues, not failed acceptance attempts or application defects.

## Target isolation and approved retained outcomes

The preflight and each existing harness launch verified the reviewed target:
`enterflow-browser-recovery-29caa4ce81d64f02`, database
`enterflow_browser_recovery_29caa4ce81d64f02`, **127.0.0.1:53045**, MySQL **8.4.13**,
UUID `97bad1ef-e1a9-11f1-aeb9-1a284b41a26f`. Container identity/image/label, tmpfs/
mount restrictions, port, CA/named TLS identity, authorized socket and certificate
fingerprint checks remained strict. No environment fallback or pin was changed.

Before tests: **28 tables, 69 rows, zero sessions, one audit event**.
Read-only post-test verification: **28 tables, 116 retained rows**:

| Table | Before | After | Inserted rows | Existing-row effects |
| --- | ---: | ---: | ---: | --- |
| users | 7 | 20 | 13: 12 employees, one approved-client login | Employee 202 profile/job title and role/active changes; client fixture account profile/active changes |
| clients | 4 | 5 | 1 company (ID 105) | Fixture company 103 profile update |
| client_applications | 1 | 3 | 2 | New 302 rejected; new 303 approved/linked to company 105; original 301 remains pending |
| audit_events | 1 | 23 | 22 | No existing audit edited/deleted |
| user_sessions | 0 | 9 | 9 | Activity and logout/revocation updates; 4 revoked and 5 unrevoked at observation |
| notification_recipients | 4 | 4 | 0 | Client A notification 1301 is now read; cross-client mutation denied |

All other table counts remain unchanged. The delta is **47 inserted rows**, not
116 newly inserted rows. New user IDs are recorded in the postflight evidence.
Fixture employee **202** finishes **active / Sales**, with retained job title
`Browser Test Sales Updated`. Fixture company/account **103** finish active.
All 20 user records have Argon2id-shaped hashes (verified as a count, not output).
Observed constraints remain **28 PRIMARY KEYs, 60 FOREIGN KEYs, 32 UNIQUE and
13 CHECK constraints**, matching the preflight counts.

Audit action totals: `employee.created` 13 (includes the original synthetic
baseline), employee update 1, role changes 2, activation/deactivation 1 each;
client update/activation/deactivation 1 each; application approval/rejection 1
each. These account for the original one event plus 22 new approved events.

Read-only [postflight evidence](evidence/task29-authenticated-execution/postflight.json)
contains counts, safe synthetic IDs/state and SELECT shapes. Successful API
transactions remain committed. No reset, deletion, fixture repair, reseed,
notification reset or automatic rerun was performed. Unrevoked sessions are
retained under existing expiry policies; this is not a promise that they remain
valid indefinitely. The initial 69-row/zero-session verifier must not be reused
as an unchanged post-auth baseline, and Client mark-read is not blindly repeatable.

## Development restoration verified

Only the approved normal backend PID **5380** and Vite PID **23728** were paused,
after command/name/creation-time verification. No other process, Docker container
or volume was stopped. Normal entry points were restored after all four commands:

```powershell
node backend/src/server.js
npm run dev -- --host 127.0.0.1 --port 5173
```

Verified no inherited browser-runtime override before restoration. Fresh results:

- `http://localhost:5173/`: **200 HTML**.
- `http://127.0.0.1:3000/api/health`: **200**, **enterflow_db**, MySQL 8.4.13.
- `http://localhost:5173/api/health`: **200**, same development database.
- Cookie-free health/HTML checks issued no session cookie.
- Pinned, strict-TLS development inventory confirms **8 employees / 8 active**,
  all approved usernames and roles present. No account was modified/reprovisioned.

Evidence: [restored health](evidence/task29-authenticated-execution/development-health.json),
[eight-account inventory](evidence/task29-authenticated-execution/development-after-accounts.json),
[restored listeners](evidence/task29-authenticated-execution/development-restored-listeners.json),
[original process identities](evidence/task29-authenticated-execution/development-before.json).
The restored development servers remain running. No authenticated test ever
used the development backend, and no development session or business write was
performed by this execution.

## Complete DATABASE CHANGE REPORT

| Stage / target | Tables accessed/affected | Queries / operations | Schema changes | Data changes | Migrations created/applied |
| --- | --- | --- | --- | --- | --- |
| Approved isolated preflight at 53045 | Expected 28 synthetic tables and information_schema metadata; synthetic user/application credentials checked in memory | Existing verifier: 38 read-only SELECTs including server identity, counts, indexes/constraints, protected metadata/hash matching | None | None | None / none |
| Four isolated harness launches and backend health | Server/database metadata | Docker metadata/public-CA reads; strict-TLS database/version/UUID SELECTs; existing startup/health SELECTs | None | None | None / none |
| Authenticated Client/Admin reads | users, roles, modules, role_modules, clients, orders/stages/items/specifications, payment terms/delivery methods, quotations/lines, PO, jobs/production stages, shipments, invoices/payments, notifications/recipients, applications/audits and sessions | Existing parameterized SELECTs, ownership/permission checks and per-request transactions; protected reads update session activity | None | Session activity UPDATEs only, plus mutation effects below | None / none |
| Approved test mutations on isolated database only | user_sessions, notification_recipients, users, clients, client_applications, audit_events | Existing API INSERT/UPDATE operations, session creation/activity/revocation, notification read state, employee/client edits, shared identity advisory locks, application registration/decisions and commits | None | Exactly the retained inserts/state changes in the six-table table above; no DELETE | None / none |
| Isolated postflight | All 28 tables counted; constraint metadata, six mutation tables and safe hash aggregate read | 39 read-only SELECTs including verified identity; no repair/cleanup | None | None | None / none |
| Development restoration, 127.0.0.1:3308/enterflow_db | Server identity; users inventory only | Normal startup connectivity SELECT, two cookie-free health SELECTs, three-SELECT pinned eight-account inventory | None | None; eight real accounts/audits/business records preserved | None / none |

Pre/post isolated verifier statements total **77 SELECTs**. Browser/harness/API
SQL is additional; its exact statement and affected-update count was not traced,
so no fabricated whole-run SQL/connection count is asserted. Recorded row deltas
and API assertions establish the actual retained effects. Driver handshakes,
per-request BEGIN/COMMIT and advisory locks are not migration operations.

**No schema, grant or migration-history change. No Migration 007 access.** No
direct SQL mutation was used outside the approved existing API test workflows.
No fixture/credential recreation or overwrite. Test passwords were kept private
and redacted from evidence. Read-only postflight confirms expected table/constraint
counts; this is not a production schema-parity audit or a byte-for-byte snapshot
of every record.

No additional write approval is currently needed because execution is finished.
Any test rerun, extra mutation, fixture reset or cleanup would need new explicit
approval and review of retained state. Nothing is implicitly approved to restore
the initial fixture count. Normal development data writes remain unauthorized.

## Task 29 status and stop point

**Task 29 COMPLETE for the agreed documented pre-business testing scope.** The
last blocker, the seven authenticated acceptance cases, is now verified. The
earlier unauthenticated smoke remains **1 passed** as separate prior evidence;
together the documented eight browser cases have passed. Prior backend **579**,
frontend **70**, migration fixtures **17**, login proxy **1**, production build
and security checks are reused as prior evidence, **not freshly rerun results**.
This report does not claim a new full-suite/build/audit rerun, arbitrary browser
coverage, exact deployment-image testing or production readiness.

Task 28/Task 32 were not investigated, assessed or advanced in this pass. Their
existing hold/status remains unchanged. Stop after Task 29 results; no next phase
or redesign started. No commit, push, merge, reset, stash or deployment occurred.

Files added this pass: `browser-test/recovery/run-approved-spec.ps1` (single-attempt
credential-redacting evidence wrapper), `post-acceptance-readonly.mjs` (read-only
outcome observer), this report and scoped evidence. Updated current testing,
handoff/tracker and preflight pointers. No application, existing spec/config,
RBAC, auth/session/TLS, provisioning or account-transfer implementation changed.
All unrelated uncommitted and teammate work is preserved.
