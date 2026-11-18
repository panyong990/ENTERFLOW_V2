# ENTER-FLOW V2 — Layer 0 Backend API Inventory and Gap Analysis

Audit date: 2026-11-18  
Branch: `integration/dev-phase-merge`  
Scope: read-only repository audit. Migration 007 and its history were not inspected. No SQL writes, migrations, seeds, imports, source changes, Git operations, or service changes were performed.

## Executive conclusion

The backend is a real Express/MySQL application, not a route-only mock. The strongest implemented slice is identity and security, client onboarding, Client portal inquiry/order reads, Sales inquiry-to-quotation-to-PO/invoice/JO orchestration, stock-request coordination, document upload/retrieval, and transactional audit logging. The original audit run did not establish a repository-wide backend test count. The latest focused Logistics and related delivery run passed 108 tests, with 0 failures and 0 skips. The latest full backend run passed 863 tests, with 0 failures and 0 skips.

The nine-role permission catalogue is broader than the routable API. In particular, permissions exist for Accounting, Warehouse delivery/waybill, Logistics delivery, Production updates, Operations reporting, and Admin business administration, but corresponding routes/services are absent or read-only. The frontend explicitly reports several of these capabilities as unavailable in Real Mode. These are API gaps, not empty-data results.

No live database persistence or browser acceptance was claimed. Therefore, source-and-test-supported operations are marked `NEEDS VERIFICATION` where correctness still requires an approved database environment and end-to-end evidence.

### Status definitions

* **COMPLETE** — route, controller/service path, validation/authorization, and supporting tests provide sufficient source evidence for the scoped operation; live persistence is still separately noted.
* **INCOMPLETE** — an implementation exists but omits part of the approved operation or has a known integration limitation.
* **MISSING** — no backend route/service implementation was found.
* **BLOCKED** — implementation depends on approved data/configuration or an unavailable external/runtime dependency.
* **NEEDS VERIFICATION** — implementation exists, but repository evidence is not enough to prove live database/browser behavior.

## A. Complete API inventory

Conventions: `P` = proposed path where no implementation exists; `DB` names tables observed in the existing schema/service SQL; `Tests` names the evidence family rather than claiming live persistence.

### Identity, authentication, onboarding, and administration

| Operation | Roles | Method/path | Existing implementation and status | Request → response / DB / controls | Tests and remaining evidence |
|---|---|---|---|---|---|
| Client self-registration | Client/public | POST `/api/auth/register` | Registration controller/service; **NEEDS VERIFICATION** | Registration fields → pending result; `client_applications`; validation, origin, rate limit, duplicate identity handling | registration controller/service/HTTP tests; live MySQL persistence not verified |
| Login, current user, logout, password change | All authenticated roles | POST `/api/auth/login`, GET `/api/auth/me`, POST `/api/auth/logout`, POST `/api/auth/change-password` | Auth/session/password services; **NEEDS VERIFICATION** | Credentials/session token → sanitized identity; `users`, `user_sessions`; HttpOnly cookie, idle/absolute expiry, origin, rate limits | Included in the subsequent 844-test backend run; live cookie/session persistence not verified |
| Admin review of client applications | Admin | GET `/api/client-applications`, `/:id`, POST `/:id/approve`, POST `/:id/reject` | Controller/service; **COMPLETE** at source/test level | Pagination or bounded decision body → application/status; `client_applications`, `clients`, `users`, `audit_events`; Admin-only permissions and same-origin mutations | application controller/service/HTTP tests; no live DB/browser verification |
| Admin dashboard and role metadata | Admin | GET `/api/admin/dashboard`, `/roles` | Admin controller/service; **NEEDS VERIFICATION** | No body / bounded filters → counts, activity, role/module metadata; aggregate reads from `users`, `clients`, `roles`, `modules`, `audit_events`; Admin-only | admin service/controller/HTTP tests; zeroes are database counts, not demo fallback |
| Employee directory CRUD/status/role | Admin | GET/PATCH `/api/admin/employees[/:id]`; POST `/employees`, `/:id/role`, `/:id/activate`, `/:id/deactivate` | Admin service; **COMPLETE** for implemented admin operations | Employee profile/role/revision → sanitized employee; `users`, `user_sessions`, `roles`, `audit_events`; revision checks, session revocation, audit transaction | admin tests cover rollback, stale revision, role/status security; live persistence not verified |
| Admin client account reads/update/status | Admin | GET/PATCH `/api/admin/clients[/:id]`; POST `/:id/activate|deactivate` | Admin service; **COMPLETE** for implemented operations | Company/contact fields + revision → sanitized client/account; `clients`, linked `users`, `audit_events`; no client creation | admin tests cover linked rollback and status security; live persistence not verified |
| Owner employee directory | Owner | GET `/api/owner/employees` | Owner directory service/controller; **NEEDS VERIFICATION** | Query filters/page → employee rows; `users`; owner employee-only gate | owner directory tests; no live DB/browser verification |

### Client, Sales, orders, quotations, PO, invoicing, and Job Orders

| Operation | Roles | Method/path | Existing implementation and status | Request → response / DB / controls | Tests and remaining evidence |
|---|---|---|---|---|---|
| Submit inquiry/order | Client | POST `/api/client/orders`; multipart alternative POST `/api/documents/client/inquiries` | Inquiry and engineer-sketch services; **NEEDS VERIFICATION** | Inquiry/contact/payment term/products or multipart sketch → order/reference; `orders`, `order_items`, `product_specifications`, files/sequences; client ownership, validation, idempotency | inquiry, engineer-sketch, client HTTP tests; no live DB persistence |
| Inquiry submission status | Client | GET `/api/documents/client/inquiry-submissions/:key` | Engineer-sketch service; **NEEDS VERIFICATION** | Idempotency key → durable status/result; submission/idempotency/file tables; client scope | engineer-sketch tests; live storage/database not verified |
| Client order list/detail | Client | GET `/api/client/orders`, `/orders/:id` | Client portal service/controller; **NEEDS VERIFICATION** | bounded filters/page → scoped order and items; `orders`, `order_items`, specifications and related records; client ownership | client portal service/HTTP tests; live ownership/persistence not verified |
| Sales client list/detail | Sales | GET `/api/sales/clients`, `/clients/:id` | Sales clients service; **NEEDS VERIFICATION** | page/query → sanitized client profile; `clients`; employee Sales gate | sales-client tests; no live DB/browser verification |
| Sales order list/detail | Sales | GET `/api/sales/orders`, `/orders/:id` | Sales orders service; **NEEDS VERIFICATION** | filters/page → company-wide order detail; orders/items/quotes/PO/payments; Sales role and bounded query validation | sales-orders tests; live DB not verified |
| Stock availability check | Sales | GET `/api/sales/orders/:id/stock-availability` | Sales orders service; **COMPLETE** for read-only calculation | order id → material/BOM/finished-good availability with unknown distinct from zero; BOM/material/catalog tables; read-only, no reservation/deduction | tests explicitly verify no stock mutation, unknown/zero/unmapped handling; approved BOM/catalog and live DB remain required |
| Prepare/send quotation with server costing | Sales | POST `/api/sales/orders/:id/quotations` | Sales orders service; **COMPLETE** for implemented quotation contract | quotation lines/cost inputs/revision base → persisted quotation revision/totals; quotations/lines/costing/discounts/add-ons/files, BOM/material prices; 20% or 50% downpayment, server totals, revision lock; `MATERIAL_COSTING_INCOMPLETE` includes product-scoped approved BOM/material-data errors | tests cover BOM costing, VAT/markup/discount, revisions, rollback, downpayment, and actionable incomplete-costing details; approved BOM/material price data and live persistence remain required |
| Client quotation history/decision/revision | Client | GET `/api/client/orders/:id/quotations`; POST decision and revision paths | Client portal service; **NEEDS VERIFICATION** | decision/revision reason → quotation state/request; quotations, order requests, audit; client ownership and accepted/rejected/revision validation | client portal tests; no live browser/database verification |
| Sales quotation history | Sales | GET `/api/sales/orders/:id/quotations` | Sales orders service; **NEEDS VERIFICATION** | order id → revisions, costing snapshots/files; scoped to order | sales order document tests; live persistence not verified |
| Client submit PO metadata | Client | POST `/api/client/orders/:id/purchase-order` | Client portal service; **NEEDS VERIFICATION** | PO metadata → PO status; `purchase_orders`, quotations/orders; accepted quotation eligibility and client ownership | client portal HTTP/service tests; live persistence not verified |
| Client upload PO document | Client | POST `/api/documents/client/orders/:id/purchase-order` | Document workflow service; **NEEDS VERIFICATION** | multipart reference/document → PO/file metadata; `purchase_orders`, `files`, `purchase_order_files`; accepted quote and upload validation | document workflow tests; storage and DB persistence not verified |
| Sales review/process PO | Sales | GET `/api/sales/orders/:id/purchase-order`; POST `/purchase-order/process` | Sales orders/document services; **NEEDS VERIFICATION** | validation decision/body → PO lifecycle; PO/orders/quotations/audit; Sales ownership/permissions and validation | service/controller tests; live persistence not verified |
| Issue invoice | Sales | POST `/api/sales/orders/:id/invoice` | Sales orders service; **NEEDS VERIFICATION** | order id → invoice metadata; `invoices`, `invoice_files`, orders; Sales invoice permission and workflow checks | sales order tests cover invoice prerequisite for JO; no live invoice persistence |
| Client invoice read | Client | GET `/api/client/orders/:id/invoices` | Client portal service; **NEEDS VERIFICATION** | order id → invoice list; `invoices`; client ownership | client portal tests; live DB not verified |
| Create Job Orders | Sales | POST `/api/sales/orders/:id/job-orders` | Sales orders service; **COMPLETE** for implemented eligibility contract | JO request → JO rows; `job_orders`, order/PO/quotation/payment/audit relationships; validated PO, issued invoice, verified authoritative downpayment, no production start/inventory deduction | tests explicitly cover eligibility and no inventory/production writes; live persistence not verified |
| Read Job Orders | Client/Sales/Production/Operations/Admin | GET client/sales/production job-order paths | Client, Sales, Production services; **NEEDS VERIFICATION** | order/job id → JO details/status/history; job-orders and related tables; role/ownership gates | production and sales delivery tests; no live DB/browser verification |

### Inventory, stock requests, production, documents, payments, and delivery

