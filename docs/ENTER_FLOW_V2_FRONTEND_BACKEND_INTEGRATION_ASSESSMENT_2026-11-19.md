# ENTER-FLOW V2 — Frontend–Backend Integration Assessment

Date: 2026-11-19

## 1. Executive Summary

This assessment reviews whether existing UI interactions in `src/app` reach persisted backend operations in `backend/src`, and whether returned records can refresh and synchronize the UI.

The repository contains substantial implemented API coverage for client, sales, accounting, production, inventory, stock-request, warehouse, logistics, and role-directory workflows. It also contains several important disconnected surfaces:

1. No module is assessed as **Connected and Verified** because no live authenticated browser workflow or live MySQL persistence check was performed.
2. The strongest source and test-supported integrations are client order/quotation/PO/payment reads and actions, sales order/quotation/PO/invoice/JO actions, inventory reads and maintenance, stock requests, Production Job Order reads, warehouse/logistics shipment reads, and payment-proof verification.
3. Production stage mutations, warehouse receiving, Logistics dispatch/POD/QR/tracking completion, accounting balance/clearing/reminders/receipt issuance, reporting, and several cross-role mutations have no complete frontend-to-database workflow.
4. Demo/local-state providers remain present. In Real Mode, supported providers call APIs or use explicitly unavailable/read-only behavior; unsupported demo-only mutations must not be treated as persisted functionality.
5. `App.tsx` is authenticated Real Mode by default: `/api/auth/me` restores the session, `enableRealRequests(true)` is enabled, and `api()` requires same-origin `/api/*` requests with cookies. Demo Preview is confined to development login and is not evidence of backend integration.

Scope boundaries: this document does not modify code, database state, migrations, or credentials. Migration 007 was not inspected or executed.

## 2. Overall Integration Findings

### Integration architecture

- The frontend shared transport is `src/app/api/client.ts:1` (`ApiError`, `api()`, `enableRealRequests()`). It rejects non-`/api/*` URLs, uses `fetch(..., credentials: "same-origin", cache: "no-store")`, and requires an envelope with `success: true`.
- 401 and 403 dispatch session-expiration/recheck events. Network, invalid-response, 409/429/503, and uncertain mutation outcomes are not silently converted into success.
- BIGINT-sensitive identifiers are preserved as strings in the client adapters and encoded in URLs.
- Backend routes are mounted in `backend/src/app.js:1`: `/api/client`, `/api/sales`, `/api/production`, `/api/stock-requests`, `/api/inventory`, `/api/documents`, `/api/accounting`, `/api/warehouse`, `/api/logistics`, `/api/owner`, and `/api/admin`.
- Authentication and permission middleware are applied before controllers. Services receive the pooled MySQL database, as shown by route factories in `backend/src/routes/*.routes.js`.

### Verification boundary

The following are evidence of contracts and service behavior, not live workflow verification:

- Backend HTTP/service integration tests.
- Frontend adapter tests.
- Source-level routing/component tests.
- `vite build`.

The following remain absent:

- Saved authenticated browser identities.
- Authenticated browser interaction against a running environment.
- Live MySQL insert/update/refresh evidence.
- Cross-role browser confirmation of visibility and synchronization.
- Deployment/environment persistence evidence.

Consequently, statuses describe **implemented source paths** plus **verification limits**. Any live persisted flow is conservatively marked partial or blocked rather than **Connected and Verified**.

## 3. Module-by-Module Integration Matrix

### P1 — Client Inquiry to Confirmed Order

