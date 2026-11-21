# P2B002 actual corrected physical ERD

Date: 2026-11-22, Asia/Singapore. **Executed P2B002 greenfield rebuild, not a proposal.** The rejected P2B001 model is not the current database. Target: `enterflow_phase2_db`, container `enterflow-phase2-mysql`, `127.0.0.1:62286`, MySQL 8.4.13. Actual result: 40 tables, 412 columns, 40 PKs, 95 FKs, 40 unique constraints, 40 enforced CHECKs, 167 indexes, 39 ownership/history triggers; **zero rows**. Counts are outcomes, not design goals or sufficient proof of correctness.

Evidence: [bootstrap](../database/phase2-bootstrap/P2B002_revised_erd_greenfield.sql), [design manifest](../database/phase2-bootstrap/P2B002_design_manifest.json), [actual metadata](../database/phase2-execution/P2B002-2026-11-22/after-metadata.json), [entity/relationship verification](../database/phase2-execution/P2B002-2026-11-22/entity-relationship-verification.json), [execution journal](../database/phase2-execution/P2B002-2026-11-22/execution.json).

The design was authored from the actual `EnterFlow_ERD_Revised.md`, original/revised diagrams, documented scope/backlog/events/use cases in `Enter-Flow_Final.pdf`, and approved business decisions. The authoring reference matches the actual Downloads revised file in normalized text. The new authoring helper reads only that revised reference; it does not import old DDL, E01–E03, P2B001, an old dictionary or backup. Physical names follow the revised entities. The final entity set was derived as 27 main entities, seven references explicitly required by their FKs, and six individually justified workflow extensions.

## Complete physical ERD

The diagram includes every actual column and FK. Full MySQL types/defaults/checks/indexes are in the server definitions below.

