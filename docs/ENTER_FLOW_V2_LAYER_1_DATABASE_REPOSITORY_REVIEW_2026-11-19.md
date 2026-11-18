# ENTER-FLOW V2 — Layer 1 Database and Repository Review

Date: 2026-11-19  
Scope: database and data-access layer only  
Source of requirements: `docs/ENTER_FLOW_V2_LAYER_0_BACKEND_API_INVENTORY_2026-11-18.md`

## Scope and restrictions

This review covered the database connection/configuration, schema documentation, migrations 001–006, database support utilities, current backend SQL/data-access services, and database-focused tests. Migration 007 was not inspected, modified, or executed. No migration, schema, seed, production-data, route, controller, frontend, or service-business-rule change was made.

The existing worktree was preserved, including all pre-existing modified and untracked files.

## 1. Database architecture reviewed

### Connection and runtime configuration

`backend/src/config/database.js` creates the MySQL pool using the validated runtime configuration, repository-root-relative CA loading, configured TLS identity, bounded pool settings, timezone, and BIGINT/DECIMAL-safe options (`supportBigNumbers`, `bigNumberStrings`, `decimalNumbers: false`). `testDatabaseConnection()` is read-only and returns only database name and server version.

The connection layer does not implement repositories or domain logic. Services acquire and release pool connections directly, use parameterized `execute()` calls, and implement transactions locally where a mutation requires atomicity.

### Schema and relationship groups

The reviewed schema documentation and migrations 001–006 define the following table groups:

| Group | Tables and relationships | Layer 1 assessment |
|---|---|---|
| Identity and access | `roles`, `modules`, `role_modules`, `clients`, `users`, `client_applications`, `user_sessions`, `audit_events`; users reference roles/clients and client-account uniqueness is enforced by migration 006 | **IMPLEMENTED** for existing authentication, registration, Admin account lifecycle, and session operations |
| Reference/catalog | `payment_terms`, `filter_types`, `material_categories`, `units`, `order_stages`, `delivery_methods`, `production_stages` | **IMPLEMENTED** as lookup structure; future additions require approved seed/schema work |
| Client and Sales workflow | `orders`, `order_items`, `product_specifications`, `quotations`, `quotation_references`, `quotation_lines`, `quotation_costing`, `quotation_bom_lines`, `quotation_discounts`, `quotation_addons`, `purchase_orders`, `order_requests`, `document_sequences` | **IMPLEMENTED / PARTIAL** depending on the Layer 0 operation; relationships preserve client/order and historical quotation snapshots |
| Production | `job_orders`, `job_bom_lines`, `production_events`, `replacement_requests` | **IMPLEMENTED** for read-only Job Order/detail/history paths; **BLOCKED** for unapproved production transitions and replacement policy decisions |
| Inventory and Warehouse | `materials`, `material_movements`, `material_changes`, `finished_goods`, `finished_good_movements`, `finished_good_order_items`, `stock_requests`, `stock_request_lines`, `stock_responses`, `stock_response_lines`, `quotation_stock_responses` | **IMPLEMENTED / PARTIAL** for inventory reads, stock-request processing, movement/audit support; supplier receiving ledger and other unapproved workflows are not modeled |
| Logistics and delivery | `shipments`, `waybills`, `shipment_events`, `delivery_receipts`, `signed_delivery_receipts`, `invoice_delivery_receipts` | **IMPLEMENTED / PARTIAL** for existing read projections and established document/payment links; dispatch, QR, POD, and status transitions remain unapproved |
| Billing and payments | `invoices`, `payments`, `payment_instructions`, `company_settings`, `company_payment_methods` | **IMPLEMENTED / PARTIAL** for existing invoice/payment reads, proof review, and established prerequisites; balance-payment, receipt, reminder, and clearing policies remain incomplete |
| Attachments | `files`, `order_files`, `specification_files`, `quotation_files`, `purchase_order_files`, `job_order_files`, `payment_files`, `invoice_files`, `waybill_files`, `delivery_receipt_files`, `replacement_request_files` | **IMPLEMENTED** for existing typed parent links and secure metadata/storage workflows; missing approved retrieval/lifecycle contracts remain blocked |
| Notifications | `notifications`, `notification_roles`, `notification_recipients` | **IMPLEMENTED / PARTIAL** for existing scoped reads and established writes; unsupported cross-role notification behavior remains outside this layer review |
| Reporting sources | Existing orders, quotations, POs, Job Orders, inventory, shipments, invoices, and payments contain source records | **PARTIAL**: no Reporting repository/API contract defines approved formulas, periods, scopes, or exports |

