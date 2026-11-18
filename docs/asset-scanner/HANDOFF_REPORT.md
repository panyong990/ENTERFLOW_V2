# Production asset scanner remediation and major Phase 1 safe regressions

November 18, 2026 (Asia/Manila). Node v26.13.0; npm 11.20.0. Branch integration/dev-phase-merge.

## 1. Task Overview

Implemented the scanner correction, preserved authentic business catalog data, strengthened negative coverage and refreshed full scoped backend/frontend safe suites. Primary reference: comprehensive handoff §§21,25–26; original 28-page Phase 1 completion/security gates remain intact. All Section 24 artifacts were preserved; deterministic --check passed without regeneration. [Master tracker](../../PHASE_1_MASTER_PROGRESS_TRACKER.md).

## 2. Implementation Summary

Every original finding is documented in [67-row CSV](baseline-findings.csv) and [JSON evidence](baseline-findings.json). Each includes identifier, source line, reference manifest/commit, baseline generated bundle/hash, emitted AST offset and original rule/classification. All 67 are authentic catalog records; the old rule conflated business IDs with Demo data. The remaining four catalog codes had been globally exempted compatibility literals. All 71 now require full verified catalog structure, while four extra legacy-map occurrences require their exact mapping context.

All **132 original prohibited markers are retained**. No 67-code blanket allowlist, scanner disable, catalog deletion or credential/RBAC change. The scanner verifies source metadata against the retained reconciled catalog, parses production JavaScript, and classifies only exact record occurrences. Reusing a legitimate ID elsewhere still fails. [Policy and evidence details](README.md).

Three additional hard-coded customer-address defaults previously labelled out of scope originated in QuotationBuilder.clientAddress. A development-only guard excludes that best-effort preview map from production; Real serverPreparation already uses explicit delivery details, so its workflow is unchanged. Those markers now fail if they reappear.

The already-installed/locked @babel/parser 7.29.14 is directly declared as a dev dependency for safe syntax parsing; no dependency installation, download, version upgrade or execution of scanned code occurred.

## 3. Functional Changes

Scanner classification is occurrence-specific: complete matching record array/constructor plus canonical name/category/unit/price/threshold/supplier; all emitted arguments must match current source. Standalone/altered/duplicate/partial catalog occurrences, unrecognized material-shaped IDs, suspicious old markers, Unicode escapes, comments, malformed assets and missing JS assets remain failures. Legacy IDs are no longer globally exempt.

Production preview address leakage is removed, while development preview behavior and Real quotation inputs remain. Source catalog and stock defaults were not modified, imported or certified as physical counts. Broader role-based pricing visibility/authenticated catalog delivery remains a business/security review item; marker-scanner success is not that approval or a general secret-scanning guarantee.

Three failed frontend assertions still demanded the old cancellation-unavailable behavior and absence of history pagination, contrary to the already implemented current workflow. Tests now verify authenticated cancellation routing, terms/eligibility guards, failure feedback, synchronous decision locking, explicit uncertain-outcome checks and server-filtered history pagination. Added an executable adapter regression proving method/path/payload/encoded IDs. Existing backend ownership, origin, payment, transaction and audit tests also pass. No assertion was removed to bypass a real defect, and no production cancellation behavior was changed to satisfy a test.

## 4. Verification and Testing

### Exact commands

Backend suite (all 67 *.test.js files under backend/src; database singleton blocked):

```powershell
$taskPreviousOrigin = $env:APP_ORIGIN
try {
  $env:APP_ORIGIN = 'http://localhost:5173'
  $backendFiles = @(rg --files backend/src -g '*.test.js' | Sort-Object)
  node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap @backendFiles
  $taskTestExit = $LASTEXITCODE
} finally { $env:APP_ORIGIN = $taskPreviousOrigin }
exit $taskTestExit
```

Frontend suite (all 35 *.test.mjs files under src/app):

```powershell
$frontendFiles = @(rg --files src/app -g '*.test.mjs' | Sort-Object)
node --test --test-isolation=none --test-reporter=tap @frontendFiles
exit $LASTEXITCODE
```

Other exact commands:

```powershell
node --test --test-isolation=none scripts/production-asset-scan.test.mjs
node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap config/api-proxy.test.mjs tests/auth-login.integration.test.mjs
node --test --test-isolation=none scripts/prepare-section24-inventory.test.mjs
node --test --test-isolation=none --test-name-pattern="unknown quantities|reconciliation reuses|prepared executor" database/material-catalog-import.test.mjs
node scripts/prepare-section24-inventory.mjs --check
npm.cmd run build
npm.cmd run check:production-demo-assets -- --write-report
npm.cmd run check:production-demo-assets
git diff --check
npm.cmd ls @babel/parser --depth=0
```

Tool execution filtered TAP output to failure/summary lines to avoid unnecessary fixture output; this did not change test selection or exit codes. Frontend/esbuild build and synthetic Vite proxy tests used approved execution outside the sandbox for local compilation subprocesses. No application database or protected Docker environment was started.

| Final group | Passed | Failed | Skipped | Exit |
|---|---:|---:|---:|---:|
| Full scoped backend suite | 844 | 0 | 0 | 0 |
| Full scoped frontend suite | 216 | 0 | 0 | 0 |
| Scanner positive/negative regressions | 12 | 0 | 0 | 0 |
| Synthetic auth/proxy/config | 2 | 0 | 0 | 0 |
| Inventory preparation artifacts | 13 | 0 | 0 | 0 |
| Selected legacy planner cases | 3 | 0 | 0 | 0 |
| Inventory artifact freshness | n/a | n/a | n/a | 0 |
| Production build (2714 modules) | n/a | n/a | n/a | 0 |
| Production scanner | n/a | 0 unexplained | n/a | 0 |
| git diff --check | n/a | n/a | n/a | 0 |

Initial full frontend run: **212 passed, 3 failed, 0 skipped, exit 1** (215 tests). Investigated the three obsolete cancellation/pagination assertions described above, retained security invariants and added the executable adapter case; final **216/216**. A focused 13-test cancellation/UI-model rerun also passed but overlaps the frontend suite and is not an extra total. Backend passed on its first full run. Scanner baseline reclassification initially found three formerly informational address-default leaks; after the DEV guard and rebuild, zero remain. Current scanner: three assets, 71 verified catalog occurrences, four verified compatibility occurrences, zero unexplained findings. [Current scan](current-scan.json).

Existing large-chunk and Node module.register deprecation warnings remain. git diff --check may print the repository's LF→CRLF normalization notice for the scanner wrapper; exit remains 0, with no whitespace error. npm ls confirms the pinned parser is already installed.

### Domain coverage and limits

| Requested area | Actual test evidence | Limits |
|---|---|---|
| Registration/auth/sessions/Admin approval | registration/auth/session/client-applications services, controllers and HTTP tests; client-onboarding HTTP fixture | Doubles/synthetic sessions; no actual Client or live approval |
| RBAC/authorization/ownership | auth/role/permission/origin middleware, admin/owner/Client/Sales/production/stock/document HTTP regressions | No live account/privilege acceptance |
| Client inquiry/cancellation | client-inquiry/client-portal/sales-cancellation services and Client/Sales HTTP; cancellation models and adapter | No actual MySQL concurrency/persistence or browser clicks |
| Quotation lifecycle | sales-orders/client-portal services, quotation documents/draft/readiness helpers, Real preparation source and adapters | No real save/send/revision/Client visibility |
| Warehouse/unknown stock | inventory service/HTTP, inventoryModel and Warehouse source guards | No physical count/import or real Warehouse write |
| Material mapping/BOM | preparation/legacy planner doubles, inventoryModel, Sales missing/valid BOM cases | No actual numeric mappings or manufacturing-data approval |
| Stock Requests/manual confirmation | stock-request service/routes/controllers and API/UI tests | No live manual stock updates |
| Accounting/invoices/payments/PO | document-workflows, sales-order document/JO eligibility, Client/Sales HTTP and Accounting source checks | No real GCS/payment proof/Accounting decision; not complete accounting acceptance |
| Production/JO | production-job-orders services/routes/adapters; Sales JO eligibility | No real eligible JO or production-stage persistence |
| Logistics/delivery | sales-job-delivery service, delivery adapters and realLogisticsWaybillReceipts/Client source assertions | Existing read/projection scopes only; full Logistics operational writes/acceptance not claimed |
| Engineer Sketch/documents | engineer-sketch service/HTTP, document-workflows and storage tests | In-memory storage; no bucket/IAM/cloud upload |
| Security/audit/logging | auth/permission/origin/rate-limit/validation/audit-request-ID, server and service-failure redaction tests | Not penetration testing or live security sign-off |