| Operation | Roles | Method/path | Existing implementation and status | Request → response / DB / controls | Tests and remaining evidence |
|---|---|---|---|---|---|
| Inventory/catalog read | Sales, Production, Warehouse, Admin, Owner, Operations | GET `/api/inventory` | Inventory service; **NEEDS VERIFICATION** | no body → materials/finished goods catalog; `materials` and catalog/BOM references; permission only, quantities may be unknown | inventory tests and safe-error tests; no live DB and no approved stock quantities |
| Create/list/process stock request | Sales create/read; Warehouse read/update | POST/GET/PATCH `/api/stock-requests[/:id]` | Stock request service; **COMPLETE** for approved manual workflow | quotation/order/material lines; response quantities/status → stock request snapshots/responses; `stock_requests`, lines, `stock_responses`, `materials`, `audit_events`; no reservation, manual observed quantity only | tests cover transactions, unknown/zero, duplicate/inconsistent updates, audit; live persistence not verified |
| Production job-order monitoring read | Production/Admin/Owner/Operations | GET `/api/production/job-orders[/:id]` | Production job-order service; **NEEDS VERIFICATION** | filters/id → job status/history/BOM counts; job order tables; employee role gate | production service tests; no production mutation route |
| Production stage/status updates | Production | P `/api/production/job-orders/:id/status` | No route/controller/service found; **MISSING** | Approved stage payload and transition response require approved transition rules; existing production/job tables | permission catalogue allows update, but no endpoint/test implementation |
| Payment proof upload | Client | POST `/api/documents/client/orders/:id/payment-proof` | Document workflow service; **NEEDS VERIFICATION** | invoice/amount/method/reference/document → pending payment; `payments`, `payment_files`, `invoices`; invoice issued, exact downpayment, client ownership, idempotency | document workflow tests; live file/database persistence not verified |
| Payment queue/review | Accounting | GET `/api/documents/accounting/payment-proof-queue`, payment file GET, POST verify/reject | Document workflow service; **NEEDS VERIFICATION** | queue filters or decision/reason → pending/verified/rejected payment; payments/files/audit; Accounting-only verify, rejected proof retained | document workflow tests and permission tests; live persistence not verified |
| Client payment read | Client | GET `/api/client/orders/:id/payments` | Client portal service; **NEEDS VERIFICATION** | order id → payment history; payments; client ownership; verified downpayment not treated as full payment | client portal tests; no live persistence |
| Accounting invoice/payment/receipt operations | Accounting | P `/api/accounting/...` | No accounting route/service for invoice reads, recording, receipts, reminders, OR issuance; **MISSING** | Requires approved payloads/state transitions and existing invoice/payment/receipt tables | frontend `Accounting.tsx` explicitly marks operations unavailable in Real Mode |
| Delivery/shipment read | Client/Sales/Logistics | GET `/api/client/orders/:id/delivery`, `/api/sales/orders/:id/delivery`, `/api/logistics/shipments[/:id]` | Client/Sales scoped reads and Logistics handoff reads; **NEEDS VERIFICATION** | owned order or handed-off shipment → scoped shipment/waybill/receipt metadata; shipments, waybills, delivery receipts; client ownership or role/permission scope | Client, Sales, Warehouse, and Logistics tests; live DB not verified |
| Warehouse delivery/waybill management | Warehouse | P `/api/warehouse/shipments...`, `/api/warehouse/waybills...` | No route/service found; **MISSING** | Requires approved dispatch/waybill transitions, scan contract, and actor/audit rules | frontend waybill components state authenticated API is unavailable |
| Logistics delivery updates | Logistics | P `/api/logistics/shipments/:id/...` | No mutation route; **BLOCKED** | Requires approved dispatch/status transitions, recipient/driver data rules, audit events, and delivery completion criteria | New API is read-only; frontend mutations remain unavailable in Real Mode |
| Engineer Sketch list/retrieve | Client/Sales | GET `/api/documents/{client|sales}/orders/:orderId/items/:itemId/sketches[/:fileId]` | Engineer sketch service; **NEEDS VERIFICATION** | ids → metadata or secure file bytes; `files`, `order_files`, `specification_files`; ownership, content headers, storage validation | engineer-sketch HTTP/service tests; live storage not verified |
| General document retrieval | Client/Sales/Accounting | GET document file paths | Document workflow service; **NEEDS VERIFICATION** | file id plus parent id → bytes; attachment join tables and `files`; parent ownership and role gate | document tests; live storage/configuration blocked until approved storage is available |
| General notifications | Client/Sales | GET/PATCH client and GET Sales notification paths | Notification services; **NEEDS VERIFICATION** | filters/read mutation → user-scoped rows/read state; notifications/recipients/roles; authenticated recipient isolation | notification service tests; client UI marks general notification mutations unavailable outside supported API |
| Reporting/analytics | Owner/Operations/Admin/Accounting/Sales | P `/api/reports...` | No general reporting route/service; **MISSING** | KPI definitions, filters, exports, and data sources are not specified in backend | `AnalyticsFullView` and Sales dashboard state authenticated reporting/revenue aggregates unavailable |

## B. Nine-role API matrix

This matrix reflects both the permission catalogue and actual route availability. `R` means implemented read surface; `W` means implemented mutation; `—` means no connected backend surface; `P` means permission exists but route is missing; `V` means route exists but live evidence is still verification-only.

| Domain | Admin | Owner | Operations | Sales | Accounting | Production | Warehouse | Logistics | Client |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Auth/session | V/RW | V/RW | V/RW | V/RW | V/RW | V/RW | V/RW | V/RW | V/RW |
| Client onboarding/accounts | RW | R | — | R/W client data | — | — | — | — | R own / self-register |
| Orders/inquiries | R/W permission, limited routes | R permission, no business routes | R rejection exception | V/RW | R only permission | R | — | — | V/R own |
| Quotations/costing | permission, no route | R permission only | — | V/RW | — | — | — | — | V/R + decisions |
| Purchase Orders | — | — | — | V/RW | — | — | — | — | V/RW upload |
| Invoices | permission only | — | — | V/RW issue | P | — | — | — | V/R |
| Payments | no permission | R permission only | — | no verify | V/RW verify route | — | — | — | V/RW upload/read |
| Job Orders/production | R permission/production read | R permission | R production read | V/RW create/read | — | V/R only | R permission only | — | V/R |
| Inventory/BOM | permission only | R permission | R permission | V/read availability | — | R permission | P update permission, only read route | — | — |
| Stock requests | — | — | — | V/RW create/list | — | — | V/RW process | — | — |
| Delivery/waybills | permission only | R permission | R permission | V/R delivery | P receipts | — | V/R shipments | V/R handoff shipments; P mutations | V/R delivery |
| Documents/sketches | — | — | — | V/R | V payment files | — | — | — | V/RW uploads |
| Notifications | — | — | — | V/R | — | — | — | — | V/RW supported client surface |
| Reporting/analytics | P | P | P | P partial dashboard | P | — | — | — | — |

Important distinction: a permission in `backend/src/config/permissions.js` is not an API implementation. The matrix marks those permission-only capabilities as gaps.

## C. Existing backend architecture map

### Request flow

`backend/src/app.js` installs request-id and structured request logging, then mounts route groups under `/api`. Route factories inject MySQL pool/services and are independently testable with stubs. Authentication reads a single validated `enterflow_session` cookie, validates the server-side session, updates activity, and attaches a frozen identity. Role and resource/action permission middleware then gate the route. Same-origin middleware protects mutations; upload middleware validates multipart documents.

### Route groups

* `/api/auth`: auth, sessions, registration, password change.
* `/api/client-applications`: Admin-only client application review.
* `/api/admin`: Admin dashboard, roles, employees, client account administration.
* `/api/owner`: Owner employee directory.
* `/api/workspace/sales`: Sales readiness response.
* `/api/sales`: Sales client/order/quotation/PO/invoice/JO/delivery/stock availability/rejection/cancellation/notifications.
* `/api/client`: Client profile/dashboard/orders/quotation decisions/PO/cancellation/invoices/payments/delivery/notifications.
* `/api/production`: production job-order reads only.
* `/api/logistics`: authenticated Logistics shipment list/detail reads for recorded Warehouse handoffs.
* `/api/stock-requests`: Sales creation/list and Warehouse processing.
* `/api/inventory`: inventory read only.
* `/api/documents`: inquiry sketches, PO/payment uploads, secure retrieval, Accounting payment-proof review.
* `/api/health`: liveness/readiness/database health.

### Services and data access

There is no repository layer directory in the inspected backend. Services issue parameterized MySQL statements directly through the pool/connection. Transactional services explicitly acquire a connection, begin/commit/rollback, release/destroy as appropriate, and write `audit_events` for the implemented high-impact mutations. Existing services include auth/session/password, registration, admin, client applications, client inquiry/portal, Sales clients/orders/dashboard/notifications, stock requests, inventory, production job orders, document workflows, engineer sketches, and owner directory.

### Database relationships observed

Identity uses `users`, `roles`, `modules`, `role_modules`, `clients`, `client_applications`, `user_sessions`, and `audit_events`. Commercial workflow uses `orders`, `order_items`, `product_specifications`, `quotations` and child costing/line records, `purchase_orders`, `invoices`, `payments`, and related attachment tables. Operations uses job orders, materials/BOM/catalog records, stock request/response records, shipments, waybills, delivery receipts, signed receipts, and notifications. Schema references were taken from existing documentation and service SQL; Migration 007 was excluded.

## D. Missing and incomplete API report

### Priority 0 — prerequisites and blockers

1. Approved BOM/material price data is required for server quotation costing. The code correctly fails closed when prices or BOM quantities are missing; do not populate or infer them during this audit.
2. Live MySQL and document storage evidence is required before marking the source-supported flows complete. The test suite uses mocks/stubs for most service tests.
3. Approved business contracts are required for production stage transitions, shipment/waybill transitions, invoice/payment/receipt lifecycle, and reporting KPI definitions.

### Priority 1 — missing workflow APIs

* Accounting API: invoice queue/read, payment recording, receipt generation/updates, payment reminders, account clearing, and Official Receipt issuance. The existing permissions and frontend actions establish the integration need, but the route/service contract is absent.
* Warehouse API: inventory catalog mutation beyond stock-request processing, shipment preparation, waybill creation/update/scan verification, delivery receipt handoff.
* Logistics API: shipment dispatch/in-transit/delivered/picked-up updates, driver/vehicle/recipient data, waybill read/scan surface.
* Production API: approved Job Order stage/status updates, production monitoring mutations, pause/resume/quality completion if approved by workflow definition.
* Reporting API: role-scoped KPI reads and exports. Do not invent KPI formulas from UI labels.

### Priority 2 — incomplete integration surfaces

* Admin permissions contain broad business read/update capabilities that do not map to Admin routes; either the permissions are intentionally policy metadata or the missing routes must be explicitly approved.
* Owner, Operations, Accounting, Warehouse, and Logistics workspaces contain UI operations with no authenticated API or only a read permission.
* Sales dashboard has a live endpoint but several charts/tables explicitly show unavailable states because the endpoint does not provide the complete requested aggregates.
* Client notification UI offers actions beyond the connected client API; general department notification reply/dismiss/clear behavior is not implemented as an authenticated backend contract.
* Original PO/document content is not available through the Sales metadata endpoint; secure retrieval exists only for selected document paths.

### Security and consistency observations

* Strong patterns: server-derived actor identity, role gates, permission gates, origin checks, bounded validators, BIGINT IDs preserved as strings, request IDs, safe error mapping, no raw error details, and transaction rollback tests.
* Route shape is inconsistent across domains: some operations are under `/api/documents`, others under role/domain prefixes; there is no single documented error envelope or pagination contract for all groups.
* The inventory route has no explicit route-local role middleware; it relies on resource permissions. This is defensible but should be covered by an integration matrix for every role.
* Several document route handlers collapse unexpected service failures into generic 503 responses; this is safe but should be correlated consistently with request/audit diagnostics.
* No backend repository abstraction exists, so SQL/table coupling is concentrated in services. This is not itself a defect, but it raises cross-module transaction and contract-review risk as missing domains are added.

## E. API implementation roadmap

1. Freeze and approve contracts for state machines, ownership scope, KPI definitions, and document/storage behavior.
2. Establish a live read-only verification fixture for approved schema/data and a storage test fixture; preserve unknown stock as unknown.
3. Normalize shared API contracts: authentication envelope, error codes/statuses, pagination, request IDs, idempotency, authorization/ownership, and audit event shape.
4. Complete Accounting reads and mutations, because verified payment and invoice state gates Job Order eligibility and downstream reporting.
5. Complete Warehouse inventory/dispatch/waybill APIs, preserving manual physical receipt updates and no automatic deduction/reservation.
6. Complete Production Job Order state updates, with explicit transition validation and audit transactions.
7. Complete Logistics shipment and waybill execution APIs, then connect delivery receipts and signed-receipt flow.
8. Add role-scoped reporting APIs only after KPI formulas and source tables are approved.
9. Finish client notifications/document retrieval and frontend adapters for every newly connected operation.
10. Run unit, HTTP integration, authorization, MySQL persistence, storage, browser, and cross-role acceptance gates before changing any status to COMPLETE.

## F. Testing and acceptance matrix

| Domain | Unit/validation | HTTP/authorization | Persistence/transaction | Cross-role/browser acceptance |
|---|---|---|---|---|
| Auth/onboarding | registration, password, session token, cookie, origin, rate limits | anonymous/client/admin/employee and inactive-account matrix | MySQL session/application/account creation and rollback | client registration, Admin approval, login/logout/change password |
| Admin/owner | input projection, revision, role/status rules | Admin-only and Owner directory-only | linked client/user/session/audit rollback | employee lifecycle and client account administration |
| Client/inquiry/sketch | inquiry fields, multipart limits, idempotency | client ownership; Sales sketch read; hostile parent IDs | order/spec/item/file/sequence atomicity | submit inquiry, retry, retrieve sketch, no duplicate |
| Sales/quotation | costing, decimal exactness, VAT/discount/markup, 20/50% DP | Sales-only writes; client cannot forge actor/totals | quotation revision/child rows/audit rollback | Sales prepares quote; client accepts/rejects/revises |
| PO/invoice/JO | PO eligibility and payload validators | client/Sales separation; no premature JO | PO validation, invoice issuance, JO atomicity | PO upload/review, invoice, JO eligibility; no inventory deduction |
| Inventory/stock requests | unknown vs zero, quantities, line consistency | Sales create; Warehouse process; other roles denied | snapshot/response/material update/audit transaction | Sales request → Warehouse review/physical update |
| Payments/accounting | amount/payment type/reason validation | Accounting-only verification; client upload; rejected retained | payment proof/file/review/audit; no auto-full-payment | upload → queue → verify/reject → client history |
| Production | approved state-transition table | Production-only mutation, read scopes | JO status/history/audit transaction | production updates visible to Sales/client only at approved scope |
| Delivery/waybill | dispatch/scan/receipt validators | Warehouse vs Logistics vs Accounting separation | shipment/waybill/receipt/signed file transactions | warehouse dispatch → logistics update → client receipt |
| Reporting | approved KPI fixtures and date/role filters | role-specific datasets and export authorization | aggregate correctness against known fixtures | Owner/Operations/Accounting/Sales dashboards, no inferred zeros |
| Documents/notifications | MIME/size/path/idempotency and recipient scope | parent ownership and secure headers | file metadata/audit/recipient read-state | upload/download/retrieval and notification state changes |