The schema uses InnoDB, restrictive foreign-key behavior, BIGINT identifiers, explicit nullable timestamps for events that have not occurred, composite ownership keys in child records, unique keys for references/idempotency where established, and checks for quantities/status-specific invariants. Unknown inventory quantities remain nullable/unknown and must not be converted to zero by data access code.

## 2. Repository/data-access architecture

No `backend/src/repositories` package, repository manifest, or repository interface exists. Current data access is implemented inside the Layer 2 service modules through direct parameterized SQL. This is an architectural boundary finding, not a confirmed defect: introducing a new repository abstraction would be a broad refactor and would move beyond verification without an approved repository contract.

Existing data-access modules reviewed include:

- identity/authentication/session/password/registration and Admin services;
- Client inquiry and portal services;
- Sales clients, orders, quotation/PO, dashboard, notification, cancellation, and delivery reads;
- Accounting invoice/payment reads and document workflow services;
- Production Job Order reads;
- inventory and stock-request services;
- shared Warehouse/Logistics shipment reader;
- Owner employee directory and dashboard aggregate reads;
- document storage metadata and typed file-link queries.

The current modules generally use bound parameters, explicit projections, string-safe BIGINT casts, connection release in `finally`, and transactions for established multi-table writes. Unit tests use database doubles to verify SQL shape, parameters, rollback, and projection behavior. These tests are not live MySQL persistence tests.

## 3. Layer 0 operation-to-schema/data-access mapping

| Role / operation family | Existing schema support | Existing data-access support | Classification |
|---|---|---|---|
| Client self-registration and account ownership | `client_applications`, `clients`, `users`, unique identity keys, migration 006 client-account uniqueness | Registration, client-application, auth, and client-portal services | **IMPLEMENTED** |
| Client inquiry, quotation decisions/revisions, PO metadata, orders, payments, invoices, Job Orders, delivery reads | Orders and typed child/history/document/payment tables with client/order composite ownership | Client inquiry/portal, document, and delivery services | **IMPLEMENTED / PARTIAL**; delivery documents and balance-payment lifecycle remain requirements gaps |
| Sales client/order/quotation/PO workflow and read-only stock availability | Orders, quotation snapshots, POs, stock requests/responses, materials/BOM references | Sales services and stock-request service | **IMPLEMENTED / PARTIAL**; downstream lifecycle transitions are intentionally limited by approved contracts |
| Admin employee account CRUD/status/role and client-account/application management | `users`, `roles`, `clients`, `client_applications`, `user_sessions`, `audit_events`, uniqueness/checks | Admin service with transactional account/status/role handling | **IMPLEMENTED**; Admin does not create client accounts |
| Accounting invoice/payment/proof reads and payment verification | `invoices`, `payments`, `payment_files`, `invoice_delivery_receipts`, audit tables | Accounting/document-workflow services | **IMPLEMENTED / PARTIAL**; receipt issuance, balance payments, reminders, and clearing require approved behavior |
| Production Job Order reads/history/specification traceability | `job_orders`, `job_bom_lines`, `production_events`, related quotation/PO/specification tables | Production Job Order service | **IMPLEMENTED** for reads; **BLOCKED** for stage mutation/state-machine behavior |
| Warehouse inventory, stock observation, stock-request processing, shipment reads | Materials/movement/audit and stock-request response tables; shipments/waybills | Inventory, stock-request, and shared shipment-reader services | **IMPLEMENTED / PARTIAL**; supplier receiving and dispatch/waybill mutation contracts remain unresolved |
| Logistics handoff shipment reads | `shipments`, printed `waybills`, handed-off `delivery_receipts`, document metadata | Shared shipment reader with handoff joins | **IMPLEMENTED** for read-only handoff queue; delivery mutation/POD/QR behavior is not established |
| Owner employee directory and established dashboard aggregates | `users` plus existing order/quotation/PO/payment source tables | Owner directory and dashboard data-access services | **IMPLEMENTED** for current read contract; general reporting is not a repository/API contract |
| Operations Job Order monitoring and rejection-history reads | Job Order/event tables and order-request/audit data | Production Job Order reader and narrow Sales rejection-history read | **IMPLEMENTED** for supported reads; Operations aggregate dashboard, delivery monitoring, and workflow mutations are not established |
| Reporting and exports | Source tables exist, but no report definitions or report-owned tables are required by approved requirements | No Reporting repository/service/API exists | **BLOCKED / NEEDS REQUIREMENTS** |