| Module | Status | Existing frontend and interaction | API / HTTP | Backend controller–service–database | Gap / persistence evidence |
|---|---|---|---|---|---|
| 1. Client Inquiry Submission | **Connected but Partially Functional** | `src/app/components/ClientPortal.tsx`; `src/app/components/client/data.tsx:66` (`addInquiry`, `addInquiryWithProductSketches`) | `clientPortalApi.createInquiry()` / `createInquiryWithSketches()` → `POST /api/client/orders` or `POST /api/documents/client/inquiries`; idempotency-key header for JSON submission | `backend/src/routes/client.routes.js:31`; `backend/src/routes/document.routes.js:48`; `client-portal.controller.js`; `client-portal.service.js` / `engineer-sketch.service.js` / document workflow service; pool-backed inserts for order/inquiry, items, and sketches | Submission and refresh are wired. Live persistence, retry/browser behavior, and sketch/object-storage completion are blocked. |
| 2. Sales Inquiry Management | **Connected but Partially Functional** | `src/app/components/SalesOrders.tsx`; `src/app/components/useSalesOrders.ts:100` (`useSalesOrders`, `useSalesOrderDetail`); `sales/InquiryRejectionArchive.tsx` | `GET /api/sales/orders`, `GET /api/sales/orders/:id`, `POST /api/sales/orders/:id/rejection`, cancellation accept/decline routes | `backend/src/routes/sales.routes.js:49-79`; `sales-orders.controller.js`; `sales-orders.service.js`; MySQL order/inquiry/cancellation queries | Existing inquiries are read and rejection/cancellation decisions are persisted through backend contracts. Sales inquiry creation/edit operations remain absent or Demo-only. |
| 3. Stock Availability | **Connected but Partially Functional** | Sales order detail in `src/app/components/SalesOrders.tsx`; `src/app/components/useSalesOrders.ts:200` (`useSalesStockAvailability`) | `getSalesStockAvailability()` → `GET /api/sales/orders/:id/stock-availability` | `backend/src/routes/sales.routes.js:79`; `sales-orders.controller.js`; `sales-orders.service.js`; inventory/BOM joins in the service | Inventory classifications and shortages are API-mapped. Live stock/BOM completeness and refresh after each inventory mutation are not browser-verified. |
| 4. Quotation Management | **Connected but Partially Functional** | `src/app/components/sales/RealQuotationPreparation.tsx`; `src/app/components/sales/LiveSalesActions.tsx`; `src/app/components/SalesOrders.tsx` | `POST /api/sales/orders/:id/quotations`; read endpoints `/api/sales/orders/:id/quotations`; `salesOrderDocuments.js` | `backend/src/routes/sales.routes.js:61-73`; `sales-orders.controller.js`; `sales-orders.service.js`; quotation/line/persisted-document tables | Create/refresh/list contracts exist. Quotation send/client notification behavior may be backend-verified in service tests but live cross-role visibility is absent. |
| 5. Client Quotation Review | **Connected but Partially Functional** | `ClientPortal.tsx` quotation UI; `client/data.tsx:86` (`decideQuotation`, `requestQuotationRevision`) | `POST /api/client/orders/:id/quotations/:quotationId/decision`; `POST /.../quotation-revision`; reads `GET /api/client/orders/:id/quotations` | `backend/src/routes/client.routes.js:38-42`; `client-portal.controller.js`; `client-portal.service.js`; quotation and revision repositories | Accept/reject/revision and refresh are implemented. Live Sales visibility after the decision is not browser-verified. |
| 6. Purchase Order Submission | **Connected but Partially Functional** | `ClientPortal.tsx`; `client/data.tsx:91-94` (`submitPurchaseOrder`) | `POST /api/client/orders/:id/purchase-order` JSON or `POST /api/documents/client/orders/:id/purchase-order` multipart | `backend/src/routes/client.routes.js:40`; `backend/src/routes/document.routes.js:76`; document/workflow service; PO and document tables/storage | JSON and multipart paths are distinct. Live file-storage, `receivedAt`, refresh, and Sales cross-role visibility are not verified. |
| 7. Sales Purchase Order Processing | **Connected but Partially Functional** | Sales order detail and actions in `src/app/components/SalesOrders.tsx`; `src/app/api/salesOrderDocuments.js:10` | `GET /api/sales/orders/:id/purchase-order`; `POST /api/sales/orders/:id/purchase-order/process` | `backend/src/routes/sales.routes.js:73-74`; `sales-orders.controller.js`; `sales-orders.service.js`; PO validation and order-state updates | Processing UI/adapter exists. Live accepted/validated/rejected state transition and downstream refresh are blocked. |
| 8. Job Order Creation | **Connected but Partially Functional** | Sales Job Order UI/hook in `src/app/components/useSalesJobOrders.ts:28`; `src/app/components/SalesOrders.tsx` | `POST /api/sales/orders/:id/job-orders`; `GET /api/sales/orders/:id/job-orders` | `backend/src/routes/sales.routes.js:76-77`; `sales-orders.controller.js`; `sales-orders.service.js`; JO/item/BOM/audit database operations | Creation, refresh, and list mapping exist. Live prerequisite enforcement, persisted due date, BOM deduction, and Client/Production visibility are not browser-verified. |

