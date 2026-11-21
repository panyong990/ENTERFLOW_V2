# P2B002 actual data dictionary

Date: 2026-11-22, Asia/Singapore. **Executed P2B002 greenfield rebuild, not a proposal.** The rejected P2B001 model is not the current database. Target: `enterflow_phase2_db`, container `enterflow-phase2-mysql`, `127.0.0.1:62286`, MySQL 8.4.13. Actual result: 40 tables, 412 columns, 40 PKs, 95 FKs, 40 unique constraints, 40 enforced CHECKs, 167 indexes, 39 ownership/history triggers; **zero rows**. Counts are outcomes, not design goals or sufficient proof of correctness.

Evidence: [bootstrap](../database/phase2-bootstrap/P2B002_revised_erd_greenfield.sql), [design manifest](../database/phase2-bootstrap/P2B002_design_manifest.json), [actual metadata](../database/phase2-execution/P2B002-2026-11-22/after-metadata.json), [entity/relationship verification](../database/phase2-execution/P2B002-2026-11-22/entity-relationship-verification.json), [execution journal](../database/phase2-execution/P2B002-2026-11-22/execution.json).

The design was authored from the actual `EnterFlow_ERD_Revised.md`, original/revised diagrams, documented scope/backlog/events/use cases in `Enter-Flow_Final.pdf`, and approved business decisions. The authoring reference matches the actual Downloads revised file in normalized text. The new authoring helper reads only that revised reference; it does not import old DDL, E01–E03, P2B001, an old dictionary or backup. Physical names follow the revised entities. The final entity set was derived as 27 main entities, seven references explicitly required by their FKs, and six individually justified workflow extensions.

All definitions below come from actual P2B002 metadata. NULL stock and unknown provenance are distinct from verified numeric zero. Monetary totals use DECIMAL(19,2), unit prices/quantities use declared decimal precision, and IDs use unsigned BIGINT. Enum values, generated expressions and exact FK carriers are included in linked actual CREATE definitions. No old dictionary was used as a template.

## role

