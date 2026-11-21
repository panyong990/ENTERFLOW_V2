# Enter-Flow ERD — Revised Attributes, Keys, Relationships, and Cardinalities

This revision removes rush/urgent-order fields and adjusts relationships to match the documented Enter-Flow workflow. Cardinalities below express the intended business model, not merely what a nullable SQL foreign key permits. Confirm optionality and uniqueness constraints when implementing the database.

## client

- `client_id` **PK**
- `company_name` **UQ**
- `industry`
- `contact_person`
- `phone`
- `email`
- `address_line1`
- `address_line2`
- `city_province`
- `zip_code`
- `default_payment_terms`
- `preferred_delivery_method_id` **FK → delivery_method.delivery_method_id**
- `internal_notes`
- `status`
- `client_since`
- `created_at`

## client_user

- `client_user_id` **PK**
- `client_id` **FK → client.client_id**
- `email` **UQ**
- `password_hash`
- `must_change_password`
- `status`
- `last_login_at`
- `created_at`

**Constraint note:** Do not make `client_user.client_id` unique if one client company may have multiple portal users. If the system intentionally allows only one login per client company, retain the unique constraint and document that business rule.

## inquiry

- `inquiry_id` **PK**
- `inquiry_no` **UQ**
- `client_id` **FK → client.client_id**
- `contact_person`
- `payment_terms`
- `source`
- `submitted_by_client_user_id` **FK → client_user.client_user_id**
- `created_by_user_id` **FK → user_account.user_id**
- `general_notes`
- `required_by_date`
- `due_date`
- `status`
- `rejection_reason`
- `created_at`
- `updated_at`

Removed `is_rush`.

## inquiry_item

- `inquiry_item_id` **PK**
- `inquiry_id` **FK → inquiry.inquiry_id**
- `line_no`
- `filter_type_id` **FK → filter_type.filter_type_id**
- `filter_name`
- `oem_reference`
- `od1_mm`
- `od2_mm`
- `id1_mm`
- `id2_mm`
- `height_mm`
- `overall_height_mm`
- `filter_media`
- `inner_core`
- `outer_core`
- `o_ring`
- `gasket`
- `filtration_rating`
- `filtration_rating_custom`
- `quantity`
- `sketch_document_id` **FK → document.document_id**

## quotation

- `quotation_id` **PK**
- `quotation_no` **UQ**
- `inquiry_id` **FK → inquiry.inquiry_id**
- `revision_no`
- `is_current`
- `quotation_date`
- `valid_until`
- `terms_of_payment`
- `time_of_delivery`
- `place_of_delivery`
- `vat_type`
- `highlight_tag`
- `highlight_note`
- `requires_downpayment`
- `downpayment_percent`
- `downpayment_amount`
- `subtotal`
- `addons_total`
- `total_amount`
- `status`
- `prepared_by_user_id` **FK → user_account.user_id**
- `approved_by_user_id` **FK → user_account.user_id**
- `sent_at`
- `created_at`

A quotation revision is a separate quotation record linked to the same inquiry; `revision_no` should be unique within an inquiry.

## quotation_item

- `quotation_item_id` **PK**
- `quotation_id` **FK → quotation.quotation_id**
- `inquiry_item_id` **FK → inquiry_item.inquiry_item_id**
- `line_no`
- `description`
- `quantity`
- `uom_id` **FK → unit_of_measure.uom_id**
- `unit_price`
- `line_total`

## cost_estimate

- `estimate_id` **PK**
- `quotation_item_id` **FK → quotation_item.quotation_item_id**
- `labor_cost_per_unit`
- `include_labor`
- `markup_percent`
- `apply_markup`
- `vat_type`
- `vat_rate`
- `apply_vat`
- `material_cost_per_unit`
- `unit_cost_with_markup`
- `unit_cost_with_vat`
- `is_locked`
- `created_by_user_id` **FK → user_account.user_id**
- `created_at`