### P2 — Production

| Module | Status | Existing frontend and interaction | API / HTTP | Backend controller–service–database | Gap / persistence evidence |
|---|---|---|---|---|---|
| 1. Production Job Order Viewing | **Connected but Partially Functional** | `src/app/components/ProductionFloor.tsx`; `OperationsProductionFloor.tsx`; `useProductionJobOrders.ts:20` | `GET /api/production/job-orders?filters`; `GET /api/production/job-orders/:id` | `backend/src/routes/production.routes.js:22-23`; `production-job-orders.controller.js`; `production-job-orders.service.js`; pool reads joined against JO/order/client/specification/stage/event tables | List/detail refresh works by source contract, bounded to 100 records. Live MySQL display and cross-role detail evidence is absent. |
| 2. Production Progress Management | **Backend Exists, Frontend Disconnected** | Existing stage UI in `ProductionFloor.tsx`, but Real Mode marks the page read-only and replaces stage operators/actions | No stage mutation endpoint found | `backend/src/routes/production.routes.js` exposes only list/detail reads | Starting, advancing, pausing, reverting, or completing stages has no approved frontend mutation/API. Demo stage state must not be cited as persisted progress. |
| 3. Production and Warehouse Coordination | **Connected but Partially Functional** | Sales Stock Request form `sales/RealSalesStockRequests.tsx`; Warehouse request panel `RealWarehouseStockRequests.tsx`; inventory provider `store/materials.tsx` | `POST /api/stock-requests`; `GET /api/stock-requests`; `PATCH /api/stock-requests/:id` | `backend/src/routes/stock-requests.routes.js:15-17`; `stock-requests.controller.js`; `stock-requests.service.js`; stock-request/line/inventory database operations | Sales submits and Warehouse responds. Live request/line synchronization and inventory update effects are unverified. Supplier receiving and automatic BOM deduction remain disconnected or unsupported. |
| 4. Job Order Completion | **Frontend Exists, Backend Missing** | Existing completion controls and status presentation exist in Demo `ProductionFloor.tsx`; Real Mode blocks writes | No JO completion mutation route found | Existing read-only Production routes only | UI completion is not an actual backend workflow. No live completion, audit event, warehouse handoff, or downstream ready-for-dispatch state. |

### P3 — Warehouse and Logistics