## G. Blockers and approval requirements

### Can proceed from the current repository

* Contract tests and route/service scaffolding for missing domains.
* Shared error/pagination/authorization conventions.
* Tests for every role denial, ownership boundary, no-inventory-deduction rule, rejected-payment retention, and no-full-payment inference.
* Read-only adapters for already implemented routes.

### Requires explicit approval or approved data/configuration

* BOM definitions, material prices, finished-good mappings, stock quantities, reorder thresholds, or any inventory import.
* Production stage transition semantics and who may perform each transition.
* Invoice/payment/Official Receipt lifecycle, balance-payment rules, reminder behavior, and accounting ownership.
* Warehouse/logistics shipment, waybill, scan, driver, vehicle, delivery receipt, and signed-receipt contracts.
* Reporting KPI formulas, date windows, financial inclusion rules, and export format.
* Document storage bucket/credentials, retention, MIME policy, and production URL/download policy.
* Any RBAC change, migration, schema change, or data correction.

## Evidence and preservation record

* Initial Git status before this report was created: `## integration/dev-phase-merge...origin/integration/dev-phase-merge`; no modified or untracked status lines were present.
* The subsequent independent fact-check confirmed the branch remains `integration/dev-phase-merge`. At that point, no tracked source files were modified, while this inventory document appeared as an untracked file. The current working tree is therefore not completely clean, and this chronology does not retroactively change the initial clean-working-tree evidence.
* Subsequent backend test run: 844 tests passed, 0 failed, 0 skipped, including auth/session, permissions, controllers, services, middleware, config, validation, Sales quotation/JO/stock-request behavior, and transactional rollback tests. This is separate evidence from the original audit and must not be combined with other overlapping suites.
* Post-Warehouse backend test run: 855 tests passed, 0 failed, 0 skipped. This includes the 25-test focused Warehouse/Accounting/inventory/Stock Request run and the full `backend/src/**/*.test.js` suite. It must not be combined with the earlier 844-test run or the overlapping focused run.
* Post-Production backend test run: 856 tests passed, 0 failed, 0 skipped. It includes the explicit Production mutation-absence HTTP test and must not be combined with earlier overlapping runs.
* No browser tests, live MySQL writes, migrations, seeds, imports, or storage uploads were executed for this audit.
* Existing documentation and source files were not overwritten. This new report is the only file created by the audit.

## Client-role verification addendum — 2026-11-18

This addendum is the role-by-role verification baseline requested for the Client role. It supersedes the earlier generic `NEEDS VERIFICATION` wording where the targeted service and HTTP tests provide sufficient evidence. `PASS` here means source, mocked database/storage behavior, authorization, and HTTP contract evidence passed; it does not claim live database, browser, or production object-storage verification.

### Client operation inventory

| Client operation | Frontend integration | Backend route/controller/service | Auth/ownership and data | Result | Evidence / gap |
|---|---|---|---|---|---|
| Self-registration | Login/registration flow calls `POST /api/auth/register` | `auth.routes.js` → registration controller/service | Public same-origin request; validation, duplicate identity locking, pending application; `client_applications` | **PASS** | Registration service/controller/HTTP tests; live persistence not verified |
| Login/logout/current user | `App.tsx` calls `/api/auth/me` and `/api/auth/logout`; login API calls `/api/auth/login` | Auth controller/service and session service | Server-side `enterflow_session`; inactive, expired, revoked, malformed, duplicate cookies rejected | **PASS** | Auth HTTP, auth/session, middleware tests; live cookie/session DB not verified |
| Change password | Client account UI/API uses `/api/auth/change-password` | Auth controller → password-change service | Authenticated session, current password, new-password validation, revoke sessions, audit | **PASS** | Password-change service/HTTP tests; live persistence not verified |
| View profile/account | `clientPortal.ts` calls `GET /api/client/profile` | Client route → client portal controller/service | Client account middleware; projection excludes privileged/internal fields; `users`/`clients` | **PASS** | Client portal tests cover projection, BIGINT IDs, invalid identity |
| Edit profile/company settings | UI presents profile/settings but no authenticated Client mutation route was found | No Client profile update controller/service route | No approved Client self-edit contract found | **MISSING** | Do not infer permission from UI; Admin/Sales account edits are separate APIs |
| Client application status | Application submission is visible through registration response/pending state | Admin-only `/api/client-applications` review routes | Client cannot access Admin application review endpoints | **PARTIAL** | No Client-owned application-status endpoint; approval/rejection visibility is not exposed as a Client API |
| Submit inquiry/order | Client portal calls JSON `POST /api/client/orders`; sketch flow calls multipart `POST /api/documents/client/inquiries` | Client route → inquiry/portal or engineer-sketch service | Client identity is server-derived; validates products/specifications/payment terms; creates `orders`, `order_items`, `product_specifications`, file links atomically | **PASS** | Inquiry, client HTTP, engineer-sketch tests; live DB/storage not verified |
| Inquiry submission status/retry | Client portal calls `GET /api/documents/client/inquiry-submissions/:key` after idempotent upload | Document route → engineer-sketch status service | Client/key namespace isolation; changed payload conflicts; retry-safe | **PASS** | Engineer-sketch tests cover duplicate/concurrent/retry/uncertain outcomes |
| Upload engineering sketches/supporting documents | Multipart inquiry API and Client portal upload adapter | Document upload middleware → engineer-sketch service/storage | MIME, extension, size, signature, storage cleanup, parent/client scope | **PASS** | Engineer-sketch/document-storage tests; configured production storage not verified |
| View submitted inquiries/order history | `GET /api/client/orders` | Client portal controller/service | Client-scoped query and pagination; stage code/internal data hidden | **PASS** | Client portal service/HTTP tests cover pagination and scope |
| View order details | `GET /api/client/orders/:id` | Client portal controller/service | Parent and child rows both scoped to authenticated `client_id`; invalid/non-owned IDs do not disclose data | **PASS** | Client portal tests cover Client A/B isolation, precise IDs, related records |
| View quotation history/details | `GET /api/client/orders/:id/quotations` | Client portal service | Owned order only; drafts/costing internals excluded; sent revision history and decimals preserved | **PASS** | Client portal and Sales document tests |
| Accept/reject quotation | `POST /api/client/orders/:id/quotations/:quotationId/decision` | Client portal controller/service | Latest eligible quotation, correct order/quotation ownership, valid decision/reason, audit; no PO auto-created | **PASS** | Client portal tests cover wrong order, stale/older quote, invalid reason, archived/cancelled order |
| Request quotation revision | `POST /api/client/orders/:id/quotation-revision` | Client portal controller/service | Owned order, quotation stage, bounded reason, one pending request, audit | **PASS** | Client portal tests cover duplicate pending and post-decision rejection |
| Submit PO information | `POST /api/client/orders/:id/purchase-order` | Client portal controller/service | Latest accepted quotation and owned order; PO only, no invoice/JO/inventory side effects | **PASS** | Client portal tests verify association, downpayment preservation, no downstream writes |
| Upload PO document | `POST /api/documents/client/orders/:id/purchase-order` | Document workflow service/storage | Requires accepted eligible quote; validated file; client-owned order; `purchase_orders`, `files`, `purchase_order_files` | **PASS** | Document workflow tests cover valid PDF, invalid file and association failures |
| View PO status/details | `GET /api/client/orders/:id/purchase-order` | Client portal controller/service | Owned order; safe PO metadata/files and lifecycle timestamps | **PASS** | Client portal tests cover IDs/timestamps/safe file metadata |
| View issued invoices | `GET /api/client/orders/:id/invoices` | Client portal controller/service | Sent invoices only; client-owned order; accounting internals excluded | **PASS** | Client portal tests cover sent-only, IDs/decimals, empty result |
| Retrieve individual invoice detail/document | No Client API adapter found for an invoice-specific path | No dedicated Client invoice detail/file route found | Existing invoice list is the only Client invoice surface | **PARTIAL** | Invoice list is verified; individual detail/document retrieval remains a gap pending approved contract |
| Upload payment proof | Client portal builds multipart request to `POST /api/documents/client/orders/:id/payment-proof` | Document workflow service/storage | Issued invoice and exact required amount checks; Client ownership; creates pending `payments` and `payment_files` | **PASS** | Document workflow tests cover valid PDF, amount/invoice rules and linkage |
| View payment records/results | `GET /api/client/orders/:id/payments` | Client portal controller/service | Client-owned order; submitted/verified amounts exposed; reviewer identity/details hidden | **PASS** | Client portal tests cover payment projection and empty results |
| View payment-proof submission status | Payment list exposes `verificationStatus`; no dedicated status-by-submission endpoint found | No separate status route | Pending/verified/rejected records remain queryable through payments | **PARTIAL** | Existing record read supports status visibility; a dedicated upload receipt/status contract is absent |
| View job orders/production progress | `GET /api/client/orders/:id/job-orders` | Client portal controller/service | Owned order; grounded status mapping; internal production data excluded | **PASS** | Client portal and Sales job-delivery tests cover projections and empty collections |
| View delivery/shipment status | `GET /api/client/orders/:id/delivery` | Client portal controller/service | Owned order; shipment/waybill/receipt metadata; internal actors excluded | **PASS** | Client portal and Sales job-delivery tests cover scope and safe projection |
| View tracking information | Client delivery projection intentionally excludes tracking links | No Client tracking-specific route | Existing service returns only approved public delivery projection | **PARTIAL** | Tracking is not exposed; do not add it without an approved privacy/business contract |
| Retrieve delivery-related documents | No Client delivery-receipt/signed-receipt file route found | Engineer sketch and PO/payment file routes only | Delivery metadata exists, but secure Client delivery-document retrieval is not connected | **MISSING** | Requires approved document ownership and signed-receipt rules |
| View notifications | Client portal calls `GET /api/client/notifications` | Client notifications controller/service | Recipient-scoped rows, dismissed excluded, pagination/filtering | **PASS** | Notification service tests cover user scoping and duplicate-free pagination |
| Mark notification read | Client portal calls `PATCH /api/client/notifications/:id/read` | Client notifications controller/service | Updates only authenticated recipient row; cannot mark another user’s notification | **PASS** | Notification tests cover recipient isolation and idempotent read state |
| Retrieve authorized sketch/PO/payment documents | Client adapters use secure document paths | Document routes → document workflow/engineer-sketch service | Parent ID and client ownership checked; secure content headers; no object paths in responses | **PASS** | Document/engineer-sketch tests cover parent-chain resolution and unauthorized access |

### Client verification outcome

No confirmed Client defect was found during this pass, so no source defect was fixed. The verified baseline is:

* **PASS:** authentication/session restrictions, self-registration, password change, profile read, inquiry submission and idempotent status, sketch upload/retrieval, order list/detail, quotation history and decisions, quotation revision requests, PO submission/upload/read, invoice list, payment-proof upload, payment read/status field, Job Order/progress read, delivery metadata read, notifications/read-state, and authorized document retrieval.
* **PARTIAL:** client application decision visibility, invoice-specific detail/document retrieval, payment-proof status as a dedicated endpoint, and public tracking information.
* **MISSING:** Client profile/company mutation and Client delivery-related document retrieval.
* **FAIL:** none observed in the executed evidence.
* **BLOCKED:** live MySQL persistence, production object storage, and browser acceptance require the approved runtime/credentials; no such verification is claimed.

### Client tests executed

Targeted Client verification command selected the existing auth, registration, client-application, client inquiry/portal, document, engineer-sketch, Sales document/delivery, and HTTP integration test files. Result: **364 tests passed, 0 failed, 0 cancelled, 0 skipped**.

Full backend source test command selected every `backend/src/**/*.test.js` file, including the pending Accounting/Warehouse/Logistics/Production work already present in the worktree. Result: **863 tests passed, 0 failed, 0 cancelled, 0 skipped**.

No browser tests, MySQL integration tests requiring external database state, migrations, SQL writes, seeds, imports, or object-storage uploads were executed. Previous Accounting, Warehouse, Production, and Logistics work was preserved unchanged.