If the system keeps only one current estimate per quotation item, add a unique constraint on `cost_estimate.quotation_item_id`; otherwise, retain multiple estimates to preserve revisions/history.

## cost_estimate_material

- `estimate_material_id` **PK**
- `estimate_id` **FK → cost_estimate.estimate_id**
- `material_category_id` **FK → material_category.material_category_id**
- `raw_material_id` **FK → raw_material.material_id**
- `qty_per_filter`
- `uom_id` **FK → unit_of_measure.uom_id**
- `unit_price_snapshot`
- `line_cost`

## purchase_order

- `po_id` **PK**
- `po_no` **UQ**
- `inquiry_id` **FK → inquiry.inquiry_id**
- `quotation_id` **FK → quotation.quotation_id**
- `client_id` **FK → client.client_id**
- `po_document_id` **FK → document.document_id**
- `received_date`
- `payment_terms`
- `delivery_method_id` **FK → delivery_method.delivery_method_id**
- `downpayment_required`
- `downpayment_percent`
- `downpayment_amount`
- `downpayment_confirmed`
- `downpayment_confirmed_date`
- `recorded_by_user_id` **FK → user_account.user_id**
- `created_at`

The PO should reference the accepted quotation. `inquiry_id` and `client_id` duplicate information that can be derived through the quotation/inquiry chain, but may be retained for reporting only if the system validates that all three references belong to the same client and inquiry.

## job_order

- `jo_id` **PK**
- `jo_no` **UQ**
- `po_id` **FK → purchase_order.po_id** **UQ**
- `client_id` **FK → client.client_id**
- `jo_date`
- `due_date`
- `status`
- `payment_terms`
- `delivery_method_id` **FK → delivery_method.delivery_method_id**
- `issue_sales_invoice`
- `po_verified`
- `specs_verified`
- `terms_verified`
- `prepared_by_user_id` **FK → user_account.user_id**
- `approved_by_user_id` **FK → user_account.user_id**
- `cancellation_reason`
- `completed_at`
- `archived_at`
- `created_at`

Removed `is_rush`. The unique constraint on `po_id` expresses the documented one-PO-to-at-most-one-job-order workflow. Remove that constraint only if one PO can legitimately be split into multiple job orders.

## job_order_item

- `jo_item_id` **PK**
- `jo_id` **FK → job_order.jo_id**
- `quotation_item_id` **FK → quotation_item.quotation_item_id**
- `line_no`
- `item_code`
- `enterfil_pn`
- `item_name`
- `quantity`
- `od1_mm`
- `od2_mm`
- `id1_mm`
- `id2_mm`
- `height_mm`
- `overall_height_mm`
- `filter_media`
- `inner_core`
- `outer_core`
- `end_cap`
- `o_ring`
- `gasket`
- `oem_pn`
- `brand`
- `other_specs`
- `final_sketch_document_id` **FK → document.document_id**

The quotation item reference should be optional only if job orders may contain items not originating from a quotation. Otherwise, require it.

## job_order_stage

- `jo_stage_id` **PK**
- `jo_id` **FK → job_order.jo_id**
- `stage_id` **FK → production_stage.stage_id**
- `status`
- `started_at`
- `completed_at`
- `marked_by_user_id` **FK → user_account.user_id**
- `remarks`
- `reverted_count`

Add a unique constraint on `(jo_id, stage_id)` if each job order has exactly one record for each defined production stage and reversion updates that record rather than creating another one.

## material_shortage_report

- `report_id` **PK**
- `jo_id` **FK → job_order.jo_id**
- `jo_stage_id` **FK → job_order_stage.jo_stage_id**
- `raw_material_id` **FK → raw_material.material_id**
- `qty_needed`
- `description`
- `status`
- `reported_by_user_id` **FK → user_account.user_id**
- `reported_at`
- `resolved_at`

## raw_material