| Module | Status | Existing frontend and interaction | API / HTTP | Backend controller–service–database | Gap / persistence evidence |
|---|---|---|---|---|---|
| 1. Inventory Management | **Connected but Partially Functional** | `src/app/components/Inventory.tsx`; `store/materials.tsx`; raw/finished tabs and maintenance dialogs | `GET /api/inventory`; `POST /api/inventory/materials`; `PATCH /api/inventory/materials/:id` | `backend/src/routes/inventory.routes.js:17-19`; `inventory.controller.js`; `inventory.service.js`; `pool` selects/updates materials and finished goods | Read, create/update, loading/error/refresh mapping exist for warehouse/admin. Live quantity precision, audit history, and finished-good persistence are not browser-verified. Supplier receiving remains absent. |
| 2. Stock Requests | **Connected but Partially Functional** | Sales `RealSalesStockRequests.tsx`; Warehouse `RealWarehouseStockRequests.tsx`; `components/StockRequestsModal.tsx` | Sales POST, list GET, Warehouse PATCH as above | `stock-requests.routes.js`; `stock-requests.controller.js`; `stock-requests.service.js`; request/line tables and optional inventory updates | Submission and response refresh are source-connected. Live role visibility and uncertain-submit reconciliation are not verified. |
| 3. Warehouse Shipment Preparation | **Backend Exists, Frontend Disconnected** | Warehouse shipment panel `RealWarehouseShipments.tsx` is read-only | `GET /api/warehouse/shipments`, `GET /api/warehouse/shipments/:id` | `backend/src/routes/warehouse.routes.js:26-27`; `warehouse.controller.js`; `warehouse.service.js`; shipment/waybill/receipt joins | UI can inspect shipments but cannot prepare, assign, or print waybills through an approved mutation. |
| 4. Shipment and Waybill Management | **Connected but Partially Functional** | Warehouse/Logistics read panels and `waybillData.ts`/waybill components | Warehouse and Logistics list/detail GET routes | `warehouse.controller.js` / `logistics.controller.js`; `warehouse.service.js` / `logistics.service.js`; shipment, waybill, and receipt reads | Shipment/waybill metadata can display. Waybill creation/printing/reference mutation is absent. |
| 5. Dispatch and Delivery Tracking | **Backend Exists, Frontend Disconnected** | `Logistics.tsx`, `RealLogisticsShipments.tsx`, `useRealLogisticsShipments()`; original waybill scanner/history components | `GET /api/logistics/shipments`, `GET /api/logistics/shipments/:id` | Read-only logistics routes; shipment/delivery metadata service joins | Dispatch, tracking status mutation, QR verification, and external tracking link updates have no complete endpoint/UI. |
| 6. Delivery Completion | **Frontend Exists, Backend Missing** | Delivery receipt and completion controls in `DeliveryReceipts.tsx`, `Logistics.tsx`, and signed receipt components | No delivery-completion mutation or receipt-send API confirmed | No existing route for completion/POD/signature persistence found | Real Mode blocks or leaves these operations unavailable. Demo receipts must not be treated as delivery records. |

### P4 — Accounting

| Module | Status | Existing frontend and interaction | API / HTTP | Backend controller–service–database | Gap / persistence evidence |
|---|---|---|---|---|---|
| 1. Invoice Management | **Connected but Partially Functional** | `RealAccounting.tsx`; `Accounting.tsx`; `RealPaymentProofQueue.tsx`; `api/accounting.ts` | `GET /api/accounting/invoices`; `GET /api/accounting/invoices/:id`; Sales `POST /api/sales/orders/:id/invoice` | `backend/src/routes/accounting.routes.js:27-30`; `backend/src/routes/sales.routes.js:75`; accounting/sales controllers and services; invoice/payment/order persistence | Invoice reads and Sales generation are implemented. Live sent/issued state and refresh cross-role are not verified. |
| 2. Payment Proof Submission | **Connected but Partially Functional** | Client accounting UI and `client/data.tsx:108` (`submitPayment`) | `POST /api/documents/client/orders/:id/payment-proof` multipart | `backend/src/routes/document.routes.js:79`; document workflow service; payment, invoice, and uploaded-file records | Upload and refresh contract exists. Live file storage and Accounting queue visibility are unverified. |
| 3. Payment Verification | **Connected but Partially Functional** | `RealPaymentProofQueue.tsx:7` (`decide`) | `GET /api/documents/accounting/payment-proof-queue`; `POST /api/documents/accounting/payments/:id/verify|reject`; document file GET | `document.routes.js:86-89`; document workflow service; payment status/rejection review database update | Queue, verify, reject, secure file access, and state refresh are wired. Live verified/rejected persistence and JO eligibility synchronization are blocked. |
| 4. Payment Ledger and Balance Management | **Connected but Partially Functional** | `Accounting.tsx` ledger plus `api/accounting.ts:20` payment reads | `GET /api/accounting/payments`, `GET /api/accounting/payments/:id` | `accounting.routes.js`; `accounting.controller.js`; `accounting.service.js`; invoice/payment joins | Reads exist. Balance payment, clearing, credits, due-state calculations, and ledger mutations remain Demo/local or unavailable. |
| 5. Official Receipt and Payment Records | **Backend Exists, Frontend Disconnected** | Existing `OfficialReceiptPreviewModal.tsx`, `client/OfficialReceiptPreviewModal.tsx`, receipt controls in `Accounting.tsx` | Read-only invoice/payment routes; no receipt issuance route found | Backend has no confirmed Official Receipt service/controller/route for number generation and persistence | Preview/displays are not proof of issuance or persisted payment records. Real Mode blocks receipt issuance. |