## Sales-role verification addendum — 2026-11-18

This addendum records the verification-first Sales audit. `PASS` means the route, controller/service behavior, authorization, validation, database interaction, and available automated evidence agree for the scoped operation. It does not claim live MySQL persistence, browser acceptance, or production storage verification.

### Sales endpoint inventory

| Sales operation | Frontend/API integration | Backend route → service | Authorization, data, and business behavior | Result | Evidence / gap |
|---|---|---|---|---|---|
| Sales readiness/capability check | Sales workspace calls `/api/workspace/sales/readiness` | Sales workspace route/service | Authenticated employee Sales role; read-only capability response | **PASS** | Sales workspace HTTP tests cover unauthenticated, wrong role, non-employee, and permission denial |
| View incoming inquiries/orders | Sales pipeline uses `/api/sales/orders` | Sales route/controller → `sales-orders.service.list` | Sales employee; company-wide Sales order read; bounded filters/pagination; `orders`, clients, items and related aggregates | **PASS** | Sales HTTP/service tests cover filters, pagination, IDs, permissions, no duplicate rows |
| View inquiry/order details and specifications | Sales record browser calls `/api/sales/orders/:id` | Sales controller → `detail` | Sales employee, `orders:read`; related specifications/items/requests/quotes loaded independently; BIGINT IDs preserved | **PASS** | Sales service tests cover detail, not-found, validation, related-record isolation |
| Retrieve authorized Engineer Sketches | Sales document UI uses `/api/documents/sales/orders/:orderId/items/:itemId/sketches[/:fileId]` | Document route → engineer-sketch service/storage | Sales role plus orders read; parent order/item chain and stored file authorization; secure content headers | **PASS** | Engineer-sketch tests cover complete parent chain, unauthorized retrieval, storage/config failure; live storage not verified |
| Manage inquiry processing status | Sales can reject via `/api/sales/orders/:id/rejection`; quotation creation is available | Sales orders controller/service | Rejection archives/preserves history, audits and notifies; no generic accept/assign/status endpoint found | **PARTIAL** | Rejection is verified; a separate approved inquiry-processing status contract is absent, so no status is invented |
| Read-only stock availability | Sales cost/stock UI calls `/api/sales/orders/:id/stock-availability` | Sales controller → `stockAvailability` | Sales orders read + inventory read; BOM/material/finished-good reads only; unknown quantities remain unknown; no reservation/deduction | **PASS** | Tests explicitly cover unknown vs verified zero, unmapped BOM, malformed quantities, and no stock mutation |
| Prepare quotation and server costing | `createSalesQuotation` calls POST `/api/sales/orders/:id/quotations` | Sales controller → `createQuotation` in `sales-orders.service` | Sales employee; orders read/update + quotations create; server uses BOM/material prices and order quantities; `quotations` and child costing/line/add-on/file records | **PASS** | Tests cover backend costing, decimal exactness, VAT/discount/markup variants, caller-total rejection, missing-price fail-closed, rollback |
| Downpayment enforcement | Quotation builder sends selected percentage | Same quotation service | Only 20% or 50%; amount derived server-side; no client-owned totals accepted | **PASS** | Dedicated tests reject unsupported percentages and verify required 20/50 contract |
| Send/revise quotation and history | Sales quotation document adapter uses POST and GET `/api/sales/orders/:id/quotations` | Sales controller/service | Immutable revision history, stale-base protection, sent supersession, order-scoped costing snapshots | **PASS** | Tests cover draft edits, sending, repeated revisions, stale bases, failed child writes and exact history |
| Process Client quotation decisions | Client uses `/api/client/orders/:id/quotations/:quotationId/decision` and revision path; Sales reads resulting state | Client portal service, not a Sales mutation route | Client ownership/latest-revision checks, accepted/rejected/revision audit; no PO auto-creation | **PASS** | Related Client tests verify correct order/version, invalid reasons, archived/cancelled rejection, no downstream PO |
| View submitted PO | Sales record browser calls GET `/api/sales/orders/:id/purchase-order` | Sales controller → `purchaseOrder` | Sales order read; accepted quotation, PO lifecycle, safe file metadata; parent order association | **PASS** | Sales document tests cover metadata, IDs, timestamps, missing order vs missing PO |
| Retrieve PO document | Frontend builds secure link `/api/documents/sales/purchase-order-files/:fileId?purchaseOrderId=...` | Document route → document workflow service | Sales role + orders read; file/PO association and parent authorization | **PASS** | Document workflow and Sales UI integration evidence; live storage not verified |
| Validate/reject PO | Sales UI calls POST `/api/sales/orders/:id/purchase-order/process` | Sales controller → `processPurchaseOrder` | Sales orders update; origin protection; validates correct order/PO/accepted quote; rejection reason supported; no inventory/JO auto-write | **PASS** | Sales HTTP/service tests cover auth/permissions and downstream prerequisites; browser persistence not verified |
| Generate/issue invoice | Sales UI calls POST `/api/sales/orders/:id/invoice` | Sales controller → `generateInvoice` | Sales order update + invoices create; invoice associated to order; service enforces commercial workflow before downstream JO eligibility | **PASS** | Sales service tests cover invoice prerequisite used by JO; live invoice persistence not verified |
| Retrieve invoice information | Sales record UI can display invoice data from order detail/dashboard data | No dedicated Sales invoice GET route; invoice read is available through existing order projections/Accounting read surface | Existing route returns order-scoped records where included; no standalone Sales invoice-detail contract found | **PARTIAL** | Generation is verified; standalone invoice retrieval/reference endpoint remains unconnected pending approved contract |
| Create Job Orders | Sales UI calls POST `/api/sales/orders/:id/job-orders` | Sales controller → `createJobOrders` | Sales order update; requires validated/cleared PO, issued invoice, accepted quotation, Accounting-verified authoritative downpayment; `job_orders` and audit relationships | **PASS** | Tests cover all prerequisites, correct references, duplicate prevention, exact quote quantities |
| Prevent JO duplicate creation | Same JO endpoint | Transactional Sales orders service | Existing JO/transaction checks reject duplicate operation before writes | **PASS** | Dedicated duplicate-transaction test passes |
| Prevent production/inventory side effects at JO creation | Same JO endpoint | Sales orders service | JO creation does not start production and does not deduct/reserve inventory | **PASS** | Dedicated test inspects writes and confirms no inventory/production mutation |
| Sales dashboard | Sales dashboard calls GET `/api/sales/dashboard` | Sales dashboard controller/service | Sales read permissions for inquiries, quotations, orders, clients; active stage counts and verified-payment revenue aggregates | **PARTIAL** | Service/HTTP tests verify stage definitions and verified-payment aggregation; frontend explicitly leaves several charts, rankings, invoice due dates, and payment tables unavailable because no corresponding API data is connected |
| Sales client directory | Sales Clients UI calls GET `/api/sales/clients[/:id]` | Sales clients controller/service | Sales employee, clients read; sanitized company/contact projection and bounded pagination | **PASS** | Sales clients tests cover pagination, inactive companies, not-found and no credential fields |
| Sales notifications/read surface | Sales workspace calls GET `/api/sales/notifications` | Sales notification controller/service | Sales employee, notifications read; user-scoped recipient rows and filters | **PASS** | Notification service/HTTP tests cover scope, filtering, pagination, duplicate-free joins |

### Sales verification outcome

* **PASS:** readiness, inquiry/order reads, specification/detail reads, authorized Engineer Sketch retrieval, read-only stock availability, quotation costing/revisions/history, 20/50% downpayment enforcement, Client quotation decision integration, PO reads/document retrieval/validation, invoice generation, JO prerequisite enforcement, duplicate prevention, no inventory/production side effects, client directory, and notification reads.
* **PARTIAL:** inquiry processing has verified rejection behavior but no separate approved status/assignment mutation; invoice generation is present but no dedicated Sales invoice-detail endpoint; dashboard is a real endpoint but does not provide every Demo UI aggregate.
* **MISSING:** no additional Sales mutation was implemented because no approved contract was found for generic inquiry status transitions or standalone invoice retrieval.
* **BLOCKED:** approved BOM/material price data, live MySQL persistence, browser acceptance, and configured production document storage remain external verification dependencies.
* **FAIL:** none observed in the executed Sales evidence.

### Sales tests executed

Focused Sales plus related Client, Accounting, Inventory, and Stock Request test selection: **169 tests passed, 0 failed, 0 cancelled, 0 skipped**.

Full backend source test command selecting every `backend/src/**/*.test.js`: **863 tests passed, 0 failed, 0 cancelled, 0 skipped**.

No source defect was fixed. No Sales source files were modified. Existing Client and prior Accounting, Warehouse, Production, and Logistics changes were preserved. No browser tests, live MySQL writes, migrations, seeds, imports, or object-storage uploads were executed.

## Admin-role verification addendum — 2026-11-18

This addendum records the Admin API and frontend verification. The existing business rule is preserved: **Admin registers employee accounts only; Clients self-register.** The backend does not expose an Admin client-creation route. Existing client-account update/status routes operate only on already-existing client records.

### Admin API inventory

| Admin function | Backend route and method | Implementation / authorization | Result | Frontend integration and gap |
|---|---|---|---|---|
| Admin dashboard | GET `/api/admin/dashboard` | `admin.routes.js` → `admin.controller.js` → `admin.service.dashboard`; authenticated active employee with role `admin`, plus `users:read`, `clientAccounts:read`, `clientApplications:read`, `reports:read`; aggregates `users`, `clients`, `roles`, `client_applications`, `audit_events` | **PASS** | `AdminDashboard.tsx` calls the real endpoint in Real Mode and keeps Demo fallback separate. Dashboard counts are source/test verified; live business data not broadly verified |
| Role and permission metadata | GET `/api/admin/roles` | Admin-only, `users:read`; reads `roles`, `modules`, `role_modules`, compares configured role permissions and reports mismatches; no write route | **PASS** | `RolesPermissions.tsx` calls `/api/admin/roles` in Real Mode and reports backend/frontend mismatches. Role editing is intentionally absent and tested as 404 |
| List employees | GET `/api/admin/employees` | Admin-only, `users:read`; validated search/status/role/department/sort/page filters; sanitized projection and summary from `users`/`roles` | **PASS** backend / **PARTIAL** overall | The real Admin employee-management screen (`UserManagementView.tsx`) currently reads `getAccounts()`/local store rather than `/api/admin/employees`; the separate Owner directory is connected to `/api/owner/employees` |
| Retrieve employee | GET `/api/admin/employees/:id` | Admin-only, `users:read`; precise BIGINT ID validation; credential-free projection and revision | **PASS** backend / **PARTIAL** overall | Admin UI selection displays local-store data; no Admin detail fetch is wired from the reviewed component |
| Register employee account | POST `/api/admin/employees` | Admin-only, `users:create` + `users:assignRole`; validated required profile/role/password fields; only existing non-Admin employee roles; Argon2id hash; duplicate identity checks; transaction and audit | **PASS** backend / **PARTIAL** overall | Admin form creates local/demo account and displays temporary password; it does not call the backend create route in the reviewed real Admin view. Backend correctly does not permit `client` or arbitrary roles |
| Update employee information | PATCH `/api/admin/employees/:id` | Admin-only, `users:update`; revision/identity conflict checks; profile-only fields; audit; identity changes revoke sessions; bootstrap Admin username protected | **PASS** backend / **PARTIAL** overall | Admin UI updates `saveAccounts()` locally; no real PATCH integration found |
| Assign employee role | POST `/api/admin/employees/:id/role` | Admin-only, `users:assignRole`; validates approved employee roles, revision, protected bootstrap Admin; revokes sessions and audits | **PASS** backend / **MISSING** frontend integration | No real Admin UI action calls this route; local role edits are not persistence |
| Activate/deactivate employee | POST `/api/admin/employees/:id/activate` or `/deactivate` | Admin-only, exact `users:activate/deactivate`; revision, active-account checks, protected initial Admin/self constraints; deactivation revokes sessions; audit transaction | **PASS** backend / **PARTIAL** overall | UI toggle updates local state only; no real Admin status mutation call found |
| Reset employee credentials | Proposed POST `/api/admin/employees/:id/password-reset` | No backend route, service operation, or approved reset contract found; existing password-change API requires the current password | **MISSING** | Admin UI has a “Reset credentials” action that generates a temporary password in local state only. This is not a real backend reset and must not be presented as persisted behavior |
| List/retrieve existing client accounts | GET `/api/admin/clients`, GET `/api/admin/clients/:id` | Admin-only, `clients:read` + `clientAccounts:read`; sanitized company/account projection from `clients` and linked `users`; no creation | **PASS** backend / **PARTIAL** overall | Admin client tab uses local `accounts` store in the reviewed Admin view; no real list/detail integration found |
| Update existing client account/company contact | PATCH `/api/admin/clients/:id` | Admin-only, `clientAccounts:update`; revision, identity conflict, linked user/client transaction, audit; does not rewrite historical application or create a client | **PASS** backend / **MISSING** frontend integration | No real Admin PATCH client integration found |
| Activate/deactivate existing client account | POST `/api/admin/clients/:id/activate` or `/deactivate` | Admin-only, exact `clientAccounts:activate/deactivate`; requires linked portal account; revision and audit; accountless company returns `NO_PORTAL_ACCOUNT` without creating one | **PASS** backend / **MISSING** frontend integration | Local Admin UI toggles demo state only; backend correctly does not auto-create a portal account |
| Client registration by Admin | POST `/api/admin/clients` | No route by design | **PASS as prohibited / MISSING as an API** | The backend preserves the rule. The Demo-only Admin UI displays a “Register Client” affordance through local state, which is a frontend contract mismatch that should be removed or clearly demo-labeled in a later approved UI task; no backend behavior was added |
| Client application review | GET `/api/client-applications`, `/:id`; POST `/:id/approve`, `/:id/reject` | Admin-only application-review routes; separate client-application service; approval creates linked client/account atomically, rejection retains application/audit | **PASS** | `RegistrationRequests.tsx` calls the real API in Real Mode, with refresh/uncertain-decision handling. Client self-registration remains the entry point |