Full file membership and results: [regression-results.json](regression-results.json). This is the complete **scoped safe backend/frontend suite**, not every repository integration/migration/browser test. *.mysql.integration.js, migration/core/baseline/seed execution suites, Docker/browser DB harnesses and standalone backend/test/database-tls.fixture.test.js (synthetic MySQL-protocol handshake) were **NOT RUN** under the database restrictions. Existing public CA path unit tests are included; they only read trust material and do not connect. Browser/actual database acceptance remains **NOT RUN**, requiring a separately approved environment/target/operations; availability was not rechecked. No migration discovery or protected-file access.

## 5. Git Change Summary

Pre-existing tracked/untracked work preserved, including the Section 24 packet/JSON/CSV/reference/BOM artifacts. Tracker updated in place; inventory generator was only checked, not run with --write. No commit/push/merge/rebase/reset/restore/clean/stash/branch switch.

Exact files written by this task:

- scripts/check-production-demo-assets.mjs
- scripts/production-asset-policy.mjs
- scripts/production-asset-scan.mjs
- scripts/production-asset-scan.test.mjs
- package.json
- package-lock.json
- src/app/components/QuotationBuilder.tsx
- src/app/components/realCancellationWorkflow.test.mjs
- src/app/components/realSalesOrdersCompletion.test.mjs
- src/app/api/clientPortal.test.mjs
- docs/asset-scanner/baseline-findings.json
- docs/asset-scanner/baseline-findings.csv
- docs/asset-scanner/current-scan.json
- docs/asset-scanner/regression-results.json
- docs/asset-scanner/README.md
- docs/asset-scanner/HANDOFF_REPORT.md
- docs/TESTING.md
- PHASE_1_MASTER_PROGRESS_TRACKER.md
- dist/index.html (generated by requested build; ignored dist/assets outputs also regenerated)

The complete working-tree diff contains earlier tasks too; do not attribute those changes to this task.

## 6. Database Change Report

Connections: none. SQL executed against databases: none. Records inspected: none. Schema/data/RBAC/credential changes: none. Migrations created/executed: none. Seeds/baselines/material imports/fabricated stock/BOMs: none. Docker operations: none. Protected Migration 007 and its checksum/history: uninspected and untouched. Database-shaped test operations used injected doubles only; no actual accounts, sessions or audit records were created.

## 7. Remaining Issues and Blockers

- Phase 1 is not fully accepted. Scanner marker gate is resolved, not all pricing visibility/business authorization, browser, live database or cross-role gates.
- Registration, Sales Dashboard/Orders and Inventory 503 root causes still require authorized reproduction with safe diagnostics; no fix or actual account claimed.
- Section 24 nullable schema/import/actual mapping publication and BOM population remain approval/data gated. Existing unknown quantities and numeric IDs were not fabricated.
- Real quotation persistence/visibility, manual Warehouse updates, complete nine-role MAIN comparison and full payment/production/logistics acceptance remain pending.
- Cloud/GCS activation and deployment remain deferred. No cloud resources touched.
- Scanner is a static marker/integrity guard, not comprehensive secret/data-flow or role-based confidentiality certification. Parser/bundler representation drift intentionally fails closed and requires review.
- Node v26.13.0 results do not certify the separately pinned container Node runtime.

## 8. Exact Next Steps

Review the 67 classifications, strengthened scanner and dated tracker. Next recommended Phase 1 task: separately approve one controlled registration reproduction, identify its safe failure stage/category, review a targeted fix, and register/approve a test Client through existing portals. Then authorize quotation visibility and Client→Sales→Client cancellation persistence checks. Do not assume mock approval proves a real account exists. Separately decide pricing visibility/authenticated catalog loading and the Section 24 schema/import/BOM execution plan. Complete remaining nine-role/cross-role sign-off gates before Phase 2.

## 9. Handoff Status

Scanner remediation and major scoped safe regressions: **Automated tests verified**. Zero unexplained production marker findings; authentic catalog retained; all original deny markers remain covered. Browser/live database/business acceptance: **verification pending/blocked by separate authorization**. Phase 1 remains incomplete.

