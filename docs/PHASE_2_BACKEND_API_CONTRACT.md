# Phase 2 backend API compatibility contract

2026-11-23, Asia/Singapore. Backend contract for Part 2; frontend integration and runtime activation are separate. See [completion evidence](PHASE_2_PART_2_BACKEND_COMPLETION_REPORT.md).

## Shared conventions and security

Existing `/api/auth`, `/api/client`, `/api/sales`, `/api/documents`, `/api/accounting`, `/api/inventory`, `/api/stock-requests`, `/api/production`, `/api/warehouse`, `/api/logistics`, `/api/admin`, and `/api/owner` mounts remain. The additional operations below are mounted at `/api/phase2`.

Protected routes require the existing session cookie, active database identity, role and permission checks. Initial-password accounts must change their password before business operations. Writes require the configured trusted Origin. Multipart routes use the existing upload middleware. Do not send actor/user/role/client ownership in business bodies: the server derives them from authentication and revalidates write authority in the transaction. Client resources are scoped through `client_user` and the inquiry's client, including document downloads.

Success responses retain `{success:true,data:...}` where used by existing controllers; failures return a safe code/message and, for validation, field errors. Service factories remain compatible imports. Database IDs are decimal strings, including values beyond JavaScript's safe integer range. Monetary/decimal values use decimal strings and fixed-point calculation; do not convert IDs or totals through floating point. Date fields use real `YYYY-MM-DD` dates. Unknown inventory quantities remain `null`, with provenance/status; they are not zero.

Stored payment terms are exactly `NET15` and `NET30`. Corresponding `paymentTermLabel` values are `15-Day Terms` and `30-Day Terms`. Invalid codes/labels are rejected; supported display labels are normalized at input boundaries. There is no payment-terms lookup table.

## Inquiry, quotation and requests

`POST /api/client/orders` retains validated inquiry fields and item specifications. A configured active `filterTypeId` is required for each applicable item; specifications are stored in numeric columns and template JSON. Sketch submissions use the existing `/api/documents/client/inquiries` multipart route and submission-key status lookup. The server produces references without a legacy sequence table. Sketch document references are real `document` IDs.

`POST /api/sales/orders/:id/quotations` accepts:

```json
{
  "status": "draft",
  "baseQuotationId": null,
  "issuedOn": "2026-11-23",
  "validUntil": "2026-12-23",
  "paymentTermCode": "NET15",
  "timeOfDelivery": "Approved delivery lead time",
  "placeOfDelivery": "Agreed delivery location",
  "note": "Optional quotation note",
  "noteHighlighted": true,
  "downpaymentPercent": 20,
  "vatType": "Exclusive",
  "vatRate": "12",
  "includeLabor": true,
  "applyMarkup": true,
  "applyVat": true,
  "discountPercent": "0",
  "costing": [{
    "orderItemId": "123",
    "uomId": "10",
    "laborCost": "25.0000",
    "markupPercent": "10",
    "materials": [{"rawMaterialId": "456", "qtyPerFilter": "0.1250", "uomId": "10"}]
  }]
}
```

IDs above illustrate the shape only; use actual configured records. An optional unique `reference` is supported. `status` is `draft` or `sent`; VAT types are `Exclusive`, `Inclusive`, `Zero-Rated`. A replacement revision supplies the current `baseQuotationId`; stale bases fail. Costing must explicitly cover inquiry items and configured units/material quantities. Material prices must already be approved, with approval provenance. The server does not invent a BOM, price, unit, or material. Previous revisions and item/cost snapshots remain intact; only one quotation is current. Highlighted notes persist as `quotation.highlight_tag='NOTE'` and read back as `noteHighlighted`.

Downpayment is exactly 20% or 50%, calculated from the resulting total with fixed-point rounding. An explicitly fully discounted zero total remains zero; it does not fabricate a positive payment. Costing is internal and is excluded from Client projections. Client quotation history hides unsent drafts/approved-but-unsent quotations.