### Admin verification findings

* **PASS:** backend Admin authentication and explicit Admin role gate; exact resource/action permissions; employee create/list/detail/update/role/status operations; protected bootstrap Admin handling; duplicate identity rejection; password hashing; session revocation on deactivation/identity/role changes; safe projections; transaction rollback/audit behavior; dashboard and role metadata reads; existing client account read/update/status APIs; Admin client-application review.
* **PARTIAL:** frontend integration for employee and client account management. The backend APIs are implemented and tested, but the reviewed Admin `UserManagementView` still uses the local `accounts` store for listing, creation, editing, reset, and activation/deactivation. Real API integration exists for dashboard, role metadata, and client application review.
* **MISSING:** persisted Admin credential reset endpoint/contract; frontend wiring for Admin employee/client mutations; Admin client creation is intentionally absent and must remain absent unless the business rule changes.
* **BLOCKED:** live persistence verification of the full Admin CRUD lifecycle requires an approved database run. One existing MySQL-backed auth/permission integration test was executed successfully, but it does not establish every Admin mutation against live data.
* **FAIL:** no confirmed backend defect was found. No code fix was made.

### Admin tests executed

Admin-focused service, HTTP, validation, authentication, authorization, session, password, and permission selection: **193 tests passed, 0 failed, 0 cancelled, 0 skipped**. This selection included the existing MySQL-backed auth/permission integration, which created and cleaned up its temporary test account successfully.

Full backend source test command selecting every `backend/src/**/*.test.js`: **863 tests passed, 0 failed, 0 cancelled, 0 skipped**.

No Admin source code was modified. Existing Client, Sales, Accounting, Warehouse, Production, and Logistics work was preserved. Migration 007 was not inspected or executed. No browser acceptance or full live Admin CRUD persistence run was claimed.

## H. Accounting API contract established by implementation

### Existing functionality reused

* The Accounting payment-proof queue, secure proof retrieval, verify/reject decisions, rejected-proof retention, downpayment amount validation, and payment/audit transactions remain reused under `/api/documents/accounting/*`.
* Sales invoice issuance remains under `POST /api/sales/orders/:id/invoice`.
* The existing `invoices` and `payments` schema, payment verification status, and Job Order downpayment gate remain authoritative.

### Implemented read contract

| Operation | Status | Method/path | Contract |
|---|---|---|---|
| Invoice queue/list | COMPLETE | `GET /api/accounting/invoices` | Accounting-only issued-invoice read; optional `orderId` and bounded `limit` 1–100 |
| Invoice retrieval | COMPLETE | `GET /api/accounting/invoices/:id` | Accounting-only issued-invoice detail |
| Payment history/list | COMPLETE | `GET /api/accounting/payments` | Accounting-only read; optional `orderId`, `invoiceId`, `status`, and bounded `limit` 1–100 |
| Payment retrieval | COMPLETE | `GET /api/accounting/payments/:id` | Accounting-only payment detail |

### Accounting operations still not implemented

| Operation | Status | Reason |
|---|---|---|
| Balance-payment submission/review | MISSING | Existing approved flows implement downpayment proofs only; balance payment lifecycle is not established |
| Account clearing | BLOCKED | No approved clearing state, eligibility, or mutation contract |
| Receipt generation/editing | BLOCKED | Receipt tables and lifecycle are not approved; no receipt numbering contract exists |
| Official Receipt issuance | BLOCKED | Frontend receipt behavior is Demo/prototype data and must not be persisted until approved |
| Payment reminders | BLOCKED | Reminder formulas and persistence/sending behavior are not approved |
| Accounting dashboard KPIs | BLOCKED | KPI formulas and live source semantics require explicit approval |

### Accounting business constraints

* Accounting is the only role permitted to verify or reject existing downpayment proofs.
* Rejected proofs remain stored with verification status and rejection reason.
* A verified downpayment remains a downpayment; it does not imply full payment.
* Sales invoice issuance is separate from Accounting and remains gated by the approved PO/quotation workflow.
* Job Order creation continues to require an issued invoice and a verified required downpayment.

## I. Warehouse API investigation and implementation

### Frontend operations found

* Inventory Real Mode reads authenticated raw-material and finished-good catalog data and separately marks unrecorded quantities.
* Real Warehouse opens an authenticated incoming Stock Request view.
* Warehouse may mark a Stock Request as reviewed or record observed quantities through the existing Stock Request workflow.
* Waybill monitoring/history/scanner UI is visible, but Real Mode explicitly disables scanning, printing, and live waybill updates.
* Inventory also exposes read-only job-order and movement context in Demo mode; these are not proof of a Warehouse backend mutation contract.

### Existing functionality reused

| Operation | Status | Method/path | Existing implementation |
|---|---|---|---|
| Inventory/catalog read | NEEDS VERIFICATION | `GET /api/inventory` | Existing inventory service reads `materials` and `finished_goods`; unknown quantities remain distinct from zero |
| Create Stock Request | COMPLETE | `POST /api/stock-requests` | Existing Sales-only transactional workflow; no inventory reservation or deduction |
| List Stock Requests | COMPLETE | `GET /api/stock-requests` | Existing Sales/Warehouse read workflow |
| Review/process Stock Request | COMPLETE | `PATCH /api/stock-requests/:id` | Existing Warehouse-only origin-protected mutation; supports reviewed response or explicit manual quantity update |

The manual update path writes only the observed Warehouse quantities supplied for request lines. It creates stock responses and audit events, updates `materials.quantity_on_hand`, and preserves stock snapshots. It does not add stock, reserve stock, or infer unknown quantities.

### Implemented Warehouse read contract

| Operation | Status | Method/path | Contract |
|---|---|---|---|
| Shipment queue/list | COMPLETE at source/test level | `GET /api/warehouse/shipments` | Warehouse-only read; optional `status` and `orderId`, bounded `limit` 1–100 |
| Shipment detail | COMPLETE at source/test level | `GET /api/warehouse/shipments/:id` | Warehouse-only shipment detail including associated waybill and delivery-receipt metadata |

Shipment reads use `shipments`, `job_orders`, `orders`, `clients`, `delivery_methods`, `waybills`, and `delivery_receipts`. They do not expose file bytes or object-storage paths.

### Missing or blocked Warehouse operations

| Operation | Status | Reason |
|---|---|---|
| Supplier delivery header or receiving record | BLOCKED | No approved receiving contract or material-movement API exists beyond explicit stock-request processing |
| Standalone material quantity update | INCOMPLETE | Warehouse quantity updates exist only as part of an approved Stock Request; no standalone supplier receipt contract is established |
| Shipment preparation/mutation | MISSING | No approved warehouse shipment creation or state-transition contract |
| Waybill creation/printing | BLOCKED | No approved numbering, QR, print-record, or audit contract; Real frontend explicitly reports unavailable |
| Logistics handoff | BLOCKED | Handoff actors, transitions, timestamps, and permissions require approval |
| Delivery receipt generation/handoff | BLOCKED | Schema exists, but numbering and generation/sending lifecycle are not approved |
| Shipment/waybill QR verification | BLOCKED | Frontend scanner behavior is Demo-only; server-side verified waybill contract is absent |

### Warehouse security and business constraints

* Inventory reads require authentication and `inventory:read`.
* Stock Request creation remains Sales-only; processing remains Warehouse-only.
* Shipment read routes require the authenticated Warehouse role and `deliveries:read`.
* The Warehouse API response and its all-shipment read scope remain unchanged; shipment SQL is shared with the separate Logistics-scoped reader.
* Unknown inventory remains unknown; verified zero is preserved as zero.
* No route or service automatically deducts or reserves inventory for inquiries, quotations, POs, or job orders.
* Waybill, shipment status, recipient, QR, and delivery receipt rules are not fabricated or implemented from Demo UI behavior.

## J. Production API investigation and implementation

### Frontend operations found

* Real Production lists persisted Job Orders and retrieves detail/specification data.
* Real Production detail is explicitly read-only and does not start, pause, complete, or revert work.
* Demo Production contains stage advance, revert, pause/resume, completion, and cancellation actions backed by local inquiry state.
* The Demo UI defines nine stage names. A completed cursor represents the handoff state after those nine stages.
* Real Production status and stage mutations are unavailable until an approved server-side state machine exists.

### Existing Production functionality reused

| Operation | Status | Method/path | Existing implementation |
|---|---|---|---|
| List Job Orders | NEEDS VERIFICATION | `GET /api/production/job-orders` | Existing authenticated employee read for Production, Admin, Owner, and Operations; permission `production:read` |
| Retrieve Job Order detail | NEEDS VERIFICATION | `GET /api/production/job-orders/:id` | Existing detail read includes commercial traceability, specifications, due date, status, pause state, and production started state |
| Retrieve Production history | NEEDS VERIFICATION | `GET /api/production/job-orders/:id` | Enhanced existing detail read to expose the stage catalogue and `production_events` history without mutation |

The detail response now includes `stages` and `productionEvents`. It does not expose storage paths or file bytes.

### State-machine findings

The existing project is not sufficient to approve Production mutations:

* `job_orders.status` contains `jo`, `in_production`, `quality_inspection`, `ready_for_dispatch`, and `cancelled`.
* `job_orders.current_stage_cursor` spans 0–9 while `production_stages` is 0–8.
* `production_events.action` permits `done`, `reverted`, `paused`, `resumed`, `completed`, and `cancelled`.
* Frontend Demo behavior is not a server-approved transition contract.
* Historical documentation is inconsistent about whether Owner may mutate Production.
* The authoritative completion, revert, pause/resume, reason, and quality-inspection rules are not established.

Accordingly, no stage/status mutation endpoint was implemented.

### Missing or blocked Production operations

| Operation | Status | Reason |
|---|---|---|
| Advance production stage | BLOCKED | Nine-stage transition order and server authority require approval |
| Revert production stage | BLOCKED | Revert eligibility, target cursor, and required reason require approval |
| Pause/resume Job Order | BLOCKED | Pause reason and resume authority require approval |
| Record quality inspection | BLOCKED | Inspection fields, pass/fail rules, and quality authority require approval |
| Record production completion | BLOCKED | Completion cursor and all-stage prerequisite require approval |
| Cancel Job Order from Production | BLOCKED | Cancellation authority and commercial side effects require approval |
| Production history mutation | BLOCKED | Read history exists; event writes require actor, transition, and reason approvals |

### Production authorization and data conventions

* Job Order reads require an authenticated employee session.
* Existing role middleware permits Production, Admin, Owner, and Operations based on `production:read`.
* Job Order IDs and list query/status values are validated before database access.
* No Production mutation trusts browser state or a supplied actor identity.
* Sales Job Order creation remains unchanged and enforces PO, invoice, quotation, and downpayment prerequisites.
* Warehouse and Accounting behavior remain unchanged.

### Required approvals

* Authoritative nine-stage names and transitions.
* Current status and cursor semantics, including cursor 9.
* Production-only versus Operations/Admin/Owner mutation authority.
* Pause/resume and material-shortage rules.
* Revert and cancellation reason requirements.
* Quality inspection result fields and acceptance criteria.
* Completion and handoff prerequisites.
* Whether Production completion updates inventory or only records production events.