```mermaid
erDiagram
  role {
    bigint_unsigned role_id PK
    enum role_name UK
    text description
    tinyint is_owner_role
  }
  delivery_method {
    bigint_unsigned delivery_method_id PK
    varchar method_name UK
    tinyint is_active
  }
  payment_method {
    bigint_unsigned payment_method_id PK
    varchar method_name UK
    text instructions
    tinyint is_active
  }
  material_category {
    bigint_unsigned material_category_id PK
    varchar category_name UK
  }
  unit_of_measure {
    bigint_unsigned uom_id PK
    varchar uom_name UK
    varchar abbreviation UK
  }
  filter_type {
    bigint_unsigned filter_type_id PK
    varchar filter_type_name UK
    varchar template_group
    tinyint is_active
  }
  production_stage {
    bigint_unsigned stage_id PK
    varchar stage_name UK
    smallint_unsigned stage_order UK
    tinyint is_active
  }
  user_account {
    bigint_unsigned user_id PK
    bigint_unsigned role_id FK
    varchar full_name
    varchar email UK
    varchar password_hash
    varchar initials
    varchar phone
    varchar status
    tinyint must_change_password
    date joined_date
    datetime last_login_at
    datetime created_at
  }
  client {
    bigint_unsigned client_id PK
    varchar company_name UK
    varchar industry
    varchar contact_person
    varchar phone
    varchar email
    varchar address_line1
    varchar address_line2
    varchar city_province
    varchar zip_code
    varchar default_payment_terms
    bigint_unsigned preferred_delivery_method_id FK
    text internal_notes
    varchar status
    date client_since
    datetime created_at
  }
  client_user {
    bigint_unsigned client_user_id FK,PK,UK
    bigint_unsigned client_id FK,UK
  }
  document {
    bigint_unsigned document_id PK
    varchar file_name
    varchar storage_bucket UK
    varchar storage_key UK
    varchar object_generation UK
    varchar mime_type
    bigint_unsigned size_bytes
    char sha256
    enum storage_status
    bigint_unsigned uploaded_by_user_id FK
    datetime uploaded_at
  }
  inquiry {
    bigint_unsigned inquiry_id PK
    varchar inquiry_no UK
    bigint_unsigned client_id FK
    varchar contact_person
    varchar payment_terms
    varchar source
    bigint_unsigned submitted_by_client_user_id FK
    bigint_unsigned created_by_user_id FK
    text general_notes
    date required_by_date
    date due_date
    varchar status
    text rejection_reason
    datetime created_at
    datetime updated_at
  }
  inquiry_item {
    bigint_unsigned inquiry_item_id PK
    bigint_unsigned inquiry_id FK,UK
    smallint_unsigned line_no UK
    bigint_unsigned filter_type_id FK
    varchar filter_name
    varchar oem_reference
    decimal od1_mm
    decimal od2_mm
    decimal id1_mm
    decimal id2_mm
    decimal height_mm
    decimal overall_height_mm
    varchar filter_media
    varchar inner_core
    varchar outer_core
    varchar o_ring
    varchar gasket
    varchar filtration_rating
    varchar filtration_rating_custom
    int_unsigned quantity
    json template_specifications
    bigint_unsigned sketch_document_id FK
  }
  quotation {
    bigint_unsigned quotation_id PK
    varchar quotation_no UK
    bigint_unsigned inquiry_id FK,UK
    smallint_unsigned revision_no UK
    tinyint is_current
    bigint_unsigned current_inquiry_id UK
    date quotation_date
    date valid_until
    varchar terms_of_payment
    varchar time_of_delivery
    text place_of_delivery
    varchar vat_type
    varchar highlight_tag
    text highlight_note
    tinyint requires_downpayment
    decimal downpayment_percent
    decimal downpayment_amount
    decimal subtotal
    decimal addons_total
    decimal total_amount
    varchar status
    bigint_unsigned prepared_by_user_id FK
    bigint_unsigned approved_by_user_id FK
    datetime sent_at
    datetime created_at
  }
  quotation_item {
    bigint_unsigned quotation_item_id PK
    bigint_unsigned quotation_id FK,UK
    bigint_unsigned inquiry_item_id FK
    smallint_unsigned line_no UK
    varchar description
    decimal quantity
    bigint_unsigned uom_id FK
    decimal unit_price
    decimal line_total
  }
  cost_estimate {
    bigint_unsigned estimate_id PK
    bigint_unsigned quotation_item_id FK
    decimal labor_cost_per_unit
    tinyint include_labor
    decimal markup_percent
    tinyint apply_markup
    varchar vat_type
    decimal vat_rate
    tinyint apply_vat
    decimal material_cost_per_unit
    decimal unit_cost_with_markup
    decimal unit_cost_with_vat
    tinyint is_locked
    bigint_unsigned created_by_user_id FK
    datetime created_at
  }
  raw_material {
    bigint_unsigned material_id PK
    bigint_unsigned material_category_id FK
    varchar material_name
    bigint_unsigned uom_id FK
    decimal qty_in_stock
    enum quantity_status
    decimal unit_price
    bigint_unsigned unit_price_approved_by_user_id FK
    datetime unit_price_approved_at
    decimal reference_unit_price
    bigint_unsigned reference_document_id FK
    smallint_unsigned reference_page
    decimal reorder_threshold
    enum threshold_status
    varchar supplier_name
    tinyint is_active
    datetime created_at
    datetime updated_at
  }
  cost_estimate_material {
    bigint_unsigned estimate_material_id PK
    bigint_unsigned estimate_id FK
    bigint_unsigned material_category_id FK
    bigint_unsigned raw_material_id FK
    decimal qty_per_filter
    bigint_unsigned uom_id FK
    decimal unit_price_snapshot
    decimal line_cost
  }
  purchase_order {
    bigint_unsigned po_id PK
    varchar po_no UK
    bigint_unsigned quotation_id FK
    bigint_unsigned po_document_id FK
    date received_date
    varchar payment_terms
    bigint_unsigned delivery_method_id FK
    bigint_unsigned recorded_by_user_id FK
    datetime created_at
  }
  job_order {
    bigint_unsigned jo_id PK
    varchar jo_no UK
    bigint_unsigned po_id FK,UK
    date jo_date
    date due_date
    varchar status
    varchar payment_terms
    bigint_unsigned delivery_method_id FK
    tinyint po_verified
    tinyint specs_verified
    tinyint terms_verified
    bigint_unsigned prepared_by_user_id FK
    bigint_unsigned approved_by_user_id FK
    text cancellation_reason
    datetime completed_at
    datetime archived_at
    datetime created_at
  }
  job_order_item {
    bigint_unsigned jo_item_id PK
    bigint_unsigned jo_id FK,UK
    bigint_unsigned quotation_item_id FK
    smallint_unsigned line_no UK
    varchar item_code
    varchar enterfil_pn
    varchar item_name
    int_unsigned quantity
    decimal od1_mm
    decimal od2_mm
    decimal id1_mm
    decimal id2_mm
    decimal height_mm
    decimal overall_height_mm
    varchar filter_media
    varchar inner_core
    varchar outer_core
    varchar end_cap
    varchar o_ring
    varchar gasket
    varchar oem_pn
    varchar brand
    text other_specs
    json template_specifications_snapshot
    bigint_unsigned final_sketch_document_id FK
  }
  job_order_stage {
    bigint_unsigned jo_stage_id PK
    bigint_unsigned jo_id FK,UK
    bigint_unsigned stage_id FK,UK
    enum status
    datetime started_at
    datetime completed_at
    bigint_unsigned marked_by_user_id FK
    text remarks
    int_unsigned reverted_count
  }
  material_shortage_report {
    bigint_unsigned report_id PK
    bigint_unsigned jo_id FK
    bigint_unsigned jo_stage_id FK
    bigint_unsigned raw_material_id FK
    decimal qty_needed
    text description
    varchar status
    bigint_unsigned reported_by_user_id FK
    datetime reported_at
    datetime resolved_at
  }
  finished_good {
    bigint_unsigned finished_good_id PK
    varchar item_code UK
    varchar enterfil_pn
    varchar item_name
    bigint_unsigned client_id FK
    bigint_unsigned filter_type_id FK
    int_unsigned qty_in_stock
    enum quantity_status
    int_unsigned buffer_min
    enum threshold_status
    varchar demand_level
    varchar order_frequency
    decimal avg_qty_per_order
    tinyint is_active
  }
  stock_movement {
    bigint_unsigned movement_id PK
    enum item_type
    bigint_unsigned raw_material_id FK
    bigint_unsigned finished_good_id FK
    text movement_reason
    enum quantity_status_before
    decimal qty_before
    decimal qty_after
    decimal qty_change
    bigint_unsigned uom_id FK
    varchar reference_no
    varchar supplier_name
    bigint_unsigned jo_id FK
    text notes
    bigint_unsigned performed_by_user_id FK
    varchar operation_key UK
    datetime created_at
  }
  stock_request {
    bigint_unsigned stock_request_id PK
    bigint_unsigned inquiry_id FK
    bigint_unsigned requested_by_user_id FK
    bigint_unsigned handled_by_user_id FK
    datetime request_date
    varchar status
    text remarks
    datetime created_at
    datetime updated_at
  }
  stock_request_item {
    bigint_unsigned stock_request_item_id PK
    bigint_unsigned stock_request_id FK,UK
    bigint_unsigned raw_material_id FK,UK
    decimal qty_requested
    decimal stock_at_request
    decimal qty_available
    decimal shortage_at_request
    enum quantity_status_at_request
    enum available_quantity_status
    datetime observed_at
    bigint_unsigned observed_by_user_id FK
    bigint_unsigned uom_id FK
    text notes
  }
  production_plan {
    bigint_unsigned plan_id PK
    varchar plan_code UK
    bigint_unsigned client_id FK
    bigint_unsigned finished_good_id FK
    bigint_unsigned jo_id FK
    varchar source
    int_unsigned planned_qty
    date week_start_date
    date week_end_date
    bigint_unsigned created_by_user_id FK
  }
  sales_invoice {
    bigint_unsigned invoice_id PK
    varchar invoice_no UK
    bigint_unsigned po_id FK,UK
    date invoice_date
    varchar payment_terms
    date delivered_date
    date due_date
    decimal total_amount
    varchar status
    bigint_unsigned issued_by_user_id FK
    datetime created_at
  }
  client_receipt {
    bigint_unsigned receipt_id PK,UK
    bigint_unsigned invoice_id FK,UK
    bigint_unsigned client_user_id FK
    bigint_unsigned payment_method_id FK
    decimal amount_declared
    text note
    enum review_status
    bigint_unsigned reviewed_by_user_id FK
    datetime reviewed_at
    text review_note
    datetime sent_at
  }
  payment_transaction {
    bigint_unsigned payment_id PK
    bigint_unsigned invoice_id FK
    bigint_unsigned payment_method_id FK
    varchar transaction_type
    decimal amount
    varchar reference_no
    date date_paid
    bigint_unsigned client_receipt_id FK
    varchar approval_status
    bigint_unsigned recorded_by_user_id FK
    bigint_unsigned approved_by_user_id FK
    datetime approved_at
    text notes
    datetime created_at
    varchar operation_key UK
    bigint_unsigned official_receipt_document_id FK
  }
  delivery {
    bigint_unsigned delivery_id PK
    bigint_unsigned jo_id FK
    bigint_unsigned delivery_method_id FK
    varchar status
    datetime dispatch_date
    date estimated_delivery_date
    datetime delivered_date
    varchar driver_name
    varchar driver_contact
    varchar vehicle_plate
    varchar tracking_link
    varchar received_by
    text notes
    bigint_unsigned dispatched_by_user_id FK
    datetime created_at
  }
  delivery_item {
    bigint_unsigned delivery_item_id PK
    bigint_unsigned delivery_id FK,UK
    bigint_unsigned jo_item_id FK,UK
    int_unsigned quantity
  }
  notification {
    bigint_unsigned notification_id PK
    bigint_unsigned user_id FK
    varchar title
    text message
    varchar notification_type
    tinyint is_read
    datetime created_at
    datetime read_at
  }
  client_receipt_file {
    bigint_unsigned receipt_id FK,PK
    bigint_unsigned document_id FK,PK
  }
  waybill {
    bigint_unsigned waybill_id PK
    bigint_unsigned delivery_id UK,FK
    varchar waybill_no UK
    varchar qr_identifier UK
    bigint_unsigned generated_by_user_id FK
    datetime generated_at
    datetime printed_at
    bigint_unsigned document_id FK
  }
  delivery_receipt {
    bigint_unsigned delivery_receipt_id PK
    bigint_unsigned delivery_id FK,UK
    varchar dr_no UK
    bigint_unsigned generated_by_user_id FK
    datetime generated_at
    bigint_unsigned document_id FK
  }
  signed_delivery_receipt {
    bigint_unsigned signed_dr_id PK
    bigint_unsigned delivery_receipt_id FK
    bigint_unsigned document_id FK,UK
    bigint_unsigned submitted_by_user_id FK
    datetime submitted_at
    datetime received_at
  }
  production_stage_event {
    bigint_unsigned stage_event_id PK
    bigint_unsigned jo_stage_id FK
    varchar action
    text reason
    bigint_unsigned performed_by_user_id FK
    datetime occurred_at
  }
  audit_event {
    bigint_unsigned audit_event_id PK
    bigint_unsigned actor_user_id FK
    varchar action
    varchar subject_type
    bigint_unsigned subject_id
    json before_value
    json after_value
    text reason
    datetime occurred_at
  }
  user_account o|--o{ audit_event : audit_event_ibfk_1
  delivery_method o|--o{ client : client_ibfk_1
  sales_invoice ||--o{ client_receipt : client_receipt_ibfk_1
  client_user ||--o{ client_receipt : client_receipt_ibfk_2
  payment_method ||--o{ client_receipt : client_receipt_ibfk_3
  user_account o|--o{ client_receipt : client_receipt_ibfk_4
  client_receipt ||--o{ client_receipt_file : client_receipt_file_ibfk_1
  document ||--o{ client_receipt_file : client_receipt_file_ibfk_2
  user_account ||--o| client_user : client_user_ibfk_1
  client ||--o| client_user : client_user_ibfk_2
  quotation_item ||--o{ cost_estimate : cost_estimate_ibfk_1
  user_account ||--o{ cost_estimate : cost_estimate_ibfk_2
  cost_estimate ||--o{ cost_estimate_material : cost_estimate_material_ibfk_1
  material_category o|--o{ cost_estimate_material : cost_estimate_material_ibfk_2
  raw_material ||--o{ cost_estimate_material : cost_estimate_material_ibfk_3
  unit_of_measure ||--o{ cost_estimate_material : cost_estimate_material_ibfk_4
  job_order ||--o{ delivery : delivery_ibfk_1
  delivery_method ||--o{ delivery : delivery_ibfk_2
  user_account o|--o{ delivery : delivery_ibfk_3
  delivery ||--o{ delivery_item : delivery_item_ibfk_1
  job_order_item ||--o{ delivery_item : delivery_item_ibfk_2
  delivery ||--o| delivery_receipt : delivery_receipt_ibfk_1
  user_account ||--o{ delivery_receipt : delivery_receipt_ibfk_2
  document o|--o{ delivery_receipt : delivery_receipt_ibfk_3
  user_account ||--o{ document : document_ibfk_1
  client ||--o{ finished_good : finished_good_ibfk_1
  filter_type ||--o{ finished_good : finished_good_ibfk_2
  client ||--o{ inquiry : inquiry_ibfk_1
  client_user o|--o{ inquiry : inquiry_ibfk_2
  user_account o|--o{ inquiry : inquiry_ibfk_3
  inquiry ||--o{ inquiry_item : inquiry_item_ibfk_1
  filter_type ||--o{ inquiry_item : inquiry_item_ibfk_2
  document o|--o{ inquiry_item : inquiry_item_ibfk_3
  purchase_order ||--o| job_order : job_order_ibfk_1
  delivery_method ||--o{ job_order : job_order_ibfk_2
  user_account ||--o{ job_order : job_order_ibfk_3
  user_account o|--o{ job_order : job_order_ibfk_4
  job_order ||--o{ job_order_item : job_order_item_ibfk_1
  quotation_item ||--o{ job_order_item : job_order_item_ibfk_2
  document o|--o{ job_order_item : job_order_item_ibfk_3
  job_order ||--o{ job_order_stage : job_order_stage_ibfk_1
  production_stage ||--o{ job_order_stage : job_order_stage_ibfk_2
  user_account o|--o{ job_order_stage : job_order_stage_ibfk_3
  job_order ||--o{ material_shortage_report : material_shortage_report_ibfk_1
  job_order_stage o|--o{ material_shortage_report : material_shortage_report_ibfk_2
  raw_material ||--o{ material_shortage_report : material_shortage_report_ibfk_3
  user_account ||--o{ material_shortage_report : material_shortage_report_ibfk_4
  user_account ||--o{ notification : notification_ibfk_1
  sales_invoice ||--o{ payment_transaction : payment_transaction_ibfk_1
  payment_method ||--o{ payment_transaction : payment_transaction_ibfk_2
  client_receipt o|--o{ payment_transaction : payment_transaction_ibfk_3
  user_account ||--o{ payment_transaction : payment_transaction_ibfk_4
  user_account ||--o{ payment_transaction : payment_transaction_ibfk_5
  document o|--o{ payment_transaction : payment_transaction_ibfk_6
  client ||--o{ production_plan : production_plan_ibfk_1
  finished_good o|--o{ production_plan : production_plan_ibfk_2
  job_order o|--o{ production_plan : production_plan_ibfk_3
  user_account ||--o{ production_plan : production_plan_ibfk_4
  job_order_stage ||--o{ production_stage_event : production_stage_event_ibfk_1
  user_account ||--o{ production_stage_event : production_stage_event_ibfk_2
  quotation ||--o{ purchase_order : purchase_order_ibfk_1
  document ||--o{ purchase_order : purchase_order_ibfk_2
  delivery_method ||--o{ purchase_order : purchase_order_ibfk_3
  user_account o|--o{ purchase_order : purchase_order_ibfk_4
  inquiry ||--o{ quotation : quotation_ibfk_1
  user_account ||--o{ quotation : quotation_ibfk_2
  user_account o|--o{ quotation : quotation_ibfk_3
  quotation ||--o{ quotation_item : quotation_item_ibfk_1
  inquiry_item o|--o{ quotation_item : quotation_item_ibfk_2
  unit_of_measure ||--o{ quotation_item : quotation_item_ibfk_3
  material_category o|--o{ raw_material : raw_material_ibfk_1
  unit_of_measure ||--o{ raw_material : raw_material_ibfk_2
  user_account o|--o{ raw_material : raw_material_ibfk_3
  document o|--o{ raw_material : raw_material_ibfk_4
  purchase_order ||--o| sales_invoice : sales_invoice_ibfk_1
  user_account ||--o{ sales_invoice : sales_invoice_ibfk_2
  delivery_receipt ||--o{ signed_delivery_receipt : signed_delivery_receipt_ibfk_1
  document ||--o| signed_delivery_receipt : signed_delivery_receipt_ibfk_2
  user_account ||--o{ signed_delivery_receipt : signed_delivery_receipt_ibfk_3
  raw_material o|--o{ stock_movement : stock_movement_ibfk_1
  finished_good o|--o{ stock_movement : stock_movement_ibfk_2
  unit_of_measure o|--o{ stock_movement : stock_movement_ibfk_3
  job_order o|--o{ stock_movement : stock_movement_ibfk_4
  user_account ||--o{ stock_movement : stock_movement_ibfk_5
  inquiry ||--o{ stock_request : stock_request_ibfk_1
  user_account ||--o{ stock_request : stock_request_ibfk_2
  user_account o|--o{ stock_request : stock_request_ibfk_3
  stock_request ||--o{ stock_request_item : stock_request_item_ibfk_1
  raw_material ||--o{ stock_request_item : stock_request_item_ibfk_2
  unit_of_measure ||--o{ stock_request_item : stock_request_item_ibfk_3
  user_account o|--o{ stock_request_item : stock_request_item_ibfk_4
  role ||--o{ user_account : user_account_ibfk_1
  delivery ||--o| waybill : waybill_ibfk_1
  user_account ||--o{ waybill : waybill_ibfk_2
  document o|--o{ waybill : waybill_ibfk_3
```

