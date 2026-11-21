# P2B002 entity and relationship implementation verification

Date: 2026-11-22, Asia/Singapore. **Executed P2B002 greenfield rebuild, not a proposal.** The rejected P2B001 model is not the current database. Target: `enterflow_phase2_db`, container `enterflow-phase2-mysql`, `127.0.0.1:62286`, MySQL 8.4.13. Actual result: 40 tables, 412 columns, 40 PKs, 95 FKs, 40 unique constraints, 40 enforced CHECKs, 167 indexes, 39 ownership/history triggers; **zero rows**. Counts are outcomes, not design goals or sufficient proof of correctness.

Evidence: [bootstrap](../database/phase2-bootstrap/P2B002_revised_erd_greenfield.sql), [design manifest](../database/phase2-bootstrap/P2B002_design_manifest.json), [actual metadata](../database/phase2-execution/P2B002-2026-11-22/after-metadata.json), [entity/relationship verification](../database/phase2-execution/P2B002-2026-11-22/entity-relationship-verification.json), [execution journal](../database/phase2-execution/P2B002-2026-11-22/execution.json).

The design was authored from the actual `EnterFlow_ERD_Revised.md`, original/revised diagrams, documented scope/backlog/events/use cases in `Enter-Flow_Final.pdf`, and approved business decisions. The authoring reference matches the actual Downloads revised file in normalized text. The new authoring helper reads only that revised reference; it does not import old DDL, E01–E03, P2B001, an old dictionary or backup. Physical names follow the revised entities. The final entity set was derived as 27 main entities, seven references explicitly required by their FKs, and six individually justified workflow extensions.

## Entity-by-entity implementation