## K. Logistics API investigation and implementation

### Frontend operations found

* The Logistics dashboard derives active/history lists and shipment details from local inquiry data in Demo Mode. Real Mode explicitly excludes Demo records and reports that authenticated logistics reads are unavailable; the UI has not yet been wired to the new API.
* Demo-only controls mark a shipment delivered, edit tracking links, send delivery information/notifications to clients, and stage/submit signed Delivery Receipts. Their Real Mode handlers return without saving.
* Logistics can view recipient, driver/vehicle, waybill, tracking, Delivery Receipt, and signed-receipt presentation data in Demo/local state. It does not generate Delivery Receipts; the component says Accounting must generate them.
* Waybill monitoring/history and scanning/printing belong to the Warehouse-facing UI. Real Mode scanning and printing are disabled; the scanner matches a client-side QR identifier against local Demo data. Logistics has no scanner route or scan persistence contract.
* Search, date filters, active/history navigation, and detail presentation are local UI behavior, not separate API operations.

### Existing delivery reads and boundaries

| Operation | Status | Method/path | Existing implementation |
|---|---|---|---|
| Client-owned delivery read | NEEDS VERIFICATION | `GET /api/client/orders/:id/delivery` | Client portal service scopes the parent order by authenticated `clientId`; returns safe shipment status, tracking reference, and delivery dates |
| Sales order delivery read | NEEDS VERIFICATION | `GET /api/sales/orders/:id/delivery` | Sales orders service returns shipment, waybill, Delivery Receipt, and signed-receipt metadata scoped to the requested Sales order |
| Warehouse shipment list/detail | NEEDS VERIFICATION | `GET /api/warehouse/shipments[/:id]` | Existing Warehouse routes and response contract remain unchanged; shared SQL reader preserves Warehouse role scope |

### Implemented Logistics read contract

| Operation | Status | Method/path | Request → response |
|---|---|---|---|
| List Logistics handoff shipments | COMPLETE at source/test level | `GET /api/logistics/shipments` | Optional `status` (`pending`, `in_transit`, `delivered`, `picked_up`), positive `orderId`, and `limit` 1–100 (default 100) → shipment metadata plus printed waybill and sent-to-Logistics Delivery Receipt references/timestamps |
| Retrieve Logistics handoff shipment | COMPLETE at source/test level | `GET /api/logistics/shipments/:id` | Positive shipment ID → shipment and recipient/driver/pickup metadata, waybill reference/print time, and Delivery Receipt metadata; QR identifiers and file-storage internals are excluded |

Both routes require an authenticated employee with role `logistics` and both `deliveries:read` and `waybills:read`; service-level role/ID validation is also enforced. The list/detail only include records with a waybill `printed_at` and Delivery Receipt `sent_to_logistics_at`, matching the documented handoff signals already used by the Logistics UI. Shipment/order IDs are returned as strings, filters are validated, SQL values are parameterized, responses are `no-store`, and service failures return a generic error while logging the request-scoped failure. The implementation uses the existing shipment reader and the `shipments`, `orders`, `clients`, `job_orders`, `delivery_methods`, `waybills`, and `delivery_receipts` tables.

### Delivery status, dispatch, and mutation findings

The schema defines shipment statuses `pending`, `in_transit`, `delivered`, and `picked_up`. The status column, UI labels, permission `deliveries:update`, and the `shipment_events` table do not define allowed transitions, authorized transition actors, required input/reason fields, or audit semantics. No valid/invalid transition tests or working Logistics mutation route existed. Accordingly, no shipment status, dispatch, delivery progress, recipient/driver, notification, or receipt mutation was implemented. The new API is read-only.

Approval is required for:

* Dispatch/Logistics handoff authority, transition graph, required fields and failure behavior.
* Delivered vs. picked-up completion criteria; attempted/failed, delayed, returned, and exception statuses and required details.
* Whether and how `shipment_events` are written, including actor identity, event values, notes, audit events, and transaction rules.
* Whether Logistics may edit tracking, recipient, driver, or vehicle information.
* Delivery-notification content, recipients, delivery receipts sent to clients, and their idempotency/audit requirements.

### Waybill/QR and receipt findings

* `waybills` records a unique reference, unique `qr_identifier`, shipment relation, and optional print timestamp/actor. The schema does not establish a numbering algorithm, QR payload/signature format, scan endpoint, scan event persistence, or duplicate-scan behavior. The Demo scanner is not an approved QR contract.
* No unauthenticated tracking endpoint or Logistics QR verification endpoint was added. The new Logistics responses omit the QR identifier.
* `delivery_receipts` records a reference, generated timestamp/actor, and sent-to-Logistics/client timestamps/actors. These columns do not approve receipt numbering, generation, dispatch, or resend rules.
* `signed_delivery_receipts` and file-link tables exist. Sales can read order-scoped signed-receipt metadata, but no Logistics-specific receipt upload/submission or secure receipt retrieval route was found. The new Logistics detail returns Delivery Receipt metadata only; it does not expose file IDs, bytes, or storage paths.
* Recipient identity, delivery time, signature/photo evidence, failed-delivery reason, receipt numbering, and retention requirements remain unapproved. No proof-of-delivery workflow was invented.

### Evidence and verification limits

* Logistics service and HTTP tests cover authenticated role/permission access, list/detail reads, invalid IDs and filters, handoff-only SQL predicates, safe waybill/receipt projections, not-found behavior, and absence of mutation routes.
* The focused Logistics plus related Warehouse, Sales Job Order/delivery, Client delivery, and document-workflow tests passed **108/108** (0 failures, 0 skipped).
* Full backend test result: **863 passed, 0 failed, 0 skipped** (`node --test` over all discovered `backend/src` `*.test.js` and `*.test.mjs` files).
* This is source/mock-test evidence only. No live MySQL, authenticated browser, storage, QR device, or delivery-write verification was performed.

## L. Admin frontend integration implementation — 2026-11-18

### Implemented integration

The Admin branch of `src/app/components/UserManagementView.tsx` now routes to the existing real-mode Admin management components through an Admin management hub. This replaces the former local/demo account store for the Admin employee and client-management workflow while preserving Demo Mode for other supported UI previews.

| Admin function | Frontend implementation | Backend route(s) used | Status |
|---|---|---|---|
| Employee listing, retrieval, creation, and information updates | `EmployeeManagement` via `useDirectory` and API-backed detail/edit handlers | `GET /api/admin/employees`, `GET /api/admin/employees/:id`, `POST /api/admin/employees`, `PATCH /api/admin/employees/:id` | PASS at source/test level |
| Employee role assignment | `EmployeeManagement` role action | `POST /api/admin/employees/:id/role` | PASS at source/test level |
| Employee activation/deactivation | `EmployeeManagement` status actions | `POST /api/admin/employees/:id/activate`, `POST /api/admin/employees/:id/deactivate` | PASS at source/test level |
| Client account listing, retrieval, information updates, activation/deactivation | `ClientManagement` via `useDirectory` and API-backed handlers | `GET /api/admin/clients`, `GET /api/admin/clients/:id`, `PATCH /api/admin/clients/:id`, `POST /api/admin/clients/:id/activate`, `POST /api/admin/clients/:id/deactivate` | PASS at source/test level |
| Client-application review | `RegistrationRequests` in `ClientManagement` | `GET /api/client-applications`, `GET /api/client-applications/:id`, existing approve/reject actions | PASS at source/test level |
| Dashboard aggregates | Existing real-mode `AdminDashboard` integration | `GET /api/admin/dashboard` | PASS at source/test level |
| Role metadata and permission display | Existing real-mode `RolesPermissions` integration | `GET /api/admin/roles` | PASS at source/test level |

The integrated components provide loading, retry/error, empty, success, and refresh behavior. Successful mutations dispatch the existing Admin change event so directory data is reloaded from the backend rather than retained only in component state. The real-mode client workflow contains no Admin client-creation action, preserving the rule that clients self-register and Admin registers employee accounts only. Backend authentication, authorization, validation, and privilege checks remain authoritative.

### Credential reset limitation

No persisted Admin credential-reset endpoint or approved security contract was found. The existing password-change flow requires the current credential; the Admin employee UI keeps reset-password behavior demo-only in real mode. No plaintext password storage, credential exposure, or frontend bypass was introduced. A reset workflow remains **MISSING / NEEDS REQUIREMENTS** until recovery identity verification, token/expiry behavior, notification or delivery rules, audit requirements, and authorization are established.

### Verification evidence and limits

* Frontend automated suite: **218 passed, 0 failed, 0 skipped**.
* Production build: **PASS** (`npm run build`; Vite completed successfully; existing large-chunk warning only).
* Full backend suite after the integration: **863 passed, 0 failed, 0 skipped**.
* Admin browser workflow: **BLOCKED before test execution** because the configured harness could not start without `browser-test/recovery/identity.reviewed.json`. This is a missing test fixture, not an application assertion failure. Therefore no authenticated browser or live-MySQL persistence result is claimed here.
* The source and automated tests verify API wiring and response/state handling. Live MySQL, browser persistence after refresh, production storage, and credential-reset behavior remain unverified.

No Owner work was started.

## M. Owner-role verification and implementation — 2026-11-18

### Owner API inventory

| Owner function | Route and method | Authorization and implementation | Result |
|---|---|---|---|
| Read-only employee directory | `GET /api/owner/employees` | Authenticated active employee with role `owner`; employee account type is required; validated search, role, department, status, sort, and pagination; sanitized employee projection only | **PASS** |
| Owner business dashboard aggregates | `GET /api/owner/dashboard` | Authenticated active employee with role `owner`; requires the established `inquiries:read`, `quotations:read`, `orders:read`, `clients:read`, and `reports:read` permissions; uses the existing verified-inquiry, quotation, PO, and payment aggregate service | **PASS** |
| Employee creation/update/status/role mutation | No Owner route | Owner permissions contain no user-management mutation actions; Admin remains the account-management role | **PASS as prohibited** |
| Client account or client-application mutation | No Owner route | Owner has no Admin client-account or application-decision route; backend role gates reject Owner access to Admin APIs | **PASS as prohibited** |
| General Owner reporting, KPI exports, or additional analytics | No approved route or KPI contract | Existing inventory records reporting/analytics as missing; no formulas, filters, export contract, or authoritative data set was established | **MISSING / NEEDS REQUIREMENTS** |

### Confirmed defect fixed

The Owner dashboard frontend previously requested `GET /api/sales/dashboard`, but the Sales router is intentionally restricted to the `sales` role. An authenticated Owner therefore received a 403 response. The frontend now selects `GET /api/owner/dashboard` for Owner sessions; other roles retain their existing Sales dashboard path. The new Owner route is read-only, mounted alongside the existing Owner employee directory, and reuses the established dashboard aggregate contract without changing the permission model or schema.

The Owner employee directory was already integrated with `GET /api/owner/employees` through `ownerEmployeeDirectory.ts` and `useOwnerEmployeeDirectory`. It retains loading, error/retry, filtering, pagination, empty-state, refresh, and sanitized display behavior. No local/demo employee records are used in Real Mode. Owner management views remain read-only and cannot create, edit, assign roles, activate/deactivate, reset credentials, or manage client accounts.

The Owner dashboard does not issue the Sales-only pending-inquiry list request. It displays the authorized aggregate count returned by the Owner dashboard and explicitly identifies the detailed inquiry list as unavailable until an Owner-scoped order-list contract is approved.

### Verification evidence and limits

* Focused Owner backend route/service and frontend integration tests: **19 passed, 0 failed, 0 skipped**.
* Full frontend suite after the implementation and defect fix: **219 passed, 0 failed, 0 skipped**.
* Full backend suite after the implementation: **865 passed, 0 failed, 0 skipped**.
* Production build: **PASS** (`npm run build`; existing large-chunk warning only).
* Automated route tests verify Owner authentication, employee account-type restriction, role denial, required dashboard permissions, dashboard response wiring, and service-failure handling. They use controlled service/database doubles; they are not live MySQL persistence evidence.
* Browser verification remains subject to the existing missing `browser-test/recovery/identity.reviewed.json` fixture. No live browser or production MySQL verification is claimed unless that harness is successfully restored and executed.
* No Owner work beyond this section was started; Operations review has not begun.

## N. Accounting-role verification and frontend integration — 2026-11-18

### Verified Accounting APIs and frontend integration