`POST /api/phase2/sales/orders/:id/quotations/:quotationId/approval` accepts `{ "send": false }` or `{ "send": true }` and requires Sales quotation approval permission. Client decisions remain `POST /api/client/orders/:id/quotations/:quotationId/decision`, with `decision` accepted/rejected (accept/reject aliases retained) and a reason for rejection. Only current, sent, unexpired quotations are eligible.

Quotation revision requests remain `POST /api/client/orders/:id/quotation-revision` with `{ "reason": "..." }`. The server resolves the current sent quotation. Sales review is `POST /api/phase2/sales/orders/:id/revisions/:requestId/review` with `decision: approved|rejected` and optional `reviewNote`; rejection requires `reason` or `reviewNote`. Approval records the request decision; creating/sending a new quotation is an explicit subsequent action.

Cancellation submission remains `POST /api/client/orders/:id/cancellation` with `reason`, `termsAcknowledged:true`, and optionally either `quotationId` or `purchaseOrderId`. Pending uniqueness is enforced. Existing Sales `/api/sales/orders/:id/cancellation/:requestId/accept` and `/decline` routes remain. Rejection requires a reason/review note; actual persisted request states are `pending`, `approved`, `rejected`. An approved cancellation also cancels the inquiry transactionally after eligibility checks; declined requests preserve inquiry state. Confirmed downpayment or a JO blocks approval. Pending proof alone is not confirmed money.

Sales inquiry rejection requires the detail response's current `revision` hash and a reason. Pending cancellations participate in that hash. A stale revision fails. Rejection finalizes pending cancellations as rejected with reviewer/time/note and preserves history.

## PO, invoice and JO

Client PO JSON submission at `/api/client/orders/:id/purchase-order` requires `reference`, `quotationId`, `documentId`, `deliveryMethodId`. The document must already be available and owned; arbitrary storage paths are forbidden. The multipart `/api/documents/client/orders/:id/purchase-order` route uploads the actual file and accepts configured `deliveryMethodId`, reference and optional matching quotation ID. Both require the current accepted quotation and inherit its canonical payment terms. A rejected PO can be resubmitted only before invoice/JO creation; prior PO evidence is preserved.

Sales PO processing remains `/api/sales/orders/:id/purchase-order/process`, with `decision:validated|rejected` and rejection reason. Decisions are audited. Invoice issuance remains `/api/sales/orders/:id/invoice` and requires a validated PO.

`POST /api/sales/orders/:id/job-orders` requires explicit `poVerified:true`, `specsVerified:true`, `termsVerified:true`, and `dueDate` (`productionDueDate` alias retained). It requires the validated PO/current accepted quotation, issued invoice, confirmed downpayment and configured production stages. It creates one JO header with item snapshots and stages; it does not deduct stock. Result is `{orderId,acceptedQuotationId,purchaseOrderId,jobOrders:[...]}`. Reads retain `{orderId,jobOrders}` and delivery `{orderId,shipments,waybills,deliveryReceipts}` containers.

The Phase 2 schema has no quotation-to-uploaded-file association. Quotation reads do not manufacture a quotation PDF/file ID. Existing supported private document routes cover sketches, PO files, payment proofs and delivery documents. Adding a persistent quotation-file relationship needs separate schema/product approval.

## Proofs, payments and documents

`POST /api/documents/client/orders/:id/payment-proof` accepts multipart invoice ID, positive amount, active payment method ID (or exact configured method name), optional note/reference, and one to five validated proof files. A submission creates `proof_of_payment` and file/document links, not confirmed money. Multiple files do not multiply payment amounts.

Existing `/api/documents/accounting/payments/:id/verify` and `/reject` routes remain. The additional `/api/phase2/accounting/proofs/:id/review` accepts `{decision:"verified"|"rejected",reason?:"..."}` and optional `Idempotency-Key`; rejection requires a reason. Verification defaults to a deterministic proof key when no key is supplied, supports partial amounts within the outstanding balance, inserts one approved payment transaction, and updates invoice state atomically. A repeated matching key/proof verification returns the original transaction; finalized decisions cannot be edited. Downloads check business parent, role and ownership before reading private bytes.

