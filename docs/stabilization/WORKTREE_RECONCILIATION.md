# Shared-worktree reconciliation — November 18, 2026

Baseline branch: `integration/dev-phase-merge`. HEAD: `1f4493c38c8903d67bd0f7e3f9707d4afa580246`. **88 baseline files: 55 tracked modifications, 33 untracked files**, after expanding untracked directories. No staged changes reported. New stabilization documents are separate additions, not counted in this entry baseline.

[Machine-readable baseline](worktree-baseline.json) contains each file's status, byte length, SHA-256 fingerprint, assigned purpose/group and verification boundary. These hashes concern only the listed worktree files; no migration/checksum/history file was inspected. Source/diff inspection and earlier reports support attribution by feature; no individual developer authorship is inferred from uncommitted files. Final preservation validation compares baseline bytes and permits only the three explicitly listed documentation updates.

## Review findings and dispositions

| ID | Finding | Evidence / disposition |
|---|---|---|
| W1 | Full aggregate evidence predates the two new Operations tests | Existing full-safe report: 844 backend / 216 frontend. Latest focused report: 64 frontend / 13 backend / 12 scanner. Current scope still 67 backend and 35 frontend files; test-file count unchanged. Do not infer a new aggregate count or mark current full suite passed until executed. |
| W2 | Saved scanner artifact is stale relative to current build | current-scan.json records index-CWp-1mBf.js; it is absent from dist/assets. Current dist/index.html loads index-BBz2fyGp.js. Later scanner command passed, but its console result did not replace the old JSON. Preserve old evidence and generate a separately dated scan in the next test run. |
| W3 | External design-capture script requires security/production disposition | index.html:14 and dist/index.html:15 include the Figma html-to-design capture script. git show HEAD:index.html confirms this predates the worktree changes. Marker scanner scans local JS assets and cannot attest to remote script behavior or HTML safety. No network request performed; no claim of malicious behavior. Do not deploy/accept the artifact until reviewed. Do not silently remove shared work in this preparation task. |
| W4 | Reporting matrix had unsupported reference/zero-display conclusions | The PDFs are now actually read; see reporting reference reconciliation. KPICard already masks values. Accepted Operations correction remains preserved; exact KPI formulas are source behavior, not definitions approved by the PDFs. |
| W5 | Layered/overlapping tests can inflate totals | 2 duplicated literal titles, no duplicate callback bodies in 102 scoped files. Existing permission-unit and HTTP tests are separate layers, not removable duplicates. Shared rendered suite and Client/Sales HTTP suites overlap focused role commands; run full membership once and do not sum focused counts. |
| W6 | Some frontend tests assert source structure, not executable workflows | Static inventory counts 545 assert.match/doesNotMatch occurrences across the scoped tests. This is an assertion-type count, not coverage percentage. Owner Analytics, Accounting and Logistics/waybill tests include source assertions/unavailable-state checks. Test names do not establish live backend integration or interaction coverage. |
| W7 | Prepared import and actual execution are intentionally different | Planner supports nullable proposal; existing executor uses verified-only policy. Proposal executionAuthorized=false; quantities/IDs/BOM data are not invented. Do not wire the nullable packet to execution or run any import. |
| W8 | Same-name Client Portal files serve different modes | App.tsx routes Demo to components/ClientPortal and authenticated Clients through RealClientPortal; the latter uses the client subdirectory. Treat these as distinct paths in coverage, not proven accidental duplicate implementations. |
| W9 | Historical status reports can conflict without representing regressions | Old scanner failure, Task 29 COMPLETE/PARTIAL snippets and environment reports are historical scoped evidence. Current tracker and dated execution records determine current status. Earlier browser/database approval/results do not authorize replay here. |
| W10 | Application-sensitive modifications remain source/mock verified only | Admin approval explicitly sets active=TRUE; registration diagnostics, cancellation filters/history/archival guards, manual-stock validation, quotation unknown-outcome handling and catalog mapping all have related tests/reports. Live uniqueness, locking, transaction persistence, policy and browser acceptance remain unverified. No new change is labeled unintended without evidence. |

