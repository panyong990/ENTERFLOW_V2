# Phase 1 controlled stabilization regression plan

Execution update: the planned safe P1–P4 groups have now run; [actual results and exact commands](execution-2026-11-18/EXECUTION_REPORT.md). Functional suites/build/scanner passed; dependency audit failed and external script has a formal production-release hold. Original preparation wording below records planning-time status. P5–P7 remain NOT RUN/blocked/deferred. No new metric or live authorization implied.

Date: November 18, 2026. **Plan prepared; major regression execution NOT RUN in this preparation task.** No new reporting metric. User accepts the Operations reliability correction at source/test level only.

## Evidence and selection rules

Run from the existing worktree root. Preserve dirty/untracked files. Use the explicit membership in [test-inventory.json](test-inventory.json): **67 backend/src and 35 src/app files**, statically parsed, not runtime counts. Its 834 test-call sites include generated/parameterized tests and are not expected TAP totals. The next execution must record actual pass/fail/skip/cancel/todo counts and exits; do not assume the historical 844/216 counts. Two Operations tests were added after the full frontend run.

No test runner may discover database directories, migration/checksum/history files, browser suites or CLI targets implicitly. Backend tests must use the fail-closed mock-database import hook. Never start backend/src/server.js, run npm server/dev/browser scripts, invoke Docker, migrations or import execution as a preparation step. No live endpoint health checks: authenticated reads can update sessions, and startup can run database checks. Tests may use injected local HTTP fixtures only, not live application/database services.

Node v26.13.0 / npm 11.20.0 and installed @babel/parser 7.29.14 / @playwright/test 1.56.1 were observed locally. Browser installation/cache availability, database/cloud availability and target configuration were not probed. Esbuild/Vite compilation can require approved local subprocess execution; this does not authorize backend/database startup. Do not install/update dependencies as a test workaround.

## Execution lanes and stop conditions

| Lane | Scope | State now | Gate |
|---|---|---|---|
| P0 | Branch/HEAD/status, 88-file baseline, 65 changed-source syntax parses, 102 test-file parses, duplicate checks, PDF reconciliation, inventory artifact freshness | Completed offline | Source classification is not functional acceptance |
| P1 | Small role/workflow subsets listed below | Planned, NOT RUN here | Investigate failures before broadening; do not weaken assertions/security |
| P2 | All explicit 67 backend / 35 frontend members once | Planned, NOT RUN here | Capture current membership and actual counts, avoid adding focused counts |
| P3 | Scanner 12-test group, synthetic auth/proxy group, inventory preparation group; optional narrowly selected legacy planner cases | Planned, NOT RUN here | No migration discovery or source catalog reconciliation redo |
| P4 | Production build, current production scanner, HTML/external-script review, diff check, final preservation comparison | Build/scan planned; preparation diff/preservation separately verified | Build warning disposition; no unexplained scanner finding; marker scanner is not a secret/HTML audit |
| P5 | Pure browser fixtures or static rendering beyond existing tests | NOT RUN; inventory config first | Must prove no database/recovery hooks, account/session writes or existing-server reuse; obtain separately scoped browser authorization if needed |
| P6 | Real nine-role sessions, persistence, cross-role workflows and MAIN visual acceptance | BLOCKED / NOT RUN | Named environment/operator, operations, approved test identities/data, runtime evidence and rollback/uncertain-write plan; explicit approval |
| P7 | Live GCS, inventory DDL/import/BOM population, deployment | DEFERRED/BLOCKED | Separate approvals; not part of regression preparation/execution |

Stop a lane on accidental unmocked DB dependency, unknown external endpoint, migration/import/Docker action, unexpected file mutation, data leak or wrong target. Retain safe failure evidence, not raw request/exception/SQL output. Investigate defects; never change assertions only to force a pass. Source-only tests requiring an unavailable UI path must not be called successful live workflows.

## Nine-role coverage and acceptance gaps

All paths below are existing files. Shared targets are intentional overlaps; execute once in P2. Frontend rendered fixture suite: `src/app/components/admin/render.test.mjs`; navigation guards: `src/app/role-access.test.mjs`.

