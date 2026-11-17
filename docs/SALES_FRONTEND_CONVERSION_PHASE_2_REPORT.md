# Phase 2 Sales frontend conversion

Completed on 2026-11-17 on `integration/dev-phase-merge`, HEAD `b4266df0eec4e60cc98654ccbed9abc3b9b95eaa`.

Authenticated Sales now opens the original Sales dashboard presentation and three-column inquiry workflow. Original quotation, costing/BOM, PO viewer, JO configuration, invoice preview, stock request and notification interfaces are isolated under `src/app/components/sales/`. Supported reads use the existing authenticated API. Unsupported transactions remain usable as unsaved preparations and show pending-integration feedback.

## 1. Exact source, test and report files

Modified by this task:

- `src/app/components/RealEmployeeShell.tsx` — select the responsive Sales sidebar only for Sales.
- `src/app/components/RealRoleWorkspace.tsx` — select the isolated Sales workspace only for Sales.
- `src/app/components/RealSalesOrders.tsx` — retain the existing export as a Sales pipeline entry point; the previous live-record reader is retained in `sales/SalesRecordBrowser.tsx`.
- `src/app/components/realSalesOrders.test.mjs` — point the retained reader checks at its new location and recognize the now-supported raw invoice/PO collections.

Added:

- `playwright.sales-conversion.config.mjs`
- `src/app/components/sales/CostEstimationPanel.tsx`
- `src/app/components/sales/drafts.ts`
- `src/app/components/sales/FinishedGoodsOrderActivity.tsx`
- `src/app/components/sales/InvoicePreviewModal.tsx`
- `src/app/components/sales/KPICard.tsx`
- `src/app/components/sales/OriginalSalesForms.tsx`
- `src/app/components/sales/pipelineModel.mjs`
- `src/app/components/sales/pipelineModel.test.mjs`
- `src/app/components/sales/QuotationBuilder.tsx`
- `src/app/components/sales/QuotationPreviewModal.tsx`
- `src/app/components/sales/RealSalesWorkspace.tsx`
- `src/app/components/sales/SalesDashboard.tsx`
- `src/app/components/sales/SalesInvoicePreparation.tsx`
- `src/app/components/sales/SalesNotifications.tsx`
- `src/app/components/sales/SalesNotificationsCenter.tsx`
- `src/app/components/sales/SalesPipeline.tsx`
- `src/app/components/sales/SalesRecordBrowser.tsx`
- `src/app/components/sales/SalesSidebar.tsx`
- `src/app/components/sales/SalesStockRequests.tsx`
- `src/app/components/sales/StockRequestsModal.tsx`
- `src/app/components/sales/usePipelineDetails.ts`
- `src/app/components/sales/useSalesNotificationStore.ts`
- `src/app/components/sales/useSalesWorkspaceData.ts`
- `tests/sales-conversion/sales.spec.mjs`
- `docs/SALES_FRONTEND_CONVERSION_PHASE_2_REPORT.md`

Ignored local evidence and build outputs are under `.vite/`: `sales-conversion-baseline.json`, `sales-protection-verification.json`, `sales-pipeline-desktop.png`, `sales-pipeline-mobile.png`, `sales-conversion-build/`, and Playwright result directories. Three temporary preparation scripts also remain there: `prepare-sales.py`, `integrate-sales.py`, and `refine-sales.py`. These scripts are implementation artifacts, not application commands to rerun. The existing `dist/index.html` change was preserved; builds deliberately used a different output directory.

## 2. Components reused from main

Read-only source reference: `main` at `e59364c1c9bd0257c82319df29e84081740ff694`.

- `SalesOrders.tsx`: three-column presentation, quotation review tabs, inquiry specification table, PO viewer, JO configuration, checklist, sketch/reference selection and modal helpers.
- `QuotationBuilder.tsx`: line editing, frontend estimates, discounts, VAT presentation, packaging, shipping, delivery terms, downpayment configuration and quotation preview interaction.
- `CostEstimationPanel.tsx`: BOM categories and chips, material rows, per-product costing, labor, markup, discounts and VAT calculations.
- `QuotationPreviewModal.tsx` and `InvoicePreviewModal.tsx`: original document layouts, print/download controls and preview interactions.
- `StockRequestsModal.tsx`: request preparation, status tabs, original request/detail layouts and navigation.
- `NotificationsCenter.tsx`: original statistics, department/read filters, action controls, notification rows and urgent-request reply form.
- `KPICard.tsx`: original visual presentation, isolated so authenticated Sales can display supported server metrics without changing shared-role behavior.

The existing integration versions of `Dashboard.tsx` and `FinishedGoodsOrderActivity.tsx`, which retain the main layouts with real-mode safeguards, were forked into Sales-only copies. The existing Sidebar, Clients directory, real-mode providers and API hooks were reused. Original shared business UI components were not overwritten.

