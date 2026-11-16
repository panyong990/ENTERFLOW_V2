# Employee Management: read-only account and API diagnosis

2026-11-16 (Asia/Manila), `dev-phase`. **All eight provisioned development
employees are present and active. No accounts were recreated or modified.**

## Screenshot provenance and confirmed fault

The user described an Admin Employee Management screenshot with
`The request could not be confirmed. Refresh before retrying any change.`,
placeholder totals and `Employee records have not loaded.` No URL or exact
signed-in identity is visible. The image/earlier separate issue request was not
available in this thread; the user's supplied details were used.

**Original screenshot environment remains undetermined.** Development and the
isolated harness use the same UI/frontend port/API paths. The visible page alone
cannot distinguish them. The approved unauthenticated Playwright smoke never
logged in or visited Employee Management, so it did not itself produce that
authenticated page. No claim is made about other unobserved manual sessions.

The message maps to `src/app/api/client.ts`'s fetch-rejection catch
(`NETWORK_ERROR`, status 0), including its 15-second timeout. It is distinct
from a successful empty list, HTTP 401/403, validation failure or JSON SQL/service
error. A failed load intentionally shows placeholders rather than a zero-account
claim. A working Vite proxy with an unreachable backend returns a different,
explicit 503 message. The original rejection's exact cause (refusal/timeout/etc.)
cannot be proved without its request/network evidence.

**Confirmed current availability fault:** initial OS checks found no frontend
on 5173 or backend on 3000. Docker exposed development at 3308 and the isolated
instance at 53045, but no application server was listening. This is consistent
with a previously rendered page later losing transport; it is not proof of the
historical screenshot's server lifecycle.

## Focused correction and current environment

Started the existing normal development entry points without source/config edits:

```powershell
node backend/src/server.js
npm run dev -- --host 127.0.0.1 --port 5173
```

Verified no differing inherited configuration overrides or browser-runtime flag
before startup. The normal backend loads `database/.env.dev`. Existing origin is
`http://localhost:5173`; use that URL to preserve same-origin protections. Both
normal servers are left running for development; no existing process was stopped.

| Fresh cookie-free check | Result |
| --- | --- |
| Frontend `http://localhost:5173/`, `Accept: text/html` | **200 HTML**, app root and Vite client present |
| Direct backend `/api/health` | **200 JSON**, `enterflow_db`, MySQL 8.4.13 |
| Frontend-proxied `/api/health` | **200 JSON**, same development target/version |
| Proxied `/api/admin/employees` with no cookie | **401 JSON**, Authentication required; no session cookie issued |

OS inspection identifies `backend/src/server.js` on loopback 3000 and Vite on
loopback 5173. **The currently restored app is confirmed development**, not the
isolated browser harness. Its backend/data/summary queries returned no SQL error.
No production application defect requiring a source change was found. Restoring
the stopped services is the focused operational correction; no security bypass,
new API, credential change, automatic login or UI redesign was introduced.

A preliminary `/` probe used JSON Accept and received 404 because Vite's HTML
fallback does not treat it as browser navigation; the correct HTML probe returned
200. A shell-quoting error in an HTML diagnostic command was corrected before
its GET. Neither was an application failure or caused a database change.

## Verified development inventory

Pinned the healthy `enterflow-mysql-dev` container/image, development label,
loopback 3308 binding and `enterflow-mysql-dev-data` volume to the installation
record. Verified trusted-CA/named-identity TLS and authorized socket before reads.
Live target: `127.0.0.1:3308/enterflow_db`, MySQL **8.4.13**, UUID
`48ff3abc-ddd0-11f1-bad9-f6054d80f334`.

| Existing username | Role | Active |
| --- | --- | --- |
| Admin | admin | Yes |
| sales | sales | Yes |
| operations | operations | Yes |
| accountant | accounting | Yes |
| production | production | Yes |
| warehouse | warehouse | Yes |
| logistics | logistics | Yes |
| owner | owner | Yes |

**Total 8, active 8**; each approved username is present once with the expected
role. No employee hash/password, token or personal profile was selected for
reporting. Older zero-account setup/readiness reports are historical and must
not justify provisioning again.

## Actual read-service checks and limits

