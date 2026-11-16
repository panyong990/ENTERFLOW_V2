# Task 29 unauthenticated Gate E smoke results

2026-11-16 (Asia/Manila), branch `dev-phase`. **PASSED** under the user's explicit
unauthenticated-only approval. Stopped after this smoke test and read-only
verification. No authenticated Client/Admin acceptance case ran.

## Actual execution

Ran once as Stephanie from the project root:

```powershell
node node_modules/@playwright/test/cli.js test --config=playwright.config.mjs tests/browser/environment.smoke.spec.mjs --workers=1 --retries=0 --max-failures=1
```

**1 passed, 0 failed; exit 0; one worker; zero retries; stop on first failure.**
Playwright reported 26.1 seconds overall and 17.8 seconds for the case:
`local frontend and isolated backend smoke check`.

Evidence: [raw Playwright output](evidence/task29-unauthenticated-smoke/playwright.log),
[result summary](evidence/task29-unauthenticated-smoke/summary.json),
[last-run status](evidence/task29-unauthenticated-smoke/last-run.json).

The existing spec verified the health endpoint's success, exact isolated database
name/MySQL version, protected Client fixture database/two-account metadata,
visible initial-page body and no observed JavaScript `pageerror` events within
the smoke's observation window. It does not exercise login, authenticated
navigation, RBAC denial, account changes, ownership workflows or broad rendering
across the portals. No claim of full browser acceptance is made.

Only `NO_COLOR`/`FORCE_COLOR` environment warnings appeared. PowerShell rendered
stderr as NativeCommandError text in the saved log; the actual CLI exit was 0
and the test passed. No assertion failure, retry, code/infrastructure fix or
security relaxation occurred.

## Preconditions and retained baseline

- Existing reviewed container
  `enterflow-browser-recovery-29caa4ce81d64f02` remained running at
  **127.0.0.1:53045**, MySQL **8.4.13**, UUID
  `97bad1ef-e1a9-11f1-aeb9-1a284b41a26f`.
- Ownership/name/image, tmpfs/no persistent mounts, exact loopback port,
  reviewed UUID/certificate fingerprint, CA signature, named certificate identity,
  authorized TLS socket and secure-transport checks passed.
- Required ports 3000/5173 were free before running Playwright. No existing
  service was stopped/reused. Only the configured temporary backend/Vite and
  headless Chromium processes were launched by the existing test runner.
- [Preflight](evidence/task29-unauthenticated-smoke/preflight.json) and
  [postflight](evidence/task29-unauthenticated-smoke/postflight.json) each passed
  the existing read-only verification: exact **28 tables/69 rows**, approved
  UNIQUE, 13 enforced CHECKs, synthetic Argon2id records, DPAPI target metadata,
  exported-password/hash matching and private credential ACLs. Credential
  plaintext/hashes were handled only in memory and never printed.
- Every per-table count matched before/after: **user_sessions stayed 0**;
  **audit_events stayed 1**. No account/application/notification mutation was
  requested. These are count and read-only security checks, not a claim of a
  separately recorded byte-for-byte snapshot of all row contents.
- The browser context was fresh and unauthenticated. Initial `/api/auth/me`
  session restoration has no session cookie and is rejected by authentication
  middleware before session lookup/activity UPDATE. No login was submitted.
- No database/fixture initialization, reset, SQL cleanup, migration, seed,
  history inspection, container lifecycle change or pin change occurred.

## DATABASE CHANGE REPORT

**Only target accessed:**
`127.0.0.1:53045/enterflow_browser_recovery_29caa4ce81d64f02`.
Development `127.0.0.1:3308/enterflow_db` was never contacted. Its eight real
employees, audits and business data were preserved through zero access.

| Stage | Queries / operations | Tables read / affected | Schema changes | Data changes | Migrations created/applied |
| --- | --- | --- | --- | --- | --- |
| Preflight verification | 38 read-only SELECTs through the existing verifier: pinned server identity, information_schema table/engine/collation/index/constraint/CHECK metadata, exact table counts, synthetic hash/password checks | All expected 28 synthetic tables counted; users/client_applications credential fields checked in memory; no table modified | None | None | None / none |
| Existing smoke harness/startup | Exact Docker metadata/public-certificate reads; `SELECT DATABASE(), VERSION(), @@server_uuid`; backend connectivity SELECT; HTTP readiness health polling and spec health request using `SELECT DATABASE(), VERSION()` | Server/database metadata; no business DML | None | None | None / none |
| Smoke browser and credential validation | Fresh unauthenticated initial-page load, no login; existing Client DPAPI metadata read in memory | No business/session writes; cookie-less auth restoration rejected before DB access | None | None | None / none |
| Postflight verification | 38 read-only SELECTs, same scope as preflight | Same 28-table baseline; zero sessions and one synthetic audit row retained | None | None | None / none |

The verifier SELECT count is **76** across preflight/postflight. Harness/startup/
health SELECTs are additional; readiness polling multiplicity was not SQL-traced,
so no fabricated exact whole-run query/connection count is claimed. Query shapes
for the verifiers are recorded in their JSON evidence. No SQL tracing/config
change was enabled. All executed application SQL paths for this scope are reads.

Tables included in the exact before/after count verification:
`roles`, `modules`, `role_modules`, `payment_terms`, `clients`, `users`,
`client_applications`, `filter_types`, `product_specifications`, `order_stages`,
`delivery_methods`, `orders`, `order_items`, `quotation_references`, `quotations`,
`quotation_lines`, `quotation_costing`, `purchase_orders`, `production_stages`,
`replacement_requests`, `job_orders`, `shipments`, `invoices`, `payments`,
`notifications`, `notification_recipients`, `audit_events`, `user_sessions`.

**Tables modified: none. Schema/data writes: zero.** No new records, sessions,
credential exports or application account changes. Existing protected credentials
were read, not replaced. Migration 007 contents and migration history remained
untouched. No cleanup procedure or Docker reset was invoked.

Filesystem effects: Playwright created its normal local results and development
tool caches; evidence was saved under `docs/evidence/task29-unauthenticated-smoke/`.
The original `test-results/.last-run.json` remains preserved. Added this report
and current documentation pointers. No application/harness/spec code changed.
Existing uncommitted/teammate/account-transfer work is preserved. No commit,
push, merge, reset, stash, deployment or software installation occurred.

## Status and next approval boundary

- **Gate D:** COMPLETE, prior approved initialization retained.
- **Gate E unauthenticated smoke:** PASSED, fresh evidence above.
- **Task 29:** PARTIAL; authenticated Client Portal and Admin Portal acceptance
  remains NOT RUN. Prior unit/build/security evidence is historical, not rerun.
- **Task 28:** PARTIAL/BLOCKED under the unchanged Migration 007 hold.
- **Task 32:** PENDING verification; no production readiness clearance.

No environment blocker remains for the next documented Client suite, but its
write scope requires separate explicit approval. The next bounded request can
authorize **only `tests/browser/client-portal.spec.mjs`**, one worker/zero retries/
stop on first failure: two synthetic Client logins, session INSERT/activity/
revocation UPDATEs and Client A's notification-recipient read-state UPDATE.
Cross-client reads/PATCH must be denied, and Demo Mode must remain isolated.
Successful mutations remain retained; no automatic notification reset, retry,
cleanup or fixture recreation is included. Admin acceptance remains a separate
approval. Stop here without starting any authenticated case.