- `material_id` **PK**
- `material_category_id` **FK → material_category.material_category_id**
- `material_name`
- `uom_id` **FK → unit_of_measure.uom_id**
- `qty_in_stock`
- `unit_price`
- `reorder_threshold`
- `supplier_name`
- `is_active`
- `created_at`
- `updated_at`

## finished_good

- `finished_good_id` **PK**
- `item_code` **UQ**
- `enterfil_pn`
- `item_name`
- `client_id` **FK → client.client_id**
- `filter_type_id` **FK → filter_type.filter_type_id**
- `qty_in_stock`
- `buffer_min`
- `demand_level`
- `order_frequency`
- `avg_qty_per_order`
- `is_active`

## stock_movement

- `movement_id` **PK**
- `item_type`
- `raw_material_id` **FK → raw_material.material_id**
- `finished_good_id` **FK → finished_good.finished_good_id**
- `movement_reason`
- `qty_before`
- `qty_after`
- `qty_change`
- `reference_no`
- `supplier_name`
- `jo_id` **FK → job_order.jo_id**
- `notes`
- `performed_by_user_id` **FK → user_account.user_id**
- `created_at`

A stock movement must reference exactly one inventory item: either `raw_material_id` or `finished_good_id`, consistent with `item_type`. Enforce this with a database check constraint if supported.

## production_plan

- `plan_id` **PK**
- `plan_code` **UQ**
- `client_id` **FK → client.client_id**
- `finished_good_id` **FK → finished_good.finished_good_id**
- `jo_id` **FK → job_order.jo_id**
- `source`
- `planned_qty`
- `week_start_date`
- `week_end_date`
- `created_by_user_id` **FK → user_account.user_id**

Use `finished_good_id` for forecasts/plans involving standard or repeat-order items and `jo_id` when a plan is tied to a specific job order. If every production plan must be tied to a job order, make `jo_id` mandatory; otherwise it can be optional.

## sales_invoice

- `invoice_id` **PK**
- `invoice_no` **UQ**
- `jo_id` **FK → job_order.jo_id** **UQ**
- `po_id` **FK → purchase_order.po_id** **UQ**
- `client_id` **FK → client.client_id**
- `invoice_date`
- `payment_terms`
- `delivered_date`
- `due_date`
- `total_amount`
- `status`
- `issued_by_user_id` **FK → user_account.user_id**
- `created_at`

This models one invoice per job order/PO. If the business permits multiple invoices per order, remove the relevant unique constraint(s). Since the documented workflow generates the invoice after PO review and before payment, keep invoice creation separate from payment verification.

## client_receipt

- `receipt_id` **PK**
- `invoice_id` **FK → sales_invoice.invoice_id**
- `client_user_id` **FK → client_user.client_user_id**
- `document_id` **FK → document.document_id**
- `payment_method_id` **FK → payment_method.payment_method_id**
- `amount_declared`
- `note`
- `review_status`
- `reviewed_by_user_id` **FK → user_account.user_id**
- `reviewed_at`
- `sent_at`

A receipt is a client's submitted proof of payment, not the same as a confirmed payment transaction.

## payment_transaction

- `payment_id` **PK**
- `invoice_id` **FK → sales_invoice.invoice_id**
- `payment_method_id` **FK → payment_method.payment_method_id**
- `transaction_type`
- `amount`
- `reference_no`
- `date_paid`
- `client_receipt_id` **FK → client_receipt.receipt_id**
- `approval_status`
- `recorded_by_user_id` **FK → user_account.user_id**
- `approved_by_user_id` **FK → user_account.user_id**
- `approved_at`
- `notes`
- `created_at`

Each confirmed partial or full payment is a separate transaction associated with an invoice. `client_receipt_id` should be optional because a transaction may be recorded through a workflow that does not use a client-uploaded receipt; if every transaction must originate from a submitted receipt, make it mandatory. If one receipt can support multiple payment transactions, do not make it unique; otherwise, enforce one-to-one linkage.