| Function | Route/method | Authorization and implementation | Status |
|---|---|---|---|
| Issued invoice listing | `GET /api/accounting/invoices` | Authenticated active employee with role `accounting` and `invoices:read`; validates `orderId` and bounded `limit`; returns only sent invoices with amount, required downpayment, due date, and verified amount | **PASS** |
| Invoice detail | `GET /api/accounting/invoices/:id` | Accounting-only, validated ID, sent-invoice projection, credential-free response | **PASS** |
| Payment listing/history | `GET /api/accounting/payments` | Accounting-only with `payments:read`; validates order, invoice, status, and bounded limit; returns submitted/verified amounts, status, dates, references, and proof-file reference | **PASS** |
| Payment detail | `GET /api/accounting/payments/:id` | Accounting-only, validated ID, safe payment projection | **PASS** |
| Payment-proof queue | `GET /api/documents/accounting/payment-proof-queue` | Accounting role plus `payments:read`; returns downpayment proofs and review metadata | **PASS** |
| Secure payment-proof retrieval | `GET /api/documents/accounting/payment-files/:fileId?paymentId=...` | Accounting role plus `payments:read`; parent payment/file ownership is resolved server-side; file response is no-store and inline | **PASS** |
| Verify payment proof | `POST /api/documents/accounting/payments/:id/verify` | Accounting role plus `payments:verify`; origin protection; pending-only decision; exact required-downpayment validation; transactional update and audit | **PASS** |
| Reject payment proof | `POST /api/documents/accounting/payments/:id/reject` | Accounting role plus `payments:verify`; origin protection; required reason; rejected proof remains recorded; transactional update and audit | **PASS** |

The Real Accounting frontend is now implemented in `RealAccounting.tsx` and uses `src/app/api/accounting.ts` for invoice/payment listing and detail retrieval. It provides loading, empty, error, retry, refresh, and detail states and does not read Demo Orders data in Real Mode. `RealPaymentProofQueue` continues to use the authenticated payment-proof queue, secure retrieval URL, and verify/reject mutations; successful decisions update the displayed row and remain backend-persisted. The existing Demo Accounting ledger remains isolated to Demo Mode.

### Accounting workflow boundaries

| Function | Result | Gap or established rule |
|---|---|---|
| Payment status and transaction history | **PASS** | Existing payment records expose pending, verified, and rejected status plus submission/review timestamps and references |
| Downpayment visibility | **PASS** | Required downpayment and verified amount are returned and displayed; verified downpayment does not imply full payment |
| Outstanding balance and credit-cycle detail | **PARTIAL / NEEDS VERIFICATION** | Invoice amount and verified amount are available, but no approved balance-payment lifecycle, credit-term semantics, or due-date formula beyond stored invoice values was established |
| Balance-payment submission/review | **MISSING** | Existing approved upload/review workflow is specifically for downpayment proofs; no balance-payment contract exists |
| Account clearing, receipt editing/generation, Official Receipt issuance | **BLOCKED** | Required states, numbering, actor rules, audit semantics, and persistence contracts remain unapproved |
| Payment reminders | **BLOCKED** | Reminder formula, delivery channel, persistence, cooldown, and audit behavior remain unapproved |
| Accounting dashboard/KPIs/reporting | **BLOCKED** | No approved Accounting KPI definitions or reporting route exists; the Real view shows API-returned record counts only and does not fabricate financial aggregates |

### Verification evidence and limits

* Focused Accounting service, HTTP, document-workflow, and storage tests: **11 passed, 0 failed, 0 skipped**.
* Full frontend suite after integration: **220 passed, 0 failed, 0 skipped**.
* Full backend suite after integration: **865 passed, 0 failed, 0 skipped**.
* Production build: **PASS** (`npm run build`; existing large-chunk warning only).
* Automated tests verify route authentication/role/permission enforcement, validation, bounded parameterized reads, payment-proof upload/storage behavior, and existing review transaction behavior. They use service/database/storage doubles; no live MySQL or production object-storage persistence is claimed.
* Browser verification remains blocked by the missing `browser-test/recovery/identity.reviewed.json` fixture. No authenticated browser persistence result is claimed.
* No Owner or Operations work was started in this Accounting review.

## O. Production API verification and frontend integration — 2026-11-18

### Verified Production API inventory

| Production function | Route and method | Authorization and implementation | Status |
|---|---|---|---|
| Job Order listing | `GET /api/production/job-orders` | Authenticated employee with role `production`, `admin`, `owner`, or `operations`; requires `production:read`; validates search, status, page, and page size; parameterized read from Job Orders and related commercial/specification records | **PASS** |
| Job Order detail | `GET /api/production/job-orders/:id` | Same employee role and permission gate; validates precise ID; returns safe Job Order, quotation/PO traceability, specification, status, and due-date projection | **PASS** |
| Production stage catalogue | Included in Job Order detail response as `stages` | Reads the existing `production_stages` table; no stage names or transitions are invented | **PASS** |
| Production event history | Included in Job Order detail response as `productionEvents` | Reads existing `production_events` with stage labels, action, reason, actor ID, and timestamp; safe projection excludes storage internals | **PASS** |
| Stage/status mutation | No route | Existing requirements do not establish an approved state machine, transition graph, actor rules, required reasons, quality outcomes, pause/resume behavior, or audit contract | **MISSING / NEEDS REQUIREMENTS** |
| Production dashboard/KPIs | No dedicated Production route | No approved Production KPI formulas or aggregate contract exists; Real Mode does not fabricate dashboard quantities | **BLOCKED** |

### Frontend integration

`ProductionRealJobOrders` and `useProductionJobOrders` use the authenticated `GET /api/production/job-orders` and `GET /api/production/job-orders/:id` APIs in Real Mode. The screen includes loading, empty, error, retry, search, status filtering, detail loading, and detail error states. The detail view now displays the backend stage catalogue and production event history, including current-stage highlighting and event reasons/timestamps. Detail retry now re-fetches the selected Job Order detail rather than only refreshing the list.

Production Real Mode remains read-only. It does not advance/revert/pause/resume stages, record inspections, complete production, cancel Job Orders, modify Warehouse inventory, or alter Sales/Accounting records. Demo Production behavior remains isolated in the existing Demo components.

### Business-rule findings

The existing Sales Job Order creation contract remains authoritative: commercial prerequisites and Accounting-verified downpayment are required, and creating a Job Order does not start production. The Production API reads existing references and does not deduct or reserve inventory. No approved state machine or mutation contract was found for stage advancement, correction, quality inspection, rejected output, cancellation, or completion; no placeholder mutation endpoints were added.

### Verification evidence and limits

* Focused Production backend, adapter, and frontend integration tests: **9 passed, 0 failed, 0 skipped**.
* Full frontend suite after integration: **222 passed, 0 failed, 0 skipped**.
* Full backend suite after integration: **865 passed, 0 failed, 0 skipped**.
* Production build: **PASS** (`npm run build`; existing large-chunk warning only).
* Automated tests cover authentication, employee account type, role/permission denial, invalid IDs and filters, safe not-found behavior, parameterized Job Order reads, stage catalogue/event projection, traceability, and frontend API/event-history wiring. They do not establish live MySQL persistence.
* Browser verification remains blocked by the missing `browser-test/recovery/identity.reviewed.json` fixture. No authenticated browser, live MySQL, or production storage verification is claimed.
* No Warehouse, Logistics, Owner, or Operations work was started in this Production review.

## P. Warehouse API verification and frontend integration — 2026-11-18

### Verified Warehouse API inventory

| Warehouse function | Route and method | Authorization and implementation | Status |
|---|---|---|---|
| Inventory listing and stock visibility | `GET /api/inventory` | Authenticated permission-controlled inventory read; Real Mode maps verified database records separately from catalog references and preserves unknown quantities as unavailable rather than zero | **PASS** |
| Stock-request listing/retrieval | `GET /api/stock-requests` | Existing Sales/Warehouse workflow; Warehouse receives authenticated request records and material-line snapshots | **PASS** |
| Stock-request processing | `PATCH /api/stock-requests/:id` | Warehouse-only processing with validated status, complete line coverage, non-negative observed quantities, duplicate/stale checks, and transactional audit | **PASS** |
| Manual inventory update after stock observation | Included in `PATCH /api/stock-requests/:id` with `inventoryUpdates` | Warehouse-only; updates active referenced materials to explicitly observed quantities and does not add requested quantities or reserve stock | **PASS** |
| Warehouse shipment listing | `GET /api/warehouse/shipments` | Authenticated active employee with role `warehouse` and `deliveries:read`; bounded status/order/limit filters; shared shipment reader | **PASS** |
| Warehouse shipment detail | `GET /api/warehouse/shipments/:id` | Same Warehouse authorization; safe shipment, waybill, and delivery-receipt metadata; no storage paths or file bytes | **PASS** |
| Supplier delivery receiving record | No dedicated route | Existing workflow supports manual observed quantities through stock-request processing, but no supplier delivery identity, partial-receipt, discrepancy, duplicate-receipt, or receiving-history contract is established | **MISSING / NEEDS REQUIREMENTS** |
| Warehouse dashboard/KPIs | No dedicated route | No approved Warehouse aggregate definitions or monitoring contract exists | **BLOCKED** |

### Frontend integration

Real Mode inventory already uses `GET /api/inventory` through `MaterialsProvider`, with loading/error/retry states and explicit distinction between authenticated material records, catalog references, zero stock, and unavailable stock. `RealWarehouseStockRequests` uses the existing stock-request list and processing APIs, validates observed quantities, confirms inventory replacement semantics, refreshes inventory after successful updates, and reloads the request list. Demo Mode remains local and separate.

Warehouse shipment reads are now integrated through `warehouseShipments.ts` and `RealWarehouseShipments.tsx`, accessible from the Warehouse inventory screen. The new read-only surface provides shipment listing, detail retrieval, loading, empty, error, retry, refresh, and status/waybill/receipt display states. It does not add delivery execution, tracking, scanning, waybill creation, or Logistics actions; those responsibilities remain outside Warehouse’s supported contract.

### Business-rule findings and remaining gaps

* Unknown inventory remains distinct from verified zero; no catalog import or unapproved 71-material population was added.
* Stock-request processing preserves Sales snapshots and does not silently change quotations, purchase orders, invoices, payments, or Job Orders.
* Manual observed quantity replacement is supported and audited. It is not a supplier receiving ledger.
* Supplier delivery identity, expected-vs-received quantities, partial deliveries, discrepancy resolution, duplicate receiving prevention, receiving documents, and inventory transaction-history semantics require approved requirements before implementation.
* Shipment list/detail reads are compatible with the existing Logistics handoff reader. Warehouse mutations for dispatch, waybill creation/printing/scanning, and delivery status remain missing or blocked by the existing workflow contract.

### Verification evidence and limits

* Focused Warehouse, inventory, stock-request, shipment, and frontend integration tests: **21 passed, 0 failed, 0 skipped**.
* Full frontend suite after integration: **224 passed, 0 failed, 0 skipped**.
* Full backend suite after integration: **865 passed, 0 failed, 0 skipped**.
* Production build: **PASS** (`npm run build`; existing large-chunk warning only).
* Automated tests cover Warehouse role/permission restrictions, invalid requests and quantities, unknown versus zero handling, duplicate/inconsistent stock updates, material integrity, transactional stock-request processing, bounded shipment reads, shipment detail projections, and frontend API wiring. They do not establish live MySQL or production persistence.
* Browser verification remains blocked by the missing `browser-test/recovery/identity.reviewed.json` fixture. No authenticated browser, live MySQL, or production storage verification is claimed.
* No Logistics, Owner, or Operations work was started in this Warehouse review.

## Q. Logistics API verification and frontend integration — 2026-11-18

### Verified Logistics API inventory

| Logistics function | Route and method | Authorization and implementation | Status |
|---|---|---|---|
| Handoff shipment listing | `GET /api/logistics/shipments` | Authenticated active employee with exact role `logistics`; requires `deliveries:read` and `waybills:read`; bounded limit/status/order filters; shared parameterized shipment reader | **PASS** |
| Handoff shipment detail | `GET /api/logistics/shipments/:id` | Same Logistics role and permissions; returns safe shipment, recipient/driver, waybill, and Delivery Receipt metadata without file bytes, QR identifiers, or storage paths | **PASS** |
| Warehouse-to-Logistics handoff eligibility | Applied to both reads | SQL requires a printed waybill and a Delivery Receipt with `sent_to_logistics_at`; shipments outside that handoff queue are not returned | **PASS** |
| Dispatch, pickup, delivery-status, or completion mutations | No route | No approved Logistics transition graph, actor rules, audit contract, or persistence behavior was established | **MISSING / NEEDS REQUIREMENTS** |
| QR scanning/generation and proof of delivery | No Logistics route | Existing UI/demo behavior does not establish a persisted QR/POD contract, document rules, or storage boundary | **BLOCKED** |
| Client tracking and notifications | No Logistics mutation route | Existing client/Sales delivery metadata remains separate; no approved Logistics notification or client-tracking mutation contract was found | **PARTIAL / NEEDS REQUIREMENTS** |
| Logistics dashboard/KPIs | No dedicated route | No approved Logistics aggregate definitions or dashboard contract exists | **BLOCKED** |