| Revised entity / extension | Actual table | Basis and outcome |
| --- | --- | --- |
| revised main entity: `role` | `role` | Revised ERD entity and attributes. Present; columns/types/null/defaults and declared relationships verified. |
| revised reference: `delivery_method` | `delivery_method` | Revised reference; five documented delivery methods, no values seeded. Present; columns/types/null/defaults and declared relationships verified. |
| revised reference: `payment_method` | `payment_method` | Revised reference; manual payment-method selection/instructions, not a gateway. Present; columns/types/null/defaults and declared relationships verified. |
| revised reference: `material_category` | `material_category` | Revised reference; documented raw-material categories. Present; columns/types/null/defaults and declared relationships verified. |
| revised reference: `unit_of_measure` | `unit_of_measure` | Revised reference; quantities and costing material measurement units. Present; columns/types/null/defaults and declared relationships verified. |
| revised reference: `filter_type` | `filter_type` | Revised reference; sixteen filter types/six template groups, no fictional values. Present; columns/types/null/defaults and declared relationships verified. |
| revised reference: `production_stage` | `production_stage` | Revised reference and ten-stage requirement; labels/order values remain unpopulated. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `user_account` | `user_account` | Revised common account identity; client_user is a shared-PK subtype, not another credential store. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `client` | `client` | Revised ERD entity and attributes. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `client_user` | `client_user` | Revised portal membership. Common login attributes reside once in user_account; approved one-company-login uniqueness retained. Present; columns/types/null/defaults and declared relationships verified. |
| revised reference: `document` | `document` | Revised document entity with private object identity/lifecycle required by security and auditability; no second files subsystem. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `inquiry` | `inquiry` | Revised ERD entity and attributes. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `inquiry_item` | `inquiry_item` | Revised requested-item specifications directly on the item; JSON accommodates the documented six template groups, not a copied specification master. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `quotation` | `quotation` | Revised ERD entity and attributes. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `quotation_item` | `quotation_item` | Revised ERD entity and attributes. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `cost_estimate` | `cost_estimate` | Revised per-quotation-item estimate; nonunique item FK preserves estimate history without deciding one-current-estimate policy. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `raw_material` | `raw_material` | Revised raw material plus explicitly approved unknown/sample/verified provenance and reference-versus-approved price safeguards; no import lineage clone. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `cost_estimate_material` | `cost_estimate_material` | Revised material-cost snapshot; category/UOM describe estimate-time measurement, not a second current stock balance. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `purchase_order` | `purchase_order` | Accepted quotation is the only commercial owner link; inquiry/client and downpayment facts derive through quotation, not duplicate FK/boolean state. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `job_order` | `job_order` | Revised single PO header; no copied inquiry/client/accepted quote owner IDs and no product-level legacy JO. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `job_order_item` | `job_order_item` | Revised item-level immutable manufacturing specifications, including structured six-template snapshot; no mutable product master reference. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `job_order_stage` | `job_order_stage` | Revised ERD entity and attributes. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `material_shortage_report` | `material_shortage_report` | Revised ERD entity and attributes. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `finished_good` | `finished_good` | Revised client-specific repeat-product inventory; quantities and thresholds are unknown until observed. Forecast attributes are not populated. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `stock_movement` | `stock_movement` | Revised single typed movement ledger; provenance, required actor/reason, unit evidence and replay identity support genuine first observations without fictitious zero. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `stock_request` | `stock_request` | Stock-request entity shown in supplied cardinality diagram and newer handoff Warehouse/Sales backlog, absent from revised text attribute sections. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `stock_request_item` | `stock_request_item` | Diagram request item plus Q02-approved provenance distinction; it is an immutable request-time snapshot, not a second live inventory balance. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `production_plan` | `production_plan` | Revised ERD entity and attributes. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `sales_invoice` | `sales_invoice` | Invoice follows PO acceptance before payment/JO in documented use cases; JO/client derive through PO, avoiding a circular mandatory JO FK. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `client_receipt` | `client_receipt` | Revised proof submission, not a payment; document_id expands to client_receipt_file for explicitly documented multi-photo submissions. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `payment_transaction` | `payment_transaction` | Confirmed-only money, one row per partial/full payment; optional nonunique receipt FK does not impose allocation cardinality or copy attachment amounts. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `delivery` | `delivery` | Revised delivery aggregate, many deliveries per JO. PO/invoice/client derive through JO; document numbers and signed files live in required document entities. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `delivery_item` | `delivery_item` | Revised ERD entity and attributes. Present; columns/types/null/defaults and declared relationships verified. |
| revised main entity: `notification` | `notification` | Revised ERD entity and attributes. Present; columns/types/null/defaults and declared relationships verified. |
| workflow extension: `client_receipt_file` | `client_receipt_file` | Final.pdf scope p12 explicitly requires multi-photo receipt uploads; one submission amount is independent from the number of documents. Present; columns/types/null/defaults and declared relationships verified. |
| workflow extension: `waybill` | `waybill` | Documented Warehouse generation/printing and Logistics QR verification; waybill is not a shipment or second delivery aggregate. Present; columns/types/null/defaults and declared relationships verified. |
| workflow extension: `delivery_receipt` | `delivery_receipt` | Final.pdf pp47-49: Accounting generates a DR after dispatch; unlike waybill, it is a different document and responsible role. Present; columns/types/null/defaults and declared relationships verified. |
| workflow extension: `signed_delivery_receipt` | `signed_delivery_receipt` | Final.pdf pp50-51: signed DR upload/retention by Client or Logistics after delivery. Multiple retained uploads do not overwrite one file on delivery. Present; columns/types/null/defaults and declared relationships verified. |
| workflow extension: `production_stage_event` | `production_stage_event` | Backlog requires timestamped staff attribution and required reversion reason; this append-only event trail is not a second stage-state tracker. Present; columns/types/null/defaults and declared relationships verified. |
| workflow extension: `audit_event` | `audit_event` | Explicit inventory audit/reason and cross-role historical traceability requirements; polymorphic historical subject IDs intentionally survive lifecycle changes. Present; columns/types/null/defaults and declared relationships verified. |

## Every normalized/omitted revised attribute

| Revised attribute | Actual resolution / reason |
| --- | --- |
| `client_user.email` | user_account.email |
| `client_user.password_hash` | user_account.password_hash |
| `client_user.must_change_password` | user_account.must_change_password |
| `client_user.status` | user_account.status |
| `client_user.last_login_at` | user_account.last_login_at |
| `client_user.created_at` | user_account.created_at |
| `document.file_path` | storage_key |
| `document.file_path or storage_key` | storage_key |
| `purchase_order.inquiry_id` | derived quotation.inquiry_id |
| `purchase_order.client_id` | derived quotation -> inquiry.client_id |
| `purchase_order.downpayment_required` | derived accepted quotation.requires_downpayment |
| `purchase_order.downpayment_percent` | derived accepted quotation.downpayment_percent |
| `purchase_order.downpayment_amount` | derived accepted quotation.downpayment_amount |
| `purchase_order.downpayment_confirmed` | derived confirmed invoice payment facts; no duplicate mutable flag |
| `purchase_order.downpayment_confirmed_date` | derived confirmed invoice payment review history; no fabricated allocation/date |
| `job_order.client_id` | derived po -> quotation -> inquiry.client_id |
| `job_order.issue_sales_invoice` | omitted: invoice precedes JO in documented workflow |
| `sales_invoice.jo_id` | derived job_order.po_id; no mandatory pre-JO cycle |
| `sales_invoice.client_id` | derived po -> quotation -> inquiry.client_id |
| `client_receipt.document_id` | client_receipt_file.document_id (one logical submission, many photos) |
| `delivery.po_id` | derived job_order.po_id |
| `delivery.invoice_id` | derived sales_invoice.po_id unique relation |
| `delivery.client_id` | derived JO -> PO -> quotation -> inquiry.client_id |
| `delivery.dr_no` | delivery_receipt.dr_no |
| `delivery.waybill_no` | waybill.waybill_no |
| `delivery.signed_dr_document_id` | signed_delivery_receipt.document_id via delivery_receipt |