## delivery

- `delivery_id` **PK**
- `jo_id` **FK → job_order.jo_id**
- `po_id` **FK → purchase_order.po_id**
- `invoice_id` **FK → sales_invoice.invoice_id**
- `client_id` **FK → client.client_id**
- `delivery_method_id` **FK → delivery_method.delivery_method_id**
- `dr_no` **UQ**
- `waybill_no` **UQ**
- `status`
- `dispatch_date`
- `estimated_delivery_date`
- `delivered_date`
- `driver_name`
- `driver_contact`
- `vehicle_plate`
- `tracking_link`
- `signed_dr_document_id` **FK → document.document_id**
- `received_by`
- `notes`
- `dispatched_by_user_id` **FK → user_account.user_id**
- `created_at`

A delivery is associated with the job order being shipped. The PO, invoice, and client can be derived from the job order's relationships; retaining them here is denormalized and requires consistency validation. If the system only supports one delivery per job order, make `delivery.jo_id` unique. If split or repeat deliveries are supported, leave it non-unique.

## delivery_item

- `delivery_item_id` **PK**
- `delivery_id` **FK → delivery.delivery_id**
- `jo_item_id` **FK → job_order_item.jo_item_id**
- `quantity`

Add a unique constraint on `(delivery_id, jo_item_id)` if each job-order item should appear only once per delivery, with its quantity summed into one row.

## notification

- `notification_id` **PK**
- `user_id` **FK → user_account.user_id**
- `title`
- `message`
- `notification_type`
- `is_read`
- `created_at`
- `read_at`

## role

- `role_id` **PK**
- `role_name` **UQ**
- `description`
- `is_owner_role`

## user_account

- `user_id` **PK**
- `role_id` **FK → role.role_id**
- `full_name`
- `email` **UQ**
- `password_hash`
- `initials`
- `phone`
- `status`
- `must_change_password`
- `joined_date`
- `last_login_at`
- `created_at`

## Lookup/reference tables required by the foreign keys

These tables are referenced above but were not included in the supplied draft. Add them to the ERD if the IDs are stored as foreign keys:

### delivery_method
- `delivery_method_id` **PK**
- `method_name` **UQ**
- `is_active`

### payment_method
- `payment_method_id` **PK**
- `method_name` **UQ**
- `instructions`
- `is_active`

### material_category
- `material_category_id` **PK**
- `category_name` **UQ**

### unit_of_measure
- `uom_id` **PK**
- `uom_name` **UQ**
- `abbreviation`

### filter_type
- `filter_type_id` **PK**
- `filter_type_name` **UQ**
- `template_group`
- `is_active`

### production_stage
- `stage_id` **PK**
- `stage_name` **UQ**
- `stage_order`
- `is_active`

### document
- `document_id` **PK**
- `file_name`
- `file_path` or `storage_key`
- `mime_type`
- `uploaded_by_user_id` **FK → user_account.user_id**
- `uploaded_at`

Store document metadata here and reference it from inquiry sketches, Purchase Order uploads, final sketches, payment receipts, and signed Delivery Receipts. If the implementation stores document data differently, adapt the FK references accordingly.

## Relationships and intended cardinalities

Notation: Parent → Child. `1` means exactly one; `0..1` means optional one; `0..M` means zero or many; `1..M` means one or many. The child-side cardinality depends on whether its FK is mandatory or nullable. This table describes intended workflow cardinalities; enforce required FKs and unique constraints in the database.