### P5 — Reporting

| Module | Status | Existing frontend and interaction | API / HTTP | Backend controller–service–database | Gap / persistence evidence |
|---|---|---|---|---|---|
| 1. Owner Analytics | **Frontend Exists, Backend Missing** | `AnalyticsFullView.tsx`, Owner KPI cards in `Dashboard.tsx`, CSV/report shells | Owner dashboard GET exists for a limited overview/directory; no general analytics/report endpoint/export route | `backend/src/routes/owner-employee-directory.routes.js:31-32`; owner employee directory service | Financial, sales, production, inventory, logistics, and report calculations remain unavailable or local Demo. CSV export is blocked in Real Mode. |
| 2. Operations Monitoring | **Connected but Partially Functional** | `OperationsProductionFloor.tsx`; `Dashboard.tsx`; Inventory reads | Production Job Order GET and Inventory GET; no Operations-specific dashboard aggregate | Production/inventory routes and services; pool reads | Production and inventory data sources exist. Bottleneck, active-order, delivery, and resolution calculations are incomplete; live KPI completeness is unverified. |
| 3. Sales, Inventory, and Production Reports | **Frontend Exists, Backend Missing** | Report tabs/export controls in `AnalyticsFullView.tsx`; Demo report data | No reporting/export endpoints found | No reporting controller/service/data export implementation found | Report definitions and formulas are unapproved; no persisted report query or export workflow exists. |

### P6 — Supporting Features

| Module | Status | Existing frontend and interaction | API / HTTP | Backend controller–service–database | Gap / persistence evidence |
|---|---|---|---|---|---|
| 1. Notifications | **Partially Connected** | Client provider and `client/NotificationsCenter.tsx`; Sales notification components; generic notification stores | Client `GET /api/client/notifications`, `PATCH .../:id/read`; Sales `GET /api/sales/notifications` | `backend/src/routes/client.routes.js:48-49`, `sales.routes.js:69`; notification controllers/services; notification-table reads/updates | Client read/mark-read and Sales read exist. Cross-role notification creation, delivery, clearing, and some role centers remain Demo/local or unsupported. |
| 2. File and Document Management | **Connected but Partially Functional** | Inquiry sketches, PO, payment proof, quotation/JO document components | `GET/POST` document routes under `/api/documents`; purchase/quotation/PO/file endpoints | `backend/src/routes/document.routes.js:48-89`; document workflows/storage service; document/file metadata and object storage | Upload/download and ownership scoping are source-connected. Live storage, generated waybill/receipt/POD files, and complete document lifecycle remain unverified. |
| 3. Settings and Preferences | **Frontend Exists, Backend Missing** | `src/app/components/Settings.tsx`; `store/settings.tsx`; `store/clientCompanySettings.ts` | No general settings/preferences API identified | No corresponding settings controller/service/route found | Real Mode settings may be unavailable/read-only or Demo/local. Persisted company settings, notification preferences, and account preferences are not established. |
| 4. Audit History | **Connected but Partially Functional** | Inventory history UI, JO event history, Admin audit/dashboard, and accounting review surfaces | Admin dashboard, JO detail events, inventory audit fields; no general audit-history endpoint | Admin/dashboard/service, JO event/service, and audit-related database operations | Selected audit records are connected. A complete role-filtered audit-history search/export surface is not established as a general API. |