## 4. Integrity and transaction findings

- Foreign keys and composite ownership keys support the established client/order/Job Order/shipment/payment relationships without relying on application-only parent checks.
- Unique constraints support established duplicate prevention for account identities, employee numbers, document references, one client account per company, one invoice per order, one shipment per Job Order, one waybill per shipment, one Delivery Receipt per shipment, and idempotent payment/material operations where defined.
- Quantity and monetary checks exist for the reviewed material, stock-request, Job Order BOM, invoice, and payment records. They do not establish unapproved lifecycle policy by themselves.
- Existing mutation services retain transaction boundaries for account lifecycle, registration, client-application decisions, stock-request processing, payment review, quotation preparation, Job Order creation, and cancellation decisions. No repository-level transaction wrapper was added because transactions currently belong to the service operation boundary.
- Nullable fields correctly represent not-yet-occurred events or unknown values in the reviewed projections. No repository correction was necessary to prevent unknown stock from becoming zero.
- No live MySQL persistence test was run. Existing tests use doubles and previously recorded validation artifacts; no database migration, seed, import, or production-data operation was executed during this review.

## 5. Changes made

No repository, schema, migration, route, controller, service, or frontend code was changed. No new repository functions were added because the project has no established repository interface and the approved Layer 0 contracts are already implemented through current service data-access modules or explicitly classified as incomplete/blocked.

This report is the only Layer 1 artifact added. The Layer 0 inventory was not changed because its current role/reporting classifications already identify the relevant API and requirements gaps.

## 6. Verification evidence

- Database-focused permitted tests: **62 passed, 0 failed, 0 skipped**. These covered baseline metadata/read-only verification, employee provisioning transaction doubles, password-input handling, and material-catalog reconciliation without populating the catalog.
- Full backend suite: **865 passed, 0 failed, 0 skipped**.
- No migrations were run; Migration 007 was not inspected or executed.
- No live MySQL persistence, production storage, or browser verification is claimed.

## 7. Explicit approval requirements

The following require approved Layer 0/requirements decisions before database or repository implementation:

1. A repository abstraction and transaction contract, if the project wants to separate SQL from current service modules.
2. Production stage transition, pause/resume, inspection, rejected-output, completion, and replacement policies.
3. Warehouse supplier receiving identity, partial receipts, discrepancies, receiving history, and inventory transaction semantics.
4. Logistics dispatch, pickup, delivery completion, QR/POD, notification, and client-tracking persistence behavior.
5. Accounting balance payments, receipt/clearing lifecycle, reminders, and financial inclusion rules.
6. Reporting KPI formulas, authoritative source records, date windows, role scopes, and export formats.
7. Any schema change needed for the above items after requirements are approved.

**Stop condition satisfied: Layer 2, Layer 3, frontend integration, and later implementation work were not started.**