## 3. Existing Sales APIs integrated

All requests use the existing same-origin authenticated request client. No endpoints or backend files were added or changed.

| Existing GET endpoint | Use |
| --- | --- |
| `/api/sales/dashboard` | Pending inquiries, quotations, POs, exact all-time verified revenue and monthly verified revenue records |
| `/api/sales/orders` | Search, sort, record-state filters, stage filters and server pagination |
| `/api/sales/orders/:id` | Complete specifications, raw invoice/PO/request collections and verified payment records |
| `/api/sales/orders/:id/quotations` | Every returned quotation revision, lines, costing, add-ons and file metadata |
| `/api/sales/orders/:id/purchase-order` | PO reference, receipt/clearance state and all returned file metadata |
| `/api/sales/orders/:id/job-orders` | Multiple JOs and their production events |
| `/api/sales/orders/:id/delivery` | Multiple shipments, waybills, delivery receipts and signed-receipt metadata |
| `/api/sales/clients` and `/api/sales/clients/:id` | Existing client directory and detail integration |
| `/api/sales/notifications` | Authenticated recipient records and server read state |

Existing `useSalesOrders`, `useSalesOrderDetail`, `useSalesOrderDocuments`, `useSalesJobOrders`, `useSalesDelivery`, client hooks and API adapters remain in use. New Sales-only hooks add bounded, cancellable detail loading and dashboard/notification reads.

## 4. Frontend features retained without transaction APIs

| Interface | Available preparation | Unsupported action behavior |
| --- | --- | --- |
| Quotation review and builder | Product details, multi-product BOM/cost estimates, pricing, packaging, shipping, terms, preview | Send reports integration pending; no quotation, stage change or notification |
| Cost/BOM | Editable unsaved material costs, consumption, per-product configurations and calculations | No catalog/template persistence, stock verification or inventory mutation |
| PO review | Original metadata viewer, approval dialog, rejection-reason entry | Confirmation reports pending; no approval/rejection/resubmission state is fabricated |
| JO configuration | Product tabs, technical fields, draft references, drawing selections, optional documents and checklist | Confirm reports pending; no JO, stock deduction or production/client notification |
| Invoice preparation | Editable draft prices, original preview and print controls | Send reports pending; no invoice issuance, due date, payment request or notification |
| Stock requests | Original modal, request preparation, inquiry selection and status tabs | Submission reports pending; no request or warehouse response |
| Notifications | Original stats/filters, related-order navigation and urgent reply entry | Mark-read, dismissal and replies report pending; server state and draft reply stay unchanged |

Business drafts use component memory. No browser storage substitutes for transaction persistence. Draft document identifiers and previews clearly identify unsaved work. Returned document amounts and IDs retain their original precision; server quotation line multiplication and readiness comparisons use decimal-string/BigInt arithmetic.

## 5. Tests and actual results

Final verification:

- **15/15 Sales Playwright tests passed** using `playwright.sales-conversion.config.mjs`. Every API request is intercepted; unexpected endpoints and mutations are rejected. The suite starts a frontend only.
- **12/12 existing Client Portal Playwright tests passed** using the preserved `playwright.client-conversion.config.mjs` and existing synthetic fixtures.
- **31/31 focused Node tests passed** across Sales API adapters, retained live-record presentation checks, exact decimal/readiness cases and existing Client routing/isolation checks.
- **Production build passed** with `npx vite build --outDir .vite/sales-conversion-build`. Vite reported its large-chunk advisory; no compilation errors remain.
- Production asset scan against that alternate build passed with **zero prohibited literals**. Existing documented compatibility/out-of-scope allowlist entries remain in shared application assets.
- TS/TSX syntax parsing and `git diff --check` passed.
- Desktop/mobile synthetic screenshots were inspected. The mobile Sales navigation now collapses into a drawer while retaining the original desktop sidebar.
- A 373-file baseline comparison found only the four intended modifications listed above. No protected/pre-existing file changed unexpectedly.

Browser coverage includes authenticated Sales landing, all navigation destinations, the three columns, search/status controls, full-record navigation, quotation/BOM/packaging input, preview, rejection validation, approval feedback, JO configuration and blocked generation, invoice preparation, stock requests, notification read-state preservation, unsaved replies, empty/error/detail-failure states, session expiry, mobile layout and all seven other employee role landings.

The tests exercised large string identifiers, high-precision dimensions and money, multiple quotation revisions, multiple invoices, multiple JOs/shipments and invoice-assigned verified payments. Sales interaction cases observed no transaction-storage access and no API mutations.

The focused Node command was:

```text
node --test src/app/api/salesOrders.test.mjs src/app/api/salesOrderDocuments.test.mjs src/app/api/salesJobOrders.test.mjs src/app/api/salesDelivery.test.mjs src/app/api/salesClients.test.mjs src/app/components/realSalesOrders.test.mjs src/app/components/sales/pipelineModel.test.mjs src/app/components/realClientPortal.test.mjs
```