### Frontend integration

Real Logistics Mode now uses `logisticsShipments.ts` with `GET /api/logistics/shipments` and `GET /api/logistics/shipments/:id` through `RealLogisticsShipments`. It no longer presents the Demo shipment rows in the Logistics role screen. The API-backed surface provides status filtering, refresh, loading, empty, error, retry, list, detail, and handoff metadata states. Refresh and detail actions re-read the backend, so returned records remain authoritative after page refresh.

The Real surface is explicitly read-only. It does not expose dispatch, delivery-status changes, QR generation, proof-of-delivery upload, or notification actions because those contracts are not established. Demo Logistics workflows remain isolated in Demo Mode. The existing Operations Logistics screen was not changed and no Operations work was started.

### Verification evidence and limits

* Focused Logistics service, HTTP authorization, handoff filtering, detail projection, mutation-boundary, and frontend integration tests: **9 passed, 0 failed, 0 skipped**.
* Full frontend suite after integration: **226 passed, 0 failed, 0 skipped**.
* Full backend suite after integration: **865 passed, 0 failed, 0 skipped**.
* Production build: **PASS** (`npm run build`; existing large-chunk warning only).
* Automated tests cover authentication, exact Logistics role enforcement, both required read permissions, invalid filters, bounded parameterized reads, handoff-only joins, safe detail projection, absence of delivery mutation routes, and frontend API wiring. They do not establish live MySQL or production persistence.
* Browser verification remains blocked by the missing `browser-test/recovery/identity.reviewed.json` fixture. No authenticated browser, live MySQL, or production storage verification is claimed.
* No Owner or Operations work was started in this Logistics review.

## R. Owner re-verification and frontend correction — 2026-11-18

### Owner API inventory

| Owner function | Route and method | Authorization and implementation | Status |
|---|---|---|---|
| Business-wide dashboard aggregates | `GET /api/owner/dashboard` | Authenticated active employee with exact `owner` role and `inquiries:read`, `quotations:read`, `orders:read`, `clients:read`, and `reports:read`; returns established inquiry, quotation, PO, verified-revenue, and monthly verified-revenue aggregates | **PASS** |
| Read-only employee directory | `GET /api/owner/employees` | Authenticated active employee with exact `owner` role; validated search, role, department, status, sort, and pagination; sanitized employee-only projection | **PASS** |
| Role and permission visibility | Included in the existing role/permission metadata surfaces | Owner receives read-only visibility only; no Owner employee mutations, role assignment, account status changes, client management, or credential reset route was added | **PASS / PARTIAL** |
| Employee management mutations | No Owner route | Existing requirements establish the Owner directory as read-only; Admin remains the employee-account management role | **MISSING by design / PASS boundary** |
| General reporting, KPI catalogue, and exports | No Owner-specific route | No approved formulas, data sources, periods, filters, export format, or reporting ownership contract was found; separate Reporting layer remains out of scope | **MISSING / NEEDS REQUIREMENTS** |

### Frontend correction and verification

The Owner dashboard already called `/api/owner/dashboard`, but its Owner KPI cards still displayed local store-derived active-order, production, and revenue values. Those cards now use only the established server aggregates: pending inquiries, quotations sent, purchase orders received, and verified revenue. Unsupported metrics remain unavailable rather than being calculated from Demo/local stores. Existing loading, error, retry, empty monthly-revenue, and permission-aware routing behavior remains in place.

The Owner employee directory remains read-only and API-backed through `/api/owner/employees`, with filtering, pagination, loading, empty, error/retry, refresh, and sanitized employee display states. Owner cannot access Admin management screens or Sales-only inquiry details through this module.

### Owner verification evidence and limits

* Owner-focused service, HTTP, authorization, and frontend tests: **66 passed, 0 failed, 0 skipped**.
* Related role regression tests: **69 passed, 0 failed, 0 skipped**.
* Full frontend suite after correction: **227 passed, 0 failed, 0 skipped**.
* Full backend suite: **865 passed, 0 failed, 0 skipped**.
* Production build: **PASS** (`npm run build`; existing large-chunk warning only).
* Automated tests verify exact Owner role/account-type enforcement, required dashboard permissions, directory validation and projection, API-backed frontend routing, and the removal of local Owner KPI derivation. They do not establish live MySQL persistence.
* Browser verification remains blocked by the missing `browser-test/recovery/identity.reviewed.json` fixture. No authenticated browser, live MySQL, or production storage verification is claimed.
* No Operations or Reporting work was started.

## S. Operations API verification and frontend integration — 2026-11-18

### Operations API inventory

| Operations function | Route and method | Authorization and implementation | Status |
|---|---|---|---|
| Production Job Order monitoring | `GET /api/production/job-orders` | Authenticated employee account with role `operations` included in the explicit role gate; requires `production:read`; bounded search/status/page filters and parameterized persisted Job Order read | **PASS** |
| Production Job Order detail | `GET /api/production/job-orders/:id` | Same Operations authorization; precise ID validation; safe Job Order, stage catalogue, event history, specification, quotation/PO traceability projection | **PASS** |
| Inquiry-rejection history | `GET /api/sales/inquiry-rejections` | Narrow existing exception for `sales`, `owner`, and `operations`; employee account and `orders:read` required; read-only history surface | **PASS** |
| Operations dashboard aggregates | No dedicated Operations route | No approved aggregate endpoint or KPI formula contract exists. Dashboard cannot claim active orders, inventory alerts, or deliveries from disconnected local stores in Real Mode | **MISSING / NEEDS REQUIREMENTS** |
| Inventory visibility | `GET /api/inventory` through the existing Real Inventory integration | Operations has `inventory:read`; Real Inventory preserves authenticated records and unavailable quantities, but no approved Operations alert aggregate exists | **PARTIAL** |
| Delivery/waybill monitoring | No Operations-scoped route | Warehouse and Logistics shipment APIs are role-restricted; no approved Operations delivery/waybill read contract was found | **MISSING / NEEDS REQUIREMENTS** |
| Operations mutations, workflow transitions, and reporting exports | No route | No approved Operations mutation state machine, KPI definitions, or Reporting/export contract exists | **MISSING / NEEDS REQUIREMENTS** |

### Frontend integration

Real Operations Production monitoring now uses the existing authenticated Production Job Order API through `ProductionRealJobOrders`, including list/detail loading, empty, error, retry, search, status filtering, and read-only detail states. The Operations dashboard uses the same API for its supported active-production-job count and does not call the Sales-only dashboard endpoint.

Real Operations dashboard cards for active orders, inventory alerts, and active deliveries now show explicit unavailable states because no equivalent approved Operations API exists. Demo bottleneck issues, local order-derived counts, and inferred delivery/inventory metrics remain Demo-only. Real Inventory remains available through its authenticated inventory integration. Operations has no employee-management, Owner dashboard, delivery mutation, or Reporting access added.

### Verification evidence and limits

* Focused Operations, Production authorization, related role, and frontend tests: **100 passed, 0 failed, 0 skipped**.
* Full frontend suite after integration: **229 passed, 0 failed, 0 skipped**.
* Full backend suite: **865 passed, 0 failed, 0 skipped**.
* Production build: **PASS** (`npm run build`; existing large-chunk warning only).
* `git diff --check`: **PASS**; existing line-ending warnings only.
* Automated tests verify Operations role access to Production reads, denial boundaries, authenticated API-backed Production monitoring, unsupported-metric handling, and preservation of Demo-only bottleneck behavior. They do not establish live MySQL persistence.
* Browser verification remains blocked by the missing `browser-test/recovery/identity.reviewed.json` fixture. No authenticated browser, live MySQL, or production storage verification is claimed.
* Reporting work was not started.

## T. Reporting API review and frontend verification — 2026-11-18

### Reporting implementation inventory

| Reporting function | Route and method | Actual implementation and data source | Status |
|---|---|---|---|
| General reporting API | No `/api/reports` route | No Reporting router, controller, service, query layer, or report response contract exists | **MISSING / NEEDS REQUIREMENTS** |
| KPI summaries | No route | Existing UI labels are backed by local Demo-store calculations in Demo Mode only; no approved KPI formulas, inclusion rules, source tables, or aggregate fixtures are established for Real Mode | **MISSING / NEEDS REQUIREMENTS** |
| Date-range and period filtering | Frontend-only month/year selector in `AnalyticsFullView` | The selector changes Demo-mode calculations; no authenticated Reporting endpoint accepts or verifies period filters | **PARTIAL** |
| Role-scoped report access | No Reporting route | Permission metadata includes `reports:read` for several roles, but no route applies those permissions to report data; no role-scoped dataset contract exists | **MISSING / NEEDS REQUIREMENTS** |
| Report exports | No approved export API | Demo Mode can create local CSV from Demo records; Real Mode refuses export and does not generate a file or claim success | **PARTIAL / BLOCKED** |
| Browser/live persistence reporting verification | Not available | No authenticated Reporting API or live reporting data source is connected; browser fixture is also unavailable | **BLOCKED** |

### Frontend verification

`AnalyticsFullView` remains the existing Reporting/Analytics interface. In Real Mode it explicitly states that live analytics data is unavailable, prevents Demo-store metrics from being shown as live values, preserves unavailable states instead of converting missing data to zero, and refuses report export with an unavailable message. The existing month/year controls remain present for navigation and Demo Mode but are not represented as authenticated server filters.

No Reporting API, query, export format, KPI formula, financial calculation, forecasting algorithm, or new permission was added because the repository does not establish the required definitions. Existing Owner and Operations screens continue to use only their separately verified role APIs; no completed role implementation was reopened.

### Verification evidence and limits

* Focused Reporting frontend and permission checks: **78 passed, 0 failed, 0 skipped**.
* Full frontend suite: **229 passed, 0 failed, 0 skipped**.
* Full backend suite: **865 passed, 0 failed, 0 skipped**.
* Production build: **PASS** (`npm run build`; existing large-chunk warning only).
* `git diff --check`: **PASS**; existing line-ending warnings only.
* Automated verification confirms the absence of a Reporting route and verifies Real Mode unavailable/export boundaries. It does not establish live MySQL, browser, or production storage reporting behavior.
* Browser verification remains blocked by the missing `browser-test/recovery/identity.reviewed.json` fixture.
* Reporting remains **MISSING / NEEDS REQUIREMENTS** pending approved KPI definitions, authoritative source tables, date-window semantics, role/data scopes, and export requirements.

## U. Original frontend restoration corrections — 2026-11-19

The frontend audit found that successful API/source tests did not prove preservation of the original UI. Real Mode bypassed original Accounting, Logistics, Production, and Operations pages; dashboard integrations in a Sales component copy were not reached by Owner/Operations routing. Stock Requests also exposed submission while no recorded materials were selectable.

Original role page routing/layouts have been restored and API reads adapted within them. Accounting and Logistics retain existing API record panels embedded in their original pages. Production uses the original cards and details drawer; Operations uses its original monitoring page. Owner's reachable Analytics page now reads `GET /api/owner/dashboard`; Operations' original Dashboard reads `GET /api/production/job-orders`. No endpoints, permissions, calculations, or schemas were added.

Stock Requests uses the existing `GET /api/inventory` material identities and `GET/POST /api/stock-requests` contracts. Controls require selectable database materials, a current order, and a valid quantity. Unavailable inventory, empty request history, mutation errors, and uncertain outcomes are distinct. No stock reservation/deduction or catalog population was introduced.

Latest recovery verification supersedes the earlier frontend test claim: the repository-reviewed 35-file frontend suite reports **228 tests, 184 passed, 44 failed, 0 skipped**; frontend API adapters **48 passed, 0 failed**; restoration-focused role/regression tests **59 passed, 0 failed**; production build **PASS** (2,709 modules); `git diff --check` **PASS**. The 44 frontend failures are not fully triaged; many appear to assert pre-refactor source locations, but they remain unresolved. Browser/live MySQL and visual equivalence remain **NEEDS VERIFICATION / BLOCKED** by the absent reviewed identity fixture. See `ENTER_FLOW_V2_FRONTEND_RESTORATION_CORRECTIONS_2026-11-19.md` for per-role findings, files, supported boundaries, list limits, and remaining requirements.