## 4. Existing Working Connections

The following traces are supported by code and deterministic tests, with live persistence still blocked:

- Client profile/orders/notification reads: `ClientDataProvider` → `clientPortalApi` → `/api/client/*` → `client.routes.js` → `client-portal.service.js` → MySQL pool.
- Client inquiry: `ClientPortal` → `addInquiry` or `addInquiryWithProductSketches` → `/api/client/orders` or `/api/documents/client/inquiries` → client/document services → persisted order/inquiry/item/sketch records.
- Client quotation decision/revision and PO submission: `client/data.tsx` → `clientPortalApi` → client/document routes/controllers/services.
- Sales order list/detail: `useSalesOrders` → `listSalesOrders/getSalesOrder` → `/api/sales/orders*` → `sales-orders.controller.js` → `sales-orders.service.js`.
- Sales stock availability: `useSalesStockAvailability` → `/api/sales/orders/:id/stock-availability` → Sales service/inventory joins.
- Sales quotation/PO/invoice/JO: `salesOrderDocuments.js`, `useSalesJobOrders.ts` → `/api/sales/orders/:id/...` → Sales service mutations and refresh.
- Production read: `useProductionJobOrders` → `/api/production/job-orders*` → Production service joined database reads.
- Inventory read/write: `MaterialsProvider` / `Inventory` → `/api/inventory*` → inventory service/pool.
- Stock requests: `RealSalesStockRequests` and `RealWarehouseStockRequests` → `/api/stock-requests*` → stock-request service/pool.
- Warehouse/logistics shipment read: `RealWarehouseShipments` / `useRealLogisticsShipments` → `/api/warehouse|logistics/shipments*` → shipment services.
- Accounting invoice/payment read: `Accounting` and `api/accounting.ts` → `/api/accounting/*` → accounting service/pool.
- Payment-proof queue/verify/reject: `RealPaymentProofQueue` → `/api/documents/accounting/*` → document workflow service/payment records.
- Admin and owner directories/dashboard: existing API adapters → `/api/admin/*` and `/api/owner/*` → authenticated role-scoped services.

## 5. Broken or Missing Connections

| Exact location | Missing or broken connection |
|---|---|
| `src/app/components/ProductionFloor.tsx` Real Mode | Existing stage controls are read-only; no `PATCH/POST /api/production/job-orders/:id/stage` or completion contract exists. |
| `src/app/components/DeliveryReceipts.tsx`; `Logistics.tsx` | Real delivery/receipt/POD/QR actions are blocked or Demo-store operations; no matching logistics mutation route/service. |
| `src/app/components/Accounting.tsx` | Reminders, balance payment, clearing, Official Receipt issuance, and receipt records are Real-unavailable or prototype notifications/local state. |
| `src/app/components/Inventory.tsx` | Receiving, supplier discrepancy, partial receiving, and receiving-document workflows are absent. Material create/update exist, but not the receiving lifecycle. |
| `src/app/components/AnalyticsFullView.tsx`; `Dashboard.tsx` | Reporting period formulas and CSV exports have no authenticated Owner/Operations reporting API. Demo order/material stores are not a reporting source in Real Mode. |
| `src/app/components/Settings.tsx`; `store/settings.tsx`; `store/clientCompanySettings.ts` | Settings UI and stores have no established persisted backend contract. |
| `src/app/store/orders.tsx` | Demo order state/localStorage is the source for many UI-only stage and document actions. In Real Mode, components must not read those actions as persisted results. |
| `src/app/store/stockRequests.tsx` | Real provider is read-only and throws unavailable operations; only dedicated `/api/stock-requests` components perform real actions. |
| `src/app/store/notifications.tsx` | Demo/local notification mutation behavior is isolated from Real client/sales APIs in `createRealReadOnlyProvider`, so generic notification UI actions cannot be assumed to persist. |