No identical file contents among baseline files. Syntax parsing passed for all **65 changed JS/MJS/TS/TSX files**, without importing/executing them. All **102 scoped test files** parsed. This is not a full semantic/type/security audit or a test execution result.

## Every baseline path

| File | State | Reconciled group | Purpose |
|---|---|---|---|
| `backend/src/controllers/client-portal.controller.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/controllers/inventory.controller.js` | Modified | Safe diagnostics | Service-stage/controller-safe logging and related tests |
| `backend/src/controllers/registration.controller.js` | Modified | Safe diagnostics | Service-stage/controller-safe logging and related tests |
| `backend/src/controllers/registration.controller.test.js` | Modified | Safe diagnostics | Service-stage/controller-safe logging and related tests |
| `backend/src/controllers/sales-dashboard.controller.js` | Modified | Safe diagnostics | Service-stage/controller-safe logging and related tests |
| `backend/src/controllers/sales-orders.controller.js` | Modified | Safe diagnostics | Service-stage/controller-safe logging and related tests |
| `backend/src/controllers/stock-requests.controller.js` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `backend/src/controllers/stock-requests.controller.test.js` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `backend/src/routes/client.http.integration.test.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/routes/client.routes.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/routes/sales.http.integration.test.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/routes/sales.routes.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/services/client-applications.service.js` | Modified | Onboarding | Explicit approved-user activation or frontend validation/pending feedback |
| `backend/src/services/client-applications.service.test.js` | Modified | Onboarding | Explicit approved-user activation or frontend validation/pending feedback |
| `backend/src/services/client-portal.service.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/services/client-portal.service.test.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/services/inventory.service.test.js` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `backend/src/services/registration.service.js` | Modified | Safe diagnostics | Service-stage/controller-safe logging and related tests |
| `backend/src/services/registration.service.test.js` | Modified | Safe diagnostics | Service-stage/controller-safe logging and related tests |
| `backend/src/services/sales-orders.service.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/services/sales-orders.service.test.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/services/stock-requests.service.js` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `backend/src/services/stock-requests.service.test.js` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `backend/src/validation/sales.validation.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `database/material-catalog-import.mjs` | Modified | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `dist/index.html` | Modified | Generated output | Build-generated hashed entry links; pre-existing external capture script remains |
| `docs/TESTING.md` | Modified | Status/evidence | Tracker, reporting reconciliation or historical task handoff |
| `package-lock.json` | Modified | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `package.json` | Modified | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `scripts/check-production-demo-assets.mjs` | Modified | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `src/app/api/clientPortal.test.mjs` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/api/clientPortal.ts` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/api/salesOrders.js` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/Dashboard.tsx` | Modified | Operations reliability | Real Mode bottleneck unavailable guard; accepted source/test level |
| `src/app/components/FinishedGoodsOrderActivity.tsx` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `src/app/components/Inventory.tsx` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `src/app/components/Login.tsx` | Modified | Onboarding | Explicit approved-user activation or frontend validation/pending feedback |
| `src/app/components/QuotationBuilder.tsx` | Modified | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `src/app/components/RealWarehouseStockRequests.tsx` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `src/app/components/admin/render.test.mjs` | Modified | Shared rendered tests | Existing multi-role/provider/Login checks plus accepted Operations regressions |
| `src/app/components/client/ClientPortal.tsx` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/client/adapters.ts` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/client/data.tsx` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/client/model.ts` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/realCancellationWorkflow.test.mjs` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/realClientPortal.test.mjs` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/realInventoryProduction.test.mjs` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `src/app/components/realSalesOrdersCompletion.test.mjs` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/sales/RealQuotationPreparation.tsx` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/sales/RealSalesStockRequests.tsx` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `src/app/components/sales/SalesPipeline.tsx` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/sales/realQuotationPreparation.test.mjs` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/sales/salesInquiryReview.test.mjs` | Modified | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/useSalesOrders.ts` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `src/app/store/materials.tsx` | Modified | Inventory/Stock Requests | Unknown stock, numeric limits, snapshots/references/manual-confirmation guards |
| `PHASE_1_MASTER_PROGRESS_TRACKER.md` | Untracked | Status/evidence | Tracker, reporting reconciliation or historical task handoff |
| `backend/src/controllers/service-failure-log.js` | Untracked | Safe diagnostics | Service-stage/controller-safe logging and related tests |
| `backend/src/controllers/service-failure-log.test.js` | Untracked | Safe diagnostics | Service-stage/controller-safe logging and related tests |
| `backend/src/routes/client-onboarding.http.integration.test.js` | Untracked | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/routes/client-sales-workflow.http.integration.test.js` | Untracked | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `backend/src/services/sales-cancellation.service.test.js` | Untracked | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `docs/CANCELLATION_PHASE_1_ACCEPTANCE_REPORT_2026-11-18.md` | Untracked | Status/evidence | Tracker, reporting reconciliation or historical task handoff |
| `docs/PHASE_1_RESUMPTION_HANDOFF_2026-11-18.md` | Untracked | Status/evidence | Tracker, reporting reconciliation or historical task handoff |
| `docs/REGISTRATION_503_ROOT_CAUSE_INVESTIGATION_2026-11-18.md` | Untracked | Status/evidence | Tracker, reporting reconciliation or historical task handoff |
| `docs/REPORTING_ANALYTICS_REQUIREMENTS_MATRIX_2026-11-18.md` | Untracked | Status/evidence | Tracker, reporting reconciliation or historical task handoff |
| `docs/asset-scanner/HANDOFF_REPORT.md` | Untracked | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `docs/asset-scanner/README.md` | Untracked | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `docs/asset-scanner/baseline-findings.csv` | Untracked | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `docs/asset-scanner/baseline-findings.json` | Untracked | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `docs/asset-scanner/current-scan.json` | Untracked | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `docs/asset-scanner/regression-results.json` | Untracked | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `docs/inventory-preparation/APPROVAL_PACKET.md` | Untracked | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `docs/inventory-preparation/BOM_REQUIREMENTS.md` | Untracked | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `docs/inventory-preparation/HANDOFF_REPORT.md` | Untracked | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `docs/inventory-preparation/bom-business-data-required.json` | Untracked | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `docs/inventory-preparation/material-import-review.csv` | Untracked | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `docs/inventory-preparation/nullable-import-proposal.json` | Untracked | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `docs/inventory-preparation/reference-and-id-validation.json` | Untracked | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `docs/inventory-preparation/verified-only-current-schema-plan.json` | Untracked | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `scripts/prepare-section24-inventory.mjs` | Untracked | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `scripts/prepare-section24-inventory.test.mjs` | Untracked | Inventory preparation | Offline approval packet/planner, mapping validation and missing BOM plan |
| `scripts/production-asset-policy.mjs` | Untracked | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `scripts/production-asset-scan.mjs` | Untracked | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `scripts/production-asset-scan.test.mjs` | Untracked | Asset scanner | Context-sensitive catalog scanner, pinned parser, tests/evidence; DEV-only address previews |
| `src/app/components/client/inquiryValidation.mjs` | Untracked | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/client/inquiryValidation.test.mjs` | Untracked | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/sales/cancellationModel.mjs` | Untracked | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |
| `src/app/components/sales/cancellationModel.test.mjs` | Untracked | Cancellation/quotation/inquiry | Existing cancellation/history/ownership/uncertain-outcome or inquiry validation work |

## Preservation boundary

Only PHASE_1_MASTER_PROGRESS_TRACKER.md, docs/TESTING.md and docs/REPORTING_ANALYTICS_REQUIREMENTS_MATRIX_2026-11-18.md may change among the baseline paths in this preparation task. All application/test/script/package/generated/inventory-preparation files remain byte-identical to the captured baseline. New preparation artifacts live under docs/stabilization. No runtime code, tests, dependencies or generated build outputs are changed by this task.

Protected Migration 007 and its checksum/history remain uninspected and untouched. No Git reset/restore/clean/stash/revert/commit/push/branch switching. No database connections/SQL/Docker/live workflow.

