-- ENTER-FLOW Phase 2 isolated corrected bootstrap, 2026-11-22.
-- Primary authority: EnterFlow_ERD_Revised.md + documented workflows.
-- Intended target ONLY: enterflow_phase2_db / enterflow-phase2-mysql.
-- No historical migrations, schema clone, business/reference seed or imports.
-- MySQL 8.4 DDL implicitly commits. Stop on error; never blindly rerun.
-- Caller must attest the container UUID/volume and zero existing objects.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET SESSION sql_mode='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET SESSION time_zone='+00:00';
-- Execute mysql --database=enterflow_phase2_db without --force.
-- A failing CHECK aborts the batch before any persistent table is created.
CREATE TEMPORARY TABLE phase2_bootstrap_guard (ok TINYINT NOT NULL CHECK (ok=1));
INSERT INTO phase2_bootstrap_guard(ok)
SELECT IF(DATABASE()='enterflow_phase2_db' AND VERSION()='8.4.13'
  AND @@server_uuid='0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8'
  AND (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE())=0,1,0);
DROP TEMPORARY TABLE phase2_bootstrap_guard;


CREATE TABLE roles (
code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  description TEXT NULL,
  is_owner_role BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uq_role_label (label),
  CONSTRAINT ck_role_code CHECK (code IN ('client','sales','admin','accounting','production','warehouse','logistics','owner','operations'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE modules (
code VARCHAR(40) NOT NULL PRIMARY KEY, label VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_modules (
role_code VARCHAR(24) NOT NULL, module_code VARCHAR(40) NOT NULL,
  PRIMARY KEY (role_code,module_code),
  FOREIGN KEY (role_code) REFERENCES roles(code),
  FOREIGN KEY (module_code) REFERENCES modules(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_terms (
code VARCHAR(24) NOT NULL PRIMARY KEY, label VARCHAR(80) NOT NULL,
  days_after_receipt SMALLINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_methods (
code VARCHAR(32) NOT NULL PRIMARY KEY, label VARCHAR(80) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE units (
code VARCHAR(16) NOT NULL PRIMARY KEY, label VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_categories (
code VARCHAR(32) NOT NULL PRIMARY KEY, label VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE filter_types (
code VARCHAR(24) NOT NULL PRIMARY KEY, label VARCHAR(100) NOT NULL,
  template_group VARCHAR(40) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE production_stages (
position SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_stage_label (label),
  CONSTRAINT ck_ten_stage_slots CHECK (position BETWEEN 0 AND 9)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clients (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  industry VARCHAR(120) NULL, contact_person VARCHAR(160) NULL,
  email VARCHAR(254) NULL, phone VARCHAR(40) NULL,
  address_line1 VARCHAR(255) NULL, address_line2 VARCHAR(255) NULL,
  city_province VARCHAR(160) NULL, postal_code VARCHAR(20) NULL,
  payment_term_code VARCHAR(24) NULL,
  preferred_delivery_method_code VARCHAR(32) NULL,
  internal_notes TEXT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_on DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_client_company (company_name),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code),
  FOREIGN KEY (preferred_delivery_method_code) REFERENCES delivery_methods(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_code VARCHAR(24) NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  account_type ENUM('employee','client') NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL, username VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NULL, password_hash VARCHAR(255) NOT NULL,
  employee_number VARCHAR(80) NULL, department VARCHAR(120) NULL,
  job_title VARCHAR(120) NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  joined_on DATE NULL, last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_email (email), UNIQUE KEY uq_user_username (username),
  UNIQUE KEY uq_employee_number (employee_number),
  UNIQUE KEY uq_one_company_login (client_id),
  UNIQUE KEY uq_user_client (id,client_id),
  UNIQUE KEY uq_user_type (id,account_type),
  FOREIGN KEY (role_code) REFERENCES roles(code),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT ck_user_identity CHECK (
    (account_type='client' AND role_code='client' AND client_id IS NOT NULL AND employee_number IS NULL)
    OR (account_type='employee' AND role_code<>'client' AND client_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_sessions (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  last_activity_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  UNIQUE KEY uq_session_token_hash (token_hash),
  KEY ix_session_user (user_id,revoked_at,expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT ck_session_expiry CHECK (expires_at>created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE files (
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
  UNIQUE KEY uq_storage_object (bucket,object_path),
  KEY ix_files_cleanup (state,uploaded_at),
  KEY ix_file_uploader (uploaded_by,uploaded_at),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_stages (
code VARCHAR(32) NOT NULL PRIMARY KEY, label VARCHAR(100) NOT NULL, position SMALLINT UNSIGNED NOT NULL, UNIQUE KEY uq_order_stage_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(60) NOT NULL, client_id BIGINT UNSIGNED NOT NULL,
  contact_person VARCHAR(160) NOT NULL, stage_code VARCHAR(32) NOT NULL,
  payment_term_code VARCHAR(24) NOT NULL, delivery_method_code VARCHAR(32) NULL,
  source ENUM('client_portal','staff') NOT NULL,
  submitted_by BIGINT UNSIGNED NULL, created_by BIGINT UNSIGNED NOT NULL,
  general_notes TEXT NULL, requested_delivery_date DATE NULL, due_date DATE NULL,
  reorder_source_id BIGINT UNSIGNED NULL,
  archive_reason ENUM('rejected','cancelled') NULL, archive_note TEXT NULL,
  archived_at DATETIME(3) NULL, archived_by BIGINT UNSIGNED NULL,
  fulfillment_completed_at DATETIME(3) NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_order_reference (reference), UNIQUE KEY uq_order_client_pair (id,client_id),
  KEY ix_order_client (client_id,submitted_at), KEY ix_order_queue (stage_code,archived_at,requested_delivery_date),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (submitted_by,client_id) REFERENCES users(id,client_id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (stage_code) REFERENCES order_stages(code),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code),
  FOREIGN KEY (delivery_method_code) REFERENCES delivery_methods(code),
  FOREIGN KEY (archived_by) REFERENCES users(id),
  FOREIGN KEY (reorder_source_id,client_id) REFERENCES orders(id,client_id),
  CONSTRAINT ck_inquiry_source CHECK ((source='client_portal' AND submitted_by IS NOT NULL) OR (source='staff' AND submitted_by IS NULL)),
  CONSTRAINT ck_order_archive CHECK (
    (archived_at IS NULL AND archived_by IS NULL AND archive_reason IS NULL AND archive_note IS NULL)
    OR (archived_at IS NOT NULL AND archived_by IS NOT NULL AND archive_reason IS NOT NULL
        AND archive_note IS NOT NULL AND CHAR_LENGTH(TRIM(archive_note))>0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_specifications (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL, filter_type_code VARCHAR(24) NOT NULL,
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
  filtration_rating VARCHAR(120) NULL, filtration_rating_custom VARCHAR(255) NULL,
  others TEXT NULL, notes TEXT NULL,

  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_spec_client (id,client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (filter_type_code) REFERENCES filter_types(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL, client_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL, specification_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_order_item_line (order_id,line_number),
  UNIQUE KEY uq_item_order (id,order_id), UNIQUE KEY uq_item_client (id,client_id),
  UNIQUE KEY uq_item_order_client (id,order_id,client_id),
  FOREIGN KEY (order_id,client_id) REFERENCES orders(id,client_id),
  FOREIGN KEY (specification_id,client_id) REFERENCES product_specifications(id,client_id),
  CONSTRAINT ck_order_item_qty CHECK (quantity>=10 AND line_number>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE materials (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  name VARCHAR(200) NOT NULL, category_code VARCHAR(32) NULL,
  unit_code VARCHAR(16) NOT NULL,
  source_unit VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  reference_unit_price DECIMAL(15,4) NULL, reference_price_text VARCHAR(80) NULL,
  reference_price_source VARCHAR(255) NULL,
  reference_price_source_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reference_price_page SMALLINT UNSIGNED NULL, reference_price_row SMALLINT UNSIGNED NULL,
  reference_price_status ENUM('unreviewed','needs_review','reviewed') NOT NULL DEFAULT 'unreviewed',
  approved_costing_price DECIMAL(15,4) NULL,
  costing_price_approved_by BIGINT UNSIGNED NULL, costing_price_approved_at DATETIME(3) NULL,
  quantity_on_hand DECIMAL(15,4) NULL DEFAULT NULL,
  quantity_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown',
  reorder_threshold DECIMAL(15,4) NULL DEFAULT NULL,
  threshold_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown',
  supplier_name VARCHAR(200) NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_material_item_code (item_code),
  UNIQUE KEY uq_material_source_row (reference_price_source_sha256,reference_price_page,reference_price_row),
  UNIQUE KEY uq_material_unit (id,unit_code), KEY ix_material_category (category_code,name),
  FOREIGN KEY (category_code) REFERENCES material_categories(code),
  FOREIGN KEY (unit_code) REFERENCES units(code),
  FOREIGN KEY (costing_price_approved_by) REFERENCES users(id),
  CONSTRAINT ck_material_stock CHECK (
    ((quantity_status='unknown' AND quantity_on_hand IS NULL)
      OR (quantity_status IN ('provisional_sample','verified') AND quantity_on_hand IS NOT NULL AND quantity_on_hand>=0))
    AND ((threshold_status='unknown' AND reorder_threshold IS NULL)
      OR (threshold_status IN ('provisional_sample','verified') AND reorder_threshold IS NOT NULL AND reorder_threshold>=0))),
  CONSTRAINT ck_material_prices CHECK (
    (reference_unit_price IS NULL OR reference_unit_price>=0)
    AND ((approved_costing_price IS NULL AND costing_price_approved_by IS NULL AND costing_price_approved_at IS NULL)
      OR (approved_costing_price IS NOT NULL AND approved_costing_price>=0
        AND costing_price_approved_by IS NOT NULL AND costing_price_approved_at IS NOT NULL)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_references (
reference VARCHAR(60) NOT NULL PRIMARY KEY, order_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_quote_reference_owner (reference,order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotations (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL, reference VARCHAR(60) NOT NULL,
  revision_number SMALLINT UNSIGNED NOT NULL,
  status ENUM('draft','sent','superseded') NOT NULL DEFAULT 'draft',
  current_sent_slot TINYINT GENERATED ALWAYS AS (CASE WHEN status='sent' THEN 1 ELSE NULL END) STORED,
  issued_on DATE NOT NULL, valid_until DATE NOT NULL,
  payment_term_code VARCHAR(24) NOT NULL,
  time_of_delivery VARCHAR(255) NOT NULL, place_of_delivery TEXT NOT NULL,
  note TEXT NULL, note_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  total_amount DECIMAL(15,2) NOT NULL,
  downpayment_percent DECIMAL(7,4) NOT NULL,
  downpayment_amount DECIMAL(15,2) NOT NULL,
  stock_checked_at DATETIME(3) NULL,
  prepared_by BIGINT UNSIGNED NOT NULL, approved_by BIGINT UNSIGNED NULL,
  sent_by BIGINT UNSIGNED NULL, sent_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_quote_revision (order_id,revision_number),
  UNIQUE KEY uq_one_sent_revision (order_id,current_sent_slot),
  UNIQUE KEY uq_quote_reference_revision (reference,revision_number),
  UNIQUE KEY uq_quote_order (id,order_id),
  FOREIGN KEY (reference,order_id) REFERENCES quotation_references(reference,order_id),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code),
  FOREIGN KEY (prepared_by) REFERENCES users(id), FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (sent_by) REFERENCES users(id),
  CONSTRAINT ck_quote_dates CHECK (valid_until>=issued_on),
  CONSTRAINT ck_quote_amounts CHECK (total_amount>=0 AND downpayment_percent IN (20,50)
    AND downpayment_amount=ROUND(total_amount*downpayment_percent/100,2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_lines (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL, order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NULL, line_number SMALLINT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL, sub_description TEXT NULL,
  quantity DECIMAL(15,4) NOT NULL, unit_label VARCHAR(40) NOT NULL,
  unit_price DECIMAL(15,4) NOT NULL,
  UNIQUE KEY uq_quote_line (quotation_id,line_number),
  UNIQUE KEY uq_quote_line_owner (id,quotation_id,order_id,order_item_id),
  FOREIGN KEY (quotation_id,order_id) REFERENCES quotations(id,order_id),
  FOREIGN KEY (order_item_id,order_id) REFERENCES order_items(id,order_id),
  CONSTRAINT ck_quote_line_values CHECK (quantity>0 AND unit_price>=0 AND line_number>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_costing (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_line_id BIGINT UNSIGNED NOT NULL,
  quotation_id BIGINT UNSIGNED NOT NULL, order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  labor_cost DECIMAL(15,4) NOT NULL, markup_percent DECIMAL(9,4) NOT NULL,
  discount_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  vat_type ENUM('Exclusive','Inclusive','Zero-Rated') NOT NULL,
  vat_rate DECIMAL(7,4) NOT NULL,
  include_labor BOOLEAN NOT NULL, apply_markup BOOLEAN NOT NULL, apply_vat BOOLEAN NOT NULL,
  material_cost_per_unit DECIMAL(15,4) NOT NULL,
  unit_cost_with_markup DECIMAL(15,4) NOT NULL,
  calculated_unit_price DECIMAL(15,4) NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_costing_line (quotation_line_id),
  UNIQUE KEY uq_costing_source (id,order_item_id,order_id),
  FOREIGN KEY (quotation_line_id,quotation_id,order_id,order_item_id)
    REFERENCES quotation_lines(id,quotation_id,order_id,order_item_id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT ck_costing_values CHECK (labor_cost>=0 AND markup_percent>=0 AND discount_percent BETWEEN 0 AND 100
    AND vat_rate BETWEEN 0 AND 100 AND material_cost_per_unit>=0 AND unit_cost_with_markup>=0 AND calculated_unit_price>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_bom_lines (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  costing_id BIGINT UNSIGNED NOT NULL, line_number SMALLINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL, unit_code VARCHAR(16) NOT NULL,
  material_name_snapshot VARCHAR(200) NOT NULL, unit_snapshot VARCHAR(40) NOT NULL,
  unit_price_snapshot DECIMAL(15,4) NOT NULL, quantity_per_filter DECIMAL(15,4) NOT NULL,
  waste_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_costing_bom_line (costing_id,line_number),
  FOREIGN KEY (costing_id) REFERENCES quotation_costing(id),
  FOREIGN KEY (material_id,unit_code) REFERENCES materials(id,unit_code),
  CONSTRAINT ck_quote_bom_values CHECK (unit_price_snapshot>=0 AND quantity_per_filter>0 AND waste_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_discounts (
quotation_id BIGINT UNSIGNED NOT NULL, line_number SMALLINT UNSIGNED NOT NULL,
  label VARCHAR(160) NOT NULL, percent DECIMAL(7,4) NOT NULL,
  PRIMARY KEY (quotation_id,line_number), FOREIGN KEY (quotation_id) REFERENCES quotations(id),
  CONSTRAINT ck_discount_percent CHECK (percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_addons (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL, kind ENUM('packaging','shipping') NOT NULL,
  material_id BIGINT UNSIGNED NULL, label VARCHAR(160) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL, unit_price DECIMAL(15,4) NOT NULL,
  include_in_unit_price BOOLEAN NOT NULL,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id), FOREIGN KEY (material_id) REFERENCES materials(id),
  CONSTRAINT ck_addon_values CHECK (quantity>0 AND unit_price>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_orders (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL, accepted_quotation_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL, client_reference VARCHAR(160) NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  uploaded_by BIGINT UNSIGNED NOT NULL,
  received_at DATETIME(3) NULL, received_by BIGINT UNSIGNED NULL,
  cleared_at DATETIME(3) NULL, cleared_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_po_order (order_id), UNIQUE KEY uq_po_reference (reference),
  UNIQUE KEY uq_po_order_pair (id,order_id),
  UNIQUE KEY uq_po_quote (id,order_id,accepted_quotation_id),
  FOREIGN KEY (accepted_quotation_id,order_id) REFERENCES quotations(id,order_id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id), FOREIGN KEY (received_by) REFERENCES users(id),
  FOREIGN KEY (cleared_by) REFERENCES users(id),
  CONSTRAINT ck_po_review CHECK ((received_at IS NULL AND received_by IS NULL) OR (received_at IS NOT NULL AND received_by IS NOT NULL)),
  CONSTRAINT ck_po_clear CHECK ((cleared_at IS NULL AND cleared_by IS NULL) OR (cleared_at IS NOT NULL AND cleared_by IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE finished_goods (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL, item_code VARCHAR(80) NOT NULL,
  enterfil_part_number VARCHAR(160) NOT NULL, specification_id BIGINT UNSIGNED NOT NULL,
  quantity_on_hand INT UNSIGNED NULL DEFAULT NULL,
  quantity_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown',
  buffer_minimum INT UNSIGNED NULL DEFAULT NULL,
  threshold_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown',
  demand ENUM('HIGH DEMAND','MONITOR','STABLE') NULL DEFAULT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE, updated_by BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_finished_item_code (item_code), UNIQUE KEY uq_finished_client_pair (id,client_id),
  KEY ix_finished_client_part (client_id,enterfil_part_number),
  FOREIGN KEY (specification_id,client_id) REFERENCES product_specifications(id,client_id),
  FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT ck_finished_provenance CHECK (
    ((quantity_status='unknown' AND quantity_on_hand IS NULL) OR (quantity_status IN ('provisional_sample','verified') AND quantity_on_hand IS NOT NULL))
    AND ((threshold_status='unknown' AND buffer_minimum IS NULL) OR (threshold_status IN ('provisional_sample','verified') AND buffer_minimum IS NOT NULL)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoices (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL, order_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL, issued_on DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL, payment_term_code VARCHAR(24) NOT NULL,
  required_downpayment DECIMAL(15,2) NOT NULL,
  payment_cycle_started_at DATETIME(3) NULL, due_on DATE NULL,
  created_by BIGINT UNSIGNED NOT NULL, sent_at DATETIME(3) NULL, sent_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_invoice_order (order_id), UNIQUE KEY uq_invoice_po (purchase_order_id),
  UNIQUE KEY uq_invoice_reference (reference), UNIQUE KEY uq_invoice_order_pair (id,order_id),
  KEY ix_invoice_due (due_on,sent_at),
  FOREIGN KEY (purchase_order_id,order_id) REFERENCES purchase_orders(id,order_id),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code),
  FOREIGN KEY (created_by) REFERENCES users(id), FOREIGN KEY (sent_by) REFERENCES users(id),
  CONSTRAINT ck_invoice_amount CHECK (amount>=0 AND required_downpayment BETWEEN 0 AND amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_requests (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(60) NOT NULL, order_id BIGINT UNSIGNED NOT NULL,
  client_reference VARCHAR(160) NULL,
  status ENUM('pending','responded','update_requested','updated') NOT NULL DEFAULT 'pending',
  requested_by BIGINT UNSIGNED NOT NULL,
  requested_by_type ENUM('employee','client') NOT NULL DEFAULT 'employee',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  update_requested_at DATETIME(3) NULL, update_reason TEXT NULL,
  UNIQUE KEY uq_request_reference (reference), UNIQUE KEY uq_request_order (id,order_id),
  KEY ix_request_queue (status,created_at),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (requested_by,requested_by_type) REFERENCES users(id,account_type),
  CONSTRAINT ck_request_employee CHECK (requested_by_type='employee')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_request_lines (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stock_request_id BIGINT UNSIGNED NOT NULL, material_id BIGINT UNSIGNED NOT NULL,
  material_name_snapshot VARCHAR(200) NOT NULL, unit_snapshot VARCHAR(40) NOT NULL,
  required_quantity DECIMAL(15,4) NOT NULL,
  stock_at_request DECIMAL(15,4) NULL, shortage_at_request DECIMAL(15,4) NULL,
  quantity_status_at_request ENUM('unknown','provisional_sample','verified') NOT NULL,
  UNIQUE KEY uq_request_material (stock_request_id,material_id),
  UNIQUE KEY uq_request_line_pair (id,stock_request_id),
  FOREIGN KEY (stock_request_id) REFERENCES stock_requests(id), FOREIGN KEY (material_id) REFERENCES materials(id),
  CONSTRAINT ck_request_qty CHECK (required_quantity>0),
  CONSTRAINT ck_request_provenance CHECK (
    (quantity_status_at_request='verified' AND stock_at_request IS NOT NULL AND stock_at_request>=0
      AND shortage_at_request IS NOT NULL AND shortage_at_request=GREATEST(required_quantity-stock_at_request,0))
    OR (quantity_status_at_request IN ('unknown','provisional_sample') AND stock_at_request IS NULL AND shortage_at_request IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_responses (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stock_request_id BIGINT UNSIGNED NOT NULL, order_id BIGINT UNSIGNED NOT NULL,
  responded_by BIGINT UNSIGNED NOT NULL,
  responded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), note TEXT NULL,
  UNIQUE KEY uq_response_request (id,stock_request_id), UNIQUE KEY uq_response_order (id,order_id),
  FOREIGN KEY (stock_request_id,order_id) REFERENCES stock_requests(id,order_id),
  FOREIGN KEY (responded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_response_lines (
stock_response_id BIGINT UNSIGNED NOT NULL, stock_request_id BIGINT UNSIGNED NOT NULL,
  stock_request_line_id BIGINT UNSIGNED NOT NULL,
  observed_quantity DECIMAL(15,4) NULL,
  quantity_status ENUM('unknown','provisional_sample','verified') NOT NULL,
  PRIMARY KEY (stock_response_id,stock_request_line_id),
  FOREIGN KEY (stock_response_id,stock_request_id) REFERENCES stock_responses(id,stock_request_id),
  FOREIGN KEY (stock_request_line_id,stock_request_id) REFERENCES stock_request_lines(id,stock_request_id),
  CONSTRAINT ck_response_provenance CHECK (
    (quantity_status='unknown' AND observed_quantity IS NULL)
    OR (quantity_status IN ('provisional_sample','verified') AND observed_quantity IS NOT NULL AND observed_quantity>=0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_stock_responses (
quotation_id BIGINT UNSIGNED NOT NULL, stock_response_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (quotation_id,stock_response_id),
  FOREIGN KEY (quotation_id,order_id) REFERENCES quotations(id,order_id),
  FOREIGN KEY (stock_response_id,order_id) REFERENCES stock_responses(id,order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_order (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(60) NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  accepted_quotation_id BIGINT UNSIGNED NOT NULL,
  jo_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('jo','in_production','quality_inspection','ready_for_dispatch','cancelled') NOT NULL DEFAULT 'jo',
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  pause_reason TEXT NULL,
  prepared_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  cancellation_reason TEXT NULL,
  completed_at DATETIME(3) NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_erd_jo_reference (reference),
  UNIQUE KEY uq_erd_jo_po (purchase_order_id),
  UNIQUE KEY uq_erd_jo_order (id, order_id),
  UNIQUE KEY uq_erd_jo_client (id, client_id),
  UNIQUE KEY uq_erd_jo_source (id, accepted_quotation_id, order_id, client_id),
  KEY ix_erd_jo_queue (status, paused, due_date),
  CONSTRAINT fk_erd_jo_po FOREIGN KEY (purchase_order_id, order_id, accepted_quotation_id)
    REFERENCES purchase_orders(id, order_id, accepted_quotation_id),
  CONSTRAINT fk_erd_jo_order FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (prepared_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT ck_erd_jo_pause CHECK (paused = 0 OR (pause_reason IS NOT NULL AND CHAR_LENGTH(TRIM(pause_reason)) > 0)),
  CONSTRAINT ck_erd_jo_cancel CHECK (status <> 'cancelled' OR (cancellation_reason IS NOT NULL AND CHAR_LENGTH(TRIM(cancellation_reason)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_order_item (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  quotation_id BIGINT UNSIGNED NOT NULL,
  quotation_line_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  item_code VARCHAR(80) NULL,
  enterfil_part_number VARCHAR(160) NULL,
  item_name VARCHAR(200) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  filter_type_code VARCHAR(24) NOT NULL,
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
  filtration_rating VARCHAR(120) NULL, filtration_rating_custom VARCHAR(255) NULL, others TEXT NULL, notes TEXT NULL,
  final_sketch_file_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_erd_jo_item_line (job_order_id, line_number),
  UNIQUE KEY uq_erd_jo_item_pair (id, job_order_id),
  FOREIGN KEY (job_order_id, quotation_id, order_id, client_id)
    REFERENCES job_order(id, accepted_quotation_id, order_id, client_id),
  FOREIGN KEY (quotation_line_id, quotation_id, order_id, order_item_id)
    REFERENCES quotation_lines(id, quotation_id, order_id, order_item_id),
  FOREIGN KEY (order_item_id, order_id, client_id) REFERENCES order_items(id, order_id, client_id),
  FOREIGN KEY (filter_type_code) REFERENCES filter_types(code),
  FOREIGN KEY (final_sketch_file_id) REFERENCES files(id),
  CONSTRAINT ck_erd_jo_item CHECK (quantity > 0 AND line_number > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_order_stage (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  stage_position SMALLINT UNSIGNED NOT NULL,
  status ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  marked_by BIGINT UNSIGNED NULL,
  remarks TEXT NULL,
  reverted_count INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_erd_jo_stage (job_order_id, stage_position),
  UNIQUE KEY uq_erd_stage_owner (id, job_order_id),
  FOREIGN KEY (job_order_id) REFERENCES job_order(id),
  FOREIGN KEY (stage_position) REFERENCES production_stages(position),
  FOREIGN KEY (marked_by) REFERENCES users(id),
  CONSTRAINT ck_erd_stage_state CHECK (
    (status = 'pending' AND started_at IS NULL AND completed_at IS NULL)
    OR (status = 'in_progress' AND started_at IS NOT NULL AND completed_at IS NULL AND marked_by IS NOT NULL)
    OR (status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
        AND completed_at >= started_at AND marked_by IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_shortage_report (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  job_order_stage_id BIGINT UNSIGNED NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  quantity_needed DECIMAL(15,4) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('pending','resolved') NOT NULL DEFAULT 'pending',
  reported_by BIGINT UNSIGNED NOT NULL,
  reported_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  KEY ix_erd_shortage_queue (status, reported_at),
  FOREIGN KEY (job_order_id) REFERENCES job_order(id),
  FOREIGN KEY (job_order_stage_id, job_order_id) REFERENCES job_order_stage(id, job_order_id),
  FOREIGN KEY (material_id) REFERENCES materials(id),
  FOREIGN KEY (reported_by) REFERENCES users(id),
  CONSTRAINT ck_erd_shortage CHECK (quantity_needed > 0 AND
    ((status = 'pending' AND resolved_at IS NULL) OR
     (status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at >= reported_at)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE production_plan (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plan_code VARCHAR(60) NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  finished_good_id BIGINT UNSIGNED NULL,
  job_order_id BIGINT UNSIGNED NULL,
  source VARCHAR(80) NOT NULL,
  planned_quantity INT UNSIGNED NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_erd_plan_code (plan_code),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (finished_good_id, client_id) REFERENCES finished_goods(id, client_id),
  FOREIGN KEY (job_order_id, client_id) REFERENCES job_order(id, client_id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT ck_erd_plan CHECK (planned_quantity > 0 AND week_end_date >= week_start_date
    AND (finished_good_id IS NOT NULL OR job_order_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_receipt (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  submitted_by BIGINT UNSIGNED NOT NULL,
  amount_declared DECIMAL(15,2) NOT NULL,
  method_snapshot VARCHAR(120) NULL,
  reference_number VARCHAR(160) NULL,
  paid_on DATE NOT NULL,
  payment_type ENUM('DOWNPAYMENT','BALANCE_PAYMENT','FULL_PAYMENT') NOT NULL,
  note TEXT NULL,
  review_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME(3) NULL,
  review_note TEXT NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  idempotency_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  UNIQUE KEY uq_erd_receipt_operation (idempotency_key),
  UNIQUE KEY uq_erd_receipt_owner (id, invoice_id, order_id, client_id),
  UNIQUE KEY uq_receipt_review_owner (id,invoice_id,order_id,client_id,review_status),
  KEY ix_erd_receipt_review (review_status, submitted_at),
  FOREIGN KEY (invoice_id, order_id) REFERENCES invoices(id, order_id),
  FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (submitted_by, client_id) REFERENCES users(id, client_id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  CONSTRAINT ck_erd_receipt_amount CHECK (amount_declared > 0),
  CONSTRAINT ck_erd_receipt_review CHECK (
    (review_status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (review_status IN ('verified','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_receipt_file (
client_receipt_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (client_receipt_id, file_id),
  FOREIGN KEY (client_receipt_id) REFERENCES client_receipt(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_transaction (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  client_receipt_id BIGINT UNSIGNED NULL,
  receipt_review_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'verified',
  payment_type ENUM('DOWNPAYMENT','BALANCE_PAYMENT','FULL_PAYMENT') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  method_snapshot VARCHAR(120) NULL,
  reference_number VARCHAR(160) NULL,
  paid_on DATE NOT NULL,
  recorded_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NOT NULL,
  approved_at DATETIME(3) NOT NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  idempotency_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  UNIQUE KEY uq_erd_transaction_operation (idempotency_key),
  KEY ix_erd_transaction_invoice (invoice_id, paid_on),
  FOREIGN KEY (invoice_id, order_id) REFERENCES invoices(id, order_id),
  FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (client_receipt_id, invoice_id, order_id, client_id, receipt_review_status)
    REFERENCES client_receipt(id, invoice_id, order_id, client_id, review_status),
  FOREIGN KEY (recorded_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT ck_transaction_review CHECK (receipt_review_status='verified'),
  CONSTRAINT ck_erd_transaction_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_movement (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_type ENUM('raw_material','finished_good') NOT NULL,
  material_id BIGINT UNSIGNED NULL,
  finished_good_id BIGINT UNSIGNED NULL,
  unit_code VARCHAR(16) NULL,
  client_id BIGINT UNSIGNED NULL,
  job_order_id BIGINT UNSIGNED NULL,
  kind ENUM('observation','opening','adjustment','correction','receipt','handover','jo_deduction','jo_restoration') NOT NULL,
  quantity_status_before ENUM('unknown','provisional_sample','verified') NOT NULL,
  quantity_before DECIMAL(15,4) NULL,
  quantity_after DECIMAL(15,4) NOT NULL,
  quantity_delta DECIMAL(15,4) NULL,
  reason TEXT NOT NULL,
  reference_text VARCHAR(160) NULL,
  supplier_name_snapshot VARCHAR(200) NULL,
  notes TEXT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  idempotency_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  UNIQUE KEY uq_erd_stock_operation (idempotency_key),
  KEY ix_erd_raw_history (material_id, occurred_at, id),
  KEY ix_erd_finished_history (finished_good_id, occurred_at, id),
  FOREIGN KEY (material_id, unit_code) REFERENCES materials(id, unit_code),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (finished_good_id, client_id) REFERENCES finished_goods(id, client_id),
  FOREIGN KEY (job_order_id, client_id) REFERENCES job_order(id, client_id),
  FOREIGN KEY (performed_by) REFERENCES users(id),
  CONSTRAINT ck_erd_stock_item CHECK (
    (item_type = 'raw_material' AND material_id IS NOT NULL AND unit_code IS NOT NULL AND finished_good_id IS NULL)
    OR (item_type = 'finished_good' AND material_id IS NULL AND unit_code IS NULL AND finished_good_id IS NOT NULL AND client_id IS NOT NULL)),
  CONSTRAINT ck_erd_stock_owner CHECK (job_order_id IS NULL OR client_id IS NOT NULL),
  CONSTRAINT ck_erd_stock_numbers CHECK (quantity_after >= 0 AND
    ((quantity_status_before = 'verified' AND quantity_before IS NOT NULL AND quantity_before >= 0
      AND quantity_delta IS NOT NULL AND quantity_after = quantity_before + quantity_delta)
     OR (quantity_status_before IN ('unknown','provisional_sample')
       AND quantity_before IS NULL AND quantity_delta IS NULL AND kind IN ('observation','opening','correction')))),
  CONSTRAINT ck_erd_stock_reason CHECK (CHAR_LENGTH(TRIM(reason)) > 0),
  CONSTRAINT ck_erd_finished_integral CHECK (item_type <> 'finished_good' OR
    (quantity_after = FLOOR(quantity_after) AND (quantity_before IS NULL OR quantity_before = FLOOR(quantity_before))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery (
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
  received_by VARCHAR(160) NULL,
  notes TEXT NULL,
  dispatched_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_erd_delivery_order (id, order_id),
  UNIQUE KEY uq_erd_delivery_job (id, job_order_id),
  KEY ix_erd_delivery_queue (status, estimated_delivery_date),
  FOREIGN KEY (job_order_id, order_id) REFERENCES job_order(id, order_id),
  FOREIGN KEY (delivery_method_code) REFERENCES delivery_methods(code),
  FOREIGN KEY (dispatched_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_item (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL,
  job_order_id BIGINT UNSIGNED NOT NULL,
  job_order_item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_erd_delivery_item (delivery_id, job_order_item_id),
  FOREIGN KEY (delivery_id, job_order_id) REFERENCES delivery(id, job_order_id),
  FOREIGN KEY (job_order_item_id, job_order_id) REFERENCES job_order_item(id, job_order_id),
  CONSTRAINT ck_erd_delivery_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_bom_lines (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_item_id BIGINT UNSIGNED NOT NULL, line_number SMALLINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL, unit_code VARCHAR(16) NOT NULL,
  material_name_snapshot VARCHAR(200) NOT NULL, unit_snapshot VARCHAR(40) NOT NULL,
  unit_price_snapshot DECIMAL(15,4) NOT NULL, quantity_per_filter DECIMAL(15,4) NOT NULL,
  waste_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_job_bom_line (job_order_item_id,line_number),
  FOREIGN KEY (job_order_item_id) REFERENCES job_order_item(id),
  FOREIGN KEY (material_id,unit_code) REFERENCES materials(id,unit_code),
  CONSTRAINT ck_job_bom_values CHECK (unit_price_snapshot>=0 AND quantity_per_filter>0 AND waste_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE production_events (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL, job_order_stage_id BIGINT UNSIGNED NULL,
  action ENUM('started','done','reverted','paused','resumed','completed','cancelled','handed_over') NOT NULL,
  reason TEXT NULL, performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_production_history (job_order_id,occurred_at,id),
  FOREIGN KEY (job_order_id) REFERENCES job_order(id),
  FOREIGN KEY (job_order_stage_id,job_order_id) REFERENCES job_order_stage(id,job_order_id),
  FOREIGN KEY (performed_by) REFERENCES users(id),
  CONSTRAINT ck_production_reason CHECK (action NOT IN ('reverted','paused','cancelled') OR (reason IS NOT NULL AND CHAR_LENGTH(TRIM(reason))>0)),
  CONSTRAINT ck_production_stage_event CHECK (action NOT IN ('started','done','reverted') OR job_order_stage_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE finished_good_order_items (
finished_good_id BIGINT UNSIGNED NOT NULL, order_item_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (finished_good_id,order_item_id),
  FOREIGN KEY (finished_good_id,client_id) REFERENCES finished_goods(id,client_id),
  FOREIGN KEY (order_item_id,client_id) REFERENCES order_items(id,client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE waybills (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL, reference VARCHAR(80) NOT NULL,
  qr_identifier VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  printed_at DATETIME(3) NULL, printed_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_waybill_delivery (delivery_id), UNIQUE KEY uq_waybill_reference (reference),
  UNIQUE KEY uq_waybill_qr (qr_identifier), FOREIGN KEY (delivery_id) REFERENCES delivery(id),
  FOREIGN KEY (printed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_events (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL, status VARCHAR(80) NOT NULL, note TEXT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_delivery_history (delivery_id,occurred_at,id),
  FOREIGN KEY (delivery_id) REFERENCES delivery(id), FOREIGN KEY (performed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_receipts (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL, order_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL,
  generated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), generated_by BIGINT UNSIGNED NOT NULL,
  sent_to_logistics_at DATETIME(3) NULL, sent_to_logistics_by BIGINT UNSIGNED NULL,
  sent_to_client_at DATETIME(3) NULL, sent_to_client_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_dr_delivery (delivery_id), UNIQUE KEY uq_dr_reference (reference),
  UNIQUE KEY uq_dr_order_pair (id,order_id),
  FOREIGN KEY (delivery_id,order_id) REFERENCES delivery(id,order_id),
  FOREIGN KEY (generated_by) REFERENCES users(id),
  FOREIGN KEY (sent_to_logistics_by) REFERENCES users(id), FOREIGN KEY (sent_to_client_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE signed_delivery_receipts (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_receipt_id BIGINT UNSIGNED NOT NULL, order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL, submitted_by BIGINT UNSIGNED NOT NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  received_at DATETIME(3) NULL, accepted_slot SMALLINT UNSIGNED NULL, discarded_at DATETIME(3) NULL,
  UNIQUE KEY uq_one_accepted_signed_dr (delivery_receipt_id,accepted_slot),
  UNIQUE KEY uq_signed_receipt_order_state (id,order_id,accepted_slot), UNIQUE KEY uq_signed_dr_file (file_id),
  KEY ix_signed_dr_state (delivery_receipt_id,received_at,discarded_at),
  FOREIGN KEY (delivery_receipt_id,order_id) REFERENCES delivery_receipts(id,order_id),
  FOREIGN KEY (file_id) REFERENCES files(id), FOREIGN KEY (submitted_by) REFERENCES users(id),
  CONSTRAINT ck_signed_dr_state CHECK (
    (received_at IS NULL AND accepted_slot IS NULL)
    OR (received_at IS NOT NULL AND discarded_at IS NULL AND accepted_slot IS NOT NULL AND accepted_slot=1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_delivery_receipts (
invoice_id BIGINT UNSIGNED NOT NULL, signed_delivery_receipt_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL, accepted_slot SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (invoice_id,signed_delivery_receipt_id),
  FOREIGN KEY (invoice_id,order_id) REFERENCES invoices(id,order_id),
  FOREIGN KEY (signed_delivery_receipt_id,order_id,accepted_slot) REFERENCES signed_delivery_receipts(id,order_id,accepted_slot),
  CONSTRAINT ck_invoice_receipt_accepted CHECK (accepted_slot=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL, message TEXT NOT NULL, notification_type VARCHAR(80) NOT NULL,
  subject_type VARCHAR(60) NULL, subject_identifier VARCHAR(100) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_notification_subject (subject_type,subject_identifier,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification_roles (
notification_id BIGINT UNSIGNED NOT NULL, role_code VARCHAR(24) NOT NULL,
  PRIMARY KEY (notification_id,role_code), FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (role_code) REFERENCES roles(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification_recipients (
notification_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME(3) NULL,
  PRIMARY KEY (notification_id,user_id), KEY ix_user_unread (user_id,read_at,notification_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id), FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_events (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NULL, action VARCHAR(100) NOT NULL,
  subject_type VARCHAR(60) NOT NULL, subject_identifier VARCHAR(100) NOT NULL,
  field_name VARCHAR(80) NULL, old_value TEXT NULL, new_value TEXT NULL, reason TEXT NULL,
  request_id VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_audit_subject (subject_type,subject_identifier,occurred_at),
  KEY ix_audit_actor (actor_id,occurred_at), FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_changes (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  material_id BIGINT UNSIGNED NOT NULL, field_name VARCHAR(80) NOT NULL,
  old_value TEXT NULL, new_value TEXT NULL, reason TEXT NOT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_material_change_history (material_id,occurred_at),
  FOREIGN KEY (material_id) REFERENCES materials(id), FOREIGN KEY (performed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE company_settings (
id SMALLINT UNSIGNED NOT NULL PRIMARY KEY, company_name VARCHAR(200) NOT NULL,
  address TEXT NULL, phone VARCHAR(40) NULL, email VARCHAR(254) NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (updated_by) REFERENCES users(id), CONSTRAINT ck_settings_singleton CHECK (id=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE company_payment_methods (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_settings_id SMALLINT UNSIGNED NOT NULL, label VARCHAR(120) NOT NULL,
  type ENUM('bank_transfer','gcash','cash','check','other') NOT NULL,
  details TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (company_settings_id) REFERENCES company_settings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_instructions (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL, payment_method_id BIGINT UNSIGNED NOT NULL,
  instructions_snapshot TEXT NOT NULL, sent_by BIGINT UNSIGNED NOT NULL,
  sent_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (payment_method_id) REFERENCES company_payment_methods(id), FOREIGN KEY (sent_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_files (
order_id BIGINT UNSIGNED NOT NULL, file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('inquiry_attachment') NOT NULL,
  PRIMARY KEY (order_id,file_id),
  FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE specification_files (
specification_id BIGINT UNSIGNED NOT NULL, file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('sketch') NOT NULL,
  PRIMARY KEY (specification_id,file_id),
  FOREIGN KEY (specification_id) REFERENCES product_specifications(id), FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_files (
quotation_id BIGINT UNSIGNED NOT NULL, file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('quotation') NOT NULL,
  PRIMARY KEY (quotation_id,file_id),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id), FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_order_files (
purchase_order_id BIGINT UNSIGNED NOT NULL, file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('purchase_order') NOT NULL,
  PRIMARY KEY (purchase_order_id,file_id),
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id), FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_order_files (
job_order_item_id BIGINT UNSIGNED NOT NULL, file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('final_sketch') NOT NULL,
  PRIMARY KEY (job_order_item_id,file_id),
  FOREIGN KEY (job_order_item_id) REFERENCES job_order_item(id), FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_files (
invoice_id BIGINT UNSIGNED NOT NULL, file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('invoice') NOT NULL,
  PRIMARY KEY (invoice_id,file_id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id), FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE waybill_files (
waybill_id BIGINT UNSIGNED NOT NULL, file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('waybill') NOT NULL,
  PRIMARY KEY (waybill_id,file_id),
  FOREIGN KEY (waybill_id) REFERENCES waybills(id), FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_receipt_files (
delivery_receipt_id BIGINT UNSIGNED NOT NULL, file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('delivery_receipt') NOT NULL,
  PRIMARY KEY (delivery_receipt_id,file_id),
  FOREIGN KEY (delivery_receipt_id) REFERENCES delivery_receipts(id), FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_transaction_files (
payment_transaction_id BIGINT UNSIGNED NOT NULL, file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('official_receipt') NOT NULL,
  PRIMARY KEY (payment_transaction_id,file_id),
  FOREIGN KEY (payment_transaction_id) REFERENCES payment_transaction(id), FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_requests (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL, requested_by BIGINT UNSIGNED NOT NULL,
  request_type ENUM('revision','cancellation','po_reupload') NOT NULL,
  status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending', reason TEXT NOT NULL,
  reviewed_by BIGINT UNSIGNED NULL, reviewed_at DATETIME(3) NULL,
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_order_request_queue (status,requested_at),
  FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document_sequences (
kind VARCHAR(40) NOT NULL, period_key VARCHAR(20) NOT NULL,
  next_value BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (kind,period_key), CONSTRAINT ck_sequence_positive CHECK (next_value>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