## 6. Mock Data and Local-State Dependencies

- Demo/local dependencies remain in `src/app/store/orders.tsx`, `store/stockRequests.tsx`, `store/notifications.tsx`, `store/settings.tsx`, `store/accounts.ts`, `store/materials.tsx`, `store/clientCompanySettings.ts`, and `store/demoOrders.ts`.
- `App.tsx` isolates Demo Preview and does not mount real business providers during Demo Preview. Demo credentials and records remain confined to that branch.
- Real `MaterialsProvider` merges real inventory with catalog-reference rows. Some rows have `source: "catalog_reference"` and no `databaseId`; the UI deliberately excludes these from database stock requests and maintenance.
- Real `StockRequestsProvider` starts empty and blocks all mutations. Real Sales/Warehouse components use dedicated API adapters instead.
- Real `OrdersProvider` behavior must not be combined with Demo-only order-stage mutations. `ClientDataProvider` and Sales/Production dedicated hooks are the real source for their respective data.
- In some Real pages, list/detail component state derives from API but legacy UI helper functions still synthesize presentation fields. The field may be a safe display projection, not persisted data; it must not be described as a database value.

## 7. Authentication and Authorization Integration Gaps

- Session restoration and logout are wired in `App.tsx`: `/api/auth/me` and `/api/auth/logout`, with cookie credentials.
- Route authorization is consistently represented by authentication, role, and permission middleware. `api()` surfaces 401/403 and emits recheck events.
- Sales routes enforce employee + Sales role. Client routes derive ownership from the authenticated client account rather than caller-supplied ownership.
- Production routes allow Production, Admin, Owner, and Operations employees with `production:read`.
- Accounting routes allow Accounting with invoice/payment permissions; payment-proof verify/reject additionally require `payments:verify`.
- Warehouse stock-request update requires Warehouse; Sales stock-request creation requires Sales.
- Inventory maintenance allows Warehouse/Admin; read permissions cover applicable roles.
- Remaining authorization gaps:
  - Reporting permissions exist (`reports:read`) but do not establish which role may receive every proposed Owner/Operations report field.
  - No general notification creation or recipient mutation contract is approved.
  - Settings and preference endpoints have no role/payload policy.
  - Logistics/production completion and receipt/POD endpoints do not exist to authorize.
  - Live 401/403 browser behavior and cross-role session transitions are not verified.

## 8. Cross-Role Data Synchronization Gaps

The strongest cross-role synchronization is represented by shared order/JO/shipment/invoice/payment database tables and refresh functions. It is not live-verified.

Gaps:

- Client decision/revision → Sales order state.
- Sales quotation sent → Client quotation state.
- Client PO upload → Sales received/validated PO state.
- Sales JO creation → Client job view and Production floor.
- Production stage/completion → Sales readiness, Warehouse preparation, Logistics active jobs, Client status.
- Warehouse stock-request response/inventory update → Sales request state and stock availability.
- Warehouse shipment preparation/waybill print → Logistics active jobs and Client tracking.
- Dispatch/delivery completion/POD → Client logistics, Accounting completion, Sales fulfillment.
- Accounting payment verification → Sales/Client payment state and JO eligibility.
- Invoice generation/payment → Sales/Accounting/Client records and outstanding balance.
- Notification fan-out for all above transitions.

No live browser or database evidence confirms that these transitions synchronize immediately or after refresh.

## 9. Environment and Testing Blockers

### Existing test evidence