| Role | Backend targets | Frontend targets | Required scenarios and gaps |
|---|---|---|---|
| Admin | admin.service.test.js; client-applications.service.test.js; admin.http.integration.test.js; client-applications.http.integration.test.js; client-onboarding.http.integration.test.js | Shared rendered suite; realEmployeeDirectory.test.mjs; realSettings.test.mjs | Registration request retrieval, approve/reject, active linked Client creation, duplicate/race/rollback, employees/roles/deactivation; Owner/Admin distinction. Live approval and every MAIN form/dialog still open. No real employee creation/reset. |
| Owner | owner-employee-directory.service.test.js; owner-employee-directory.routes.test.js; permissions.test.js; production/inventory route tests | Shared rendered suite; realAnalytics.test.mjs; realEmployeeDirectory.test.mjs; realNotifications.test.mjs; realSettings.test.mjs; role-access | Analytics unavailable/export guards, directory and restricted reads, notifications/settings, denial of Sales-only APIs. Source formulas/date boundaries/CSV escaping not accepted report definitions; complete real reporting dataset and visual acceptance absent. |
| Operations | production.http.integration.test.js; inventory.http.integration.test.js; sales.http.integration.test.js; auth-permission.http.integration.test.js | Shared rendered suite with accepted two Operations regressions; realInventoryProduction.test.mjs; realLogisticsWaybillReceipts.test.mjs; role-access | No Sales Demo/financial leakage, role scopes, loading/error/unavailable, bottleneck no-false-empty behavior, intended production/logistics/waybill monitoring. New Operations tests render statically; tab/navigation interaction and authenticated browser coverage remain open. |
| Sales | sales-orders.service.test.js; sales-cancellation.service.test.js; sales-inquiry-rejection.service.test.js; sales-dashboard.service.test.js; sales-clients.service.test.js; sales-order-documents.service.test.js; sales-job-delivery.service.test.js; stock-requests.service.test.js; sales.http.integration.test.js; sales-workspace.http.integration.test.js | salesOrders/salesClients/salesOrderDocuments/salesJobOrders/salesDelivery/stockRequests API tests; components/sales model/draft/readiness/preparation/review tests; realSalesOrders*.test.mjs | Inquiry, stock assessment, draft/save/send/revision/decisions, cancellation/history, PO, invoice, JO eligibility, manual Stock Requests; uncertain writes block blind retries. Decimal/date/lifecycle/concurrency and persisted Client visibility require approved integration/browser evidence. |
| Accounting | document-workflows.service.test.js; sales-order-documents.service.test.js; sales-orders.service.test.js; client-sales-workflow.http.integration.test.js; permissions/middleware tests | realAccounting.test.mjs; Shared rendered suite | Invoice/centralized payment history, downpayment rules, Accounting-only proof verification/rejection reasons, preserved rejection/resubmission, balances/due dates/overdue where implemented, Sales denial. Several Real Mode financial mutations are explicitly unavailable; source tests cannot close functional UI acceptance. No dedicated live Accounting workflow evidence claimed. |
| Production | production-job-orders.service.test.js; production.http.integration.test.js; sales-orders.service.test.js | api/productionJobOrders.test.mjs; realInventoryProduction.test.mjs; Shared rendered suite | Eligible JO visibility, specification labels, missing/invalid IDs, permission denial, pagination, stage/hold/completion behavior where implemented. Current production read tests do not establish production-stage write persistence or cross-role acceptance. |
| Warehouse | inventory.service.test.js; stock-requests.service.test.js; stock-requests.controller.test.js; inventory.http.integration.test.js; stock-requests.routes.test.js | store/inventoryModel.test.mjs; api/stockRequests.test.mjs; realInventoryProduction.test.mjs; preparation tests | Unknown vs verified zero, numeric mapping/decimal limits, BOM absent vs insufficient, unchanged snapshots, Sales request references, exact manual observation and update material set, no automatic stock changes. No physical quantities/import/committed IDs/BOMs fabricated; all live gates pending approval/business data. |
| Logistics | sales-job-delivery.service.test.js; sales.http.integration.test.js; document-workflows.service.test.js | api/salesDelivery.test.mjs; realLogisticsWaybillReceipts.test.mjs; Shared rendered suite | Delivery/waybill/tracking/document ownership and role isolation, status history/verification where implemented. Sales delivery projections and unavailable Logistics UI source checks do not establish a complete authorized Logistics mutation workflow. Camera/scan/browser interactions and persistence open. |
| Client | registration/auth/session/password/client-applications services and related routes; client-inquiry.service.test.js; client-portal.service.test.js; client.http.integration.test.js; client-onboarding.http.integration.test.js; client-sales-workflow.http.integration.test.js; engineer-sketch/document-workflows tests | api/clientPortal.test.mjs; realClientPortal.test.mjs; realCancellationWorkflow.test.mjs; client/inquiryValidation.test.mjs; Shared rendered Login/Demo checks | Validate registration→pending→Admin decision→login; inquiry/ownership, quotation visibility/decisions/revisions, cancellation, PO/proof, tracking/document links, sketch/storage-not-configured. Registration actual 503 remains blocked; do not search/reproduce again. Legacy Demo and authenticated client subdirectory are different coverage targets. |