The existing GCS provider remains. Uploads validate size, MIME, extension, signatures, safe keys and SHA-256, and record object generation. Metadata becomes available only after storage acknowledgement. Known failures compensate confirmed staged objects; ambiguous commits retain them for reconciliation. General upload compensation does not guarantee cleanup after process termination. Sketch submission separately maintains the existing durable pre-upload journal and status lookup. Live GCS connectivity was not exercised in this task.

## Inventory, production and delivery

Inventory writes accept configured category/unit IDs and explicit fields; price approval/provenance fields are not writable through ordinary maintenance. Explicit stock observations require a reason and append stock movement records where a confirmed quantity exists. Unknown/provisional starting values are not silently converted to zero. Invalidating a quantity to unknown is audited; a movement requiring non-null ending quantity is not fabricated. Read-only availability and stock requests never reserve or deduct stock. `responded` records observations; `updated` additionally requires consistent explicit inventory updates and reasons.

Additional operations under `/api/phase2`:

| Method/path | Body and behavior |
| --- | --- |
| `POST /production/job-orders/:id/stages` | `stageId` is a JO-stage ID; `action:start|complete|revert`; revert requires reason. Sequential stages, append-only events; no revert after delivery allocation. |
| `POST /production/plans` | `jobOrderId`, unique `planCode`, integer `quantity`, `weekStartDate`, `weekEndDate`, optional boolean `rush`. Total planned quantity cannot exceed JO quantity. |
| `POST /production/shortages` | `jobOrderId`, optional owned JO `stageId`, `materialId`, positive decimal `quantity`, `description`. |
| `POST /warehouse/deliveries` | `jobOrderId`, active `deliveryMethodId`, `items:[{jobOrderItemId,quantity}]`, optional estimated date/driver/contact/plate/tracking link. Ready JO and remaining quantity required. |
| `POST /warehouse/deliveries/:id/waybill` | `printed:true` records explicit print acknowledgement; does not imply an external courier call. |
| `POST /documents/deliveries/:id` | Accounting/Logistics multipart upload, scoped to the destination delivery by audit evidence. |
| `POST /accounting/deliveries/:id/receipt` | `documentId`, optional boolean `handoff`; handoff requires available receipt and printed waybill. |
| `PATCH /logistics/deliveries/:id` | `status`, optional `receivedBy`/`trackingLink`; only valid post-handoff transitions. Full delivery starts the NET15/NET30 invoice clock. |
| `POST /logistics/deliveries/:id/signed-receipt` | `documentId`; available scoped document and completed delivery required. |
| `GET /documents/deliveries/:id/files/:fileId` | Private authenticated, parent-scoped download; generation-aware storage read. |

Production detail includes items, stages, events/productionEvents, PO trace, plans and shortages. Rush changes priority without skipping stages. Delivery methods must be configured for Lalamove, company vehicle or pickup as approved; there is no automated courier integration claim. Logistics cannot read a delivery before its recorded handoff. Client tracking excludes internal driver/actor/cost/storage details.

## Notifications, reporting and administration

`GET /api/phase2/notifications` and `PATCH /api/phase2/notifications/:id/read` are per-user and enforce the existing notification permissions. The original matrix is unchanged: Client can read/update; Sales can read; other employee roles have no notification grant. A broader employee inbox/read-state feature needs explicit RBAC approval. Existing Client and Sales notification paths remain.

`GET /api/phase2/reference-data` returns actual active configured references and the two payment-term labels. It requires an existing orders/inventory/production/deliveries read grant. Missing lists remain empty; writes report missing prerequisites. `GET /api/phase2/reports/summary` requires reports read permission and aggregates actual invoices and approved payments independently of file joins.

Administration revalidates active Admin authority, preserves the initial Admin's protected identity/self-access, serializes identity uniqueness, revokes sessions for relevant identity/role/status/password changes, and writes audits. Employee ID/department/job title have no corresponding Phase 2 columns; explicitly supplied supported metadata is kept in audit JSON and read back from there. Historical missing metadata is returned as null. Owner directory is a read-only restricted projection. No role, employee, Client account or operational reference is silently provisioned.