Revised ERD entity and attributes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `role_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `role_name` | `enum('Client','Sales','Admin','Accounting','Production','Warehouse','Logistics','Owner','Operations')` | NO | `No explicit default` | UNIQUE: uq_role_name |
| `description` | `text` | YES | `NULL` | — |
| `is_owner_role` | `tinyint(1)` | NO | `0` | — |

Actual CHECKs:

- `ck_role_owner` (ENFORCED=YES): `(`is_owner_role` = (`role_name` = _utf8mb4\'Owner\'))`

Actual indexes (including PK/UQ/FK support):

- `PRIMARY` (role_id); unique=True.

- `uq_role_name` (role_name); unique=True.


## delivery_method

Revised reference; five documented delivery methods, no values seeded.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `delivery_method_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `method_name` | `varchar(100)` | NO | `No explicit default` | UNIQUE: uq_delivery_method_name |
| `is_active` | `tinyint(1)` | NO | `1` | — |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `PRIMARY` (delivery_method_id); unique=True.

- `uq_delivery_method_name` (method_name); unique=True.


## payment_method

Revised reference; manual payment-method selection/instructions, not a gateway.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `payment_method_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `method_name` | `varchar(100)` | NO | `No explicit default` | UNIQUE: uq_payment_method_name |
| `instructions` | `text` | YES | `NULL` | — |
| `is_active` | `tinyint(1)` | NO | `1` | — |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `PRIMARY` (payment_method_id); unique=True.

- `uq_payment_method_name` (method_name); unique=True.


## material_category

Revised reference; documented raw-material categories.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `material_category_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `category_name` | `varchar(100)` | NO | `No explicit default` | UNIQUE: uq_material_category_name |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `PRIMARY` (material_category_id); unique=True.

- `uq_material_category_name` (category_name); unique=True.


## unit_of_measure

Revised reference; quantities and costing material measurement units.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `uom_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `uom_name` | `varchar(80)` | NO | `No explicit default` | UNIQUE: uq_uom_name |
| `abbreviation` | `varchar(20)` | NO | `No explicit default` | UNIQUE: uq_uom_abbreviation |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `PRIMARY` (uom_id); unique=True.

- `uq_uom_abbreviation` (abbreviation); unique=True.

- `uq_uom_name` (uom_name); unique=True.


## filter_type

Revised reference; sixteen filter types/six template groups, no fictional values.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `filter_type_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `filter_type_name` | `varchar(120)` | NO | `No explicit default` | UNIQUE: uq_filter_type_name |
| `template_group` | `varchar(80)` | NO | `No explicit default` | — |
| `is_active` | `tinyint(1)` | NO | `1` | — |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `PRIMARY` (filter_type_id); unique=True.

- `uq_filter_type_name` (filter_type_name); unique=True.


## production_stage

Revised reference and ten-stage requirement; labels/order values remain unpopulated.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `stage_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `stage_name` | `varchar(120)` | NO | `No explicit default` | UNIQUE: uq_stage_name |
| `stage_order` | `smallint unsigned` | NO | `No explicit default` | UNIQUE: uq_stage_order |
| `is_active` | `tinyint(1)` | NO | `1` | — |

Actual CHECKs:

- `ck_ten_stage_positions` (ENFORCED=YES): `(`stage_order` between 1 and 10)`

Actual indexes (including PK/UQ/FK support):

- `PRIMARY` (stage_id); unique=True.

- `uq_stage_name` (stage_name); unique=True.

- `uq_stage_order` (stage_order); unique=True.


## user_account

Revised common account identity; client_user is a shared-PK subtype, not another credential store.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `user_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `role_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: user_account_ibfk_1 |
| `full_name` | `varchar(160)` | NO | `No explicit default` | — |
| `email` | `varchar(254)` | NO | `No explicit default` | UNIQUE: uq_user_email |
| `password_hash` | `varchar(255)` | NO | `No explicit default` | — |
| `initials` | `varchar(16)` | YES | `NULL` | — |
| `phone` | `varchar(40)` | YES | `NULL` | — |
| `status` | `varchar(30)` | NO | `No explicit default` | — |
| `must_change_password` | `tinyint(1)` | NO | `1` | — |
| `joined_date` | `date` | YES | `NULL` | — |
| `last_login_at` | `datetime(3)` | YES | `NULL` | — |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_user_password_flag` (ENFORCED=YES): `(`must_change_password` in (0,1))`

Actual indexes (including PK/UQ/FK support):

- `PRIMARY` (user_id); unique=True.

- `role_id` (role_id); unique=False.

- `uq_user_email` (email); unique=True.


## client

Revised ERD entity and attributes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `client_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `company_name` | `varchar(200)` | NO | `No explicit default` | UNIQUE: uq_client_company |
| `industry` | `varchar(120)` | YES | `NULL` | — |
| `contact_person` | `varchar(160)` | YES | `NULL` | — |
| `phone` | `varchar(40)` | YES | `NULL` | — |
| `email` | `varchar(254)` | YES | `NULL` | — |
| `address_line1` | `varchar(255)` | YES | `NULL` | — |
| `address_line2` | `varchar(255)` | YES | `NULL` | — |
| `city_province` | `varchar(160)` | YES | `NULL` | — |
| `zip_code` | `varchar(20)` | YES | `NULL` | — |
| `default_payment_terms` | `varchar(80)` | YES | `NULL` | — |
| `preferred_delivery_method_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: client_ibfk_1 |
| `internal_notes` | `text` | YES | `NULL` | — |
| `status` | `varchar(30)` | NO | `No explicit default` | — |
| `client_since` | `date` | YES | `NULL` | — |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `preferred_delivery_method_id` (preferred_delivery_method_id); unique=False.

- `PRIMARY` (client_id); unique=True.

- `uq_client_company` (company_name); unique=True.


## client_user

Revised portal membership. Common login attributes reside once in user_account; approved one-company-login uniqueness retained.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `client_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: client_user_ibfk_1; PRIMARY KEY: PRIMARY; UNIQUE: uq_client_user_owner |
| `client_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: client_user_ibfk_2; UNIQUE: uq_client_user_owner; UNIQUE: uq_company_portal_login |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `PRIMARY` (client_user_id); unique=True.

- `uq_client_user_owner` (client_user_id, client_id); unique=True.

- `uq_company_portal_login` (client_id); unique=True.


## document

Revised document entity with private object identity/lifecycle required by security and auditability; no second files subsystem.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `document_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `file_name` | `varchar(255)` | NO | `No explicit default` | — |
| `storage_bucket` | `varchar(63)` | YES | `NULL` | UNIQUE: uq_document_object_version |
| `storage_key` | `varchar(700)` | YES | `NULL` | UNIQUE: uq_document_object_version |
| `object_generation` | `varchar(40)` | YES | `NULL` | UNIQUE: uq_document_object_version |
| `mime_type` | `varchar(120)` | NO | `No explicit default` | — |
| `size_bytes` | `bigint unsigned` | NO | `No explicit default` | — |
| `sha256` | `char(64)` | YES | `NULL` | — |
| `storage_status` | `enum('pending','available','failed','deleted')` | NO | `pending` | — |
| `uploaded_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: document_ibfk_1 |
| `uploaded_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_document_available` (ENFORCED=YES): `((`storage_status` <> _utf8mb4\'available\') or ((`storage_bucket` is not null) and (`storage_key` is not null) and (`object_generation` is not null)))`

Actual indexes (including PK/UQ/FK support):

- `PRIMARY` (document_id); unique=True.

- `uploaded_by_user_id` (uploaded_by_user_id); unique=False.

- `uq_document_object_version` (storage_bucket, storage_key, object_generation); unique=True.


## inquiry

Revised ERD entity and attributes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `inquiry_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `inquiry_no` | `varchar(60)` | NO | `No explicit default` | UNIQUE: uq_inquiry_number |
| `client_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: inquiry_ibfk_1; FOREIGN KEY: inquiry_ibfk_2 |
| `contact_person` | `varchar(160)` | NO | `No explicit default` | — |
| `payment_terms` | `varchar(80)` | NO | `No explicit default` | — |
| `source` | `varchar(40)` | NO | `No explicit default` | — |
| `submitted_by_client_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: inquiry_ibfk_2 |
| `created_by_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: inquiry_ibfk_3 |
| `general_notes` | `text` | YES | `NULL` | — |
| `required_by_date` | `date` | YES | `NULL` | — |
| `due_date` | `date` | YES | `NULL` | — |
| `status` | `varchar(40)` | NO | `No explicit default` | — |
| `rejection_reason` | `text` | YES | `NULL` | — |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |
| `updated_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_inquiry_creator` (ENFORCED=YES): `((`submitted_by_client_user_id` is not null) or (`created_by_user_id` is not null))`

Actual indexes (including PK/UQ/FK support):

- `created_by_user_id` (created_by_user_id); unique=False.

- `ix_inquiry_client_queue` (client_id, status, created_at); unique=False.

- `PRIMARY` (inquiry_id); unique=True.

- `submitted_by_client_user_id` (submitted_by_client_user_id, client_id); unique=False.

- `uq_inquiry_number` (inquiry_no); unique=True.


## inquiry_item

Revised requested-item specifications directly on the item; JSON accommodates the documented six template groups, not a copied specification master.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `inquiry_item_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `inquiry_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: inquiry_item_ibfk_1; UNIQUE: uq_inquiry_line |
| `line_no` | `smallint unsigned` | NO | `No explicit default` | UNIQUE: uq_inquiry_line |
| `filter_type_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: inquiry_item_ibfk_2 |
| `filter_name` | `varchar(200)` | NO | `No explicit default` | — |
| `oem_reference` | `varchar(160)` | YES | `NULL` | — |
| `od1_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `od2_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `id1_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `id2_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `height_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `overall_height_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `filter_media` | `varchar(255)` | YES | `NULL` | — |
| `inner_core` | `varchar(255)` | YES | `NULL` | — |
| `outer_core` | `varchar(255)` | YES | `NULL` | — |
| `o_ring` | `varchar(255)` | YES | `NULL` | — |
| `gasket` | `varchar(255)` | YES | `NULL` | — |
| `filtration_rating` | `varchar(120)` | YES | `NULL` | — |
| `filtration_rating_custom` | `varchar(255)` | YES | `NULL` | — |
| `quantity` | `int unsigned` | NO | `No explicit default` | — |
| `template_specifications` | `json` | YES | `NULL` | — |
| `sketch_document_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: inquiry_item_ibfk_3 |

Actual CHECKs:

- `ck_inquiry_line_quantity` (ENFORCED=YES): `((`quantity` > 0) and (`line_no` > 0))`

Actual indexes (including PK/UQ/FK support):

- `filter_type_id` (filter_type_id); unique=False.

- `PRIMARY` (inquiry_item_id); unique=True.

- `sketch_document_id` (sketch_document_id); unique=False.

- `uq_inquiry_line` (inquiry_id, line_no); unique=True.


## quotation

Revised ERD entity and attributes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `quotation_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `quotation_no` | `varchar(60)` | NO | `No explicit default` | UNIQUE: uq_quotation_number |
| `inquiry_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: quotation_ibfk_1; UNIQUE: uq_quotation_revision |
| `revision_no` | `smallint unsigned` | NO | `No explicit default` | UNIQUE: uq_quotation_revision |
| `is_current` | `tinyint(1)` | NO | `1` | — |
| `current_inquiry_id` | `bigint unsigned` | YES | `GENERATED: (case when (`is_current` = 1) then `inquiry_id` else NULL end)` | UNIQUE: uq_current_quotation |
| `quotation_date` | `date` | NO | `No explicit default` | — |
| `valid_until` | `date` | NO | `No explicit default` | — |
| `terms_of_payment` | `varchar(80)` | NO | `No explicit default` | — |
| `time_of_delivery` | `varchar(255)` | NO | `No explicit default` | — |
| `place_of_delivery` | `text` | NO | `No explicit default` | — |
| `vat_type` | `varchar(40)` | NO | `No explicit default` | — |
| `highlight_tag` | `varchar(80)` | YES | `NULL` | — |
| `highlight_note` | `text` | YES | `NULL` | — |
| `requires_downpayment` | `tinyint(1)` | NO | `1` | — |
| `downpayment_percent` | `decimal(5,2)` | NO | `No explicit default` | — |
| `downpayment_amount` | `decimal(19,2)` | NO | `No explicit default` | — |
| `subtotal` | `decimal(19,2)` | NO | `No explicit default` | — |
| `addons_total` | `decimal(19,2)` | NO | `No explicit default` | — |
| `total_amount` | `decimal(19,2)` | NO | `No explicit default` | — |
| `status` | `varchar(40)` | NO | `No explicit default` | — |
| `prepared_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: quotation_ibfk_2 |
| `approved_by_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: quotation_ibfk_3 |
| `sent_at` | `datetime(3)` | YES | `NULL` | — |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_quotation_current` (ENFORCED=YES): `(`is_current` in (0,1))`

- `ck_quotation_dates` (ENFORCED=YES): `(`valid_until` >= `quotation_date`)`

- `ck_quotation_money` (ENFORCED=YES): `((`subtotal` >= 0) and (`addons_total` >= 0) and (`total_amount` >= 0) and (`requires_downpayment` = 1) and (`downpayment_percent` in (20,50)) and (`downpayment_amount` = round(((`total_amount` * `downpayment_percent`) / 100),2)))`

Actual indexes (including PK/UQ/FK support):

- `approved_by_user_id` (approved_by_user_id); unique=False.

- `prepared_by_user_id` (prepared_by_user_id); unique=False.

- `PRIMARY` (quotation_id); unique=True.

- `uq_current_quotation` (current_inquiry_id); unique=True.

- `uq_quotation_number` (quotation_no); unique=True.

- `uq_quotation_revision` (inquiry_id, revision_no); unique=True.


## quotation_item

Revised ERD entity and attributes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `quotation_item_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `quotation_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: quotation_item_ibfk_1; UNIQUE: uq_quotation_item_line |
| `inquiry_item_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: quotation_item_ibfk_2 |
| `line_no` | `smallint unsigned` | NO | `No explicit default` | UNIQUE: uq_quotation_item_line |
| `description` | `varchar(255)` | NO | `No explicit default` | — |
| `quantity` | `decimal(15,4)` | NO | `No explicit default` | — |
| `uom_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: quotation_item_ibfk_3 |
| `unit_price` | `decimal(15,4)` | NO | `No explicit default` | — |
| `line_total` | `decimal(19,2)` | YES | `GENERATED: round((`quantity` * `unit_price`),2)` | — |

Actual CHECKs:

- `ck_quotation_item_values` (ENFORCED=YES): `((`line_no` > 0) and (`quantity` > 0) and (`unit_price` >= 0))`

Actual indexes (including PK/UQ/FK support):

- `inquiry_item_id` (inquiry_item_id); unique=False.

- `PRIMARY` (quotation_item_id); unique=True.

- `uom_id` (uom_id); unique=False.

- `uq_quotation_item_line` (quotation_id, line_no); unique=True.


## cost_estimate

Revised per-quotation-item estimate; nonunique item FK preserves estimate history without deciding one-current-estimate policy.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `estimate_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `quotation_item_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: cost_estimate_ibfk_1 |
| `labor_cost_per_unit` | `decimal(15,4)` | NO | `No explicit default` | — |
| `include_labor` | `tinyint(1)` | NO | `No explicit default` | — |
| `markup_percent` | `decimal(9,4)` | NO | `No explicit default` | — |
| `apply_markup` | `tinyint(1)` | NO | `No explicit default` | — |
| `vat_type` | `varchar(40)` | NO | `No explicit default` | — |
| `vat_rate` | `decimal(7,4)` | NO | `No explicit default` | — |
| `apply_vat` | `tinyint(1)` | NO | `No explicit default` | — |
| `material_cost_per_unit` | `decimal(15,4)` | NO | `No explicit default` | — |
| `unit_cost_with_markup` | `decimal(15,4)` | NO | `No explicit default` | — |
| `unit_cost_with_vat` | `decimal(15,4)` | NO | `No explicit default` | — |
| `is_locked` | `tinyint(1)` | NO | `0` | — |
| `created_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: cost_estimate_ibfk_2 |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_estimate_flags` (ENFORCED=YES): `((`include_labor` in (0,1)) and (`apply_markup` in (0,1)) and (`apply_vat` in (0,1)) and (`is_locked` in (0,1)))`

- `ck_estimate_values` (ENFORCED=YES): `((`labor_cost_per_unit` >= 0) and (`markup_percent` >= 0) and (`vat_rate` between 0 and 100) and (`material_cost_per_unit` >= 0) and (`unit_cost_with_markup` >= 0) and (`unit_cost_with_vat` >= 0))`

Actual indexes (including PK/UQ/FK support):

- `created_by_user_id` (created_by_user_id); unique=False.

- `ix_estimate_item_history` (quotation_item_id, created_at); unique=False.

- `PRIMARY` (estimate_id); unique=True.


## raw_material

Revised raw material plus explicitly approved unknown/sample/verified provenance and reference-versus-approved price safeguards; no import lineage clone.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `material_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `material_category_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: raw_material_ibfk_1 |
| `material_name` | `varchar(200)` | NO | `No explicit default` | — |
| `uom_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: raw_material_ibfk_2 |
| `qty_in_stock` | `decimal(15,4)` | YES | `NULL` | — |
| `quantity_status` | `enum('unknown','provisional_sample','verified')` | NO | `unknown` | — |
| `unit_price` | `decimal(15,4)` | YES | `NULL` | — |
| `unit_price_approved_by_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: raw_material_ibfk_3 |
| `unit_price_approved_at` | `datetime(3)` | YES | `NULL` | — |
| `reference_unit_price` | `decimal(15,4)` | YES | `NULL` | — |
| `reference_document_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: raw_material_ibfk_4 |
| `reference_page` | `smallint unsigned` | YES | `NULL` | — |
| `reorder_threshold` | `decimal(15,4)` | YES | `NULL` | — |
| `threshold_status` | `enum('unknown','provisional_sample','verified')` | NO | `unknown` | — |
| `supplier_name` | `varchar(200)` | YES | `NULL` | — |
| `is_active` | `tinyint(1)` | NO | `1` | — |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |
| `updated_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_raw_costing_price` (ENFORCED=YES): `(((`unit_price` is null) and (`unit_price_approved_by_user_id` is null) and (`unit_price_approved_at` is null)) or ((`unit_price` is not null) and (`unit_price` >= 0) and (`unit_price_approved_by_user_id` is not null) and (`unit_price_approved_at` is not null)))`

- `ck_raw_quantity` (ENFORCED=YES): `(((`quantity_status` = _utf8mb4\'unknown\') and (`qty_in_stock` is null)) or ((`quantity_status` in (_utf8mb4\'provisional_sample\',_utf8mb4\'verified\')) and (`qty_in_stock` is not null) and (`qty_in_stock` >= 0)))`

- `ck_raw_threshold` (ENFORCED=YES): `(((`threshold_status` = _utf8mb4\'unknown\') and (`reorder_threshold` is null)) or ((`threshold_status` in (_utf8mb4\'provisional_sample\',_utf8mb4\'verified\')) and (`reorder_threshold` is not null) and (`reorder_threshold` >= 0)))`

- `ck_reference_price` (ENFORCED=YES): `((`reference_unit_price` is null) or (`reference_unit_price` >= 0))`

Actual indexes (including PK/UQ/FK support):

- `ix_material_category_name` (material_category_id, material_name); unique=False.

- `PRIMARY` (material_id); unique=True.

- `reference_document_id` (reference_document_id); unique=False.

- `unit_price_approved_by_user_id` (unit_price_approved_by_user_id); unique=False.

- `uom_id` (uom_id); unique=False.


## cost_estimate_material

Revised material-cost snapshot; category/UOM describe estimate-time measurement, not a second current stock balance.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `estimate_material_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `estimate_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: cost_estimate_material_ibfk_1 |
| `material_category_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: cost_estimate_material_ibfk_2 |
| `raw_material_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: cost_estimate_material_ibfk_3 |
| `qty_per_filter` | `decimal(15,4)` | NO | `No explicit default` | — |
| `uom_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: cost_estimate_material_ibfk_4 |
| `unit_price_snapshot` | `decimal(15,4)` | NO | `No explicit default` | — |
| `line_cost` | `decimal(19,4)` | YES | `GENERATED: (`qty_per_filter` * `unit_price_snapshot`)` | — |

Actual CHECKs:

- `ck_estimate_material_values` (ENFORCED=YES): `((`qty_per_filter` > 0) and (`unit_price_snapshot` >= 0))`

Actual indexes (including PK/UQ/FK support):

- `estimate_id` (estimate_id); unique=False.

- `material_category_id` (material_category_id); unique=False.

- `PRIMARY` (estimate_material_id); unique=True.

- `raw_material_id` (raw_material_id); unique=False.

- `uom_id` (uom_id); unique=False.


## purchase_order

Accepted quotation is the only commercial owner link; inquiry/client and downpayment facts derive through quotation, not duplicate FK/boolean state.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `po_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `po_no` | `varchar(80)` | NO | `No explicit default` | UNIQUE: uq_po_number |
| `quotation_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: purchase_order_ibfk_1 |
| `po_document_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: purchase_order_ibfk_2 |
| `received_date` | `date` | NO | `No explicit default` | — |
| `payment_terms` | `varchar(80)` | NO | `No explicit default` | — |
| `delivery_method_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: purchase_order_ibfk_3 |
| `recorded_by_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: purchase_order_ibfk_4 |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `delivery_method_id` (delivery_method_id); unique=False.

- `po_document_id` (po_document_id); unique=False.

- `PRIMARY` (po_id); unique=True.

- `quotation_id` (quotation_id); unique=False.

- `recorded_by_user_id` (recorded_by_user_id); unique=False.

- `uq_po_number` (po_no); unique=True.


## job_order

Revised single PO header; no copied inquiry/client/accepted quote owner IDs and no product-level legacy JO.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `jo_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `jo_no` | `varchar(60)` | NO | `No explicit default` | UNIQUE: uq_jo_number |
| `po_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: job_order_ibfk_1; UNIQUE: uq_jo_po |
| `jo_date` | `date` | NO | `No explicit default` | — |
| `due_date` | `date` | NO | `No explicit default` | — |
| `status` | `varchar(40)` | NO | `No explicit default` | — |
| `payment_terms` | `varchar(80)` | NO | `No explicit default` | — |
| `delivery_method_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: job_order_ibfk_2 |
| `po_verified` | `tinyint(1)` | NO | `0` | — |
| `specs_verified` | `tinyint(1)` | NO | `0` | — |
| `terms_verified` | `tinyint(1)` | NO | `0` | — |
| `prepared_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: job_order_ibfk_3 |
| `approved_by_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: job_order_ibfk_4 |
| `cancellation_reason` | `text` | YES | `NULL` | — |
| `completed_at` | `datetime(3)` | YES | `NULL` | — |
| `archived_at` | `datetime(3)` | YES | `NULL` | — |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_jo_verification_flags` (ENFORCED=YES): `((`po_verified` in (0,1)) and (`specs_verified` in (0,1)) and (`terms_verified` in (0,1)))`

Actual indexes (including PK/UQ/FK support):

- `approved_by_user_id` (approved_by_user_id); unique=False.

- `delivery_method_id` (delivery_method_id); unique=False.

- `ix_jo_queue` (status, due_date); unique=False.

- `prepared_by_user_id` (prepared_by_user_id); unique=False.

- `PRIMARY` (jo_id); unique=True.

- `uq_jo_number` (jo_no); unique=True.

- `uq_jo_po` (po_id); unique=True.


## job_order_item

Revised item-level immutable manufacturing specifications, including structured six-template snapshot; no mutable product master reference.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `jo_item_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `jo_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: job_order_item_ibfk_1; UNIQUE: uq_jo_item_line |
| `quotation_item_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: job_order_item_ibfk_2 |
| `line_no` | `smallint unsigned` | NO | `No explicit default` | UNIQUE: uq_jo_item_line |
| `item_code` | `varchar(80)` | YES | `NULL` | — |
| `enterfil_pn` | `varchar(160)` | YES | `NULL` | — |
| `item_name` | `varchar(200)` | NO | `No explicit default` | — |
| `quantity` | `int unsigned` | NO | `No explicit default` | — |
| `od1_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `od2_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `id1_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `id2_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `height_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `overall_height_mm` | `decimal(15,4)` | YES | `NULL` | — |
| `filter_media` | `varchar(255)` | YES | `NULL` | — |
| `inner_core` | `varchar(255)` | YES | `NULL` | — |
| `outer_core` | `varchar(255)` | YES | `NULL` | — |
| `end_cap` | `varchar(255)` | YES | `NULL` | — |
| `o_ring` | `varchar(255)` | YES | `NULL` | — |
| `gasket` | `varchar(255)` | YES | `NULL` | — |
| `oem_pn` | `varchar(160)` | YES | `NULL` | — |
| `brand` | `varchar(160)` | YES | `NULL` | — |
| `other_specs` | `text` | YES | `NULL` | — |
| `template_specifications_snapshot` | `json` | YES | `NULL` | — |
| `final_sketch_document_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: job_order_item_ibfk_3 |

Actual CHECKs:

- `ck_jo_item_quantity` (ENFORCED=YES): `((`quantity` > 0) and (`line_no` > 0))`

Actual indexes (including PK/UQ/FK support):

- `final_sketch_document_id` (final_sketch_document_id); unique=False.

- `PRIMARY` (jo_item_id); unique=True.

- `quotation_item_id` (quotation_item_id); unique=False.

- `uq_jo_item_line` (jo_id, line_no); unique=True.


## job_order_stage

Revised ERD entity and attributes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `jo_stage_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `jo_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: job_order_stage_ibfk_1; UNIQUE: uq_jo_defined_stage |
| `stage_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: job_order_stage_ibfk_2; UNIQUE: uq_jo_defined_stage |
| `status` | `enum('pending','in_progress','completed')` | NO | `pending` | — |
| `started_at` | `datetime(3)` | YES | `NULL` | — |
| `completed_at` | `datetime(3)` | YES | `NULL` | — |
| `marked_by_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: job_order_stage_ibfk_3 |
| `remarks` | `text` | YES | `NULL` | — |
| `reverted_count` | `int unsigned` | NO | `0` | — |

Actual CHECKs:

- `ck_stage_times` (ENFORCED=YES): `(((`status` = _utf8mb4\'pending\') and (`started_at` is null) and (`completed_at` is null)) or ((`status` = _utf8mb4\'in_progress\') and (`started_at` is not null) and (`completed_at` is null) and (`marked_by_user_id` is not null)) or ((`status` = _utf8mb4\'completed\') and (`started_at` is not null) and (`completed_at` is not null) and (`completed_at` >= `started_at`) and (`marked_by_user_id` is not null)))`

Actual indexes (including PK/UQ/FK support):

- `marked_by_user_id` (marked_by_user_id); unique=False.

- `PRIMARY` (jo_stage_id); unique=True.

- `stage_id` (stage_id); unique=False.

- `uq_jo_defined_stage` (jo_id, stage_id); unique=True.


## material_shortage_report

Revised ERD entity and attributes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `report_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `jo_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: material_shortage_report_ibfk_1 |
| `jo_stage_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: material_shortage_report_ibfk_2 |
| `raw_material_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: material_shortage_report_ibfk_3 |
| `qty_needed` | `decimal(15,4)` | NO | `No explicit default` | — |
| `description` | `text` | NO | `No explicit default` | — |
| `status` | `varchar(40)` | NO | `No explicit default` | — |
| `reported_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: material_shortage_report_ibfk_4 |
| `reported_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |
| `resolved_at` | `datetime(3)` | YES | `NULL` | — |

Actual CHECKs:

- `ck_shortage_quantity` (ENFORCED=YES): `(`qty_needed` > 0)`

- `ck_shortage_resolved` (ENFORCED=YES): `((`resolved_at` is null) or (`resolved_at` >= `reported_at`))`

Actual indexes (including PK/UQ/FK support):

- `ix_shortage_queue` (status, reported_at); unique=False.

- `jo_id` (jo_id); unique=False.

- `jo_stage_id` (jo_stage_id); unique=False.

- `PRIMARY` (report_id); unique=True.

- `raw_material_id` (raw_material_id); unique=False.

- `reported_by_user_id` (reported_by_user_id); unique=False.


## finished_good

Revised client-specific repeat-product inventory; quantities and thresholds are unknown until observed. Forecast attributes are not populated.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `finished_good_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `item_code` | `varchar(80)` | NO | `No explicit default` | UNIQUE: uq_finished_item_code |
| `enterfil_pn` | `varchar(160)` | YES | `NULL` | — |
| `item_name` | `varchar(200)` | NO | `No explicit default` | — |
| `client_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: finished_good_ibfk_1 |
| `filter_type_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: finished_good_ibfk_2 |
| `qty_in_stock` | `int unsigned` | YES | `NULL` | — |
| `quantity_status` | `enum('unknown','provisional_sample','verified')` | NO | `unknown` | — |
| `buffer_min` | `int unsigned` | YES | `NULL` | — |
| `threshold_status` | `enum('unknown','provisional_sample','verified')` | NO | `unknown` | — |
| `demand_level` | `varchar(40)` | YES | `NULL` | — |
| `order_frequency` | `varchar(80)` | YES | `NULL` | — |
| `avg_qty_per_order` | `decimal(15,4)` | YES | `NULL` | — |
| `is_active` | `tinyint(1)` | NO | `1` | — |

Actual CHECKs:

- `ck_finished_average` (ENFORCED=YES): `((`avg_qty_per_order` is null) or (`avg_qty_per_order` >= 0))`

- `ck_finished_quantity` (ENFORCED=YES): `(((`quantity_status` = _utf8mb4\'unknown\') and (`qty_in_stock` is null)) or ((`quantity_status` in (_utf8mb4\'provisional_sample\',_utf8mb4\'verified\')) and (`qty_in_stock` is not null)))`

- `ck_finished_threshold` (ENFORCED=YES): `(((`threshold_status` = _utf8mb4\'unknown\') and (`buffer_min` is null)) or ((`threshold_status` in (_utf8mb4\'provisional_sample\',_utf8mb4\'verified\')) and (`buffer_min` is not null)))`

Actual indexes (including PK/UQ/FK support):

- `filter_type_id` (filter_type_id); unique=False.

- `ix_finished_client` (client_id, item_name); unique=False.

- `PRIMARY` (finished_good_id); unique=True.

- `uq_finished_item_code` (item_code); unique=True.


## stock_movement

Revised single typed movement ledger; provenance, required actor/reason, unit evidence and replay identity support genuine first observations without fictitious zero.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `movement_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `item_type` | `enum('raw_material','finished_good')` | NO | `No explicit default` | — |
| `raw_material_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: stock_movement_ibfk_1 |
| `finished_good_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: stock_movement_ibfk_2 |
| `movement_reason` | `text` | NO | `No explicit default` | — |
| `quantity_status_before` | `enum('unknown','provisional_sample','verified')` | NO | `No explicit default` | — |
| `qty_before` | `decimal(15,4)` | YES | `NULL` | — |
| `qty_after` | `decimal(15,4)` | NO | `No explicit default` | — |
| `qty_change` | `decimal(15,4)` | YES | `NULL` | — |
| `uom_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: stock_movement_ibfk_3 |
| `reference_no` | `varchar(160)` | YES | `NULL` | — |
| `supplier_name` | `varchar(200)` | YES | `NULL` | — |
| `jo_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: stock_movement_ibfk_4 |
| `notes` | `text` | YES | `NULL` | — |
| `performed_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: stock_movement_ibfk_5 |
| `operation_key` | `varchar(120)` | NO | `No explicit default` | UNIQUE: uq_stock_operation |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_finished_movement_units` (ENFORCED=YES): `((`item_type` <> _utf8mb4\'finished_good\') or ((`qty_after` = floor(`qty_after`)) and ((`qty_before` is null) or (`qty_before` = floor(`qty_before`)))))`

- `ck_stock_item_xor` (ENFORCED=YES): `(((`item_type` = _utf8mb4\'raw_material\') and (`raw_material_id` is not null) and (`finished_good_id` is null) and (`uom_id` is not null)) or ((`item_type` = _utf8mb4\'finished_good\') and (`raw_material_id` is null) and (`finished_good_id` is not null) and (`uom_id` is null)))`

- `ck_stock_observation` (ENFORCED=YES): `((`qty_after` >= 0) and (((`quantity_status_before` = _utf8mb4\'verified\') and (`qty_before` is not null) and (`qty_before` >= 0) and (`qty_change` is not null) and (`qty_after` = (`qty_before` + `qty_change`))) or ((`quantity_status_before` in (_utf8mb4\'unknown\',_utf8mb4\'provisional_sample\')) and (`qty_before` is null) and (`qty_change` is null))))`

- `ck_stock_reason` (ENFORCED=YES): `(char_length(trim(`movement_reason`)) > 0)`

Actual indexes (including PK/UQ/FK support):

- `ix_finished_movement_history` (finished_good_id, created_at, movement_id); unique=False.

- `ix_raw_movement_history` (raw_material_id, created_at, movement_id); unique=False.

- `jo_id` (jo_id); unique=False.

- `performed_by_user_id` (performed_by_user_id); unique=False.

- `PRIMARY` (movement_id); unique=True.

- `uom_id` (uom_id); unique=False.

- `uq_stock_operation` (operation_key); unique=True.


## stock_request

Stock-request entity shown in supplied cardinality diagram and newer handoff Warehouse/Sales backlog, absent from revised text attribute sections.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `stock_request_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `inquiry_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: stock_request_ibfk_1 |
| `requested_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: stock_request_ibfk_2 |
| `handled_by_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: stock_request_ibfk_3 |
| `request_date` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |
| `status` | `varchar(40)` | NO | `No explicit default` | — |
| `remarks` | `text` | YES | `NULL` | — |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |
| `updated_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `handled_by_user_id` (handled_by_user_id); unique=False.

- `inquiry_id` (inquiry_id); unique=False.

- `ix_stock_request_queue` (status, request_date); unique=False.

- `PRIMARY` (stock_request_id); unique=True.

- `requested_by_user_id` (requested_by_user_id); unique=False.


## stock_request_item

Diagram request item plus Q02-approved provenance distinction; it is an immutable request-time snapshot, not a second live inventory balance.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `stock_request_item_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `stock_request_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: stock_request_item_ibfk_1; UNIQUE: uq_request_material |
| `raw_material_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: stock_request_item_ibfk_2; UNIQUE: uq_request_material |
| `qty_requested` | `decimal(15,4)` | NO | `No explicit default` | — |
| `stock_at_request` | `decimal(15,4)` | YES | `NULL` | — |
| `qty_available` | `decimal(15,4)` | YES | `NULL` | — |
| `shortage_at_request` | `decimal(15,4)` | YES | `NULL` | — |
| `quantity_status_at_request` | `enum('unknown','provisional_sample','verified')` | NO | `No explicit default` | — |
| `available_quantity_status` | `enum('unknown','provisional_sample','verified')` | YES | `NULL` | — |
| `observed_at` | `datetime(3)` | YES | `NULL` | — |
| `observed_by_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: stock_request_item_ibfk_4 |
| `uom_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: stock_request_item_ibfk_3 |
| `notes` | `text` | YES | `NULL` | — |

Actual CHECKs:

- `ck_request_response` (ENFORCED=YES): `(((`available_quantity_status` is null) and (`qty_available` is null) and (`observed_at` is null) and (`observed_by_user_id` is null)) or ((`available_quantity_status` is not null) and (`observed_at` is not null) and (`observed_by_user_id` is not null) and (((`available_quantity_status` = _utf8mb4\'verified\') and (`qty_available` is not null) and (`qty_available` >= 0)) or ((`available_quantity_status` in (_utf8mb4\'unknown\',_utf8mb4\'provisional_sample\')) and (`qty_available` is null)))))`

- `ck_request_snapshot_provenance` (ENFORCED=YES): `(((`quantity_status_at_request` = _utf8mb4\'verified\') and (`stock_at_request` is not null) and (`stock_at_request` >= 0) and (`shortage_at_request` is not null) and (`shortage_at_request` = greatest((`qty_requested` - `stock_at_request`),0))) or ((`quantity_status_at_request` in (_utf8mb4\'unknown\',_utf8mb4\'provisional_sample\')) and (`stock_at_request` is null) and (`shortage_at_request` is null)))`

- `ck_requested_quantity` (ENFORCED=YES): `(`qty_requested` > 0)`

Actual indexes (including PK/UQ/FK support):

- `observed_by_user_id` (observed_by_user_id); unique=False.

- `PRIMARY` (stock_request_item_id); unique=True.

- `raw_material_id` (raw_material_id); unique=False.

- `uom_id` (uom_id); unique=False.

- `uq_request_material` (stock_request_id, raw_material_id); unique=True.


## production_plan

Revised ERD entity and attributes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `plan_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `plan_code` | `varchar(60)` | NO | `No explicit default` | UNIQUE: uq_plan_code |
| `client_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: production_plan_ibfk_1 |
| `finished_good_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: production_plan_ibfk_2 |
| `jo_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: production_plan_ibfk_3 |
| `source` | `varchar(80)` | NO | `No explicit default` | — |
| `planned_qty` | `int unsigned` | NO | `No explicit default` | — |
| `week_start_date` | `date` | NO | `No explicit default` | — |
| `week_end_date` | `date` | NO | `No explicit default` | — |
| `created_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: production_plan_ibfk_4 |

Actual CHECKs:

- `ck_production_plan` (ENFORCED=YES): `((`planned_qty` > 0) and (`week_end_date` >= `week_start_date`) and ((`finished_good_id` is not null) or (`jo_id` is not null)))`

Actual indexes (including PK/UQ/FK support):

- `client_id` (client_id); unique=False.

- `created_by_user_id` (created_by_user_id); unique=False.

- `finished_good_id` (finished_good_id); unique=False.

- `jo_id` (jo_id); unique=False.

- `PRIMARY` (plan_id); unique=True.

- `uq_plan_code` (plan_code); unique=True.


## sales_invoice

Invoice follows PO acceptance before payment/JO in documented use cases; JO/client derive through PO, avoiding a circular mandatory JO FK.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `invoice_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `invoice_no` | `varchar(60)` | NO | `No explicit default` | UNIQUE: uq_invoice_number |
| `po_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: sales_invoice_ibfk_1; UNIQUE: uq_invoice_po |
| `invoice_date` | `date` | NO | `No explicit default` | — |
| `payment_terms` | `varchar(80)` | NO | `No explicit default` | — |
| `delivered_date` | `date` | YES | `NULL` | — |
| `due_date` | `date` | YES | `NULL` | — |
| `total_amount` | `decimal(19,2)` | NO | `No explicit default` | — |
| `status` | `varchar(40)` | NO | `No explicit default` | — |
| `issued_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: sales_invoice_ibfk_2 |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_invoice_total` (ENFORCED=YES): `(`total_amount` >= 0)`

Actual indexes (including PK/UQ/FK support):

- `issued_by_user_id` (issued_by_user_id); unique=False.

- `ix_invoice_due` (status, due_date); unique=False.

- `PRIMARY` (invoice_id); unique=True.

- `uq_invoice_number` (invoice_no); unique=True.

- `uq_invoice_po` (po_id); unique=True.


## client_receipt

Revised proof submission, not a payment; document_id expands to client_receipt_file for explicitly documented multi-photo submissions.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `receipt_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY; UNIQUE: uq_receipt_invoice |
| `invoice_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: client_receipt_ibfk_1; UNIQUE: uq_receipt_invoice |
| `client_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: client_receipt_ibfk_2 |
| `payment_method_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: client_receipt_ibfk_3 |
| `amount_declared` | `decimal(19,2)` | NO | `No explicit default` | — |
| `note` | `text` | YES | `NULL` | — |
| `review_status` | `enum('pending','verified','rejected')` | NO | `pending` | — |
| `reviewed_by_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: client_receipt_ibfk_4 |
| `reviewed_at` | `datetime(3)` | YES | `NULL` | — |
| `review_note` | `text` | YES | `NULL` | — |
| `sent_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_receipt_amount` (ENFORCED=YES): `(`amount_declared` > 0)`

- `ck_receipt_review` (ENFORCED=YES): `(((`review_status` = _utf8mb4\'pending\') and (`reviewed_by_user_id` is null) and (`reviewed_at` is null)) or ((`review_status` in (_utf8mb4\'verified\',_utf8mb4\'rejected\')) and (`reviewed_by_user_id` is not null) and (`reviewed_at` is not null)))`

Actual indexes (including PK/UQ/FK support):

- `client_user_id` (client_user_id); unique=False.

- `invoice_id` (invoice_id); unique=False.

- `ix_receipt_review` (review_status, sent_at); unique=False.

- `payment_method_id` (payment_method_id); unique=False.

- `PRIMARY` (receipt_id); unique=True.

- `reviewed_by_user_id` (reviewed_by_user_id); unique=False.

- `uq_receipt_invoice` (receipt_id, invoice_id); unique=True.


## payment_transaction

Confirmed-only money, one row per partial/full payment; optional nonunique receipt FK does not impose allocation cardinality or copy attachment amounts.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `payment_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `invoice_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: payment_transaction_ibfk_1; FOREIGN KEY: payment_transaction_ibfk_3 |
| `payment_method_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: payment_transaction_ibfk_2 |
| `transaction_type` | `varchar(40)` | NO | `No explicit default` | — |
| `amount` | `decimal(19,2)` | NO | `No explicit default` | — |
| `reference_no` | `varchar(160)` | YES | `NULL` | — |
| `date_paid` | `date` | NO | `No explicit default` | — |
| `client_receipt_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: payment_transaction_ibfk_3 |
| `approval_status` | `varchar(20)` | NO | `approved` | — |
| `recorded_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: payment_transaction_ibfk_4 |
| `approved_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: payment_transaction_ibfk_5 |
| `approved_at` | `datetime(3)` | NO | `No explicit default` | — |
| `notes` | `text` | YES | `NULL` | — |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |
| `operation_key` | `varchar(120)` | NO | `No explicit default` | UNIQUE: uq_payment_operation |
| `official_receipt_document_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: payment_transaction_ibfk_6 |

Actual CHECKs:

- `ck_confirmed_payment` (ENFORCED=YES): `((`amount` > 0) and (`approval_status` = _utf8mb4\'approved\'))`

Actual indexes (including PK/UQ/FK support):

- `approved_by_user_id` (approved_by_user_id); unique=False.

- `client_receipt_id` (client_receipt_id, invoice_id); unique=False.

- `ix_invoice_payments` (invoice_id, date_paid); unique=False.

- `official_receipt_document_id` (official_receipt_document_id); unique=False.

- `payment_method_id` (payment_method_id); unique=False.

- `PRIMARY` (payment_id); unique=True.

- `recorded_by_user_id` (recorded_by_user_id); unique=False.

- `uq_payment_operation` (operation_key); unique=True.


## delivery

Revised delivery aggregate, many deliveries per JO. PO/invoice/client derive through JO; document numbers and signed files live in required document entities.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `delivery_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `jo_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: delivery_ibfk_1 |
| `delivery_method_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: delivery_ibfk_2 |
| `status` | `varchar(40)` | NO | `No explicit default` | — |
| `dispatch_date` | `datetime(3)` | YES | `NULL` | — |
| `estimated_delivery_date` | `date` | YES | `NULL` | — |
| `delivered_date` | `datetime(3)` | YES | `NULL` | — |
| `driver_name` | `varchar(160)` | YES | `NULL` | — |
| `driver_contact` | `varchar(40)` | YES | `NULL` | — |
| `vehicle_plate` | `varchar(40)` | YES | `NULL` | — |
| `tracking_link` | `varchar(2048)` | YES | `NULL` | — |
| `received_by` | `varchar(160)` | YES | `NULL` | — |
| `notes` | `text` | YES | `NULL` | — |
| `dispatched_by_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: delivery_ibfk_3 |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `delivery_method_id` (delivery_method_id); unique=False.

- `dispatched_by_user_id` (dispatched_by_user_id); unique=False.

- `ix_delivery_queue` (status, estimated_delivery_date); unique=False.

- `jo_id` (jo_id); unique=False.

- `PRIMARY` (delivery_id); unique=True.


## delivery_item

Revised ERD entity and attributes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `delivery_item_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `delivery_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: delivery_item_ibfk_1; UNIQUE: uq_delivery_item |
| `jo_item_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: delivery_item_ibfk_2; UNIQUE: uq_delivery_item |
| `quantity` | `int unsigned` | NO | `No explicit default` | — |

Actual CHECKs:

- `ck_delivery_item_quantity` (ENFORCED=YES): `(`quantity` > 0)`

Actual indexes (including PK/UQ/FK support):

- `jo_item_id` (jo_item_id); unique=False.

- `PRIMARY` (delivery_item_id); unique=True.

- `uq_delivery_item` (delivery_id, jo_item_id); unique=True.


## notification

Revised ERD entity and attributes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `notification_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: notification_ibfk_1 |
| `title` | `varchar(255)` | NO | `No explicit default` | — |
| `message` | `text` | NO | `No explicit default` | — |
| `notification_type` | `varchar(80)` | NO | `No explicit default` | — |
| `is_read` | `tinyint(1)` | NO | `0` | — |
| `created_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |
| `read_at` | `datetime(3)` | YES | `NULL` | — |

Actual CHECKs:

- `ck_notification_read` (ENFORCED=YES): `(((`is_read` = 0) and (`read_at` is null)) or ((`is_read` = 1) and (`read_at` is not null)))`

Actual indexes (including PK/UQ/FK support):

- `ix_user_notifications` (user_id, is_read, created_at); unique=False.

- `PRIMARY` (notification_id); unique=True.


## client_receipt_file

Final.pdf scope p12 explicitly requires multi-photo receipt uploads; one submission amount is independent from the number of documents.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `receipt_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: client_receipt_file_ibfk_1; PRIMARY KEY: PRIMARY |
| `document_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: client_receipt_file_ibfk_2; PRIMARY KEY: PRIMARY |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `document_id` (document_id); unique=False.

- `PRIMARY` (receipt_id, document_id); unique=True.


## waybill

Documented Warehouse generation/printing and Logistics QR verification; waybill is not a shipment or second delivery aggregate.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `waybill_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `delivery_id` | `bigint unsigned` | NO | `No explicit default` | UNIQUE: uq_waybill_delivery; FOREIGN KEY: waybill_ibfk_1 |
| `waybill_no` | `varchar(80)` | NO | `No explicit default` | UNIQUE: uq_waybill_number |
| `qr_identifier` | `varchar(120)` | NO | `No explicit default` | UNIQUE: uq_waybill_qr |
| `generated_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: waybill_ibfk_2 |
| `generated_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |
| `printed_at` | `datetime(3)` | YES | `NULL` | — |
| `document_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: waybill_ibfk_3 |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `document_id` (document_id); unique=False.

- `generated_by_user_id` (generated_by_user_id); unique=False.

- `PRIMARY` (waybill_id); unique=True.

- `uq_waybill_delivery` (delivery_id); unique=True.

- `uq_waybill_number` (waybill_no); unique=True.

- `uq_waybill_qr` (qr_identifier); unique=True.


## delivery_receipt

Final.pdf pp47-49: Accounting generates a DR after dispatch; unlike waybill, it is a different document and responsible role.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `delivery_receipt_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `delivery_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: delivery_receipt_ibfk_1; UNIQUE: uq_dr_delivery |
| `dr_no` | `varchar(80)` | NO | `No explicit default` | UNIQUE: uq_dr_number |
| `generated_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: delivery_receipt_ibfk_2 |
| `generated_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |
| `document_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: delivery_receipt_ibfk_3 |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `document_id` (document_id); unique=False.

- `generated_by_user_id` (generated_by_user_id); unique=False.

- `PRIMARY` (delivery_receipt_id); unique=True.

- `uq_dr_delivery` (delivery_id); unique=True.

- `uq_dr_number` (dr_no); unique=True.


## signed_delivery_receipt

Final.pdf pp50-51: signed DR upload/retention by Client or Logistics after delivery. Multiple retained uploads do not overwrite one file on delivery.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `signed_dr_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `delivery_receipt_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: signed_delivery_receipt_ibfk_1 |
| `document_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: signed_delivery_receipt_ibfk_2; UNIQUE: uq_signed_dr_document |
| `submitted_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: signed_delivery_receipt_ibfk_3 |
| `submitted_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |
| `received_at` | `datetime(3)` | YES | `NULL` | — |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `delivery_receipt_id` (delivery_receipt_id); unique=False.

- `PRIMARY` (signed_dr_id); unique=True.

- `submitted_by_user_id` (submitted_by_user_id); unique=False.

- `uq_signed_dr_document` (document_id); unique=True.


## production_stage_event

Backlog requires timestamped staff attribution and required reversion reason; this append-only event trail is not a second stage-state tracker.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `stage_event_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `jo_stage_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: production_stage_event_ibfk_1 |
| `action` | `varchar(40)` | NO | `No explicit default` | — |
| `reason` | `text` | YES | `NULL` | — |
| `performed_by_user_id` | `bigint unsigned` | NO | `No explicit default` | FOREIGN KEY: production_stage_event_ibfk_2 |
| `occurred_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

- `ck_stage_reversion_reason` (ENFORCED=YES): `((`action` <> _utf8mb4\'reverted\') or ((`reason` is not null) and (char_length(trim(`reason`)) > 0)))`

Actual indexes (including PK/UQ/FK support):

- `ix_stage_event_history` (jo_stage_id, occurred_at, stage_event_id); unique=False.

- `performed_by_user_id` (performed_by_user_id); unique=False.

- `PRIMARY` (stage_event_id); unique=True.


## audit_event

Explicit inventory audit/reason and cross-role historical traceability requirements; polymorphic historical subject IDs intentionally survive lifecycle changes.

| Column | Actual MySQL type | Nullable | Default / generation | Keys |
| --- | --- | --- | --- | --- |
| `audit_event_id` | `bigint unsigned` | NO | `AUTO_INCREMENT` | PRIMARY KEY: PRIMARY |
| `actor_user_id` | `bigint unsigned` | YES | `NULL` | FOREIGN KEY: audit_event_ibfk_1 |
| `action` | `varchar(80)` | NO | `No explicit default` | — |
| `subject_type` | `varchar(60)` | NO | `No explicit default` | — |
| `subject_id` | `bigint unsigned` | NO | `No explicit default` | — |
| `before_value` | `json` | YES | `NULL` | — |
| `after_value` | `json` | YES | `NULL` | — |
| `reason` | `text` | YES | `NULL` | — |
| `occurred_at` | `datetime(3)` | NO | `CURRENT_TIMESTAMP(3)` | — |

Actual CHECKs:

Actual indexes (including PK/UQ/FK support):

- `actor_user_id` (actor_user_id); unique=False.

- `ix_audit_subject` (subject_type, subject_id, occurred_at); unique=False.

- `PRIMARY` (audit_event_id); unique=True.

