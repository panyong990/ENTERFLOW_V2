# ENTER-FLOW V2 Phase 2 Task 001 schema source dictionary

Date: 2026-11-21, Asia/Singapore. Static reference for the [architecture review](PHASE_2_TASK_001_DATABASE_ARCHITECTURE_REVIEW_2026-11-21.md). These are source declarations read from five explicitly named permitted files, not a current database export or a new migration. Original declarations must be interpreted with the later material ALTER section. No SQL was executed; no migration directory was enumerated; no protected Migration 007 or Task 003 artifact was accessed. Deployment and actual record state remain pending operator evidence.

## schema_migrations

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  version VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## roles

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## modules

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  code VARCHAR(40) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## role_modules

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  role_code VARCHAR(24) NOT NULL,
  module_code VARCHAR(40) NOT NULL,
  PRIMARY KEY (role_code, module_code),
  FOREIGN KEY (role_code) REFERENCES roles(code),
  FOREIGN KEY (module_code) REFERENCES modules(code)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## payment_terms

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  days_after_receipt SMALLINT UNSIGNED NOT NULL
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## clients

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  industry VARCHAR(120) NULL,
  contact_person VARCHAR(160) NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(40) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city_province VARCHAR(160) NULL,
  postal_code VARCHAR(20) NULL,
  payment_term_code VARCHAR(24) NULL,
  internal_notes TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_on DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_client_company (company_name),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## users

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_code VARCHAR(24) NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  account_type ENUM('employee','client') NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL,
  username VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NULL,
  password_hash VARCHAR(255) NOT NULL,
  employee_number VARCHAR(80) NULL,
  department VARCHAR(120) NULL,
  job_title VARCHAR(120) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  joined_on DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_email (email),
  UNIQUE KEY uq_user_username (username),
  UNIQUE KEY uq_employee_number (employee_number),
  CONSTRAINT ck_user_identity CHECK (
    (account_type = 'client' AND role_code = 'client' AND client_id IS NOT NULL AND employee_number IS NULL)
    OR (account_type = 'employee' AND role_code <> 'client' AND client_id IS NULL)
  ),
  FOREIGN KEY (role_code) REFERENCES roles(code),
  FOREIGN KEY (client_id) REFERENCES clients(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## client_applications

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL,
  username VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  decided_at DATETIME(3) NULL,
  decided_by BIGINT UNSIGNED NULL,
  rejection_reason TEXT NULL,
  approved_client_id BIGINT UNSIGNED NULL,
  KEY ix_application_review (status, submitted_at),
  KEY ix_application_email (email),
  KEY ix_application_username (username),
  FOREIGN KEY (decided_by) REFERENCES users(id),
  FOREIGN KEY (approved_client_id) REFERENCES clients(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## filter_types

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  template_group VARCHAR(24) NOT NULL
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## product_specifications

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  filter_type_code VARCHAR(24) NOT NULL,
  filter_name VARCHAR(200) NOT NULL,
  od1 VARCHAR(100) NULL, od2 VARCHAR(100) NULL,
  id1 VARCHAR(100) NULL, id2 VARCHAR(100) NULL,
  height VARCHAR(100) NULL, overall_height VARCHAR(100) NULL,
  length VARCHAR(100) NULL, width VARCHAR(100) NULL,
  thickness VARCHAR(100) NULL, depth VARCHAR(100) NULL,
  pocket_count VARCHAR(100) NULL, diameter VARCHAR(100) NULL,
  cloth_cutting_width VARCHAR(100) NULL, cloth_cutting_length VARCHAR(100) NULL,
  spring_plate_center_to_center VARCHAR(100) NULL,
  spring_plate_width VARCHAR(100) NULL, spring_plate_length VARCHAR(100) NULL,
  pad_od VARCHAR(100) NULL, pad_id VARCHAR(100) NULL,
  media VARCHAR(255) NULL, inner_core VARCHAR(255) NULL, outer_core VARCHAR(255) NULL,
  oring VARCHAR(255) NULL, gasket VARCHAR(255) NULL, end_cap VARCHAR(255) NULL,
  oem_part_number VARCHAR(160) NULL, brand VARCHAR(160) NULL,
  filtration_rating VARCHAR(120) NULL, others TEXT NULL, notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_spec_client (id, client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (filter_type_code) REFERENCES filter_types(code)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## material_categories

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## units

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  code VARCHAR(16) NOT NULL PRIMARY KEY,
  label VARCHAR(40) NOT NULL
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## materials

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_code VARCHAR(32) NOT NULL,
  unit_code VARCHAR(16) NOT NULL,
  unit_price DECIMAL(15,4) NOT NULL DEFAULT 0,
  quantity_on_hand DECIMAL(15,4) NOT NULL DEFAULT 0,
  reorder_threshold DECIMAL(15,4) NOT NULL DEFAULT 0,
  supplier_name VARCHAR(200) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_material_values CHECK (unit_price >= 0 AND quantity_on_hand >= 0 AND reorder_threshold >= 0),
  KEY ix_material_category (category_code, name),
  FOREIGN KEY (category_code) REFERENCES material_categories(code),
  FOREIGN KEY (unit_code) REFERENCES units(code)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## bom_templates

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  filter_type_code VARCHAR(24) NOT NULL,
  size_label VARCHAR(40) NULL,
  labor_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
  markup_percent DECIMAL(9,4) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  vat_type ENUM('Exclusive','Inclusive','Zero-Rated') NOT NULL,
  vat_rate DECIMAL(7,4) NOT NULL,
  include_labor BOOLEAN NOT NULL, apply_markup BOOLEAN NOT NULL, apply_vat BOOLEAN NOT NULL,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_template_cost CHECK (labor_cost >= 0 AND markup_percent >= 0 AND discount_percent BETWEEN 0 AND 100 AND vat_rate BETWEEN 0 AND 100),
  FOREIGN KEY (filter_type_code) REFERENCES filter_types(code),
  FOREIGN KEY (created_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## bom_template_lines

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  template_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  quantity_per_filter DECIMAL(15,4) NOT NULL,
  waste_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_template_line (template_id, line_number),
  CONSTRAINT ck_template_qty CHECK (quantity_per_filter > 0 AND waste_percent BETWEEN 0 AND 100),
  FOREIGN KEY (template_id) REFERENCES bom_templates(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## files

Definition source: [exact SQL file](../database/migrations/001_identity_catalog.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  bucket VARCHAR(63) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  object_path VARCHAR(700) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  object_generation VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  state ENUM('pending','available','failed','deleted') NOT NULL DEFAULT 'pending',
  uploaded_by BIGINT UNSIGNED NOT NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  UNIQUE KEY uq_storage_object (bucket, object_path),
  KEY ix_files_cleanup (state, uploaded_at),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## order_stages

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## delivery_methods

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## orders

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(60) NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  contact_person VARCHAR(160) NOT NULL,
  stage_code VARCHAR(32) NOT NULL,
  payment_term_code VARCHAR(24) NOT NULL,
  delivery_method_code VARCHAR(32) NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NOT NULL,
  general_notes TEXT NULL,
  urgent BOOLEAN NOT NULL DEFAULT FALSE,
  requested_delivery_date DATE NULL,
  reorder_source_id BIGINT UNSIGNED NULL,
  archive_reason ENUM('rejected','cancelled') NULL,
  archive_note TEXT NULL,
  archived_at DATETIME(3) NULL,
  archived_by BIGINT UNSIGNED NULL,
  fulfillment_completed_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_order_reference (reference),
  UNIQUE KEY uq_order_client_pair (id, client_id),
  KEY ix_order_client (client_id, submitted_at),
  KEY ix_order_queue (stage_code, archived_at, urgent, requested_delivery_date),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (stage_code) REFERENCES order_stages(code),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code),
  FOREIGN KEY (delivery_method_code) REFERENCES delivery_methods(code),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (archived_by) REFERENCES users(id),
  FOREIGN KEY (reorder_source_id, client_id) REFERENCES orders(id, client_id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## order_items

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  specification_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_order_item_line (order_id, line_number),
  UNIQUE KEY uq_item_order (id, order_id),
  UNIQUE KEY uq_item_client (id, client_id),
  UNIQUE KEY uq_item_order_client (id, order_id, client_id),
  CONSTRAINT ck_order_item_qty CHECK (quantity >= 10),
  FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (specification_id, client_id) REFERENCES product_specifications(id, client_id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## quotation_references

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  reference VARCHAR(60) NOT NULL PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_quote_reference_owner (reference, order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## quotations

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL,
  revision_number SMALLINT UNSIGNED NOT NULL,
  status ENUM('draft','sent','superseded') NOT NULL DEFAULT 'draft',
  issued_on DATE NOT NULL,
  valid_until DATE NOT NULL,
  payment_term_code VARCHAR(24) NOT NULL,
  time_of_delivery VARCHAR(255) NOT NULL,
  place_of_delivery TEXT NOT NULL,
  note TEXT NULL,
  note_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  total_amount DECIMAL(15,2) NOT NULL,
  downpayment_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  downpayment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  stock_checked_at DATETIME(3) NULL,
  prepared_by BIGINT UNSIGNED NOT NULL,
  sent_by BIGINT UNSIGNED NULL,
  sent_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_quote_revision (order_id, revision_number),
  UNIQUE KEY uq_quote_reference_revision (reference, revision_number),
  UNIQUE KEY uq_quote_order (id, order_id),
  CONSTRAINT ck_quote_amounts CHECK (total_amount >= 0 AND downpayment_percent BETWEEN 0 AND 100 AND downpayment_amount BETWEEN 0 AND total_amount),
  CONSTRAINT ck_quote_dates CHECK (valid_until >= issued_on),
  FOREIGN KEY (reference, order_id) REFERENCES quotation_references(reference, order_id),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code),
  FOREIGN KEY (prepared_by) REFERENCES users(id),
  FOREIGN KEY (sent_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## quotation_lines

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  sub_description TEXT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  unit_label VARCHAR(40) NOT NULL,
  unit_price DECIMAL(15,4) NOT NULL,
  UNIQUE KEY uq_quote_line (quotation_id, line_number),
  CONSTRAINT ck_quote_line_values CHECK (quantity > 0 AND unit_price >= 0),
  FOREIGN KEY (quotation_id, order_id) REFERENCES quotations(id, order_id),
  FOREIGN KEY (order_item_id, order_id) REFERENCES order_items(id, order_id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## quotation_costing

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  labor_cost DECIMAL(15,4) NOT NULL,
  markup_percent DECIMAL(9,4) NOT NULL,
  discount_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  vat_type ENUM('Exclusive','Inclusive','Zero-Rated') NOT NULL,
  vat_rate DECIMAL(7,4) NOT NULL,
  include_labor BOOLEAN NOT NULL, apply_markup BOOLEAN NOT NULL, apply_vat BOOLEAN NOT NULL,
  calculated_unit_price DECIMAL(15,4) NOT NULL,
  UNIQUE KEY uq_costing_item (quotation_id, order_item_id),
  UNIQUE KEY uq_costing_source (id, order_item_id, order_id),
  CONSTRAINT ck_costing_values CHECK (labor_cost >= 0 AND markup_percent >= 0 AND discount_percent BETWEEN 0 AND 100 AND vat_rate BETWEEN 0 AND 100 AND calculated_unit_price >= 0),
  FOREIGN KEY (quotation_id, order_id) REFERENCES quotations(id, order_id),
  FOREIGN KEY (order_item_id, order_id) REFERENCES order_items(id, order_id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## quotation_bom_lines

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  costing_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  material_name_snapshot VARCHAR(200) NOT NULL,
  unit_snapshot VARCHAR(40) NOT NULL,
  unit_price_snapshot DECIMAL(15,4) NOT NULL,
  quantity_per_filter DECIMAL(15,4) NOT NULL,
  waste_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_costing_bom_line (costing_id, line_number),
  CONSTRAINT ck_quote_bom_values CHECK (unit_price_snapshot >= 0 AND quantity_per_filter > 0 AND waste_percent BETWEEN 0 AND 100),
  FOREIGN KEY (costing_id) REFERENCES quotation_costing(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## quotation_discounts

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  quotation_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  label VARCHAR(160) NOT NULL,
  percent DECIMAL(7,4) NOT NULL,
  PRIMARY KEY (quotation_id, line_number),
  CONSTRAINT ck_quote_discount CHECK (percent BETWEEN 0 AND 100),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## quotation_addons

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('packaging','shipping') NOT NULL,
  material_id BIGINT UNSIGNED NULL,
  label VARCHAR(200) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  unit_price DECIMAL(15,4) NOT NULL,
  include_in_unit_price BOOLEAN NOT NULL,
  UNIQUE KEY uq_quote_addon (quotation_id, kind),
  CONSTRAINT ck_addon_values CHECK (quantity > 0 AND unit_price >= 0),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## purchase_orders

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  accepted_quotation_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL,
  client_reference VARCHAR(160) NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  uploaded_by BIGINT UNSIGNED NOT NULL,
  received_at DATETIME(3) NULL,
  received_by BIGINT UNSIGNED NULL,
  cleared_at DATETIME(3) NULL,
  cleared_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_po_order (order_id),
  UNIQUE KEY uq_po_reference (reference),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (accepted_quotation_id, order_id) REFERENCES quotations(id, order_id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (received_by) REFERENCES users(id),
  FOREIGN KEY (cleared_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## order_requests

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('cancellation','quotation_revision','urgent_upgrade') NOT NULL,
  reason TEXT NOT NULL,
  response TEXT NULL,
  requested_by BIGINT UNSIGNED NOT NULL,
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  status ENUM('pending','approved','declined','completed') NOT NULL DEFAULT 'pending',
  decided_by BIGINT UNSIGNED NULL,
  decided_at DATETIME(3) NULL,
  KEY ix_order_request_queue (status, kind, requested_at),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (decided_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## document_sequences

Definition source: [exact SQL file](../database/migrations/002_orders_quotations.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  document_type VARCHAR(16) NOT NULL,
  document_year SMALLINT UNSIGNED NOT NULL,
  `last_value` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (document_type, document_year)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## production_stages

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  position SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  CONSTRAINT ck_production_position CHECK (position BETWEEN 0 AND 8)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## replacement_requests

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  defect_description TEXT NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  status ENUM('pending','processing','resolved') NOT NULL DEFAULT 'pending',
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  requested_by BIGINT UNSIGNED NOT NULL,
  resolved_at DATETIME(3) NULL,
  resolved_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_replacement_order_pair (id, order_id),
  CONSTRAINT ck_replacement_qty CHECK (quantity > 0),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## job_orders

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(60) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  specification_id BIGINT UNSIGNED NOT NULL,
  replacement_request_id BIGINT UNSIGNED NULL,
  costing_id BIGINT UNSIGNED NULL,
  quantity INT UNSIGNED NOT NULL,
  production_due_date DATE NOT NULL,
  current_stage_cursor SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('jo','in_production','quality_inspection','ready_for_dispatch','cancelled') NOT NULL DEFAULT 'jo',
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  pause_reason TEXT NULL,
  materials_deducted_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_jo_reference (reference),
  UNIQUE KEY uq_job_order_pair (id, order_id),
  UNIQUE KEY uq_job_client_pair (id, client_id),
  KEY ix_jo_queue (status, paused, production_due_date),
  CONSTRAINT ck_jo_values CHECK (quantity > 0 AND current_stage_cursor BETWEEN 0 AND 9),
  FOREIGN KEY (order_item_id, order_id, client_id) REFERENCES order_items(id, order_id, client_id),
  FOREIGN KEY (specification_id, client_id) REFERENCES product_specifications(id, client_id),
  FOREIGN KEY (replacement_request_id, order_id) REFERENCES replacement_requests(id, order_id),
  FOREIGN KEY (costing_id, order_item_id, order_id) REFERENCES quotation_costing(id, order_item_id, order_id),
  FOREIGN KEY (created_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## job_bom_lines

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  material_name_snapshot VARCHAR(200) NOT NULL,
  unit_snapshot VARCHAR(40) NOT NULL,
  unit_price_snapshot DECIMAL(15,4) NOT NULL,
  quantity_per_filter DECIMAL(15,4) NOT NULL,
  waste_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_job_bom_line (job_order_id, line_number),
  CONSTRAINT ck_job_bom_values CHECK (unit_price_snapshot >= 0 AND quantity_per_filter > 0 AND waste_percent BETWEEN 0 AND 100),
  FOREIGN KEY (job_order_id) REFERENCES job_orders(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## production_events

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  stage_position SMALLINT UNSIGNED NULL,
  action ENUM('done','reverted','paused','resumed','completed','cancelled') NOT NULL,
  reason TEXT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_production_history (job_order_id, occurred_at),
  FOREIGN KEY (job_order_id) REFERENCES job_orders(id),
  FOREIGN KEY (stage_position) REFERENCES production_stages(position),
  FOREIGN KEY (performed_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## material_movements

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  material_id BIGINT UNSIGNED NOT NULL,
  job_order_id BIGINT UNSIGNED NULL,
  kind ENUM('opening','adjustment','receipt','jo_deduction','jo_restoration') NOT NULL,
  quantity_delta DECIMAL(15,4) NOT NULL,
  quantity_before DECIMAL(15,4) NOT NULL,
  quantity_after DECIMAL(15,4) NOT NULL,
  reason TEXT NOT NULL,
  reference_text VARCHAR(160) NULL,
  idempotency_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_material_operation (idempotency_key),
  KEY ix_material_history (material_id, occurred_at),
  CONSTRAINT ck_material_movement CHECK (quantity_before >= 0 AND quantity_after >= 0 AND quantity_after = quantity_before + quantity_delta),
  FOREIGN KEY (material_id) REFERENCES materials(id),
  FOREIGN KEY (job_order_id) REFERENCES job_orders(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## material_changes

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  material_id BIGINT UNSIGNED NOT NULL,
  field_name VARCHAR(80) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  reason TEXT NOT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_material_change_history (material_id, occurred_at),
  FOREIGN KEY (material_id) REFERENCES materials(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## finished_goods

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  item_code VARCHAR(80) NOT NULL,
  enterfil_part_number VARCHAR(160) NOT NULL,
  specification_id BIGINT UNSIGNED NOT NULL,
  quantity_on_hand INT UNSIGNED NOT NULL DEFAULT 0,
  buffer_minimum INT UNSIGNED NOT NULL DEFAULT 0,
  demand ENUM('HIGH DEMAND','MONITOR','STABLE') NOT NULL DEFAULT 'STABLE',
  updated_by BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_finished_item_code (item_code),
  UNIQUE KEY uq_finished_client_pair (id, client_id),
  KEY ix_finished_client_part (client_id, enterfil_part_number),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (specification_id, client_id) REFERENCES product_specifications(id, client_id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## finished_good_movements

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  finished_good_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  job_order_id BIGINT UNSIGNED NULL,
  quantity_before INT UNSIGNED NOT NULL,
  quantity_after INT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_finished_history (finished_good_id, occurred_at),
  FOREIGN KEY (finished_good_id, client_id) REFERENCES finished_goods(id, client_id),
  FOREIGN KEY (job_order_id, client_id) REFERENCES job_orders(id, client_id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## finished_good_order_items

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  finished_good_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (finished_good_id, order_item_id),
  FOREIGN KEY (finished_good_id, client_id) REFERENCES finished_goods(id, client_id),
  FOREIGN KEY (order_item_id, client_id) REFERENCES order_items(id, client_id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## stock_requests

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(60) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_reference VARCHAR(160) NULL,
  status ENUM('pending','responded','update_requested','updated') NOT NULL DEFAULT 'pending',
  requested_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  update_requested_at DATETIME(3) NULL,
  update_reason TEXT NULL,
  UNIQUE KEY uq_stock_request_reference (reference),
  UNIQUE KEY uq_stock_request_order (id, order_id),
  KEY ix_stock_request_queue (status, created_at),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (requested_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## stock_request_lines

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stock_request_id BIGINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  material_name_snapshot VARCHAR(200) NOT NULL,
  unit_snapshot VARCHAR(40) NOT NULL,
  required_quantity DECIMAL(15,4) NOT NULL,
  stock_at_request DECIMAL(15,4) NULL,
  shortage_at_request DECIMAL(15,4) NULL,
  UNIQUE KEY uq_request_material (stock_request_id, material_id),
  UNIQUE KEY uq_request_line_pair (id, stock_request_id),
  CONSTRAINT ck_stock_request_values CHECK (required_quantity > 0 AND (stock_at_request IS NULL OR stock_at_request >= 0) AND (shortage_at_request IS NULL OR shortage_at_request >= 0)),
  FOREIGN KEY (stock_request_id) REFERENCES stock_requests(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## stock_responses

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stock_request_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('initial','updated') NOT NULL,
  responded_by BIGINT UNSIGNED NOT NULL,
  responded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_response_request_pair (id, stock_request_id),
  UNIQUE KEY uq_response_order_pair (id, order_id),
  KEY ix_stock_responses (stock_request_id, responded_at),
  FOREIGN KEY (stock_request_id, order_id) REFERENCES stock_requests(id, order_id),
  FOREIGN KEY (responded_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## stock_response_lines

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  stock_response_id BIGINT UNSIGNED NOT NULL,
  stock_request_line_id BIGINT UNSIGNED NOT NULL,
  stock_request_id BIGINT UNSIGNED NOT NULL,
  current_quantity DECIMAL(15,4) NOT NULL,
  shortage_quantity DECIMAL(15,4) NOT NULL,
  status ENUM('sufficient','shortage') NOT NULL,
  PRIMARY KEY (stock_response_id, stock_request_line_id),
  CONSTRAINT ck_stock_response_values CHECK (current_quantity >= 0 AND shortage_quantity >= 0),
  FOREIGN KEY (stock_response_id, stock_request_id) REFERENCES stock_responses(id, stock_request_id),
  FOREIGN KEY (stock_request_line_id, stock_request_id) REFERENCES stock_request_lines(id, stock_request_id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## quotation_stock_responses

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  quotation_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  stock_response_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (quotation_id, order_id) REFERENCES quotations(id, order_id),
  FOREIGN KEY (stock_response_id, order_id) REFERENCES stock_responses(id, order_id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## shipments

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  delivery_method_code VARCHAR(32) NOT NULL,
  status ENUM('pending','in_transit','delivered','picked_up') NOT NULL DEFAULT 'pending',
  tracking_reference VARCHAR(160) NULL,
  tracking_link VARCHAR(2048) NULL,
  recipient_name VARCHAR(160) NULL, recipient_phone VARCHAR(40) NULL,
  recipient_email VARCHAR(254) NULL, delivery_address TEXT NULL,
  driver_name VARCHAR(160) NULL, driver_phone VARCHAR(40) NULL,
  vehicle_plate VARCHAR(40) NULL,
  pickup_person VARCHAR(160) NULL, pickup_phone VARCHAR(40) NULL,
  pickup_email VARCHAR(254) NULL, pickup_vehicle_plate VARCHAR(40) NULL,
  pickup_id_required BOOLEAN NULL,
  office_contact VARCHAR(160) NULL,
  estimated_delivery_date DATE NULL, expected_pickup_date DATE NULL,
  dispatched_at DATETIME(3) NULL, delivered_at DATETIME(3) NULL,
  fulfillment_completed_at DATETIME(3) NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_shipment_job (job_order_id),
  UNIQUE KEY uq_shipment_order (id, order_id),
  KEY ix_shipment_queue (status, estimated_delivery_date),
  FOREIGN KEY (job_order_id, order_id) REFERENCES job_orders(id, order_id),
  FOREIGN KEY (delivery_method_code) REFERENCES delivery_methods(code),
  FOREIGN KEY (updated_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## waybills

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(80) NOT NULL,
  qr_identifier VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  printed_at DATETIME(3) NULL,
  printed_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_waybill_shipment (shipment_id),
  UNIQUE KEY uq_waybill_reference (reference),
  UNIQUE KEY uq_waybill_qr (qr_identifier),
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  FOREIGN KEY (printed_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## shipment_events

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(80) NOT NULL,
  note TEXT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_shipment_events (shipment_id, occurred_at),
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## delivery_receipts

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL,
  generated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  generated_by BIGINT UNSIGNED NOT NULL,
  sent_to_logistics_at DATETIME(3) NULL,
  sent_to_logistics_by BIGINT UNSIGNED NULL,
  sent_to_client_at DATETIME(3) NULL,
  sent_to_client_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_dr_shipment (shipment_id),
  UNIQUE KEY uq_dr_reference (reference),
  UNIQUE KEY uq_dr_order_pair (id, order_id),
  FOREIGN KEY (shipment_id, order_id) REFERENCES shipments(id, order_id),
  FOREIGN KEY (generated_by) REFERENCES users(id),
  FOREIGN KEY (sent_to_logistics_by) REFERENCES users(id),
  FOREIGN KEY (sent_to_client_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## signed_delivery_receipts

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_receipt_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  submitted_by BIGINT UNSIGNED NOT NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  received_at DATETIME(3) NULL,
  -- NULL for staged/discarded; exactly 1 for accepted. CHECK prevents bypass.
  accepted_slot SMALLINT UNSIGNED NULL,
  discarded_at DATETIME(3) NULL,
  CONSTRAINT ck_signed_dr_state CHECK (
    (received_at IS NULL AND accepted_slot IS NULL)
    OR (received_at IS NOT NULL AND discarded_at IS NULL
        AND accepted_slot IS NOT NULL AND accepted_slot = 1)
  ),
  -- Multiple NULL slots are allowed; only one (DR, 1) can exist.
  UNIQUE KEY uq_one_accepted_signed_dr (delivery_receipt_id, accepted_slot),
  UNIQUE KEY uq_signed_receipt_order_state (id, order_id, accepted_slot),
  UNIQUE KEY uq_signed_dr_file (file_id),
  KEY ix_signed_dr_state (delivery_receipt_id, received_at, discarded_at),
  FOREIGN KEY (delivery_receipt_id, order_id) REFERENCES delivery_receipts(id, order_id),
  FOREIGN KEY (file_id) REFERENCES files(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## invoices

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL,
  issued_on DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_term_code VARCHAR(24) NOT NULL,
  required_downpayment DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_cycle_started_at DATETIME(3) NULL,
  due_on DATE NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  sent_at DATETIME(3) NULL,
  sent_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_invoice_order (order_id),
  UNIQUE KEY uq_invoice_reference (reference),
  UNIQUE KEY uq_invoice_order_pair (id, order_id),
  KEY ix_invoice_due (due_on, sent_at),
  CONSTRAINT ck_invoice_amount CHECK (amount >= 0 AND required_downpayment BETWEEN 0 AND amount),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (sent_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## invoice_delivery_receipts

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  invoice_id BIGINT UNSIGNED NOT NULL,
  signed_delivery_receipt_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  accepted_slot SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (invoice_id, signed_delivery_receipt_id),
  CONSTRAINT ck_invoice_receipt_accepted CHECK (accepted_slot = 1),
  FOREIGN KEY (invoice_id, order_id) REFERENCES invoices(id, order_id),
  FOREIGN KEY (signed_delivery_receipt_id, order_id, accepted_slot)
    REFERENCES signed_delivery_receipts(id, order_id, accepted_slot)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## payments

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NULL,
  payment_type ENUM('DOWNPAYMENT','BALANCE_PAYMENT','FULL_PAYMENT') NOT NULL,
  submitted_amount DECIMAL(15,2) NOT NULL,
  verified_amount DECIMAL(15,2) NULL,
  method VARCHAR(80) NULL,
  reference_number VARCHAR(160) NULL,
  paid_on DATE NOT NULL,
  note TEXT NULL,
  verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  submitted_by BIGINT UNSIGNED NOT NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME(3) NULL,
  idempotency_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  UNIQUE KEY uq_payment_operation (idempotency_key),
  KEY ix_payment_review (verification_status, submitted_at),
  KEY ix_payment_order (order_id, verification_status),
  CONSTRAINT ck_payment_amount CHECK (submitted_amount > 0 AND (verified_amount IS NULL OR verified_amount > 0)),
  CONSTRAINT ck_payment_review CHECK (
    (verification_status = 'pending' AND verified_amount IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (verification_status = 'verified' AND verified_amount IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (verification_status = 'rejected' AND verified_amount IS NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (invoice_id, order_id) REFERENCES invoices(id, order_id),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## payment_instructions

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  method VARCHAR(80) NOT NULL,
  account_name VARCHAR(160) NULL,
  account_number VARCHAR(100) NULL,
  bank_name VARCHAR(160) NULL,
  note TEXT NULL,
  sent_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  sent_by BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (sent_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## company_settings

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  address_line1 VARCHAR(255) NULL, address_line2 VARCHAR(255) NULL,
  city_province VARCHAR(160) NULL, postal_code VARCHAR(20) NULL,
  main_phone VARCHAR(40) NULL, secondary_phone VARCHAR(40) NULL,
  email VARCHAR(254) NULL, office_hours VARCHAR(160) NULL,
  default_vehicle_plate VARCHAR(40) NULL,
  default_driver VARCHAR(160) NULL, default_driver_contact VARCHAR(40) NULL,
  document_footer TEXT NULL,
  bank_name VARCHAR(160) NULL, bank_account_name VARCHAR(160) NULL, bank_account_number VARCHAR(100) NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_company_singleton CHECK (id = 1),
  FOREIGN KEY (updated_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## company_payment_methods

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_settings_id SMALLINT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  type ENUM('bank_transfer','gcash','cash','check','other') NOT NULL,
  details TEXT NOT NULL,
  FOREIGN KEY (company_settings_id) REFERENCES company_settings(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## notifications

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  department ENUM('sales','production','logistics','payments','system') NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  module_code VARCHAR(40) NULL,
  order_id BIGINT UNSIGNED NULL,
  client_id BIGINT UNSIGNED NULL,
  reply_to_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (module_code) REFERENCES modules(code),
  CONSTRAINT ck_notification_order_scope CHECK (order_id IS NULL OR client_id IS NOT NULL),
  FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (reply_to_id) REFERENCES notifications(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## notification_roles

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  notification_id BIGINT UNSIGNED NOT NULL,
  role_code VARCHAR(24) NOT NULL,
  PRIMARY KEY (notification_id, role_code),
  FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (role_code) REFERENCES roles(code)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## notification_recipients

Definition source: [exact SQL file](../database/migrations/003_operations_billing.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME(3) NULL,
  dismissed_at DATETIME(3) NULL,
  PRIMARY KEY (notification_id, user_id),
  KEY ix_user_notifications (user_id, dismissed_at, read_at),
  FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## order_files

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('inquiry_sketch','supporting_document') NOT NULL,
  PRIMARY KEY (order_id, file_id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## specification_files

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  specification_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('sketch','product_image') NOT NULL,
  PRIMARY KEY (specification_id, file_id),
  FOREIGN KEY (specification_id) REFERENCES product_specifications(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## quotation_files

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  quotation_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document','signed_quotation') NOT NULL,
  PRIMARY KEY (quotation_id, file_id),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## purchase_order_files

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('client_document') NOT NULL,
  PRIMARY KEY (purchase_order_id, file_id),
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## job_order_files

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  job_order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('sketch','signed_quotation','generated_document') NOT NULL,
  PRIMARY KEY (job_order_id, file_id),
  FOREIGN KEY (job_order_id) REFERENCES job_orders(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## payment_files

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  payment_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('proof_of_payment','receipt') NOT NULL,
  PRIMARY KEY (payment_id, file_id),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## invoice_files

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  invoice_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document') NOT NULL,
  PRIMARY KEY (invoice_id, file_id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## waybill_files

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  waybill_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document') NOT NULL,
  PRIMARY KEY (waybill_id, file_id),
  FOREIGN KEY (waybill_id) REFERENCES waybills(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## delivery_receipt_files

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  delivery_receipt_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document') NOT NULL,
  PRIMARY KEY (delivery_receipt_id, file_id),
  FOREIGN KEY (delivery_receipt_id) REFERENCES delivery_receipts(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## replacement_request_files

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  replacement_request_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('defect_proof') NOT NULL,
  PRIMARY KEY (replacement_request_id, file_id),
  FOREIGN KEY (replacement_request_id) REFERENCES replacement_requests(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## audit_events

Definition source: [exact SQL file](../database/migrations/004_attachments_audit.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  subject_type VARCHAR(60) NOT NULL,
  subject_identifier VARCHAR(100) NOT NULL,
  field_name VARCHAR(80) NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  reason TEXT NULL,
  request_id VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_audit_subject (subject_type, subject_identifier, occurred_at),
  KEY ix_audit_actor (actor_id, occurred_at),
  FOREIGN KEY (actor_id) REFERENCES users(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## material_import_review

Definition source: [exact SQL file](../database/migrations/008_inventory_material_master.sql). The following preserves column types, nullability, defaults, keys, CHECKs and FK targets; it is a declaration body for review.

```text
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_document VARCHAR(255) NOT NULL,
  source_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_page SMALLINT UNSIGNED NOT NULL,
  source_row SMALLINT UNSIGNED NOT NULL,
  source_item_code VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  source_description VARCHAR(200) NULL,
  source_unit VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  source_reference_price DECIMAL(15,4) NULL,
  source_reference_price_text VARCHAR(32) NULL,
  review_reasons JSON NOT NULL,
  review_status ENUM('needs_review','resolved','excluded') NOT NULL DEFAULT 'needs_review',
  resolved_material_id BIGINT UNSIGNED NULL,
  resolution_note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_material_import_source_row (source_sha256, source_page, source_row),
  KEY ix_material_import_review_status (review_status, source_page, source_row),
  FOREIGN KEY (resolved_material_id) REFERENCES materials(id)
Table options: InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## Source aware material changes

The earlier materials definition above is the original shape. This ALTER describes source changes expected by current inventory services. Application is not established. Its existing-record transition and later blanket zero reclassification are defects D01 in the main review; do not execute or replay this declaration as a correction.

```text
  MODIFY category_code VARCHAR(32) NULL,
  MODIFY quantity_on_hand DECIMAL(15,4) NULL DEFAULT NULL,
  MODIFY reorder_threshold DECIMAL(15,4) NULL DEFAULT NULL,
  ADD COLUMN item_code VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER id,
  ADD COLUMN source_unit VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER unit_code,
  ADD COLUMN reference_unit_price DECIMAL(15,4) NULL AFTER unit_price,
  ADD COLUMN reference_price_text VARCHAR(32) NULL AFTER reference_unit_price,
  ADD COLUMN reference_price_source VARCHAR(255) NULL AFTER reference_price_text,
  ADD COLUMN reference_price_source_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER reference_price_source,
  ADD COLUMN reference_price_page SMALLINT UNSIGNED NULL AFTER reference_price_source_sha256,
  ADD COLUMN reference_price_row SMALLINT UNSIGNED NULL AFTER reference_price_page,
  ADD COLUMN reference_price_status ENUM('unreviewed','needs_review','reviewed') NOT NULL DEFAULT 'unreviewed' AFTER reference_price_row,
  ADD COLUMN approved_costing_price DECIMAL(15,4) NULL AFTER reference_price_status,
  ADD COLUMN costing_price_approved_by BIGINT UNSIGNED NULL AFTER approved_costing_price,
  ADD COLUMN costing_price_approved_at DATETIME(3) NULL AFTER costing_price_approved_by,
  ADD COLUMN quantity_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown' AFTER quantity_on_hand,
  ADD COLUMN threshold_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown' AFTER reorder_threshold,
  ADD COLUMN created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER active,
  ADD UNIQUE KEY uq_material_item_code (item_code),
  ADD UNIQUE KEY uq_material_source_row (reference_price_source_sha256,reference_price_page,reference_price_row),
  DROP CHECK ck_material_values,
  ADD CONSTRAINT ck_material_values CHECK (
    unit_price >= 0
    AND (reference_unit_price IS NULL OR reference_unit_price >= 0)
    AND (approved_costing_price IS NULL OR approved_costing_price >= 0)
    AND (quantity_on_hand IS NULL OR quantity_on_hand >= 0)
    AND (reorder_threshold IS NULL OR reorder_threshold >= 0)
    AND (
      (approved_costing_price IS NULL AND costing_price_approved_by IS NULL AND costing_price_approved_at IS NULL)
      OR (approved_costing_price IS NOT NULL AND costing_price_approved_by IS NOT NULL AND costing_price_approved_at IS NOT NULL)
    )
  ),
  ADD CONSTRAINT ck_material_stock_provenance CHECK (
    (
      (quantity_on_hand IS NULL AND quantity_status='unknown')
      OR (quantity_on_hand IS NOT NULL AND quantity_status IN ('provisional_sample','verified'))
    )
    AND (
      (reorder_threshold IS NULL AND threshold_status='unknown')
      OR (reorder_threshold IS NOT NULL AND threshold_status IN ('provisional_sample','verified'))
    )
  ),
  ADD CONSTRAINT fk_material_costing_price_approver FOREIGN KEY (costing_price_approved_by) REFERENCES users(id)
```

## Session structure required by current application SQL

`user_sessions` is referenced by auth/session/Admin services. Inspected SQL requires `id`, `user_id`, `token_hash`, `expires_at`, `last_activity_at`, and `revoked_at`. Creation relies on database defaults for activity and any other mandatory timestamps. Token generation is 32 random bytes encoded as hex; only a SHA-256 hex digest is stored. The service requires unique token lookup, a user relationship, activity/expiry filtering and revocation support. Complete column types, defaults, unique constraints, FK actions and indexes must be supplied by current metadata; they are not inferred from the service or Task 002 subset. No session or token was read.

## Client account uniqueness beyond the original declaration

Historical Layer 1 evidence attributes one-client-account uniqueness to a later allowed change. The original users declaration above does not contain that unique key. Current metadata must confirm `users(client_id)` uniqueness and its relationship to the existing account-type CHECK. Employee NULL client IDs must remain valid. No later SQL filename, deployed key name or application status is invented here.

## Runner history structure from implementation only

`database/migration-core.mjs` defines `_enterflow_migration_history`: `file VARCHAR(255) ASCII binary PRIMARY KEY`; `checksum CHAR(64) ASCII NOT NULL`; `state ENUM(applying,applied,failed) NOT NULL`; `method ENUM(execute,baseline) NOT NULL`; `started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`; nullable `applied_at DATETIME(3)` and `error_code VARCHAR(80)`. This is a structure description only. No history/checksum value or protected row was retrieved. Keep it distinct from legacy schema_migrations, and do not invoke its SELECT-star reader for inspection.

## Interpretation and missing deployed evidence

The five permitted sources supplied 71 CREATE TABLE declaration bodies: 70 original and material_import_review. The application session table and runner history name bring the known source inventory to 73 distinct names. This does not establish a deployed table count. No assertion is made about any protected migration content or additional live objects. Main review sections 3 through 9 assess normalization, workflow safety, semantic defects, indexing and required current evidence.