| Parent | Child (FK) | Parent → Child | Child → Parent | Rule |
|---|---|---:|---:|---|
| `client` | `client_user` | `1..M` | `1` | Each portal user belongs to one client; allow multiple portal users unless policy says otherwise. |
| `client` | `inquiry` | `0..M` | `1` | Each inquiry belongs to one client. |
| `client_user` | `inquiry` | `0..M` | `0..1` | The submitting portal user may be absent for staff-created inquiries. |
| `user_account` | `inquiry` | `0..M` | `0..1` | Optional staff creator for client-submitted inquiries. |
| `inquiry` | `inquiry_item` | `1..M` | `1` | An inquiry contains one or more requested items. |
| `inquiry` | `quotation` | `0..M` | `1` | Revisions are separate quotation records for the same inquiry. |
| `user_account` | `quotation` (prepared by) | `0..M` | `0..1` | A quotation has one preparer when assigned. |
| `user_account` | `quotation` (approved by) | `0..M` | `0..1` | Approval may be pending or not required. |
| `quotation` | `quotation_item` | `1..M` | `1` | Each quotation contains one or more items. |
| `inquiry_item` | `quotation_item` | `0..M` | `0..1` | An inquiry item may appear in revised quotations; each quotation item traces to at most one inquiry item. |
| `quotation_item` | `cost_estimate` | `0..M` | `1` | Use `0..1` instead of `0..M` if only one estimate per quotation item is retained. |
| `cost_estimate` | `cost_estimate_material` | `1..M` | `1` | Each estimate contains one or more material lines if material costing is itemized. |
| `raw_material` | `cost_estimate_material` | `0..M` | `1` | Each estimate-material line identifies one raw material. |
| `inquiry` | `purchase_order` | `0..M` | `1` | Each PO references the originating inquiry. |
| `quotation` | `purchase_order` | `0..M` | `1` | Each PO is based on one accepted quotation. |
| `client` | `purchase_order` | `0..M` | `1` | Each PO identifies one client; validate it matches the quotation/inquiry client. |
| `purchase_order` | `job_order` | `0..1` | `1` | One verified PO creates at most one job order under the current workflow. |
| `client` | `job_order` | `0..M` | `1` | Each job order belongs to one client. |
| `job_order` | `job_order_item` | `1..M` | `1` | A job order contains one or more production items. |
| `quotation_item` | `job_order_item` | `0..M` | `0..1` | A job-order item may trace to a quotation item; make mandatory if all JOs derive from quotations. |
| `job_order` | `job_order_stage` | `1..M` | `1` | Each job order has its production-stage records. |
| `production_stage` | `job_order_stage` | `0..M` | `1` | Each stage record references one defined production stage. |
| `job_order` | `material_shortage_report` | `0..M` | `1` | A job order may have multiple shortage reports. |
| `job_order_stage` | `material_shortage_report` | `0..M` | `0..1` | A report may identify the stage where the shortage occurred. |
| `raw_material` | `material_shortage_report` | `0..M` | `1` | Each report identifies the affected raw material. |
| `job_order` | `sales_invoice` | `0..1` | `1` | One invoice per job order under the proposed uniqueness rule. |
| `purchase_order` | `sales_invoice` | `0..1` | `1` | One invoice per PO under the proposed uniqueness rule. |
| `client` | `sales_invoice` | `0..M` | `1` | Each invoice identifies one client; validate against its PO/JO. |
| `sales_invoice` | `client_receipt` | `0..M` | `1` | An invoice may have multiple submitted proofs, including partial payments or resubmissions. |
| `client_user` | `client_receipt` | `0..M` | `1` | Each uploaded receipt is submitted by one portal user. |
| `user_account` | `client_receipt` (reviewed by) | `0..M` | `0..1` | Review is optional until an authorized staff member reviews it. |
| `sales_invoice` | `payment_transaction` | `0..M` | `0..1` | A transaction may be linked to an invoice; make the FK mandatory if all transactions are invoice-based. |
| `client_receipt` | `payment_transaction` | `0..1` or `0..M` | `0..1` | Decide whether one receipt may support more than one payment transaction; use a unique FK for one-to-one. |
| `job_order` | `delivery` | `0..M` | `1` | Supports partial or repeat deliveries; use `0..1` if one delivery per job order is guaranteed. |
| `delivery` | `delivery_item` | `1..M` | `1` | Each delivery contains one or more shipped job-order items. |
| `job_order_item` | `delivery_item` | `0..M` | `1` | An item can be shipped across multiple deliveries. |
| `client` | `finished_good` | `0..M` | `0..1` | A finished-good record may be client-specific; remove the FK if finished goods are global catalog items. |
| `finished_good` | `production_plan` | `0..M` | `0..1` | A plan may forecast a standard/repeat-order product. |
| `job_order` | `production_plan` | `0..M` | `0..1` | A plan may be tied to a particular job order. |
| `raw_material` | `stock_movement` | `0..M` | `0..1` | A movement may concern a raw material. |
| `finished_good` | `stock_movement` | `0..M` | `0..1` | A movement may concern a finished good; exactly one of the two item FKs must be set. |
| `job_order` | `stock_movement` | `0..M` | `0..1` | Movement may be linked to a job order when relevant. |
| `user_account` | `stock_movement` | `0..M` | `0..1` | Records who performed the stock change. |
| `user_account` | `notification` | `0..M` | `1` | Each notification belongs to one user. |
| `role` | `user_account` | `0..M` | `1` | Each user account has one role. |
| `user_account` | `job_order_stage` | `0..M` | `0..1` | Stage may be unassigned/unmarked before work starts. |
| `user_account` | `material_shortage_report` | `0..M` | `1` | Each shortage report records one reporter. |
| `user_account` | `payment_transaction` (recorded by) | `0..M` | `0..1` | Record the staff member who entered the transaction. |
| `user_account` | `payment_transaction` (approved by) | `0..M` | `0..1` | Approval may be pending. |
| `user_account` | `sales_invoice` (issued by) | `0..M` | `1` | Each invoice records the issuing employee. |
| `user_account` | `purchase_order` (recorded by) | `0..M` | `0..1` | PO recorder may be stored when entered by staff. |
| `user_account` | `job_order` (prepared by) | `0..M` | `0..1` | Job order preparer may be stored when assigned. |
| `user_account` | `job_order` (approved by) | `0..M` | `0..1` | Approval may be pending. |