Backend service names resolve under `backend/src/services`, route names under `backend/src/routes`, permission config under `backend/src/config`, middleware under `backend/src/middleware`; all frontend names resolve under `src/app` as recorded exactly in test-inventory.json. This table identifies scenario targets, not fresh per-case pass claims or assurance every listed scenario already has executable coverage.

## Critical workflow checks across roles

| Workflow | Regression expectations | Evidence limit / next coverage need |
|---|---|---|
| Registration/auth/sessions | Validation, Argon2id, identity lock, begin/commit/rollback/cleanup, pending/rejected login denial, approved link, session expiry/logout/secure cookie/origin/rate limit | Existing isolated coverage; actual 503 category unknown. Do not duplicate investigation or reproduce. |
| Security/ownership | Nine-role allow/deny, employee vs Client, permission denial before service access, Client A/B isolation, same-origin/CSRF, request ID and safe error/logging | Existing unit/HTTP evidence; expand only confirmed missing denial cases after running current suite. No auth bypass or live session writes. |
| Client→Sales inquiry | Required fields/specifications, unknown stock/BOM distinction, ID mapping, request detail/pagination/error distinctions, sketch all-or-nothing/idempotency | Existing service/HTTP/model checks; multipart/cloud/browser/persistent links need scoped evidence. |
| Quotation lifecycle | Save/draft/send, 20%/50% terms, decimal costing, snapshots, latest revision, decisions/reasons, cancelled/archive guards, stale revision/uncertain outcomes | Preserve accepted business rules; mock fixtures cannot validate real SQL/locking/decimal DB behavior or current MAIN rendering. |
| Cancellation | Ownership/eligibility/terms/reason, one pending request, Sales decision/race, archived approved history, unchanged declined order, payment restrictions, audit and fail-closed actions | Existing implementation/tests already reconciled; run regressions without restarting investigation or redesigning policy. Live policy/persistence acceptance remains open. |
| PO→invoice→payments→JO | Latest accepted quote, PO validation/rejection, invoice match, proof history/reason/resubmission, Accounting-only verified downpayment, duplicate JO prevention | UI/source and service tests have different scope. Real Accounting mutation gaps and cross-role writes must remain explicit. |
| Inventory/BOM→Stock Request | Unknown/zero/missing map/BOM distinct, bounded decimals, captured references/snapshots, manual observations/material set/approval, no implicit reserve/deduct | Pure preparation/check allowed; no new schema, import, physical values, numeric-ID publication or BOM population. |
| Production→Logistics→Client | JO retrieval and stages, due/hold where present, waybill, delivery statuses/verification, final balance/history and Client document visibility | Projections/read tests are not the whole transition chain. Define missing HTTP/browser cases only from approved workflow, not invented statuses. |
| Reporting | Four original reporting domains, centralized payment/credit/due/overdue functions, role visibility, unknown/unavailable vs zero, date/null behavior, exports unavailable until real data | Original §§5.2–5.3/7.13/11.4 and reference reconciliation. Detailed matrix formulas remain source observations, not approved KPI definitions. |
| Engineer Sketch/documents | Type/size/signature/ownership, no raw leaks, transaction/storage failure, idempotency/retry cleanup, STORAGE_NOT_CONFIGURED with no Real local fallback | In-memory storage tests only. GCS/IAM/live transfers deferred; do not configure cloud to get tests green. |
| Production assets | All authentic catalog contexts retained; altered/unknown/suspicious identifiers fail, deny markers intact, no Demo addresses | Scanner positives/negatives plus fresh build output; external HTML script review separate, and scanner success is not confidentiality acceptance. |

