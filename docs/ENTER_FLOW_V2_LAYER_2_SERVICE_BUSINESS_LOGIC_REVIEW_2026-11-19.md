# ENTER-FLOW V2 — Layer 2 Service and Business Logic Review

Date: 2026-11-19  
Scope: backend services and business logic only  
Source requirements: Layer 0 API inventory and Layer 1 database/repository review

## Scope restrictions

This review covered existing backend service modules and their service-level tests across all nine roles plus Reporting dependencies. No API routes/controllers, frontend components, database schema, migrations, seeds, repository abstraction, or production data were changed. Migration 007 was not inspected, modified, or executed.

## 1. Service inventory and verified logic

| Domain / role | Services reviewed | Established behavior verified | Status |
|---|---|---|---|
| Client | `client-inquiry.service`, `client-portal.service`, `client-applications.service`, `registration.service`, `document-workflows.service`, `engineer-sketch.service` | Client self-registration/application flow, authenticated ownership, inquiry validation, quotation decisions/revisions, PO metadata, payment-proof handling, cancellation rules, secure document ownership, and bounded reads | **IMPLEMENTED / PARTIAL** |
| Sales | `sales-clients.service`, `sales-orders.service`, `sales-dashboard.service`, `sales-notifications.service`, `sales-cancellation.service`, document/delivery services, `stock-requests.service` | Server-side quotation costing from approved BOM/material snapshots, 20%/50% downpayment validation, PO prerequisites, invoice/verification/JO prerequisites, read-only stock availability, cancellation decisions, dashboard verified-payment aggregation, and transactional writes | **IMPLEMENTED / PARTIAL** |
| Admin | `admin.service`, `client-applications.service`, auth/session/password services | Employee-only account registration, duplicate identity handling, safe projections, role/status controls, session revocation, client-account management without client creation, application review, role metadata, and dashboard aggregation | **IMPLEMENTED** |
| Accounting | `accounting.service`, `document-workflows.service` | Authenticated invoice/payment reads, bounded filters, payment-proof queue, secure file retrieval, and established payment-review transaction behavior | **IMPLEMENTED / PARTIAL** |
| Production | `production-job-orders.service` | Authenticated Job Order list/detail, stage catalogue, event history, specification and quotation/PO traceability; no unsupported production transitions | **IMPLEMENTED for reads / BLOCKED for mutations** |
| Warehouse | `inventory.service`, `stock-requests.service`, `warehouse.service`, shared shipment reader | Inventory reads, unknown-versus-zero handling, stock-request snapshots and transactional Warehouse observation, manual quantity replacement, and shipment metadata reads | **IMPLEMENTED / PARTIAL** |
| Logistics | `logistics.service`, shared `shipment-read.service` | Authenticated handoff-only shipment list/detail requiring printed waybill and Delivery Receipt sent to Logistics; safe metadata projection | **IMPLEMENTED for reads / BLOCKED for mutations** |
| Owner | `owner-employee-directory.service`, `sales-dashboard.service` used by Owner dashboard route | Read-only employee directory and established business aggregates for inquiries, quotations, POs, verified revenue, and monthly verified revenue | **IMPLEMENTED / PARTIAL** |
| Operations | Production Job Order service and narrow Sales rejection-history read | Operations employee access to supported Job Order monitoring and rejection-history reads; no invented Operations KPI or workflow mutation logic | **IMPLEMENTED for supported reads / PARTIAL** |
| Reporting | No Reporting service | Existing Demo analytics calculations remain frontend-only; no approved server report definition, formula, period contract, or export service exists | **MISSING / NEEDS REQUIREMENTS** |

## 2. Business rules and transaction boundaries

The reviewed services enforce the established rules below:

- Admin creates employee accounts; clients self-register through the client application flow.
- Client and order ownership is taken from authenticated server identity, not caller-supplied ownership fields.
- Quotation costing uses server-side quotation/BOM/material-price data and preserves historical snapshots.
- Only the established 20% and 50% downpayment choices are accepted.
- PO processing and Job Order creation verify accepted/latest quotation, validated PO, issued invoice, verified downpayment, and quantity consistency before writes.
- Creating a Job Order does not advance production or deduct/reserve inventory.
- Sales stock availability is read-only; unknown inventory remains distinct from verified zero.
- Warehouse stock processing replaces manually observed quantities and records the established audit/movement behavior; it does not silently add requested quantities or create an unapproved supplier ledger.
- Accounting owns payment verification. Verified downpayment is not treated as full payment.
- Logistics and Production mutation state machines remain unimplemented because transition, actor, audit, and persistence rules are not approved.
- Client quotation decisions, revisions, cancellation requests, Sales cancellation decisions, account lifecycle operations, stock-request processing, payment review, and Job Order creation retain explicit transaction/rollback handling and duplicate/stale guards where the requirements establish them.

No service was changed because no confirmed defect was reproduced and no missing operation had sufficiently defined behavior beyond the existing implementation.

## 3. Reporting and aggregate dependencies

The existing `sales-dashboard.service` computes only the established aggregate contract: pending inquiries, quotations sent, purchase orders received, verified revenue, and monthly verified revenue grouped by `paid_on`. It uses server-side order/payment records and does not expose a general Reporting API.

Owner reuses that established aggregate service through its Owner-specific route with additional Owner authorization. No service was added for executive KPI formulas, receivables aging, forecasts, delivery performance, inventory alerts, report periods, or exports because those definitions remain unapproved.

## 4. Unsupported or incomplete business logic

The following remain **MISSING / PARTIAL / BLOCKED / NEEDS REQUIREMENTS**:

1. Production stage advancement, pause/resume, inspection, rejected output, completion, and replacement workflows.
2. Warehouse supplier receiving identity, partial delivery/discrepancy handling, receiving history, and a separate receiving ledger.
3. Logistics dispatch, pickup, delivery completion, QR scanning/generation, proof-of-delivery upload, and delivery notifications.
4. Accounting balance-payment submission, receipt issuance, account clearing, reminders, and their audit/state rules.
5. Owner and Operations KPI definitions beyond the established Owner dashboard aggregate contract.
6. General Reporting calculations, date-window semantics, role-scoped datasets, and exports.

These gaps may require future approved business rules and, in some cases, schema support. They were not guessed or implemented in Layer 2.

## 5. Verification evidence

- All backend service-level tests: **365 passed, 0 failed, 0 skipped**.
- Full backend test suite: **865 passed, 0 failed, 0 skipped**.
- Service tests cover valid/invalid inputs, ownership and role boundaries, duplicate/stale handling, costing/prerequisites, transaction commit/rollback, payment verification, inventory integrity, shipment handoff filtering, and safe projections.
- No live MySQL persistence verification was performed. Service tests use controlled database doubles unless separately identified as integration tests.
- No migrations, seeds, imports, schema changes, or production-data modifications were performed.
- `git diff --check`: **PASS**; existing line-ending warnings only.

## 6. Files changed and approval requirements

Only this Layer 2 review document was added. Existing uncommitted implementation work was preserved. No service code, route/controller, frontend, database, or repository file was changed.

Explicit approval is required before implementing the blocked workflows or introducing new calculations, state machines, permissions, schema support, or Reporting contracts.

**Stop condition satisfied: Layer 3, frontend integration, and later layers were not started.**