## Important consistency checks before drawing the ERD

1. **No rush/urgent-order fields:** `is_rush` is removed from both `inquiry` and `job_order`; no rush/urgent workflow should appear elsewhere.
2. **Sales Invoice workflow:** Invoice creation follows PO review and is handled by the role assigned in the final workflow. The source file has inconsistent role wording in places; confirm whether Sales or Accounting issues the invoice before finalizing `issued_by_user_id` permissions.
3. **Delivery Receipt vs. waybill:** Warehouse generates the waybill after production completion. Accounting/Company Secretary generates the Delivery Receipt. Logistics coordinates delivery and records the signed Delivery Receipt.
4. **Payments:** Client receipt uploads are evidence awaiting manual review; confirmed payment transactions are separate records. Partial payments should be represented as multiple payment transactions linked to the invoice.
5. **Stock:** `stock_movement` records manual stock adjustments and relevant changes; it must not imply automated supplier procurement.
6. **FK columns must actually reference entities:** IDs such as `delivery_method_id`, `payment_method_id`, `uom_id`, `filter_type_id`, `stage_id`, and document IDs need matching lookup/document tables or must be changed to plain attributes consistently.
7. **Avoid contradictory duplicate references:** If `delivery` stores `jo_id`, `po_id`, `invoice_id`, and `client_id`, enforce that they all refer to the same transaction. For a more normalized design, store `jo_id` and derive PO, invoice, and client through the related records.
8. **Cardinality depends on constraints:** A foreign key alone does not establish one-to-one. Add `UNIQUE` constraints where the workflow truly permits only one child record, such as one job order per PO or one invoice per PO/JO.