## Coverage gaps and duplication

- Static audit: 102 files, 834 test call sites, 545 source regex assertions. Test-call/source-assertion counts are not runtime tests or line coverage. No blanket percentage or workflow acceptance is inferred.
- Duplicated titles: `sales cannot verify payments` and `unknown roles are denied`, in permissions.test.js and permission.http.integration.test.js. These are valuable unit/HTTP layers. No identical callback bodies or baseline file bytes found; no tests removed.
- Broad admin/render fixture compiles many surfaces and includes legacy Demo Client Portal. Real Client tests target the authenticated path; keep both. Focused plans intentionally overlap full suites; totals are not additive.
- Missing interaction/persistence: dynamic tabs/buttons/forms, failed-load retry and stale-response races, unknown commit reconciliation, concurrent registration/approval/cancellation/Stock Requests, real SQL constraints/decimal mappings, cross-session Client visibility, full MAIN screenshots and all nine-role final evidence. Some service cases exist; completeness is not established by title inventories.
- Accounting, production and logistics source/unavailable-state tests can pass while mutations are absent. Inventory catalog references are not committed material rows. Owner analytics formulas/exports remain disconnected. Record implementation gaps separately from test defects; do not write tests asserting success against placeholders.
- No coverage instrumentation or live security/penetration evidence was collected. Current source review is not a complete security audit. External capture-script review is a release blocker until dispositioned; no malicious/exfiltration claim is made.

## Known failures, stale evidence and environment dependencies

| Item | Current classification |
|---|---|
| Real registration 503 | Unresolved runtime issue, stage unknown; blocked on unavailable event or separate authorization; not a freshly failing isolated test |
| Earlier 67 scanner findings / three stale cancellation assertions | Resolved in earlier task; retain historical evidence, do not reintroduce or re-investigate absent a new regression |
| Operations newly added failing regression | Reproduced before fix, final 64-test group passed; user accepted source/test correction. Full frontend refresh still pending |
| Scanner current-scan.json bundle filename | Stale saved evidence after accepted Operations rebuild; next fresh scan must reference current files and preserve old record |
| Figma capture script in committed HTML | Potentially unintended production inclusion; outside local JS scanner scope, needs explicit security/production disposition |
| EPERM during local compilation/subprocesses | Known sandbox constraint, not an assertion/business failure; use authorized subprocess execution without changing assertions |
| Browser harnesses/configs | Some start backend/Vite and use recovery/database fixtures. Existing historical approval is not current permission. Do not run Playwright discovery/config imports without first reviewing hooks; even `--list` can evaluate configuration |
| MySQL/TLS fixture/integration/migration suites | NOT RUN; exclude all migration discovery/execution, live integrations and standalone synthetic MySQL-protocol TLS fixture under current restrictions |
| Node/Vite warnings | Existing module.register deprecation and >500kB chunks; not failures; record again if observed |
| Cloud/physical data | GCS intentionally unconfigured; quantities, mappings and BOM data unapproved/unpopulated. Do not invent/install/start services |

## Exact next-run commands — PLANNED, NOT EXECUTED HERE

These select only already audited members from the manifest. First check branch/HEAD/status and confirm manifest paths/hashes remain appropriate; do not silently change the suite membership if others edit the shared worktree.

Focused example, accepted Operations/role regression:

