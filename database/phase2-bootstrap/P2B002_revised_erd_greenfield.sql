-- P2B002: revised EnterFlow ERD greenfield schema, 2026-11-22.
-- Design input: EnterFlow_ERD_Revised.md + documented project workflows ONLY.
-- No old DDL, old dictionary, P2B001 or database backup was used to author this.
-- No persistent INSERTs/reference/sample rows. FK actions are RESTRICT.
-- Target is an empty schema selected by the guarded executor; no USE/CREATE DATABASE.
-- DDL implicitly commits: stop on error, preserve evidence, never blindly rerun.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET SESSION time_zone='+00:00';
CREATE TABLE role (
role_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_name ENUM('Client','Sales','Admin','Accounting','Production','Warehouse','Logistics','Owner','Operations') NOT NULL,
  description TEXT NULL,
  is_owner_role BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uq_role_name (role_name),
  CONSTRAINT ck_role_owner CHECK (is_owner_role=(role_name='Owner'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_method (
delivery_method_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  method_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_delivery_method_name (method_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_method (
payment_method_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  method_name VARCHAR(100) NOT NULL,
  instructions TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_payment_method_name (method_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_category (
material_category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_material_category_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE unit_of_measure (
uom_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uom_name VARCHAR(80) NOT NULL,
  abbreviation VARCHAR(20) NOT NULL,
  UNIQUE KEY uq_uom_name (uom_name),
  UNIQUE KEY uq_uom_abbreviation (abbreviation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE filter_type (
filter_type_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  filter_type_name VARCHAR(120) NOT NULL,
  template_group VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_filter_type_name (filter_type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE production_stage (
stage_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stage_name VARCHAR(120) NOT NULL,
  stage_order SMALLINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_stage_name (stage_name),
  UNIQUE KEY uq_stage_order (stage_order),
  CONSTRAINT ck_ten_stage_positions CHECK (stage_order BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_account (
user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  initials VARCHAR(16) NULL,
  phone VARCHAR(40) NULL,
  status VARCHAR(30) NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  joined_date DATE NULL,
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_email (email),
  FOREIGN KEY (role_id) REFERENCES role(role_id),
  CONSTRAINT ck_user_password_flag CHECK (must_change_password IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client (
client_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  industry VARCHAR(120) NULL,
  contact_person VARCHAR(160) NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(254) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city_province VARCHAR(160) NULL,
  zip_code VARCHAR(20) NULL,
  default_payment_terms VARCHAR(80) NULL,
  preferred_delivery_method_id BIGINT UNSIGNED NULL,
  internal_notes TEXT NULL,
  status VARCHAR(30) NOT NULL,
  client_since DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_client_company (company_name),
  FOREIGN KEY (preferred_delivery_method_id) REFERENCES delivery_method(delivery_method_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_user (
client_user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_company_portal_login (client_id),
  UNIQUE KEY uq_client_user_owner (client_user_id,client_id),
  FOREIGN KEY (client_user_id) REFERENCES user_account(user_id),
  FOREIGN KEY (client_id) REFERENCES client(client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document (
document_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  storage_bucket VARCHAR(63) CHARACTER SET ascii COLLATE ascii_bin NULL,
  storage_key VARCHAR(700) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  object_generation VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  storage_status ENUM('pending','available','failed','deleted') NOT NULL DEFAULT 'pending',
  uploaded_by_user_id BIGINT UNSIGNED NOT NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_document_object_version (storage_bucket,storage_key,object_generation),
  FOREIGN KEY (uploaded_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_document_available CHECK (storage_status<>'available' OR
    (storage_bucket IS NOT NULL AND storage_key IS NOT NULL AND object_generation IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inquiry (
inquiry_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  inquiry_no VARCHAR(60) NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  contact_person VARCHAR(160) NOT NULL,
  payment_terms VARCHAR(80) NOT NULL,
  source VARCHAR(40) NOT NULL,
  submitted_by_client_user_id BIGINT UNSIGNED NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  general_notes TEXT NULL,
  required_by_date DATE NULL,
  due_date DATE NULL,
  status VARCHAR(40) NOT NULL,
  rejection_reason TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inquiry_number (inquiry_no),
  KEY ix_inquiry_client_queue (client_id,status,created_at),
  FOREIGN KEY (client_id) REFERENCES client(client_id),
  FOREIGN KEY (submitted_by_client_user_id,client_id) REFERENCES client_user(client_user_id,client_id),
  FOREIGN KEY (created_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_inquiry_creator CHECK (submitted_by_client_user_id IS NOT NULL OR created_by_user_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inquiry_item (
inquiry_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  inquiry_id BIGINT UNSIGNED NOT NULL,
  line_no SMALLINT UNSIGNED NOT NULL,
  filter_type_id BIGINT UNSIGNED NOT NULL,
  filter_name VARCHAR(200) NOT NULL,
  oem_reference VARCHAR(160) NULL,

  od1_mm DECIMAL(15,4) NULL, od2_mm DECIMAL(15,4) NULL,
  id1_mm DECIMAL(15,4) NULL, id2_mm DECIMAL(15,4) NULL,
  height_mm DECIMAL(15,4) NULL, overall_height_mm DECIMAL(15,4) NULL,

  filter_media VARCHAR(255) NULL,
  inner_core VARCHAR(255) NULL, outer_core VARCHAR(255) NULL,
  o_ring VARCHAR(255) NULL, gasket VARCHAR(255) NULL,
  filtration_rating VARCHAR(120) NULL, filtration_rating_custom VARCHAR(255) NULL,
  quantity INT UNSIGNED NOT NULL,
  template_specifications JSON NULL,
  sketch_document_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_inquiry_line (inquiry_id,line_no),
  FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id),
  FOREIGN KEY (filter_type_id) REFERENCES filter_type(filter_type_id),
  FOREIGN KEY (sketch_document_id) REFERENCES document(document_id),
  CONSTRAINT ck_inquiry_line_quantity CHECK (quantity>0 AND line_no>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation (
quotation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_no VARCHAR(60) NOT NULL,
  inquiry_id BIGINT UNSIGNED NOT NULL,
  revision_no SMALLINT UNSIGNED NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  current_inquiry_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN is_current=1 THEN inquiry_id ELSE NULL END) STORED,
  quotation_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  terms_of_payment VARCHAR(80) NOT NULL,
  time_of_delivery VARCHAR(255) NOT NULL,
  place_of_delivery TEXT NOT NULL,
  vat_type VARCHAR(40) NOT NULL,
  highlight_tag VARCHAR(80) NULL,
  highlight_note TEXT NULL,
  requires_downpayment BOOLEAN NOT NULL DEFAULT TRUE,
  downpayment_percent DECIMAL(5,2) NOT NULL,
  downpayment_amount DECIMAL(19,2) NOT NULL,
  subtotal DECIMAL(19,2) NOT NULL,
  addons_total DECIMAL(19,2) NOT NULL,
  total_amount DECIMAL(19,2) NOT NULL,
  status VARCHAR(40) NOT NULL,
  prepared_by_user_id BIGINT UNSIGNED NOT NULL,
  approved_by_user_id BIGINT UNSIGNED NULL,
  sent_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_quotation_number (quotation_no),
  UNIQUE KEY uq_quotation_revision (inquiry_id,revision_no),
  UNIQUE KEY uq_current_quotation (current_inquiry_id),
  FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id),
  FOREIGN KEY (prepared_by_user_id) REFERENCES user_account(user_id),
  FOREIGN KEY (approved_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_quotation_dates CHECK (valid_until>=quotation_date),
  CONSTRAINT ck_quotation_current CHECK (is_current IN (0,1)),
  CONSTRAINT ck_quotation_money CHECK (subtotal>=0 AND addons_total>=0 AND total_amount>=0
    AND requires_downpayment=1 AND downpayment_percent IN (20,50)
    AND downpayment_amount=ROUND(total_amount*downpayment_percent/100,2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_item (
quotation_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL,
  inquiry_item_id BIGINT UNSIGNED NULL,
  line_no SMALLINT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  uom_id BIGINT UNSIGNED NOT NULL,
  unit_price DECIMAL(15,4) NOT NULL,
  line_total DECIMAL(19,2) GENERATED ALWAYS AS (ROUND(quantity*unit_price,2)) STORED,
  UNIQUE KEY uq_quotation_item_line (quotation_id,line_no),
  FOREIGN KEY (quotation_id) REFERENCES quotation(quotation_id),
  FOREIGN KEY (inquiry_item_id) REFERENCES inquiry_item(inquiry_item_id),
  FOREIGN KEY (uom_id) REFERENCES unit_of_measure(uom_id),
  CONSTRAINT ck_quotation_item_values CHECK (line_no>0 AND quantity>0 AND unit_price>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cost_estimate (
estimate_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_item_id BIGINT UNSIGNED NOT NULL,
  labor_cost_per_unit DECIMAL(15,4) NOT NULL,
  include_labor BOOLEAN NOT NULL,
  markup_percent DECIMAL(9,4) NOT NULL,
  apply_markup BOOLEAN NOT NULL,
  vat_type VARCHAR(40) NOT NULL,
  vat_rate DECIMAL(7,4) NOT NULL,
  apply_vat BOOLEAN NOT NULL,
  material_cost_per_unit DECIMAL(15,4) NOT NULL,
  unit_cost_with_markup DECIMAL(15,4) NOT NULL,
  unit_cost_with_vat DECIMAL(15,4) NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_estimate_item_history (quotation_item_id,created_at),
  FOREIGN KEY (quotation_item_id) REFERENCES quotation_item(quotation_item_id),
  FOREIGN KEY (created_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_estimate_values CHECK (labor_cost_per_unit>=0 AND markup_percent>=0 AND vat_rate BETWEEN 0 AND 100
    AND material_cost_per_unit>=0 AND unit_cost_with_markup>=0 AND unit_cost_with_vat>=0),
  CONSTRAINT ck_estimate_flags CHECK (include_labor IN (0,1) AND apply_markup IN (0,1) AND apply_vat IN (0,1) AND is_locked IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE raw_material (
material_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  material_category_id BIGINT UNSIGNED NULL,
  material_name VARCHAR(200) NOT NULL,
  uom_id BIGINT UNSIGNED NOT NULL,
  qty_in_stock DECIMAL(15,4) NULL DEFAULT NULL,
  quantity_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown',
  unit_price DECIMAL(15,4) NULL DEFAULT NULL,
  unit_price_approved_by_user_id BIGINT UNSIGNED NULL,
  unit_price_approved_at DATETIME(3) NULL,
  reference_unit_price DECIMAL(15,4) NULL,
  reference_document_id BIGINT UNSIGNED NULL,
  reference_page SMALLINT UNSIGNED NULL,
  reorder_threshold DECIMAL(15,4) NULL DEFAULT NULL,
  threshold_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown',
  supplier_name VARCHAR(200) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_material_category_name (material_category_id,material_name),
  FOREIGN KEY (material_category_id) REFERENCES material_category(material_category_id),
  FOREIGN KEY (uom_id) REFERENCES unit_of_measure(uom_id),
  FOREIGN KEY (unit_price_approved_by_user_id) REFERENCES user_account(user_id),
  FOREIGN KEY (reference_document_id) REFERENCES document(document_id),
  CONSTRAINT ck_raw_quantity CHECK ((quantity_status='unknown' AND qty_in_stock IS NULL)
    OR (quantity_status IN ('provisional_sample','verified') AND qty_in_stock IS NOT NULL AND qty_in_stock>=0)),
  CONSTRAINT ck_raw_threshold CHECK ((threshold_status='unknown' AND reorder_threshold IS NULL)
    OR (threshold_status IN ('provisional_sample','verified') AND reorder_threshold IS NOT NULL AND reorder_threshold>=0)),
  CONSTRAINT ck_raw_costing_price CHECK ((unit_price IS NULL AND unit_price_approved_by_user_id IS NULL AND unit_price_approved_at IS NULL)
    OR (unit_price IS NOT NULL AND unit_price>=0 AND unit_price_approved_by_user_id IS NOT NULL AND unit_price_approved_at IS NOT NULL)),
  CONSTRAINT ck_reference_price CHECK (reference_unit_price IS NULL OR reference_unit_price>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cost_estimate_material (
estimate_material_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  estimate_id BIGINT UNSIGNED NOT NULL,
  material_category_id BIGINT UNSIGNED NULL,
  raw_material_id BIGINT UNSIGNED NOT NULL,
  qty_per_filter DECIMAL(15,4) NOT NULL,
  uom_id BIGINT UNSIGNED NOT NULL,
  unit_price_snapshot DECIMAL(15,4) NOT NULL,
  line_cost DECIMAL(19,4) GENERATED ALWAYS AS (qty_per_filter*unit_price_snapshot) STORED,
  FOREIGN KEY (estimate_id) REFERENCES cost_estimate(estimate_id),
  FOREIGN KEY (material_category_id) REFERENCES material_category(material_category_id),
  FOREIGN KEY (raw_material_id) REFERENCES raw_material(material_id),
  FOREIGN KEY (uom_id) REFERENCES unit_of_measure(uom_id),
  CONSTRAINT ck_estimate_material_values CHECK (qty_per_filter>0 AND unit_price_snapshot>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_order (
po_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  po_no VARCHAR(80) NOT NULL,
  quotation_id BIGINT UNSIGNED NOT NULL,
  po_document_id BIGINT UNSIGNED NOT NULL,
  received_date DATE NOT NULL,
  payment_terms VARCHAR(80) NOT NULL,
  delivery_method_id BIGINT UNSIGNED NOT NULL,
  recorded_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_po_number (po_no),
  FOREIGN KEY (quotation_id) REFERENCES quotation(quotation_id),
  FOREIGN KEY (po_document_id) REFERENCES document(document_id),
  FOREIGN KEY (delivery_method_id) REFERENCES delivery_method(delivery_method_id),
  FOREIGN KEY (recorded_by_user_id) REFERENCES user_account(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_order (
jo_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jo_no VARCHAR(60) NOT NULL,
  po_id BIGINT UNSIGNED NOT NULL,
  jo_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(40) NOT NULL,
  payment_terms VARCHAR(80) NOT NULL,
  delivery_method_id BIGINT UNSIGNED NOT NULL,
  po_verified BOOLEAN NOT NULL DEFAULT FALSE,
  specs_verified BOOLEAN NOT NULL DEFAULT FALSE,
  terms_verified BOOLEAN NOT NULL DEFAULT FALSE,
  prepared_by_user_id BIGINT UNSIGNED NOT NULL,
  approved_by_user_id BIGINT UNSIGNED NULL,
  cancellation_reason TEXT NULL,
  completed_at DATETIME(3) NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_jo_number (jo_no),
  UNIQUE KEY uq_jo_po (po_id),
  KEY ix_jo_queue (status,due_date),
  FOREIGN KEY (po_id) REFERENCES purchase_order(po_id),
  FOREIGN KEY (delivery_method_id) REFERENCES delivery_method(delivery_method_id),
  FOREIGN KEY (prepared_by_user_id) REFERENCES user_account(user_id),
  FOREIGN KEY (approved_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_jo_verification_flags CHECK (po_verified IN (0,1) AND specs_verified IN (0,1) AND terms_verified IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_order_item (
jo_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jo_id BIGINT UNSIGNED NOT NULL,
  quotation_item_id BIGINT UNSIGNED NOT NULL,
  line_no SMALLINT UNSIGNED NOT NULL,
  item_code VARCHAR(80) NULL,
  enterfil_pn VARCHAR(160) NULL,
  item_name VARCHAR(200) NOT NULL,
  quantity INT UNSIGNED NOT NULL,

  od1_mm DECIMAL(15,4) NULL, od2_mm DECIMAL(15,4) NULL,
  id1_mm DECIMAL(15,4) NULL, id2_mm DECIMAL(15,4) NULL,
  height_mm DECIMAL(15,4) NULL, overall_height_mm DECIMAL(15,4) NULL,

  filter_media VARCHAR(255) NULL,
  inner_core VARCHAR(255) NULL, outer_core VARCHAR(255) NULL,
  end_cap VARCHAR(255) NULL,
  o_ring VARCHAR(255) NULL, gasket VARCHAR(255) NULL,
  oem_pn VARCHAR(160) NULL, brand VARCHAR(160) NULL,
  other_specs TEXT NULL,
  template_specifications_snapshot JSON NULL,
  final_sketch_document_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_jo_item_line (jo_id,line_no),
  FOREIGN KEY (jo_id) REFERENCES job_order(jo_id),
  FOREIGN KEY (quotation_item_id) REFERENCES quotation_item(quotation_item_id),
  FOREIGN KEY (final_sketch_document_id) REFERENCES document(document_id),
  CONSTRAINT ck_jo_item_quantity CHECK (quantity>0 AND line_no>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_order_stage (
jo_stage_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jo_id BIGINT UNSIGNED NOT NULL,
  stage_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  marked_by_user_id BIGINT UNSIGNED NULL,
  remarks TEXT NULL,
  reverted_count INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_jo_defined_stage (jo_id,stage_id),
  FOREIGN KEY (jo_id) REFERENCES job_order(jo_id),
  FOREIGN KEY (stage_id) REFERENCES production_stage(stage_id),
  FOREIGN KEY (marked_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_stage_times CHECK (
    (status='pending' AND started_at IS NULL AND completed_at IS NULL)
    OR (status='in_progress' AND started_at IS NOT NULL AND completed_at IS NULL AND marked_by_user_id IS NOT NULL)
    OR (status='completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
      AND completed_at>=started_at AND marked_by_user_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_shortage_report (
report_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jo_id BIGINT UNSIGNED NOT NULL,
  jo_stage_id BIGINT UNSIGNED NULL,
  raw_material_id BIGINT UNSIGNED NOT NULL,
  qty_needed DECIMAL(15,4) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(40) NOT NULL,
  reported_by_user_id BIGINT UNSIGNED NOT NULL,
  reported_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  KEY ix_shortage_queue (status,reported_at),
  FOREIGN KEY (jo_id) REFERENCES job_order(jo_id),
  FOREIGN KEY (jo_stage_id) REFERENCES job_order_stage(jo_stage_id),
  FOREIGN KEY (raw_material_id) REFERENCES raw_material(material_id),
  FOREIGN KEY (reported_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_shortage_quantity CHECK (qty_needed>0),
  CONSTRAINT ck_shortage_resolved CHECK (resolved_at IS NULL OR resolved_at>=reported_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE finished_good (
finished_good_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(80) NOT NULL,
  enterfil_pn VARCHAR(160) NULL,
  item_name VARCHAR(200) NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  filter_type_id BIGINT UNSIGNED NOT NULL,
  qty_in_stock INT UNSIGNED NULL DEFAULT NULL,
  quantity_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown',
  buffer_min INT UNSIGNED NULL DEFAULT NULL,
  threshold_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown',
  demand_level VARCHAR(40) NULL,
  order_frequency VARCHAR(80) NULL,
  avg_qty_per_order DECIMAL(15,4) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_finished_item_code (item_code),
  KEY ix_finished_client (client_id,item_name),
  FOREIGN KEY (client_id) REFERENCES client(client_id),
  FOREIGN KEY (filter_type_id) REFERENCES filter_type(filter_type_id),
  CONSTRAINT ck_finished_quantity CHECK ((quantity_status='unknown' AND qty_in_stock IS NULL)
    OR (quantity_status IN ('provisional_sample','verified') AND qty_in_stock IS NOT NULL)),
  CONSTRAINT ck_finished_threshold CHECK ((threshold_status='unknown' AND buffer_min IS NULL)
    OR (threshold_status IN ('provisional_sample','verified') AND buffer_min IS NOT NULL)),
  CONSTRAINT ck_finished_average CHECK (avg_qty_per_order IS NULL OR avg_qty_per_order>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_movement (
movement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_type ENUM('raw_material','finished_good') NOT NULL,
  raw_material_id BIGINT UNSIGNED NULL,
  finished_good_id BIGINT UNSIGNED NULL,
  movement_reason TEXT NOT NULL,
  quantity_status_before ENUM('unknown','provisional_sample','verified') NOT NULL,
  qty_before DECIMAL(15,4) NULL,
  qty_after DECIMAL(15,4) NOT NULL,
  qty_change DECIMAL(15,4) NULL,
  uom_id BIGINT UNSIGNED NULL,
  reference_no VARCHAR(160) NULL,
  supplier_name VARCHAR(200) NULL,
  jo_id BIGINT UNSIGNED NULL,
  notes TEXT NULL,
  performed_by_user_id BIGINT UNSIGNED NOT NULL,
  operation_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_stock_operation (operation_key),
  KEY ix_raw_movement_history (raw_material_id,created_at,movement_id),
  KEY ix_finished_movement_history (finished_good_id,created_at,movement_id),
  FOREIGN KEY (raw_material_id) REFERENCES raw_material(material_id),
  FOREIGN KEY (finished_good_id) REFERENCES finished_good(finished_good_id),
  FOREIGN KEY (uom_id) REFERENCES unit_of_measure(uom_id),
  FOREIGN KEY (jo_id) REFERENCES job_order(jo_id),
  FOREIGN KEY (performed_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_stock_item_xor CHECK (
    (item_type='raw_material' AND raw_material_id IS NOT NULL AND finished_good_id IS NULL AND uom_id IS NOT NULL)
    OR (item_type='finished_good' AND raw_material_id IS NULL AND finished_good_id IS NOT NULL AND uom_id IS NULL)),
  CONSTRAINT ck_stock_observation CHECK (qty_after>=0 AND
    ((quantity_status_before='verified' AND qty_before IS NOT NULL AND qty_before>=0 AND qty_change IS NOT NULL AND qty_after=qty_before+qty_change)
      OR (quantity_status_before IN ('unknown','provisional_sample') AND qty_before IS NULL AND qty_change IS NULL))),
  CONSTRAINT ck_finished_movement_units CHECK (item_type<>'finished_good' OR
    (qty_after=FLOOR(qty_after) AND (qty_before IS NULL OR qty_before=FLOOR(qty_before)))),
  CONSTRAINT ck_stock_reason CHECK (CHAR_LENGTH(TRIM(movement_reason))>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_request (
stock_request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  inquiry_id BIGINT UNSIGNED NOT NULL,
  requested_by_user_id BIGINT UNSIGNED NOT NULL,
  handled_by_user_id BIGINT UNSIGNED NULL,
  request_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  status VARCHAR(40) NOT NULL,
  remarks TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_stock_request_queue (status,request_date),
  FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id),
  FOREIGN KEY (requested_by_user_id) REFERENCES user_account(user_id),
  FOREIGN KEY (handled_by_user_id) REFERENCES user_account(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_request_item (
stock_request_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stock_request_id BIGINT UNSIGNED NOT NULL,
  raw_material_id BIGINT UNSIGNED NOT NULL,
  qty_requested DECIMAL(15,4) NOT NULL,
  stock_at_request DECIMAL(15,4) NULL,
  qty_available DECIMAL(15,4) NULL,
  shortage_at_request DECIMAL(15,4) NULL,
  quantity_status_at_request ENUM('unknown','provisional_sample','verified') NOT NULL,
  available_quantity_status ENUM('unknown','provisional_sample','verified') NULL,
  observed_at DATETIME(3) NULL,
  observed_by_user_id BIGINT UNSIGNED NULL,
  uom_id BIGINT UNSIGNED NOT NULL,
  notes TEXT NULL,
  UNIQUE KEY uq_request_material (stock_request_id,raw_material_id),
  FOREIGN KEY (stock_request_id) REFERENCES stock_request(stock_request_id),
  FOREIGN KEY (raw_material_id) REFERENCES raw_material(material_id),
  FOREIGN KEY (uom_id) REFERENCES unit_of_measure(uom_id),
  FOREIGN KEY (observed_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_requested_quantity CHECK (qty_requested>0),
  CONSTRAINT ck_request_snapshot_provenance CHECK (
    (quantity_status_at_request='verified' AND stock_at_request IS NOT NULL AND stock_at_request>=0
      AND shortage_at_request IS NOT NULL AND shortage_at_request=GREATEST(qty_requested-stock_at_request,0))
    OR (quantity_status_at_request IN ('unknown','provisional_sample') AND stock_at_request IS NULL AND shortage_at_request IS NULL)),
  CONSTRAINT ck_request_response CHECK (
    (available_quantity_status IS NULL AND qty_available IS NULL AND observed_at IS NULL AND observed_by_user_id IS NULL)
    OR (available_quantity_status IS NOT NULL AND observed_at IS NOT NULL AND observed_by_user_id IS NOT NULL
      AND ((available_quantity_status='verified' AND qty_available IS NOT NULL AND qty_available>=0)
        OR (available_quantity_status IN ('unknown','provisional_sample') AND qty_available IS NULL))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE production_plan (
plan_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plan_code VARCHAR(60) NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  finished_good_id BIGINT UNSIGNED NULL,
  jo_id BIGINT UNSIGNED NULL,
  source VARCHAR(80) NOT NULL,
  planned_qty INT UNSIGNED NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_plan_code (plan_code),
  FOREIGN KEY (client_id) REFERENCES client(client_id),
  FOREIGN KEY (finished_good_id) REFERENCES finished_good(finished_good_id),
  FOREIGN KEY (jo_id) REFERENCES job_order(jo_id),
  FOREIGN KEY (created_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_production_plan CHECK (planned_qty>0 AND week_end_date>=week_start_date
    AND (finished_good_id IS NOT NULL OR jo_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sales_invoice (
invoice_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(60) NOT NULL,
  po_id BIGINT UNSIGNED NOT NULL,
  invoice_date DATE NOT NULL,
  payment_terms VARCHAR(80) NOT NULL,
  delivered_date DATE NULL,
  due_date DATE NULL,
  total_amount DECIMAL(19,2) NOT NULL,
  status VARCHAR(40) NOT NULL,
  issued_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_invoice_number (invoice_no),
  UNIQUE KEY uq_invoice_po (po_id),
  KEY ix_invoice_due (status,due_date),
  FOREIGN KEY (po_id) REFERENCES purchase_order(po_id),
  FOREIGN KEY (issued_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_invoice_total CHECK (total_amount>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_receipt (
receipt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  client_user_id BIGINT UNSIGNED NOT NULL,
  payment_method_id BIGINT UNSIGNED NOT NULL,
  amount_declared DECIMAL(19,2) NOT NULL,
  note TEXT NULL,
  review_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by_user_id BIGINT UNSIGNED NULL,
  reviewed_at DATETIME(3) NULL,
  review_note TEXT NULL,
  sent_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_receipt_invoice (receipt_id,invoice_id),
  KEY ix_receipt_review (review_status,sent_at),
  FOREIGN KEY (invoice_id) REFERENCES sales_invoice(invoice_id),
  FOREIGN KEY (client_user_id) REFERENCES client_user(client_user_id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_method(payment_method_id),
  FOREIGN KEY (reviewed_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_receipt_amount CHECK (amount_declared>0),
  CONSTRAINT ck_receipt_review CHECK (
    (review_status='pending' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
    OR (review_status IN ('verified','rejected') AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_transaction (
payment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  payment_method_id BIGINT UNSIGNED NOT NULL,
  transaction_type VARCHAR(40) NOT NULL,
  amount DECIMAL(19,2) NOT NULL,
  reference_no VARCHAR(160) NULL,
  date_paid DATE NOT NULL,
  client_receipt_id BIGINT UNSIGNED NULL,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'approved',
  recorded_by_user_id BIGINT UNSIGNED NOT NULL,
  approved_by_user_id BIGINT UNSIGNED NOT NULL,
  approved_at DATETIME(3) NOT NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  operation_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  official_receipt_document_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_payment_operation (operation_key),
  KEY ix_invoice_payments (invoice_id,date_paid),
  FOREIGN KEY (invoice_id) REFERENCES sales_invoice(invoice_id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_method(payment_method_id),
  FOREIGN KEY (client_receipt_id,invoice_id) REFERENCES client_receipt(receipt_id,invoice_id),
  FOREIGN KEY (recorded_by_user_id) REFERENCES user_account(user_id),
  FOREIGN KEY (approved_by_user_id) REFERENCES user_account(user_id),
  FOREIGN KEY (official_receipt_document_id) REFERENCES document(document_id),
  CONSTRAINT ck_confirmed_payment CHECK (amount>0 AND approval_status='approved')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery (
delivery_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jo_id BIGINT UNSIGNED NOT NULL,
  delivery_method_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL,
  dispatch_date DATETIME(3) NULL,
  estimated_delivery_date DATE NULL,
  delivered_date DATETIME(3) NULL,
  driver_name VARCHAR(160) NULL,
  driver_contact VARCHAR(40) NULL,
  vehicle_plate VARCHAR(40) NULL,
  tracking_link VARCHAR(2048) NULL,
  received_by VARCHAR(160) NULL,
  notes TEXT NULL,
  dispatched_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_delivery_queue (status,estimated_delivery_date),
  FOREIGN KEY (jo_id) REFERENCES job_order(jo_id),
  FOREIGN KEY (delivery_method_id) REFERENCES delivery_method(delivery_method_id),
  FOREIGN KEY (dispatched_by_user_id) REFERENCES user_account(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_item (
delivery_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL,
  jo_item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_delivery_item (delivery_id,jo_item_id),
  FOREIGN KEY (delivery_id) REFERENCES delivery(delivery_id),
  FOREIGN KEY (jo_item_id) REFERENCES job_order_item(jo_item_id),
  CONSTRAINT ck_delivery_item_quantity CHECK (quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification (
notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(80) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  read_at DATETIME(3) NULL,
  KEY ix_user_notifications (user_id,is_read,created_at),
  FOREIGN KEY (user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_notification_read CHECK ((is_read=0 AND read_at IS NULL) OR (is_read=1 AND read_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_receipt_file (
receipt_id BIGINT UNSIGNED NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (receipt_id,document_id),
  FOREIGN KEY (receipt_id) REFERENCES client_receipt(receipt_id),
  FOREIGN KEY (document_id) REFERENCES document(document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE waybill (
waybill_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL,
  waybill_no VARCHAR(80) NOT NULL,
  qr_identifier VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  generated_by_user_id BIGINT UNSIGNED NOT NULL,
  generated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  printed_at DATETIME(3) NULL,
  document_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_waybill_delivery (delivery_id), UNIQUE KEY uq_waybill_number (waybill_no),
  UNIQUE KEY uq_waybill_qr (qr_identifier),
  FOREIGN KEY (delivery_id) REFERENCES delivery(delivery_id),
  FOREIGN KEY (generated_by_user_id) REFERENCES user_account(user_id),
  FOREIGN KEY (document_id) REFERENCES document(document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_receipt (
delivery_receipt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL,
  dr_no VARCHAR(80) NOT NULL,
  generated_by_user_id BIGINT UNSIGNED NOT NULL,
  generated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  document_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_dr_delivery (delivery_id), UNIQUE KEY uq_dr_number (dr_no),
  FOREIGN KEY (delivery_id) REFERENCES delivery(delivery_id),
  FOREIGN KEY (generated_by_user_id) REFERENCES user_account(user_id),
  FOREIGN KEY (document_id) REFERENCES document(document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE signed_delivery_receipt (
signed_dr_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_receipt_id BIGINT UNSIGNED NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  submitted_by_user_id BIGINT UNSIGNED NOT NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  received_at DATETIME(3) NULL,
  UNIQUE KEY uq_signed_dr_document (document_id),
  FOREIGN KEY (delivery_receipt_id) REFERENCES delivery_receipt(delivery_receipt_id),
  FOREIGN KEY (document_id) REFERENCES document(document_id),
  FOREIGN KEY (submitted_by_user_id) REFERENCES user_account(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE production_stage_event (
stage_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jo_stage_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(40) NOT NULL,
  reason TEXT NULL,
  performed_by_user_id BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_stage_event_history (jo_stage_id,occurred_at,stage_event_id),
  FOREIGN KEY (jo_stage_id) REFERENCES job_order_stage(jo_stage_id),
  FOREIGN KEY (performed_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_stage_reversion_reason CHECK (action<>'reverted' OR (reason IS NOT NULL AND CHAR_LENGTH(TRIM(reason))>0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_event (
audit_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  subject_type VARCHAR(60) NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  before_value JSON NULL,
  after_value JSON NULL,
  reason TEXT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_audit_subject (subject_type,subject_id,occurred_at),
  FOREIGN KEY (actor_user_id) REFERENCES user_account(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
CREATE TRIGGER client_user_role_bi BEFORE INSERT ON client_user FOR EACH ROW
BEGIN
IF (SELECT r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=NEW.client_user_id)<>'Client' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Portal profile requires Client role'; END IF;
END$$

CREATE TRIGGER client_user_role_bu BEFORE UPDATE ON client_user FOR EACH ROW
BEGIN
IF (SELECT r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=NEW.client_user_id)<>'Client' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Portal profile requires Client role'; END IF;
END$$

CREATE TRIGGER quote_item_source_bi BEFORE INSERT ON quotation_item FOR EACH ROW
BEGIN
IF NEW.inquiry_item_id IS NOT NULL AND (SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id)<>(SELECT inquiry_id FROM inquiry_item WHERE inquiry_item_id=NEW.inquiry_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Quotation item must belong to the same inquiry'; END IF;
END$$

CREATE TRIGGER quote_item_source_bu BEFORE UPDATE ON quotation_item FOR EACH ROW
BEGIN
IF NEW.inquiry_item_id IS NOT NULL AND (SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id)<>(SELECT inquiry_id FROM inquiry_item WHERE inquiry_item_id=NEW.inquiry_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Quotation item must belong to the same inquiry'; END IF;
END$$

CREATE TRIGGER jo_item_source_bi BEFORE INSERT ON job_order_item FOR EACH ROW
BEGIN
IF (SELECT p.quotation_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id WHERE j.jo_id=NEW.jo_id)<>(SELECT quotation_id FROM quotation_item WHERE quotation_item_id=NEW.quotation_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JO item must reference its PO accepted quotation'; END IF;
END$$

CREATE TRIGGER jo_item_source_bu BEFORE UPDATE ON job_order_item FOR EACH ROW
BEGIN
IF (SELECT p.quotation_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id WHERE j.jo_id=NEW.jo_id)<>(SELECT quotation_id FROM quotation_item WHERE quotation_item_id=NEW.quotation_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JO item must reference its PO accepted quotation'; END IF;
END$$

CREATE TRIGGER delivery_item_owner_bi BEFORE INSERT ON delivery_item FOR EACH ROW
BEGIN
IF (SELECT jo_id FROM delivery WHERE delivery_id=NEW.delivery_id)<>(SELECT jo_id FROM job_order_item WHERE jo_item_id=NEW.jo_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Delivery item must belong to the same JO'; END IF;
END$$

CREATE TRIGGER delivery_item_owner_bu BEFORE UPDATE ON delivery_item FOR EACH ROW
BEGIN
IF (SELECT jo_id FROM delivery WHERE delivery_id=NEW.delivery_id)<>(SELECT jo_id FROM job_order_item WHERE jo_item_id=NEW.jo_item_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Delivery item must belong to the same JO'; END IF;
END$$

CREATE TRIGGER shortage_stage_owner_bi BEFORE INSERT ON material_shortage_report FOR EACH ROW
BEGIN
IF NEW.jo_stage_id IS NOT NULL AND NEW.jo_id<>(SELECT jo_id FROM job_order_stage WHERE jo_stage_id=NEW.jo_stage_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Shortage stage must belong to its JO'; END IF;
END$$

CREATE TRIGGER shortage_stage_owner_bu BEFORE UPDATE ON material_shortage_report FOR EACH ROW
BEGIN
IF NEW.jo_stage_id IS NOT NULL AND NEW.jo_id<>(SELECT jo_id FROM job_order_stage WHERE jo_stage_id=NEW.jo_stage_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Shortage stage must belong to its JO'; END IF;
END$$

CREATE TRIGGER receipt_client_owner_bi BEFORE INSERT ON client_receipt FOR EACH ROW
BEGIN
IF (SELECT i.client_id FROM sales_invoice s JOIN purchase_order p ON p.po_id=s.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE s.invoice_id=NEW.invoice_id)<>(SELECT client_id FROM client_user WHERE client_user_id=NEW.client_user_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Receipt submitter must own the invoice client'; END IF;
END$$

CREATE TRIGGER receipt_client_owner_bu BEFORE UPDATE ON client_receipt FOR EACH ROW
BEGIN
IF (SELECT i.client_id FROM sales_invoice s JOIN purchase_order p ON p.po_id=s.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE s.invoice_id=NEW.invoice_id)<>(SELECT client_id FROM client_user WHERE client_user_id=NEW.client_user_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Receipt submitter must own the invoice client'; END IF;
END$$

CREATE TRIGGER plan_client_owner_bi BEFORE INSERT ON production_plan FOR EACH ROW
BEGIN
IF (NEW.finished_good_id IS NOT NULL AND NEW.client_id<>(SELECT client_id FROM finished_good WHERE finished_good_id=NEW.finished_good_id)) OR (NEW.jo_id IS NOT NULL AND NEW.client_id<>(SELECT i.client_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE j.jo_id=NEW.jo_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Production plan sources must belong to its client'; END IF;
END$$

CREATE TRIGGER plan_client_owner_bu BEFORE UPDATE ON production_plan FOR EACH ROW
BEGIN
IF (NEW.finished_good_id IS NOT NULL AND NEW.client_id<>(SELECT client_id FROM finished_good WHERE finished_good_id=NEW.finished_good_id)) OR (NEW.jo_id IS NOT NULL AND NEW.client_id<>(SELECT i.client_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE j.jo_id=NEW.jo_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Production plan sources must belong to its client'; END IF;
END$$

CREATE TRIGGER movement_jo_client_bi BEFORE INSERT ON stock_movement FOR EACH ROW
BEGIN
IF NEW.finished_good_id IS NOT NULL AND NEW.jo_id IS NOT NULL AND (SELECT client_id FROM finished_good WHERE finished_good_id=NEW.finished_good_id)<>(SELECT i.client_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE j.jo_id=NEW.jo_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Finished good and JO must belong to the same client'; END IF;
END$$

CREATE TRIGGER movement_jo_client_bu BEFORE UPDATE ON stock_movement FOR EACH ROW
BEGIN
IF NEW.finished_good_id IS NOT NULL AND NEW.jo_id IS NOT NULL AND (SELECT client_id FROM finished_good WHERE finished_good_id=NEW.finished_good_id)<>(SELECT i.client_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE j.jo_id=NEW.jo_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Finished good and JO must belong to the same client'; END IF;
END$$

CREATE TRIGGER inquiry_client_id_history BEFORE UPDATE ON inquiry FOR EACH ROW
BEGIN
IF NOT(NEW.client_id<=>OLD.client_id) AND (EXISTS(SELECT 1 FROM quotation WHERE inquiry_id=OLD.inquiry_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER quotation_inquiry_id_history BEFORE UPDATE ON quotation FOR EACH ROW
BEGIN
IF NOT(NEW.inquiry_id<=>OLD.inquiry_id) AND (EXISTS(SELECT 1 FROM quotation_item WHERE quotation_id=OLD.quotation_id) OR EXISTS(SELECT 1 FROM purchase_order WHERE quotation_id=OLD.quotation_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER inquiry_item_inquiry_id_history BEFORE UPDATE ON inquiry_item FOR EACH ROW
BEGIN
IF NOT(NEW.inquiry_id<=>OLD.inquiry_id) AND (EXISTS(SELECT 1 FROM quotation_item WHERE inquiry_item_id=OLD.inquiry_item_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER purchase_order_quotation_id_history BEFORE UPDATE ON purchase_order FOR EACH ROW
BEGIN
IF NOT(NEW.quotation_id<=>OLD.quotation_id) AND (EXISTS(SELECT 1 FROM job_order WHERE po_id=OLD.po_id) OR EXISTS(SELECT 1 FROM sales_invoice WHERE po_id=OLD.po_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER job_order_po_id_history BEFORE UPDATE ON job_order FOR EACH ROW
BEGIN
IF NOT(NEW.po_id<=>OLD.po_id) AND (EXISTS(SELECT 1 FROM job_order_item WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM delivery WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM production_plan WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM stock_movement WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM job_order_stage WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM material_shortage_report WHERE jo_id=OLD.jo_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER quotation_item_quotation_id_history BEFORE UPDATE ON quotation_item FOR EACH ROW
BEGIN
IF NOT(NEW.quotation_id<=>OLD.quotation_id) AND (EXISTS(SELECT 1 FROM job_order_item WHERE quotation_item_id=OLD.quotation_item_id) OR EXISTS(SELECT 1 FROM cost_estimate WHERE quotation_item_id=OLD.quotation_item_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER job_order_item_jo_id_history BEFORE UPDATE ON job_order_item FOR EACH ROW
BEGIN
IF NOT(NEW.jo_id<=>OLD.jo_id) AND (EXISTS(SELECT 1 FROM delivery_item WHERE jo_item_id=OLD.jo_item_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER delivery_jo_id_history BEFORE UPDATE ON delivery FOR EACH ROW
BEGIN
IF NOT(NEW.jo_id<=>OLD.jo_id) AND (EXISTS(SELECT 1 FROM delivery_item WHERE delivery_id=OLD.delivery_id) OR EXISTS(SELECT 1 FROM waybill WHERE delivery_id=OLD.delivery_id) OR EXISTS(SELECT 1 FROM delivery_receipt WHERE delivery_id=OLD.delivery_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER job_order_stage_jo_id_history BEFORE UPDATE ON job_order_stage FOR EACH ROW
BEGIN
IF NOT(NEW.jo_id<=>OLD.jo_id) AND (EXISTS(SELECT 1 FROM material_shortage_report WHERE jo_stage_id=OLD.jo_stage_id) OR EXISTS(SELECT 1 FROM production_stage_event WHERE jo_stage_id=OLD.jo_stage_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER finished_good_client_id_history BEFORE UPDATE ON finished_good FOR EACH ROW
BEGIN
IF NOT(NEW.client_id<=>OLD.client_id) AND (EXISTS(SELECT 1 FROM production_plan WHERE finished_good_id=OLD.finished_good_id) OR EXISTS(SELECT 1 FROM stock_movement WHERE finished_good_id=OLD.finished_good_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER sales_invoice_po_id_history BEFORE UPDATE ON sales_invoice FOR EACH ROW
BEGIN
IF NOT(NEW.po_id<=>OLD.po_id) AND (EXISTS(SELECT 1 FROM client_receipt WHERE invoice_id=OLD.invoice_id) OR EXISTS(SELECT 1 FROM payment_transaction WHERE invoice_id=OLD.invoice_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER client_user_client_id_history BEFORE UPDATE ON client_user FOR EACH ROW
BEGIN
IF NOT(NEW.client_id<=>OLD.client_id) AND (EXISTS(SELECT 1 FROM client_receipt WHERE client_user_id=OLD.client_user_id) OR EXISTS(SELECT 1 FROM inquiry WHERE submitted_by_client_user_id=OLD.client_user_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END$$

CREATE TRIGGER audit_event_append_only_update BEFORE UPDATE ON audit_event FOR EACH ROW
BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END$$

CREATE TRIGGER audit_event_append_only_delete BEFORE DELETE ON audit_event FOR EACH ROW
BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END$$

CREATE TRIGGER production_stage_event_append_only_update BEFORE UPDATE ON production_stage_event FOR EACH ROW
BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END$$

CREATE TRIGGER production_stage_event_append_only_delete BEFORE DELETE ON production_stage_event FOR EACH ROW
BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END$$

CREATE TRIGGER stock_movement_append_only_update BEFORE UPDATE ON stock_movement FOR EACH ROW
BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END$$

CREATE TRIGGER stock_movement_append_only_delete BEFORE DELETE ON stock_movement FOR EACH ROW
BEGIN
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';
END$$

CREATE TRIGGER user_account_portal_role BEFORE UPDATE ON user_account FOR EACH ROW
BEGIN
IF EXISTS(SELECT 1 FROM client_user WHERE client_user_id=OLD.user_id) AND (SELECT role_name FROM role WHERE role_id=NEW.role_id)<>'Client' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Portal identity must retain Client role'; END IF;
END$$

CREATE TRIGGER role_identity_history BEFORE UPDATE ON role FOR EACH ROW
BEGIN
IF NOT(NEW.role_name<=>OLD.role_name) AND EXISTS(SELECT 1 FROM user_account WHERE role_id=OLD.role_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot relabel a role used by accounts'; END IF;
END$$

CREATE TRIGGER raw_material_unit_history BEFORE UPDATE ON raw_material FOR EACH ROW
BEGIN
IF NEW.uom_id<>OLD.uom_id AND (EXISTS(SELECT 1 FROM stock_movement WHERE raw_material_id=OLD.material_id) OR EXISTS(SELECT 1 FROM stock_request_item WHERE raw_material_id=OLD.material_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unit conversion requires separate approved reconciliation'; END IF;
END$$

CREATE TRIGGER raw_movement_unit_bi BEFORE INSERT ON stock_movement FOR EACH ROW
BEGIN
IF NEW.raw_material_id IS NOT NULL AND NEW.uom_id<>(SELECT uom_id FROM raw_material WHERE material_id=NEW.raw_material_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Raw movement must use the recorded stock unit'; END IF;
END$$

CREATE TRIGGER raw_movement_unit_bu BEFORE UPDATE ON stock_movement FOR EACH ROW
BEGIN
IF NEW.raw_material_id IS NOT NULL AND NEW.uom_id<>(SELECT uom_id FROM raw_material WHERE material_id=NEW.raw_material_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Raw movement must use the recorded stock unit'; END IF;
END$$

DELIMITER ;