Exercised the existing `createAdminService` employee-list operation against
development with the existing active Admin ID and a diagnostic SELECT-only
adapter. This is an internal service read check, **not HTTP authentication or
a browser test**. No public auth route/middleware was bypassed or modified.
Unexpected DML, advisory-lock and file-output SQL fail before execution. The
adapter's transaction lifecycle methods are no-ops; actual SELECTs autocommit.
The service's actor `SELECT ... FOR SHARE` still checks the active Admin; any
statement-level read locks release normally. Only list operations are exposed.

**14 read-service checks passed**, plus invalid-role rejection before SQL:

- Unfiltered list/statistics: **8 items, total 8, active 8**.
- Active/inactive filters: **8 / 0**.
- Admin/warehouse role filters: **1 each**.
- Department filter: matching records; unspecified department: **0**.
- Page size 3: **3 / 3 / 2**, all eight employees exactly once.
- Page 99 clamps to page 3; descending-ID order verified.
- Existing-ID search includes its employee; impossible search returns **0**.

This verifies actual backend records, statistics, filter, search, sort and
pagination behavior. It does not establish fresh signed-in browser rendering,
login or complete interactive UI acceptance. Authenticated GETs update
`user_sessions.last_activity_at`, so live signed-in HTTP/browser verification
needs separate write approval. None was attempted; no successful full suite was
repeated. Task 29's prior smoke pass is not relabeled as a new test result.

Evidence: [initial accounts](evidence/employee-management-diagnosis/development-accounts.json),
[service checks/SELECT shapes](evidence/employee-management-diagnosis/directory-read-verification.json),
[HTTP probes](evidence/employee-management-diagnosis/http-readonly.json),
[HTML probe](evidence/employee-management-diagnosis/frontend-html.json),
[current listeners](evidence/employee-management-diagnosis/listeners-after.json),
[summary](evidence/employee-management-diagnosis/summary.json).

## DATABASE CHANGE REPORT

The latest user request explicitly authorizes development read-only checks for
this diagnosis, superseding the earlier smoke-only prohibition on connecting
to development for this narrow purpose. It grants no writes/authenticated tests.

| Action | Target | Tables read/affected | Actual queries/operations | Schema/data changes | Migrations created/applied |
| --- | --- | --- | --- | --- | --- |
| Initial inventory | Pinned development `127.0.0.1:3308/enterflow_db` | users read; none modified | 3 SELECTs: identity; employee total/active; approved usernames/roles/active projections | None / none | None / none |
| Directory verification | Same pinned development target | users, roles read; none modified | 73 SELECTs, including repeated identity/inventory and 14 service list checks; invalid role rejected before SQL; no real BEGIN/COMMIT/DML | None / none | None / none |
| Normal backend startup/health | Same development target | Server/database metadata only | Existing startup connectivity SELECT and one direct/one proxied health SELECT | None / none | None / none |
| HTML/cookie-free directory check | Normal local app | None modified; no business SQL for HTML or cookie-less auth rejection | GETs only, no Cookie/Authorization header or login | None / none | None / none |
| Isolated fixtures, audits/sessions, history | Not queried/modified this pass | None | No initialization, seed, migration, baseline, provisioning, transfer, audit/session write, reset or cleanup | None / none | None / none |

**Database writes: zero. Tables modified: none.** There were 76 explicit CLI
SELECTs plus the standard startup/two health SELECTs. This counts this agent's
known queries, not a server-wide trace of other users. Two CLI connections;
normal backend uses its existing pool. SELECTs exclude employee hashes/passwords.
No record was created, updated/deleted, activated/deactivated or reassigned.
Audits/business data are preserved through zero writes; audit contents were not
independently queried. All synthetic fixtures and protected credentials remained
untouched. Migration 007 and migration history were not accessed/changed.

Runtime configuration credentials were handled in memory, not printed/exported.
Normal startup creates the existing dummy hash in memory, not in user records.
Files added: `backend/diagnostics/employee-directory-readonly.mjs`, this report
and evidence. Updated only current pointers in handoff/older setup/login reports.
Application, RBAC, Real/Demo, authentication/TLS, account-transfer/provisioning
implementation and all prior work remain preserved. No commit, push, merge,
reset, stash, deployment or dependency install occurred.

## Remaining boundary

Refresh Employee Management in the restored normal session at
`http://localhost:5173`. If it still fails, capture the request URL/status/timing
and safe response code, excluding cookies/tokens. The historical screenshot
environment and exact original network rejection remain unproven. A live
authenticated reproduction needs separate session-write permission; none ran.
Task 29 PARTIAL, Task 28 PARTIAL/BLOCKED, Task 32 pending; no Admin redesign.