```powershell
node --test --test-isolation=none --test-reporter=tap src/app/components/admin/render.test.mjs src/app/components/realInventoryProduction.test.mjs src/app/role-access.test.mjs
exit $LASTEXITCODE
```

Full safe backend, restoring the synthetic origin afterward:

```powershell
$taskPreviousOrigin = $env:APP_ORIGIN
try {
  $env:APP_ORIGIN = 'http://localhost:5173'
  $taskInventory = Get-Content docs/stabilization/test-inventory.json -Raw | ConvertFrom-Json
  $taskBackendFiles = @($taskInventory.inventory | Where-Object { $_.path.StartsWith('backend/src/') } | ForEach-Object { $_.path })
  if ($taskBackendFiles.Count -ne 67) { throw 'Reviewed backend membership changed.' }
  node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap @taskBackendFiles 2>&1 | Select-String 'not ok|# tests|# pass|# fail|# skipped|# cancelled|# todo|error:'
  $taskTestExit = $LASTEXITCODE
} finally { $env:APP_ORIGIN = $taskPreviousOrigin }
exit $taskTestExit
```

Full safe frontend:

```powershell
$taskInventory = Get-Content docs/stabilization/test-inventory.json -Raw | ConvertFrom-Json
$taskFrontendFiles = @($taskInventory.inventory | Where-Object { $_.path.StartsWith('src/app/') } | ForEach-Object { $_.path })
if ($taskFrontendFiles.Count -ne 35) { throw 'Reviewed frontend membership changed.' }
node --test --test-isolation=none --test-reporter=tap @taskFrontendFiles 2>&1 | Select-String 'not ok|# tests|# pass|# fail|# skipped|# cancelled|# todo|error:'
exit $LASTEXITCODE
```

Run each following command as a separate invocation and record its exit; do not let a later command hide a previous failure:

```powershell
node --test --test-isolation=none --test-reporter=tap scripts/production-asset-scan.test.mjs
node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap config/api-proxy.test.mjs tests/auth-login.integration.test.mjs
node --test --test-isolation=none --test-reporter=tap scripts/prepare-section24-inventory.test.mjs
node scripts/prepare-section24-inventory.mjs --check
npm.cmd run build
npm.cmd run check:production-demo-assets
git diff --check
```

The inventory generator is check-only. No --write regeneration. Optional previously reviewed planner cases require the exact targeted invocation below; exclude completed catalog reconciliation and never expand discovery:

```powershell
node --test --test-isolation=none --test-reporter=tap --test-name-pattern="unknown quantities|reconciliation reuses|prepared executor" database/material-catalog-import.test.mjs
exit $LASTEXITCODE
```

Retain a new dated execution ledger with commands, Node version, membership/source hashes, actual counts/exits, focused-versus-full overlap and safe failures. Keep historical scanner JSON intact; capture current scanner output in a new dated evidence artifact rather than overwriting the old report. Check generated artifact filenames against that new build. Record HTML/external-script disposition separately.

## Live/browser authorization boundary and final acceptance

No executable live workflow command is authorized or supplied for replay. Before any live stage, define target/operator/approved accounts, whether startup or requests write sessions/audit/business data, runtime correlation, retention/redaction, allowed mutations and rollback/uncertain-outcome handling. Verify actual configuration without exposing values. Never inspect protected Migration 007/history as part of these checks.

For each role record MAIN page/form/dialog/table comparison, viewports, loading/empty/unavailable/error, interaction screenshots, denied roles, authenticated source correctness and persistence/cross-role evidence. Connect Client→Sales→Accounting→JO/Production→Warehouse→Logistics→Client only under explicitly approved operations; preserve payment history, decisions, documents and cancellation references. No bypass/manual account creation or invented stock/BOM data.

Exit preparation with the manifest/plan/tracker preserved and exact blockers stated. Exit stabilization only when safe suites/build/scanner/diff and reviewed source changes pass, then perform separately authorized visual/live gates. Phase 1 additionally requires all original applicable requirements, documented limitations/deferrals and explicit final sign-off; no role or phase is accepted by this plan alone.