No real-account login or live-database acceptance test was performed.

## 6. Remaining functional limitations

- Quotations, PO reviews, JOs, invoices, stock requests, cancellation decisions, notification replies and notification read/dismissal updates lack connected transaction endpoints. Pending messages are deliberate.
- Material catalogs, inventory quantities and saved BOM templates are unavailable to Sales. Manually entered draft costs are estimates, and stock is explicitly unverified.
- The PO API exposes received/cleared states, not a full Sales approval/rejection/resubmission history. Those original filter choices remain available with an explicit unavailable-state explanation.
- Original uploaded quotation/PO/invoice/sketch file content is not exposed by the current Sales APIs. Metadata is retained; reconstructed quotation previews are labeled as record previews. Historical invoice line allocation is unavailable and is not invented.
- Weekly order aggregates, production chart aggregates, top-client rankings and recurring-finished-goods activity remain visibly unavailable. Exact supported monthly verified-revenue records are shown separately.
- Readiness is a conservative presentation check over returned PO, accepted quotation, sent invoice and invoice-assigned verified-payment records. It does not authorize or create a JO; future generation requires server validation.
- Pipeline columns and local detailed-status filtering apply to the current server result page. All stages/archived/downstream records remain reachable through the full-record view. Detail reads use at most four concurrent requests.
- Notification center search, department/read filters and statistics apply to the displayed result page; pagination exposes additional server records. No realtime subscription is claimed.
- Closing a form, leaving its screen or reloading discards unsaved preparations. Selected JO drawings/reference documents are draft selections, not completed uploads.

## 7. Differences from Demo Sales

The original navy/red presentation, three columns, forms, modal/document layouts, calculations and navigation remain the reference. Real records replace sample records. Additional explicit loading, error, unavailable, paging and record-history controls make API limitations visible.

Official document-number generation and simulated successes are replaced with unsaved draft references and pending messages. No new-client badge or PO review state is guessed from incomplete data. Existing server documents display exact returned values rather than Demo recalculations.

The dashboard revenue card is labeled **Verified Revenue**, with its all-time scope stated, because that is what the existing endpoint returns. Unsupported chart/ranking datasets are not fabricated. Original notification statistics/reply controls are retained, with their current-page scope and pending writes stated. Sales gets a narrow-screen navigation drawer; other employee sidebars retain their prior behavior.

Sales users still do not receive management-only New Inquiry controls.

## 8. Protected work and other roles

The existing `RealClientPortal.tsx`, `src/app/components/client/`, Client tests/configuration and pre-existing `dist/index.html` edits are byte-for-byte unchanged from the initial snapshot. All pre-existing untracked Client files remain present.

Admin, Owner/CEO, Operations, Accounting, Production, Warehouse, Logistics, Employee Management, password-reset, login/session, RBAC and backend authorization implementations were not edited. Shared shell/workspace edits are conditional Sales selections; other role branches retain their existing components and routes. Their mocked landing tests passed. Client regressions passed independently.

Tasks 28 and 32 remain on hold. No work proceeded to another module.

## 9. Git branch and working tree

Branch remains `integration/dev-phase-merge`; HEAD remains `b4266df0eec4e60cc98654ccbed9abc3b9b95eaa`. The work is uncommitted and unstaged. No commit, push, merge, branch switch, reset, restore, stash, rebase, cherry-pick or deployment was performed.

The pre-existing tracked changes remain `dist/index.html`, `src/app/components/RealClientPortal.tsx` and `src/app/components/realClientPortal.test.mjs`, with pre-existing untracked Client components/config/tests. This task adds the Sales files/report and modifies only the four files listed in section 1.

`main` and `dev-phase` were inspected read-only. The latter resolves to `19d1dc760220cf48398d2e9f86f6e24cd9bbbabb`; neither branch was switched to or modified.

## 10. DATABASE CHANGE REPORT

| Category | Result |
| --- | --- |
| Database connections or live SQL commands made by this task | None |
| Tables accessed or changed by task execution | None; browser API traffic was mocked |
| Schema changes | None |
| Data changes | None |
| Employee accounts/credentials | Not queried or changed; the eight real accounts were outside test scope |
| Backend APIs, authorization or permissions | No changes |
| Migrations | None created, edited or executed |
| Migration 007 and protected history | Unmodified; baseline content comparison passed |
| Seeds, baselines, provisioning, database-status commands | None run |
| Database-connected tests | None run |
| Pending approval requirements | No database change is proposed or awaiting approval for this completed frontend task. Future backend/database work requires a separate authorized scope; Tasks 28/32 remain held. |

Stopped after the Sales frontend conversion and verification. Nothing was committed, pushed or deployed.