## Relationship-by-relationship evidence

These are **actual database cardinalities**, derived from child PK/UQ columns and nullability, not observed occupancy. A FK does not force a parent to have one or more children. Inquiry/quote/JO/delivery item sets, receipt photos and ten stage instances need coordinated later writers before an operational workflow may be accepted. No placeholder children were created to imitate those requirements.

| Parent | Child FK | Parent → children | Child → parent | Exact referenced columns | Actions |
| --- | --- | --- | --- | --- | --- |
| `user_account` | `audit_event(actor_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `delivery_method` | `client(preferred_delivery_method_id)` | 0..M | 0..1 | `delivery_method_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `sales_invoice` | `client_receipt(invoice_id)` | 0..M | 1 | `invoice_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `client_user` | `client_receipt(client_user_id)` | 0..M | 1 | `client_user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `payment_method` | `client_receipt(payment_method_id)` | 0..M | 1 | `payment_method_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `client_receipt(reviewed_by_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `client_receipt` | `client_receipt_file(receipt_id)` | 0..M | 1 | `receipt_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `document` | `client_receipt_file(document_id)` | 0..M | 1 | `document_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `client_user(client_user_id)` | 0..1 | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `client` | `client_user(client_id)` | 0..1 | 1 | `client_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `quotation_item` | `cost_estimate(quotation_item_id)` | 0..M | 1 | `quotation_item_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `cost_estimate(created_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `cost_estimate` | `cost_estimate_material(estimate_id)` | 0..M | 1 | `estimate_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `material_category` | `cost_estimate_material(material_category_id)` | 0..M | 0..1 | `material_category_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `raw_material` | `cost_estimate_material(raw_material_id)` | 0..M | 1 | `material_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `unit_of_measure` | `cost_estimate_material(uom_id)` | 0..M | 1 | `uom_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `job_order` | `delivery(jo_id)` | 0..M | 1 | `jo_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `delivery_method` | `delivery(delivery_method_id)` | 0..M | 1 | `delivery_method_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `delivery(dispatched_by_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `delivery` | `delivery_item(delivery_id)` | 0..M | 1 | `delivery_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `job_order_item` | `delivery_item(jo_item_id)` | 0..M | 1 | `jo_item_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `delivery` | `delivery_receipt(delivery_id)` | 0..1 | 1 | `delivery_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `delivery_receipt(generated_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `document` | `delivery_receipt(document_id)` | 0..M | 0..1 | `document_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `document(uploaded_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `client` | `finished_good(client_id)` | 0..M | 1 | `client_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `filter_type` | `finished_good(filter_type_id)` | 0..M | 1 | `filter_type_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `client` | `inquiry(client_id)` | 0..M | 1 | `client_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `client_user` | `inquiry(submitted_by_client_user_id, client_id)` | 0..M | 0..1 | `client_user_id, client_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `inquiry(created_by_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `inquiry` | `inquiry_item(inquiry_id)` | 0..M | 1 | `inquiry_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `filter_type` | `inquiry_item(filter_type_id)` | 0..M | 1 | `filter_type_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `document` | `inquiry_item(sketch_document_id)` | 0..M | 0..1 | `document_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `purchase_order` | `job_order(po_id)` | 0..1 | 1 | `po_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `delivery_method` | `job_order(delivery_method_id)` | 0..M | 1 | `delivery_method_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `job_order(prepared_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `job_order(approved_by_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `job_order` | `job_order_item(jo_id)` | 0..M | 1 | `jo_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `quotation_item` | `job_order_item(quotation_item_id)` | 0..M | 1 | `quotation_item_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `document` | `job_order_item(final_sketch_document_id)` | 0..M | 0..1 | `document_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `job_order` | `job_order_stage(jo_id)` | 0..M | 1 | `jo_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `production_stage` | `job_order_stage(stage_id)` | 0..M | 1 | `stage_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `job_order_stage(marked_by_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `job_order` | `material_shortage_report(jo_id)` | 0..M | 1 | `jo_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `job_order_stage` | `material_shortage_report(jo_stage_id)` | 0..M | 0..1 | `jo_stage_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `raw_material` | `material_shortage_report(raw_material_id)` | 0..M | 1 | `material_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `material_shortage_report(reported_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `notification(user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `sales_invoice` | `payment_transaction(invoice_id)` | 0..M | 1 | `invoice_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `payment_method` | `payment_transaction(payment_method_id)` | 0..M | 1 | `payment_method_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `client_receipt` | `payment_transaction(client_receipt_id, invoice_id)` | 0..M | 0..1 | `receipt_id, invoice_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `payment_transaction(recorded_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `payment_transaction(approved_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `document` | `payment_transaction(official_receipt_document_id)` | 0..M | 0..1 | `document_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `client` | `production_plan(client_id)` | 0..M | 1 | `client_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `finished_good` | `production_plan(finished_good_id)` | 0..M | 0..1 | `finished_good_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `job_order` | `production_plan(jo_id)` | 0..M | 0..1 | `jo_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `production_plan(created_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `job_order_stage` | `production_stage_event(jo_stage_id)` | 0..M | 1 | `jo_stage_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `production_stage_event(performed_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `quotation` | `purchase_order(quotation_id)` | 0..M | 1 | `quotation_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `document` | `purchase_order(po_document_id)` | 0..M | 1 | `document_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `delivery_method` | `purchase_order(delivery_method_id)` | 0..M | 1 | `delivery_method_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `purchase_order(recorded_by_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `inquiry` | `quotation(inquiry_id)` | 0..M | 1 | `inquiry_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `quotation(prepared_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `quotation(approved_by_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `quotation` | `quotation_item(quotation_id)` | 0..M | 1 | `quotation_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `inquiry_item` | `quotation_item(inquiry_item_id)` | 0..M | 0..1 | `inquiry_item_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `unit_of_measure` | `quotation_item(uom_id)` | 0..M | 1 | `uom_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `material_category` | `raw_material(material_category_id)` | 0..M | 0..1 | `material_category_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `unit_of_measure` | `raw_material(uom_id)` | 0..M | 1 | `uom_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `raw_material(unit_price_approved_by_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `document` | `raw_material(reference_document_id)` | 0..M | 0..1 | `document_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `purchase_order` | `sales_invoice(po_id)` | 0..1 | 1 | `po_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `sales_invoice(issued_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `delivery_receipt` | `signed_delivery_receipt(delivery_receipt_id)` | 0..M | 1 | `delivery_receipt_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `document` | `signed_delivery_receipt(document_id)` | 0..1 | 1 | `document_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `signed_delivery_receipt(submitted_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `raw_material` | `stock_movement(raw_material_id)` | 0..M | 0..1 | `material_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `finished_good` | `stock_movement(finished_good_id)` | 0..M | 0..1 | `finished_good_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `unit_of_measure` | `stock_movement(uom_id)` | 0..M | 0..1 | `uom_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `job_order` | `stock_movement(jo_id)` | 0..M | 0..1 | `jo_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `stock_movement(performed_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `inquiry` | `stock_request(inquiry_id)` | 0..M | 1 | `inquiry_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `stock_request(requested_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `stock_request(handled_by_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `stock_request` | `stock_request_item(stock_request_id)` | 0..M | 1 | `stock_request_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `raw_material` | `stock_request_item(raw_material_id)` | 0..M | 1 | `material_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `unit_of_measure` | `stock_request_item(uom_id)` | 0..M | 1 | `uom_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `stock_request_item(observed_by_user_id)` | 0..M | 0..1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `role` | `user_account(role_id)` | 0..M | 1 | `role_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `delivery` | `waybill(delivery_id)` | 0..1 | 1 | `delivery_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `user_account` | `waybill(generated_by_user_id)` | 0..M | 1 | `user_id` | UPDATE NO ACTION; DELETE NO ACTION |
| `document` | `waybill(document_id)` | 0..M | 0..1 | `document_id` | UPDATE NO ACTION; DELETE NO ACTION |

## Explicit omissions and normalized relationships

- **No revised main/reference entity is missing.** The diagram-only stock_request and stock_request_item are included. All revised attributes are either physical columns or explicitly mapped below; no silent omission is treated as a successful match.
- PO stores accepted quotation only; inquiry/client derive. JO stores PO only; inquiry/client/accepted quote derive. Invoice stores PO only; client and optional future JO derive. Delivery stores JO only; PO/invoice/client derive. Ownership guards validate quote-item inquiry, accepted JO source, same-JO delivery items, shortage stages, receipt client and plan/finished-good ownership without adding copied owner chains.
- Client-user email/password/status/login dates live in the revised user_account identity, inherited by the shared-PK portal subtype. No extra credential/session/module/permission-compatibility tables were added.
- Delivery waybill_no/dr_no/signed-file attributes are normalized into the documented waybill, delivery_receipt and retained signed_delivery_receipt entities. Receipt document_id becomes the specifically required multi-photo junction.
- PO downpayment flags/amounts/confirmation dates derive from accepted quote and actual approved payment facts. No independent mutable confirmation flag, inferred allocation, fabricated approval time or duplicate financial record is stored.
- No old shipment, per-product JO header, combined payment/payment-file, split movement, urgent, migration-history, legacy catalog/specification-master, import-review, company-settings, document-sequence, broad lookup or report tables were reproduced for compatibility.
- No payment-term lookup, automatic supplier purchasing, pricing import, BOM template population, courier integration or reporting fact duplication was invented. Plain terms/supplier text are attributes.

The rejected build remains at its original SQL/evidence paths. Byte-preserved copies of its SQL, execution journal and four reports are in [rejected-P2B001](../database/phase2-execution/P2B002-2026-11-22/rejected-P2B001); [fingerprints](../database/phase2-execution/P2B002-2026-11-22/preserved-P2B001-fingerprints.json) record provenance. These are historical artifacts, not inputs or expected outputs for P2B002.

## Unresolved decisions and requirements not claimed implemented

1. **Ten stage names/order:** the schema reserves unique positions 1–10; no definitions/history exist. Do not invent the tenth name. Exactly ten definitions/instances and sequential transition/reversion transactions need approved reference values and authorized writers.
2. **Receipt allocation:** optional, nonunique receipt linkage follows the unresolved revised cardinality. No one-receipt-one-payment, allocation cap, split policy or inferred transfer is imposed. Manual review authorization, proof completeness and financial transaction atomicity remain required. Separate equal-value payments remain distinct; photos never become money.
3. **Invoice issuer/chronology:** scope wording varies between Sales and Accounting. Actual PO review use cases place invoice before payment/JO. Invoice owns only PO; JO/client derive. Schema actor FKs do not decide or grant issuing permissions. No mandatory pre-JO invoice FK cycle or JO invoice-creation switch was implemented.
4. **Cost estimate selection:** revised text leaves one current versus multiple historic estimates open. The item FK is nonunique to retain history; no unapproved current-estimate uniqueness or approval selection is invented.
5. **Numbering:** quotation_no and po_no uniqueness follow the revised ERD. Printed revision numbering and the distinction between a system PO number and customer-supplied reference need approved formats/namespaces. No number sequences, sample numbers or legacy quote-reference ownership table were carried over.
6. **Stock units/prices:** unit conversion, BOM recipes, reference prices and any reference populations need actual approval. Raw unit_price means approved costing price and requires approver/time; PDF reference values occupy separate nullable fields. No quantities/prices/materials/BOMs are populated. Source JSON for noncylindrical template fields needs approved template validation, not invented legacy column sets.
7. **Cross-row operational invariants:** physical first observations and same-value sample verification can be represented, but atomic balance+movement+audit writers, stable operation-key generation, concurrency/locking and direct-write privilege boundaries are not implemented by this schema-only task. Parent/child guards exist and are restored, but no multi-session mutation tests or proof of universal bypass prevention is claimed. This is not an activated inventory system.
8. **Historical snapshots and staged creation:** complete specification fields/JSON live on JO items, not a mutable master. Issuance/lock rules, append-before-edit audits, minimum one-or-more child records, correct delivered cumulative quantities, manual receipt review and approved snapshot copying need coordinated future writers. Only actual metadata and empty restoration were verified; no fabricated fixtures were inserted.
9. **Existing approved account/finished-good choices:** one portal account per company and client-specific finished goods remain constrained. Revised optional/multi-account variants are not silently activated. The Client account is a shared-PK user_account subtype: credentials/status are stored once, not copied. Staff-versus-client assignment requires the portal role guards and later authenticated APIs; this task creates no logins or grants.
10. **Status/demand vocabularies and forecast basis:** unspecified statuses remain required VARCHAR fields instead of fictional enum populations. Demand/frequency/average fields are nullable; no period, algorithm, thresholds or forecast values were invented. Future UI/API validation and role-specific reporting stay outside this task.

Application configuration is unchanged. No service/frontend compatibility layer, deployment, procurement, bank gateway, courier integration or next implementation task was started.