- Backend: prior deterministic suite result is 865 passed, 0 failed as stated in existing review docs.
- Focused backend HTTP integration: 198 passed, 0 failed in the existing Layer 5 review.
- Frontend API adapters: 48 passed, 0 failed.
- Restoration/component tests: `realClientPortal.test.mjs`, `realSalesOrders.test.mjs`, `realInventoryProduction.test.mjs`, `realAccounting.test.mjs`, `realLogistics.test.mjs`, `realOperations.test.mjs`, `realEmployeeDirectory.test.mjs`, `frontendRestoration.test.mjs`, and stock-request tests cover mappings, unavailable states, and source/routing guards.
- Latest frontend restoration review reports 228 tests/184 passed/44 failed, with 44 unresolved source assertions and at least one provider omission; it does not establish live browser success.
- Browser specs exist under `tests/browser`, `tests/client-conversion`, `tests/sales-conversion`, `tests/warehouse-integration`, and `tests/admin-refresh`, but browser/live verification requires reviewed identities and environment setup.

### Concrete blockers

- `browser-test/recovery/identity.reviewed.json` is absent.
- Saved live test account identifiers required by `backend/src/services/auth.http.integration.js` are absent.
- No live authenticated browser session was run.
- No live MySQL persistence/refresh result was run.
- No live file-upload/object-storage verification was run.
- No live cross-role synchronization scenario was run.
- Existing uncommitted changes were preserved and no migration or destructive operation was executed.

## 10. Recommended Implementation Order

The implementation order must follow the existing business dependencies:

1. **Verify and repair client inquiry creation and persistence**: JSON/multipart submission, sketch records, idempotent retries, refresh, and client/Sales visibility.
2. **Complete Sales inquiry and rejection/cancellation management**: distinguish implemented reads from absent/create/edit actions and attach authoritative state changes.
3. **Complete accepted quotation flow**: client decision, Sales visibility, accepted quotation state, and exact PO prerequisites.
4. **Complete PO submission and Sales processing**: multipart file, PO validation, received/validated/rejected state, refresh, and downstream JO eligibility.
5. **Complete payment-proof submission and verification before production**: Client upload, Accounting queue, secure proof, verify/reject, refresh, and JO eligibility.
6. **Complete Job Order creation**: persist due date, JO/item/BOM relationships, audit records, Client visibility, and Production visibility.
7. **Complete Production progress and completion**: approved stage mutations, pause/revert/history, completion, warehouse handoff, and Sales/Client readiness.
8. **Complete stock-request and inventory synchronization**: Sales request, Warehouse response, inventory update, shortage/refetch, and optional receiving/reconciliation.
9. **Complete warehouse shipment/waybill preparation**: shipment record, waybill identity, print/reference, warehouse-to-logistics handoff.
10. **Complete Logistics dispatch/POD/delivery completion**: status mutation, tracking/POD/receipt evidence, Client/Sales/warehouse visibility, and fulfillment close.
11. **Complete accounting ledger/balance/receipts**: only after invoice/payment/PO/JO/fulfillment states are authoritative; add verified clearing and Official Receipt persistence.
12. **Add notification fan-out last within each transition**: only after recipient and read-policy requirements are approved.
13. **Add reporting only after metric formulas and role data minimization are approved**: reuse only connected tables/APIs, then add exports/audit.
14. **Complete supporting settings and general audit history** after core workflow persistence is stable.

## 11. Exact Next Task

Establish and execute a live, authenticated P1 smoke scenario for one existing inquiry:

1. Sign in as a real Client account.
2. Submit a new inquiry through `POST /api/client/orders` or the sketch multipart route.
3. Refresh `/api/client/orders` and confirm the record and returned ID.
4. Sign in as Sales and confirm the inquiry in `/api/sales/orders`.
5. Create a quotation through `/api/sales/orders/:id/quotations`.
6. Sign in as Client and confirm `/api/client/orders/:id/quotations`, accept it, and refresh Sales detail.
7. Submit a PO as Client, upload it if required, and confirm the PO in Sales detail.
8. Process the PO as Sales and confirm the resulting state.
9. Record MySQL rows and browser-visible refresh evidence for each mutation.

Do not implement or change functionality for this task. First verify the existing P1 chain against the database and identify the exact first disconnected interaction.