## Relationship cardinalities and referential actions

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

## Actual MySQL table definitions

### audit_event

```sql
CREATE TABLE `audit_event` (
  `audit_event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `actor_user_id` bigint unsigned DEFAULT NULL,
  `action` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` bigint unsigned NOT NULL,
  `before_value` json DEFAULT NULL,
  `after_value` json DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `occurred_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`audit_event_id`),
  KEY `ix_audit_subject` (`subject_type`,`subject_id`,`occurred_at`),
  KEY `actor_user_id` (`actor_user_id`),
  CONSTRAINT `audit_event_ibfk_1` FOREIGN KEY (`actor_user_id`) REFERENCES `user_account` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### client

```sql
CREATE TABLE `client` (
  `client_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `industry` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_person` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city_province` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zip_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `default_payment_terms` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preferred_delivery_method_id` bigint unsigned DEFAULT NULL,
  `internal_notes` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_since` date DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`client_id`),
  UNIQUE KEY `uq_client_company` (`company_name`),
  KEY `preferred_delivery_method_id` (`preferred_delivery_method_id`),
  CONSTRAINT `client_ibfk_1` FOREIGN KEY (`preferred_delivery_method_id`) REFERENCES `delivery_method` (`delivery_method_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### client_receipt

```sql
CREATE TABLE `client_receipt` (
  `receipt_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint unsigned NOT NULL,
  `client_user_id` bigint unsigned NOT NULL,
  `payment_method_id` bigint unsigned NOT NULL,
  `amount_declared` decimal(19,2) NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `review_status` enum('pending','verified','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reviewed_by_user_id` bigint unsigned DEFAULT NULL,
  `reviewed_at` datetime(3) DEFAULT NULL,
  `review_note` text COLLATE utf8mb4_unicode_ci,
  `sent_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`receipt_id`),
  UNIQUE KEY `uq_receipt_invoice` (`receipt_id`,`invoice_id`),
  KEY `ix_receipt_review` (`review_status`,`sent_at`),
  KEY `invoice_id` (`invoice_id`),
  KEY `client_user_id` (`client_user_id`),
  KEY `payment_method_id` (`payment_method_id`),
  KEY `reviewed_by_user_id` (`reviewed_by_user_id`),
  CONSTRAINT `client_receipt_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoice` (`invoice_id`),
  CONSTRAINT `client_receipt_ibfk_2` FOREIGN KEY (`client_user_id`) REFERENCES `client_user` (`client_user_id`),
  CONSTRAINT `client_receipt_ibfk_3` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method` (`payment_method_id`),
  CONSTRAINT `client_receipt_ibfk_4` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_receipt_amount` CHECK ((`amount_declared` > 0)),
  CONSTRAINT `ck_receipt_review` CHECK ((((`review_status` = _utf8mb4'pending') and (`reviewed_by_user_id` is null) and (`reviewed_at` is null)) or ((`review_status` in (_utf8mb4'verified',_utf8mb4'rejected')) and (`reviewed_by_user_id` is not null) and (`reviewed_at` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### client_receipt_file

```sql
CREATE TABLE `client_receipt_file` (
  `receipt_id` bigint unsigned NOT NULL,
  `document_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`receipt_id`,`document_id`),
  KEY `document_id` (`document_id`),
  CONSTRAINT `client_receipt_file_ibfk_1` FOREIGN KEY (`receipt_id`) REFERENCES `client_receipt` (`receipt_id`),
  CONSTRAINT `client_receipt_file_ibfk_2` FOREIGN KEY (`document_id`) REFERENCES `document` (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### client_user

```sql
CREATE TABLE `client_user` (
  `client_user_id` bigint unsigned NOT NULL,
  `client_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`client_user_id`),
  UNIQUE KEY `uq_company_portal_login` (`client_id`),
  UNIQUE KEY `uq_client_user_owner` (`client_user_id`,`client_id`),
  CONSTRAINT `client_user_ibfk_1` FOREIGN KEY (`client_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `client_user_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### cost_estimate

```sql
CREATE TABLE `cost_estimate` (
  `estimate_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `quotation_item_id` bigint unsigned NOT NULL,
  `labor_cost_per_unit` decimal(15,4) NOT NULL,
  `include_labor` tinyint(1) NOT NULL,
  `markup_percent` decimal(9,4) NOT NULL,
  `apply_markup` tinyint(1) NOT NULL,
  `vat_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vat_rate` decimal(7,4) NOT NULL,
  `apply_vat` tinyint(1) NOT NULL,
  `material_cost_per_unit` decimal(15,4) NOT NULL,
  `unit_cost_with_markup` decimal(15,4) NOT NULL,
  `unit_cost_with_vat` decimal(15,4) NOT NULL,
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `created_by_user_id` bigint unsigned NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`estimate_id`),
  KEY `ix_estimate_item_history` (`quotation_item_id`,`created_at`),
  KEY `created_by_user_id` (`created_by_user_id`),
  CONSTRAINT `cost_estimate_ibfk_1` FOREIGN KEY (`quotation_item_id`) REFERENCES `quotation_item` (`quotation_item_id`),
  CONSTRAINT `cost_estimate_ibfk_2` FOREIGN KEY (`created_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_estimate_flags` CHECK (((`include_labor` in (0,1)) and (`apply_markup` in (0,1)) and (`apply_vat` in (0,1)) and (`is_locked` in (0,1)))),
  CONSTRAINT `ck_estimate_values` CHECK (((`labor_cost_per_unit` >= 0) and (`markup_percent` >= 0) and (`vat_rate` between 0 and 100) and (`material_cost_per_unit` >= 0) and (`unit_cost_with_markup` >= 0) and (`unit_cost_with_vat` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### cost_estimate_material

```sql
CREATE TABLE `cost_estimate_material` (
  `estimate_material_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `estimate_id` bigint unsigned NOT NULL,
  `material_category_id` bigint unsigned DEFAULT NULL,
  `raw_material_id` bigint unsigned NOT NULL,
  `qty_per_filter` decimal(15,4) NOT NULL,
  `uom_id` bigint unsigned NOT NULL,
  `unit_price_snapshot` decimal(15,4) NOT NULL,
  `line_cost` decimal(19,4) GENERATED ALWAYS AS ((`qty_per_filter` * `unit_price_snapshot`)) STORED,
  PRIMARY KEY (`estimate_material_id`),
  KEY `estimate_id` (`estimate_id`),
  KEY `material_category_id` (`material_category_id`),
  KEY `raw_material_id` (`raw_material_id`),
  KEY `uom_id` (`uom_id`),
  CONSTRAINT `cost_estimate_material_ibfk_1` FOREIGN KEY (`estimate_id`) REFERENCES `cost_estimate` (`estimate_id`),
  CONSTRAINT `cost_estimate_material_ibfk_2` FOREIGN KEY (`material_category_id`) REFERENCES `material_category` (`material_category_id`),
  CONSTRAINT `cost_estimate_material_ibfk_3` FOREIGN KEY (`raw_material_id`) REFERENCES `raw_material` (`material_id`),
  CONSTRAINT `cost_estimate_material_ibfk_4` FOREIGN KEY (`uom_id`) REFERENCES `unit_of_measure` (`uom_id`),
  CONSTRAINT `ck_estimate_material_values` CHECK (((`qty_per_filter` > 0) and (`unit_price_snapshot` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### delivery

```sql
CREATE TABLE `delivery` (
  `delivery_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_id` bigint unsigned NOT NULL,
  `delivery_method_id` bigint unsigned NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dispatch_date` datetime(3) DEFAULT NULL,
  `estimated_delivery_date` date DEFAULT NULL,
  `delivered_date` datetime(3) DEFAULT NULL,
  `driver_name` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_contact` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_plate` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tracking_link` varchar(2048) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `received_by` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `dispatched_by_user_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`delivery_id`),
  KEY `ix_delivery_queue` (`status`,`estimated_delivery_date`),
  KEY `jo_id` (`jo_id`),
  KEY `delivery_method_id` (`delivery_method_id`),
  KEY `dispatched_by_user_id` (`dispatched_by_user_id`),
  CONSTRAINT `delivery_ibfk_1` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `delivery_ibfk_2` FOREIGN KEY (`delivery_method_id`) REFERENCES `delivery_method` (`delivery_method_id`),
  CONSTRAINT `delivery_ibfk_3` FOREIGN KEY (`dispatched_by_user_id`) REFERENCES `user_account` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### delivery_item

```sql
CREATE TABLE `delivery_item` (
  `delivery_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delivery_id` bigint unsigned NOT NULL,
  `jo_item_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL,
  PRIMARY KEY (`delivery_item_id`),
  UNIQUE KEY `uq_delivery_item` (`delivery_id`,`jo_item_id`),
  KEY `jo_item_id` (`jo_item_id`),
  CONSTRAINT `delivery_item_ibfk_1` FOREIGN KEY (`delivery_id`) REFERENCES `delivery` (`delivery_id`),
  CONSTRAINT `delivery_item_ibfk_2` FOREIGN KEY (`jo_item_id`) REFERENCES `job_order_item` (`jo_item_id`),
  CONSTRAINT `ck_delivery_item_quantity` CHECK ((`quantity` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### delivery_method

```sql
CREATE TABLE `delivery_method` (
  `delivery_method_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `method_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`delivery_method_id`),
  UNIQUE KEY `uq_delivery_method_name` (`method_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### delivery_receipt

```sql
CREATE TABLE `delivery_receipt` (
  `delivery_receipt_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delivery_id` bigint unsigned NOT NULL,
  `dr_no` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `generated_by_user_id` bigint unsigned NOT NULL,
  `generated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `document_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`delivery_receipt_id`),
  UNIQUE KEY `uq_dr_delivery` (`delivery_id`),
  UNIQUE KEY `uq_dr_number` (`dr_no`),
  KEY `generated_by_user_id` (`generated_by_user_id`),
  KEY `document_id` (`document_id`),
  CONSTRAINT `delivery_receipt_ibfk_1` FOREIGN KEY (`delivery_id`) REFERENCES `delivery` (`delivery_id`),
  CONSTRAINT `delivery_receipt_ibfk_2` FOREIGN KEY (`generated_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `delivery_receipt_ibfk_3` FOREIGN KEY (`document_id`) REFERENCES `document` (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### document

```sql
CREATE TABLE `document` (
  `document_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `storage_bucket` varchar(63) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `storage_key` varchar(700) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `object_generation` varchar(40) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `mime_type` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` bigint unsigned NOT NULL,
  `sha256` char(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `storage_status` enum('pending','available','failed','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `uploaded_by_user_id` bigint unsigned NOT NULL,
  `uploaded_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`document_id`),
  UNIQUE KEY `uq_document_object_version` (`storage_bucket`,`storage_key`,`object_generation`),
  KEY `uploaded_by_user_id` (`uploaded_by_user_id`),
  CONSTRAINT `document_ibfk_1` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_document_available` CHECK (((`storage_status` <> _utf8mb4'available') or ((`storage_bucket` is not null) and (`storage_key` is not null) and (`object_generation` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### filter_type

```sql
CREATE TABLE `filter_type` (
  `filter_type_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `filter_type_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_group` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`filter_type_id`),
  UNIQUE KEY `uq_filter_type_name` (`filter_type_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### finished_good

```sql
CREATE TABLE `finished_good` (
  `finished_good_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `item_code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enterfil_pn` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` bigint unsigned NOT NULL,
  `filter_type_id` bigint unsigned NOT NULL,
  `qty_in_stock` int unsigned DEFAULT NULL,
  `quantity_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `buffer_min` int unsigned DEFAULT NULL,
  `threshold_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `demand_level` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_frequency` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avg_qty_per_order` decimal(15,4) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`finished_good_id`),
  UNIQUE KEY `uq_finished_item_code` (`item_code`),
  KEY `ix_finished_client` (`client_id`,`item_name`),
  KEY `filter_type_id` (`filter_type_id`),
  CONSTRAINT `finished_good_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`),
  CONSTRAINT `finished_good_ibfk_2` FOREIGN KEY (`filter_type_id`) REFERENCES `filter_type` (`filter_type_id`),
  CONSTRAINT `ck_finished_average` CHECK (((`avg_qty_per_order` is null) or (`avg_qty_per_order` >= 0))),
  CONSTRAINT `ck_finished_quantity` CHECK ((((`quantity_status` = _utf8mb4'unknown') and (`qty_in_stock` is null)) or ((`quantity_status` in (_utf8mb4'provisional_sample',_utf8mb4'verified')) and (`qty_in_stock` is not null)))),
  CONSTRAINT `ck_finished_threshold` CHECK ((((`threshold_status` = _utf8mb4'unknown') and (`buffer_min` is null)) or ((`threshold_status` in (_utf8mb4'provisional_sample',_utf8mb4'verified')) and (`buffer_min` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### inquiry

```sql
CREATE TABLE `inquiry` (
  `inquiry_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `inquiry_no` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` bigint unsigned NOT NULL,
  `contact_person` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_terms` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submitted_by_client_user_id` bigint unsigned DEFAULT NULL,
  `created_by_user_id` bigint unsigned DEFAULT NULL,
  `general_notes` text COLLATE utf8mb4_unicode_ci,
  `required_by_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`inquiry_id`),
  UNIQUE KEY `uq_inquiry_number` (`inquiry_no`),
  KEY `ix_inquiry_client_queue` (`client_id`,`status`,`created_at`),
  KEY `submitted_by_client_user_id` (`submitted_by_client_user_id`,`client_id`),
  KEY `created_by_user_id` (`created_by_user_id`),
  CONSTRAINT `inquiry_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`),
  CONSTRAINT `inquiry_ibfk_2` FOREIGN KEY (`submitted_by_client_user_id`, `client_id`) REFERENCES `client_user` (`client_user_id`, `client_id`),
  CONSTRAINT `inquiry_ibfk_3` FOREIGN KEY (`created_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_inquiry_creator` CHECK (((`submitted_by_client_user_id` is not null) or (`created_by_user_id` is not null)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### inquiry_item

```sql
CREATE TABLE `inquiry_item` (
  `inquiry_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `inquiry_id` bigint unsigned NOT NULL,
  `line_no` smallint unsigned NOT NULL,
  `filter_type_id` bigint unsigned NOT NULL,
  `filter_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `oem_reference` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `od1_mm` decimal(15,4) DEFAULT NULL,
  `od2_mm` decimal(15,4) DEFAULT NULL,
  `id1_mm` decimal(15,4) DEFAULT NULL,
  `id2_mm` decimal(15,4) DEFAULT NULL,
  `height_mm` decimal(15,4) DEFAULT NULL,
  `overall_height_mm` decimal(15,4) DEFAULT NULL,
  `filter_media` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `inner_core` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outer_core` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `o_ring` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gasket` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filtration_rating` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filtration_rating_custom` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int unsigned NOT NULL,
  `template_specifications` json DEFAULT NULL,
  `sketch_document_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`inquiry_item_id`),
  UNIQUE KEY `uq_inquiry_line` (`inquiry_id`,`line_no`),
  KEY `filter_type_id` (`filter_type_id`),
  KEY `sketch_document_id` (`sketch_document_id`),
  CONSTRAINT `inquiry_item_ibfk_1` FOREIGN KEY (`inquiry_id`) REFERENCES `inquiry` (`inquiry_id`),
  CONSTRAINT `inquiry_item_ibfk_2` FOREIGN KEY (`filter_type_id`) REFERENCES `filter_type` (`filter_type_id`),
  CONSTRAINT `inquiry_item_ibfk_3` FOREIGN KEY (`sketch_document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `ck_inquiry_line_quantity` CHECK (((`quantity` > 0) and (`line_no` > 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### job_order

```sql
CREATE TABLE `job_order` (
  `jo_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_no` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_id` bigint unsigned NOT NULL,
  `jo_date` date NOT NULL,
  `due_date` date NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_terms` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_method_id` bigint unsigned NOT NULL,
  `po_verified` tinyint(1) NOT NULL DEFAULT '0',
  `specs_verified` tinyint(1) NOT NULL DEFAULT '0',
  `terms_verified` tinyint(1) NOT NULL DEFAULT '0',
  `prepared_by_user_id` bigint unsigned NOT NULL,
  `approved_by_user_id` bigint unsigned DEFAULT NULL,
  `cancellation_reason` text COLLATE utf8mb4_unicode_ci,
  `completed_at` datetime(3) DEFAULT NULL,
  `archived_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`jo_id`),
  UNIQUE KEY `uq_jo_number` (`jo_no`),
  UNIQUE KEY `uq_jo_po` (`po_id`),
  KEY `ix_jo_queue` (`status`,`due_date`),
  KEY `delivery_method_id` (`delivery_method_id`),
  KEY `prepared_by_user_id` (`prepared_by_user_id`),
  KEY `approved_by_user_id` (`approved_by_user_id`),
  CONSTRAINT `job_order_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_order` (`po_id`),
  CONSTRAINT `job_order_ibfk_2` FOREIGN KEY (`delivery_method_id`) REFERENCES `delivery_method` (`delivery_method_id`),
  CONSTRAINT `job_order_ibfk_3` FOREIGN KEY (`prepared_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `job_order_ibfk_4` FOREIGN KEY (`approved_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_jo_verification_flags` CHECK (((`po_verified` in (0,1)) and (`specs_verified` in (0,1)) and (`terms_verified` in (0,1))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### job_order_item

```sql
CREATE TABLE `job_order_item` (
  `jo_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_id` bigint unsigned NOT NULL,
  `quotation_item_id` bigint unsigned NOT NULL,
  `line_no` smallint unsigned NOT NULL,
  `item_code` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enterfil_pn` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int unsigned NOT NULL,
  `od1_mm` decimal(15,4) DEFAULT NULL,
  `od2_mm` decimal(15,4) DEFAULT NULL,
  `id1_mm` decimal(15,4) DEFAULT NULL,
  `id2_mm` decimal(15,4) DEFAULT NULL,
  `height_mm` decimal(15,4) DEFAULT NULL,
  `overall_height_mm` decimal(15,4) DEFAULT NULL,
  `filter_media` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `inner_core` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outer_core` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `end_cap` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `o_ring` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gasket` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `oem_pn` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `other_specs` text COLLATE utf8mb4_unicode_ci,
  `template_specifications_snapshot` json DEFAULT NULL,
  `final_sketch_document_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`jo_item_id`),
  UNIQUE KEY `uq_jo_item_line` (`jo_id`,`line_no`),
  KEY `quotation_item_id` (`quotation_item_id`),
  KEY `final_sketch_document_id` (`final_sketch_document_id`),
  CONSTRAINT `job_order_item_ibfk_1` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `job_order_item_ibfk_2` FOREIGN KEY (`quotation_item_id`) REFERENCES `quotation_item` (`quotation_item_id`),
  CONSTRAINT `job_order_item_ibfk_3` FOREIGN KEY (`final_sketch_document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `ck_jo_item_quantity` CHECK (((`quantity` > 0) and (`line_no` > 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### job_order_stage

```sql
CREATE TABLE `job_order_stage` (
  `jo_stage_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_id` bigint unsigned NOT NULL,
  `stage_id` bigint unsigned NOT NULL,
  `status` enum('pending','in_progress','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `started_at` datetime(3) DEFAULT NULL,
  `completed_at` datetime(3) DEFAULT NULL,
  `marked_by_user_id` bigint unsigned DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `reverted_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`jo_stage_id`),
  UNIQUE KEY `uq_jo_defined_stage` (`jo_id`,`stage_id`),
  KEY `stage_id` (`stage_id`),
  KEY `marked_by_user_id` (`marked_by_user_id`),
  CONSTRAINT `job_order_stage_ibfk_1` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `job_order_stage_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `production_stage` (`stage_id`),
  CONSTRAINT `job_order_stage_ibfk_3` FOREIGN KEY (`marked_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_stage_times` CHECK ((((`status` = _utf8mb4'pending') and (`started_at` is null) and (`completed_at` is null)) or ((`status` = _utf8mb4'in_progress') and (`started_at` is not null) and (`completed_at` is null) and (`marked_by_user_id` is not null)) or ((`status` = _utf8mb4'completed') and (`started_at` is not null) and (`completed_at` is not null) and (`completed_at` >= `started_at`) and (`marked_by_user_id` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### material_category

```sql
CREATE TABLE `material_category` (
  `material_category_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`material_category_id`),
  UNIQUE KEY `uq_material_category_name` (`category_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### material_shortage_report

```sql
CREATE TABLE `material_shortage_report` (
  `report_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_id` bigint unsigned NOT NULL,
  `jo_stage_id` bigint unsigned DEFAULT NULL,
  `raw_material_id` bigint unsigned NOT NULL,
  `qty_needed` decimal(15,4) NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reported_by_user_id` bigint unsigned NOT NULL,
  `reported_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resolved_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`report_id`),
  KEY `ix_shortage_queue` (`status`,`reported_at`),
  KEY `jo_id` (`jo_id`),
  KEY `jo_stage_id` (`jo_stage_id`),
  KEY `raw_material_id` (`raw_material_id`),
  KEY `reported_by_user_id` (`reported_by_user_id`),
  CONSTRAINT `material_shortage_report_ibfk_1` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `material_shortage_report_ibfk_2` FOREIGN KEY (`jo_stage_id`) REFERENCES `job_order_stage` (`jo_stage_id`),
  CONSTRAINT `material_shortage_report_ibfk_3` FOREIGN KEY (`raw_material_id`) REFERENCES `raw_material` (`material_id`),
  CONSTRAINT `material_shortage_report_ibfk_4` FOREIGN KEY (`reported_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_shortage_quantity` CHECK ((`qty_needed` > 0)),
  CONSTRAINT `ck_shortage_resolved` CHECK (((`resolved_at` is null) or (`resolved_at` >= `reported_at`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### notification

```sql
CREATE TABLE `notification` (
  `notification_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `notification_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `read_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`notification_id`),
  KEY `ix_user_notifications` (`user_id`,`is_read`,`created_at`),
  CONSTRAINT `notification_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_notification_read` CHECK ((((`is_read` = 0) and (`read_at` is null)) or ((`is_read` = 1) and (`read_at` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### payment_method

```sql
CREATE TABLE `payment_method` (
  `payment_method_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `method_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instructions` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`payment_method_id`),
  UNIQUE KEY `uq_payment_method_name` (`method_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### payment_transaction

```sql
CREATE TABLE `payment_transaction` (
  `payment_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint unsigned NOT NULL,
  `payment_method_id` bigint unsigned NOT NULL,
  `transaction_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(19,2) NOT NULL,
  `reference_no` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_paid` date NOT NULL,
  `client_receipt_id` bigint unsigned DEFAULT NULL,
  `approval_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `recorded_by_user_id` bigint unsigned NOT NULL,
  `approved_by_user_id` bigint unsigned NOT NULL,
  `approved_at` datetime(3) NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `operation_key` varchar(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `official_receipt_document_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `uq_payment_operation` (`operation_key`),
  KEY `ix_invoice_payments` (`invoice_id`,`date_paid`),
  KEY `payment_method_id` (`payment_method_id`),
  KEY `client_receipt_id` (`client_receipt_id`,`invoice_id`),
  KEY `recorded_by_user_id` (`recorded_by_user_id`),
  KEY `approved_by_user_id` (`approved_by_user_id`),
  KEY `official_receipt_document_id` (`official_receipt_document_id`),
  CONSTRAINT `payment_transaction_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoice` (`invoice_id`),
  CONSTRAINT `payment_transaction_ibfk_2` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method` (`payment_method_id`),
  CONSTRAINT `payment_transaction_ibfk_3` FOREIGN KEY (`client_receipt_id`, `invoice_id`) REFERENCES `client_receipt` (`receipt_id`, `invoice_id`),
  CONSTRAINT `payment_transaction_ibfk_4` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `payment_transaction_ibfk_5` FOREIGN KEY (`approved_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `payment_transaction_ibfk_6` FOREIGN KEY (`official_receipt_document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `ck_confirmed_payment` CHECK (((`amount` > 0) and (`approval_status` = _utf8mb4'approved')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### production_plan

```sql
CREATE TABLE `production_plan` (
  `plan_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `plan_code` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` bigint unsigned NOT NULL,
  `finished_good_id` bigint unsigned DEFAULT NULL,
  `jo_id` bigint unsigned DEFAULT NULL,
  `source` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `planned_qty` int unsigned NOT NULL,
  `week_start_date` date NOT NULL,
  `week_end_date` date NOT NULL,
  `created_by_user_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`plan_id`),
  UNIQUE KEY `uq_plan_code` (`plan_code`),
  KEY `client_id` (`client_id`),
  KEY `finished_good_id` (`finished_good_id`),
  KEY `jo_id` (`jo_id`),
  KEY `created_by_user_id` (`created_by_user_id`),
  CONSTRAINT `production_plan_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`),
  CONSTRAINT `production_plan_ibfk_2` FOREIGN KEY (`finished_good_id`) REFERENCES `finished_good` (`finished_good_id`),
  CONSTRAINT `production_plan_ibfk_3` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `production_plan_ibfk_4` FOREIGN KEY (`created_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_production_plan` CHECK (((`planned_qty` > 0) and (`week_end_date` >= `week_start_date`) and ((`finished_good_id` is not null) or (`jo_id` is not null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### production_stage

```sql
CREATE TABLE `production_stage` (
  `stage_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stage_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stage_order` smallint unsigned NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`stage_id`),
  UNIQUE KEY `uq_stage_name` (`stage_name`),
  UNIQUE KEY `uq_stage_order` (`stage_order`),
  CONSTRAINT `ck_ten_stage_positions` CHECK ((`stage_order` between 1 and 10))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### production_stage_event

```sql
CREATE TABLE `production_stage_event` (
  `stage_event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jo_stage_id` bigint unsigned NOT NULL,
  `action` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `performed_by_user_id` bigint unsigned NOT NULL,
  `occurred_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`stage_event_id`),
  KEY `ix_stage_event_history` (`jo_stage_id`,`occurred_at`,`stage_event_id`),
  KEY `performed_by_user_id` (`performed_by_user_id`),
  CONSTRAINT `production_stage_event_ibfk_1` FOREIGN KEY (`jo_stage_id`) REFERENCES `job_order_stage` (`jo_stage_id`),
  CONSTRAINT `production_stage_event_ibfk_2` FOREIGN KEY (`performed_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_stage_reversion_reason` CHECK (((`action` <> _utf8mb4'reverted') or ((`reason` is not null) and (char_length(trim(`reason`)) > 0))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### purchase_order

```sql
CREATE TABLE `purchase_order` (
  `po_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `po_no` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quotation_id` bigint unsigned NOT NULL,
  `po_document_id` bigint unsigned NOT NULL,
  `received_date` date NOT NULL,
  `payment_terms` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_method_id` bigint unsigned NOT NULL,
  `recorded_by_user_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`po_id`),
  UNIQUE KEY `uq_po_number` (`po_no`),
  KEY `quotation_id` (`quotation_id`),
  KEY `po_document_id` (`po_document_id`),
  KEY `delivery_method_id` (`delivery_method_id`),
  KEY `recorded_by_user_id` (`recorded_by_user_id`),
  CONSTRAINT `purchase_order_ibfk_1` FOREIGN KEY (`quotation_id`) REFERENCES `quotation` (`quotation_id`),
  CONSTRAINT `purchase_order_ibfk_2` FOREIGN KEY (`po_document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `purchase_order_ibfk_3` FOREIGN KEY (`delivery_method_id`) REFERENCES `delivery_method` (`delivery_method_id`),
  CONSTRAINT `purchase_order_ibfk_4` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `user_account` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### quotation

```sql
CREATE TABLE `quotation` (
  `quotation_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `quotation_no` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inquiry_id` bigint unsigned NOT NULL,
  `revision_no` smallint unsigned NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT '1',
  `current_inquiry_id` bigint unsigned GENERATED ALWAYS AS ((case when (`is_current` = 1) then `inquiry_id` else NULL end)) STORED,
  `quotation_date` date NOT NULL,
  `valid_until` date NOT NULL,
  `terms_of_payment` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `time_of_delivery` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `place_of_delivery` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `vat_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `highlight_tag` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `highlight_note` text COLLATE utf8mb4_unicode_ci,
  `requires_downpayment` tinyint(1) NOT NULL DEFAULT '1',
  `downpayment_percent` decimal(5,2) NOT NULL,
  `downpayment_amount` decimal(19,2) NOT NULL,
  `subtotal` decimal(19,2) NOT NULL,
  `addons_total` decimal(19,2) NOT NULL,
  `total_amount` decimal(19,2) NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prepared_by_user_id` bigint unsigned NOT NULL,
  `approved_by_user_id` bigint unsigned DEFAULT NULL,
  `sent_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`quotation_id`),
  UNIQUE KEY `uq_quotation_number` (`quotation_no`),
  UNIQUE KEY `uq_quotation_revision` (`inquiry_id`,`revision_no`),
  UNIQUE KEY `uq_current_quotation` (`current_inquiry_id`),
  KEY `prepared_by_user_id` (`prepared_by_user_id`),
  KEY `approved_by_user_id` (`approved_by_user_id`),
  CONSTRAINT `quotation_ibfk_1` FOREIGN KEY (`inquiry_id`) REFERENCES `inquiry` (`inquiry_id`),
  CONSTRAINT `quotation_ibfk_2` FOREIGN KEY (`prepared_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `quotation_ibfk_3` FOREIGN KEY (`approved_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_quotation_current` CHECK ((`is_current` in (0,1))),
  CONSTRAINT `ck_quotation_dates` CHECK ((`valid_until` >= `quotation_date`)),
  CONSTRAINT `ck_quotation_money` CHECK (((`subtotal` >= 0) and (`addons_total` >= 0) and (`total_amount` >= 0) and (`requires_downpayment` = 1) and (`downpayment_percent` in (20,50)) and (`downpayment_amount` = round(((`total_amount` * `downpayment_percent`) / 100),2))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### quotation_item

```sql
CREATE TABLE `quotation_item` (
  `quotation_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `quotation_id` bigint unsigned NOT NULL,
  `inquiry_item_id` bigint unsigned DEFAULT NULL,
  `line_no` smallint unsigned NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `uom_id` bigint unsigned NOT NULL,
  `unit_price` decimal(15,4) NOT NULL,
  `line_total` decimal(19,2) GENERATED ALWAYS AS (round((`quantity` * `unit_price`),2)) STORED,
  PRIMARY KEY (`quotation_item_id`),
  UNIQUE KEY `uq_quotation_item_line` (`quotation_id`,`line_no`),
  KEY `inquiry_item_id` (`inquiry_item_id`),
  KEY `uom_id` (`uom_id`),
  CONSTRAINT `quotation_item_ibfk_1` FOREIGN KEY (`quotation_id`) REFERENCES `quotation` (`quotation_id`),
  CONSTRAINT `quotation_item_ibfk_2` FOREIGN KEY (`inquiry_item_id`) REFERENCES `inquiry_item` (`inquiry_item_id`),
  CONSTRAINT `quotation_item_ibfk_3` FOREIGN KEY (`uom_id`) REFERENCES `unit_of_measure` (`uom_id`),
  CONSTRAINT `ck_quotation_item_values` CHECK (((`line_no` > 0) and (`quantity` > 0) and (`unit_price` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### raw_material

```sql
CREATE TABLE `raw_material` (
  `material_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `material_category_id` bigint unsigned DEFAULT NULL,
  `material_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uom_id` bigint unsigned NOT NULL,
  `qty_in_stock` decimal(15,4) DEFAULT NULL,
  `quantity_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `unit_price` decimal(15,4) DEFAULT NULL,
  `unit_price_approved_by_user_id` bigint unsigned DEFAULT NULL,
  `unit_price_approved_at` datetime(3) DEFAULT NULL,
  `reference_unit_price` decimal(15,4) DEFAULT NULL,
  `reference_document_id` bigint unsigned DEFAULT NULL,
  `reference_page` smallint unsigned DEFAULT NULL,
  `reorder_threshold` decimal(15,4) DEFAULT NULL,
  `threshold_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `supplier_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`material_id`),
  KEY `ix_material_category_name` (`material_category_id`,`material_name`),
  KEY `uom_id` (`uom_id`),
  KEY `unit_price_approved_by_user_id` (`unit_price_approved_by_user_id`),
  KEY `reference_document_id` (`reference_document_id`),
  CONSTRAINT `raw_material_ibfk_1` FOREIGN KEY (`material_category_id`) REFERENCES `material_category` (`material_category_id`),
  CONSTRAINT `raw_material_ibfk_2` FOREIGN KEY (`uom_id`) REFERENCES `unit_of_measure` (`uom_id`),
  CONSTRAINT `raw_material_ibfk_3` FOREIGN KEY (`unit_price_approved_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `raw_material_ibfk_4` FOREIGN KEY (`reference_document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `ck_raw_costing_price` CHECK ((((`unit_price` is null) and (`unit_price_approved_by_user_id` is null) and (`unit_price_approved_at` is null)) or ((`unit_price` is not null) and (`unit_price` >= 0) and (`unit_price_approved_by_user_id` is not null) and (`unit_price_approved_at` is not null)))),
  CONSTRAINT `ck_raw_quantity` CHECK ((((`quantity_status` = _utf8mb4'unknown') and (`qty_in_stock` is null)) or ((`quantity_status` in (_utf8mb4'provisional_sample',_utf8mb4'verified')) and (`qty_in_stock` is not null) and (`qty_in_stock` >= 0)))),
  CONSTRAINT `ck_raw_threshold` CHECK ((((`threshold_status` = _utf8mb4'unknown') and (`reorder_threshold` is null)) or ((`threshold_status` in (_utf8mb4'provisional_sample',_utf8mb4'verified')) and (`reorder_threshold` is not null) and (`reorder_threshold` >= 0)))),
  CONSTRAINT `ck_reference_price` CHECK (((`reference_unit_price` is null) or (`reference_unit_price` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### role

```sql
CREATE TABLE `role` (
  `role_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_name` enum('Client','Sales','Admin','Accounting','Production','Warehouse','Logistics','Owner','Operations') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_owner_role` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uq_role_name` (`role_name`),
  CONSTRAINT `ck_role_owner` CHECK ((`is_owner_role` = (`role_name` = _utf8mb4'Owner')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### sales_invoice

```sql
CREATE TABLE `sales_invoice` (
  `invoice_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_no` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_id` bigint unsigned NOT NULL,
  `invoice_date` date NOT NULL,
  `payment_terms` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivered_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `total_amount` decimal(19,2) NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issued_by_user_id` bigint unsigned NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`invoice_id`),
  UNIQUE KEY `uq_invoice_number` (`invoice_no`),
  UNIQUE KEY `uq_invoice_po` (`po_id`),
  KEY `ix_invoice_due` (`status`,`due_date`),
  KEY `issued_by_user_id` (`issued_by_user_id`),
  CONSTRAINT `sales_invoice_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_order` (`po_id`),
  CONSTRAINT `sales_invoice_ibfk_2` FOREIGN KEY (`issued_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_invoice_total` CHECK ((`total_amount` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### signed_delivery_receipt

```sql
CREATE TABLE `signed_delivery_receipt` (
  `signed_dr_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delivery_receipt_id` bigint unsigned NOT NULL,
  `document_id` bigint unsigned NOT NULL,
  `submitted_by_user_id` bigint unsigned NOT NULL,
  `submitted_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `received_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`signed_dr_id`),
  UNIQUE KEY `uq_signed_dr_document` (`document_id`),
  KEY `delivery_receipt_id` (`delivery_receipt_id`),
  KEY `submitted_by_user_id` (`submitted_by_user_id`),
  CONSTRAINT `signed_delivery_receipt_ibfk_1` FOREIGN KEY (`delivery_receipt_id`) REFERENCES `delivery_receipt` (`delivery_receipt_id`),
  CONSTRAINT `signed_delivery_receipt_ibfk_2` FOREIGN KEY (`document_id`) REFERENCES `document` (`document_id`),
  CONSTRAINT `signed_delivery_receipt_ibfk_3` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `user_account` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### stock_movement

```sql
CREATE TABLE `stock_movement` (
  `movement_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `item_type` enum('raw_material','finished_good') COLLATE utf8mb4_unicode_ci NOT NULL,
  `raw_material_id` bigint unsigned DEFAULT NULL,
  `finished_good_id` bigint unsigned DEFAULT NULL,
  `movement_reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_status_before` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL,
  `qty_before` decimal(15,4) DEFAULT NULL,
  `qty_after` decimal(15,4) NOT NULL,
  `qty_change` decimal(15,4) DEFAULT NULL,
  `uom_id` bigint unsigned DEFAULT NULL,
  `reference_no` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jo_id` bigint unsigned DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `performed_by_user_id` bigint unsigned NOT NULL,
  `operation_key` varchar(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`movement_id`),
  UNIQUE KEY `uq_stock_operation` (`operation_key`),
  KEY `ix_raw_movement_history` (`raw_material_id`,`created_at`,`movement_id`),
  KEY `ix_finished_movement_history` (`finished_good_id`,`created_at`,`movement_id`),
  KEY `uom_id` (`uom_id`),
  KEY `jo_id` (`jo_id`),
  KEY `performed_by_user_id` (`performed_by_user_id`),
  CONSTRAINT `stock_movement_ibfk_1` FOREIGN KEY (`raw_material_id`) REFERENCES `raw_material` (`material_id`),
  CONSTRAINT `stock_movement_ibfk_2` FOREIGN KEY (`finished_good_id`) REFERENCES `finished_good` (`finished_good_id`),
  CONSTRAINT `stock_movement_ibfk_3` FOREIGN KEY (`uom_id`) REFERENCES `unit_of_measure` (`uom_id`),
  CONSTRAINT `stock_movement_ibfk_4` FOREIGN KEY (`jo_id`) REFERENCES `job_order` (`jo_id`),
  CONSTRAINT `stock_movement_ibfk_5` FOREIGN KEY (`performed_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_finished_movement_units` CHECK (((`item_type` <> _utf8mb4'finished_good') or ((`qty_after` = floor(`qty_after`)) and ((`qty_before` is null) or (`qty_before` = floor(`qty_before`)))))),
  CONSTRAINT `ck_stock_item_xor` CHECK ((((`item_type` = _utf8mb4'raw_material') and (`raw_material_id` is not null) and (`finished_good_id` is null) and (`uom_id` is not null)) or ((`item_type` = _utf8mb4'finished_good') and (`raw_material_id` is null) and (`finished_good_id` is not null) and (`uom_id` is null)))),
  CONSTRAINT `ck_stock_observation` CHECK (((`qty_after` >= 0) and (((`quantity_status_before` = _utf8mb4'verified') and (`qty_before` is not null) and (`qty_before` >= 0) and (`qty_change` is not null) and (`qty_after` = (`qty_before` + `qty_change`))) or ((`quantity_status_before` in (_utf8mb4'unknown',_utf8mb4'provisional_sample')) and (`qty_before` is null) and (`qty_change` is null))))),
  CONSTRAINT `ck_stock_reason` CHECK ((char_length(trim(`movement_reason`)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### stock_request

```sql
CREATE TABLE `stock_request` (
  `stock_request_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `inquiry_id` bigint unsigned NOT NULL,
  `requested_by_user_id` bigint unsigned NOT NULL,
  `handled_by_user_id` bigint unsigned DEFAULT NULL,
  `request_date` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`stock_request_id`),
  KEY `ix_stock_request_queue` (`status`,`request_date`),
  KEY `inquiry_id` (`inquiry_id`),
  KEY `requested_by_user_id` (`requested_by_user_id`),
  KEY `handled_by_user_id` (`handled_by_user_id`),
  CONSTRAINT `stock_request_ibfk_1` FOREIGN KEY (`inquiry_id`) REFERENCES `inquiry` (`inquiry_id`),
  CONSTRAINT `stock_request_ibfk_2` FOREIGN KEY (`requested_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `stock_request_ibfk_3` FOREIGN KEY (`handled_by_user_id`) REFERENCES `user_account` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### stock_request_item

```sql
CREATE TABLE `stock_request_item` (
  `stock_request_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stock_request_id` bigint unsigned NOT NULL,
  `raw_material_id` bigint unsigned NOT NULL,
  `qty_requested` decimal(15,4) NOT NULL,
  `stock_at_request` decimal(15,4) DEFAULT NULL,
  `qty_available` decimal(15,4) DEFAULT NULL,
  `shortage_at_request` decimal(15,4) DEFAULT NULL,
  `quantity_status_at_request` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci NOT NULL,
  `available_quantity_status` enum('unknown','provisional_sample','verified') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `observed_at` datetime(3) DEFAULT NULL,
  `observed_by_user_id` bigint unsigned DEFAULT NULL,
  `uom_id` bigint unsigned NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`stock_request_item_id`),
  UNIQUE KEY `uq_request_material` (`stock_request_id`,`raw_material_id`),
  KEY `raw_material_id` (`raw_material_id`),
  KEY `uom_id` (`uom_id`),
  KEY `observed_by_user_id` (`observed_by_user_id`),
  CONSTRAINT `stock_request_item_ibfk_1` FOREIGN KEY (`stock_request_id`) REFERENCES `stock_request` (`stock_request_id`),
  CONSTRAINT `stock_request_item_ibfk_2` FOREIGN KEY (`raw_material_id`) REFERENCES `raw_material` (`material_id`),
  CONSTRAINT `stock_request_item_ibfk_3` FOREIGN KEY (`uom_id`) REFERENCES `unit_of_measure` (`uom_id`),
  CONSTRAINT `stock_request_item_ibfk_4` FOREIGN KEY (`observed_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `ck_request_response` CHECK ((((`available_quantity_status` is null) and (`qty_available` is null) and (`observed_at` is null) and (`observed_by_user_id` is null)) or ((`available_quantity_status` is not null) and (`observed_at` is not null) and (`observed_by_user_id` is not null) and (((`available_quantity_status` = _utf8mb4'verified') and (`qty_available` is not null) and (`qty_available` >= 0)) or ((`available_quantity_status` in (_utf8mb4'unknown',_utf8mb4'provisional_sample')) and (`qty_available` is null)))))),
  CONSTRAINT `ck_request_snapshot_provenance` CHECK ((((`quantity_status_at_request` = _utf8mb4'verified') and (`stock_at_request` is not null) and (`stock_at_request` >= 0) and (`shortage_at_request` is not null) and (`shortage_at_request` = greatest((`qty_requested` - `stock_at_request`),0))) or ((`quantity_status_at_request` in (_utf8mb4'unknown',_utf8mb4'provisional_sample')) and (`stock_at_request` is null) and (`shortage_at_request` is null)))),
  CONSTRAINT `ck_requested_quantity` CHECK ((`qty_requested` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### unit_of_measure

```sql
CREATE TABLE `unit_of_measure` (
  `uom_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uom_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abbreviation` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`uom_id`),
  UNIQUE KEY `uq_uom_name` (`uom_name`),
  UNIQUE KEY `uq_uom_abbreviation` (`abbreviation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### user_account

```sql
CREATE TABLE `user_account` (
  `user_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint unsigned NOT NULL,
  `full_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `initials` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `must_change_password` tinyint(1) NOT NULL DEFAULT '1',
  `joined_date` date DEFAULT NULL,
  `last_login_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_user_email` (`email`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `user_account_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `role` (`role_id`),
  CONSTRAINT `ck_user_password_flag` CHECK ((`must_change_password` in (0,1)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### waybill

```sql
CREATE TABLE `waybill` (
  `waybill_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delivery_id` bigint unsigned NOT NULL,
  `waybill_no` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qr_identifier` varchar(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `generated_by_user_id` bigint unsigned NOT NULL,
  `generated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `printed_at` datetime(3) DEFAULT NULL,
  `document_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`waybill_id`),
  UNIQUE KEY `uq_waybill_delivery` (`delivery_id`),
  UNIQUE KEY `uq_waybill_number` (`waybill_no`),
  UNIQUE KEY `uq_waybill_qr` (`qr_identifier`),
  KEY `generated_by_user_id` (`generated_by_user_id`),
  KEY `document_id` (`document_id`),
  CONSTRAINT `waybill_ibfk_1` FOREIGN KEY (`delivery_id`) REFERENCES `delivery` (`delivery_id`),
  CONSTRAINT `waybill_ibfk_2` FOREIGN KEY (`generated_by_user_id`) REFERENCES `user_account` (`user_id`),
  CONSTRAINT `waybill_ibfk_3` FOREIGN KEY (`document_id`) REFERENCES `document` (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
