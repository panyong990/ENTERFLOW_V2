"""P2B002 authoring: literal revised-ERD entities, never old schema/DDL input.

The only input document is EnterFlow_ERD_Revised.md. New attributes/entities
below have explicit requirement justifications in the manifest. No DB access.
"""
from pathlib import Path
import re
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
REFERENCE = ROOT / 'docs/erd-reference/EnterFlow_ERD_Revised.md'
tables = {}
reasons = {}
triggers = []
def entity(name, body, reason='Revised ERD entity and attributes.'):
    tables[name] = body.strip()
    reasons[name] = reason

entity('role', '''
  role_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_name ENUM('Client','Sales','Admin','Accounting','Production','Warehouse','Logistics','Owner','Operations') NOT NULL,
  description TEXT NULL,
  is_owner_role BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uq_role_name (role_name),
  CONSTRAINT ck_role_owner CHECK (is_owner_role=(role_name='Owner'))
''')
entity('delivery_method', '''
  delivery_method_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  method_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_delivery_method_name (method_name)
''', 'Revised reference; five documented delivery methods, no values seeded.')
entity('payment_method', '''
  payment_method_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  method_name VARCHAR(100) NOT NULL,
  instructions TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_payment_method_name (method_name)
''', 'Revised reference; manual payment-method selection/instructions, not a gateway.')
entity('material_category', '''
  material_category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_material_category_name (category_name)
''', 'Revised reference; documented raw-material categories.')
entity('unit_of_measure', '''
  uom_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uom_name VARCHAR(80) NOT NULL,
  abbreviation VARCHAR(20) NOT NULL,
  UNIQUE KEY uq_uom_name (uom_name),
  UNIQUE KEY uq_uom_abbreviation (abbreviation)
''', 'Revised reference; quantities and costing material measurement units.')
entity('filter_type', '''
  filter_type_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  filter_type_name VARCHAR(120) NOT NULL,
  template_group VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_filter_type_name (filter_type_name)
''', 'Revised reference; sixteen filter types/six template groups, no fictional values.')
entity('production_stage', '''
  stage_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stage_name VARCHAR(120) NOT NULL,
  stage_order SMALLINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_stage_name (stage_name),
  UNIQUE KEY uq_stage_order (stage_order),
  CONSTRAINT ck_ten_stage_positions CHECK (stage_order BETWEEN 1 AND 10)
''', 'Revised reference and ten-stage requirement; labels/order values remain unpopulated.')
entity('user_account', '''
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
''', 'Revised common account identity; client_user is a shared-PK subtype, not another credential store.')
entity('client', '''
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
''')
entity('client_user', '''
  client_user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_company_portal_login (client_id),
  UNIQUE KEY uq_client_user_owner (client_user_id,client_id),
  FOREIGN KEY (client_user_id) REFERENCES user_account(user_id),
  FOREIGN KEY (client_id) REFERENCES client(client_id)
''', 'Revised portal membership. Common login attributes reside once in user_account; approved one-company-login uniqueness retained.')
entity('document', '''
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
''', 'Revised document entity with private object identity/lifecycle required by security and auditability; no second files subsystem.')
entity('inquiry', '''
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
''')
dimensions = '''
  od1_mm DECIMAL(15,4) NULL, od2_mm DECIMAL(15,4) NULL,
  id1_mm DECIMAL(15,4) NULL, id2_mm DECIMAL(15,4) NULL,
  height_mm DECIMAL(15,4) NULL, overall_height_mm DECIMAL(15,4) NULL,
'''
entity('inquiry_item', '''
  inquiry_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  inquiry_id BIGINT UNSIGNED NOT NULL,
  line_no SMALLINT UNSIGNED NOT NULL,
  filter_type_id BIGINT UNSIGNED NOT NULL,
  filter_name VARCHAR(200) NOT NULL,
  oem_reference VARCHAR(160) NULL,
''' + dimensions + '''
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
''', 'Revised requested-item specifications directly on the item; JSON accommodates the documented six template groups, not a copied specification master.')
entity('quotation', '''
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
''')
entity('quotation_item', '''
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
''')
entity('cost_estimate', '''
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
''', 'Revised per-quotation-item estimate; nonunique item FK preserves estimate history without deciding one-current-estimate policy.')
entity('raw_material', '''
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
''', 'Revised raw material plus explicitly approved unknown/sample/verified provenance and reference-versus-approved price safeguards; no import lineage clone.')
entity('cost_estimate_material', '''
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
''', 'Revised material-cost snapshot; category/UOM describe estimate-time measurement, not a second current stock balance.')
entity('purchase_order', '''
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
''', 'Accepted quotation is the only commercial owner link; inquiry/client and downpayment facts derive through quotation, not duplicate FK/boolean state.')
entity('job_order', '''
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
''', 'Revised single PO header; no copied inquiry/client/accepted quote owner IDs and no product-level legacy JO.')
entity('job_order_item', '''
  jo_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jo_id BIGINT UNSIGNED NOT NULL,
  quotation_item_id BIGINT UNSIGNED NOT NULL,
  line_no SMALLINT UNSIGNED NOT NULL,
  item_code VARCHAR(80) NULL,
  enterfil_pn VARCHAR(160) NULL,
  item_name VARCHAR(200) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
''' + dimensions + '''
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
''', 'Revised item-level immutable manufacturing specifications, including structured six-template snapshot; no mutable product master reference.')
entity('job_order_stage', '''
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
''')
entity('material_shortage_report', '''
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
''')
entity('finished_good', '''
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
''', 'Revised client-specific repeat-product inventory; quantities and thresholds are unknown until observed. Forecast attributes are not populated.')
entity('stock_movement', '''
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
''', 'Revised single typed movement ledger; provenance, required actor/reason, unit evidence and replay identity support genuine first observations without fictitious zero.')
entity('stock_request', '''
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
''', 'Stock-request entity shown in supplied cardinality diagram and newer handoff Warehouse/Sales backlog, absent from revised text attribute sections.')
entity('stock_request_item', '''
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
''', 'Diagram request item plus Q02-approved provenance distinction; it is an immutable request-time snapshot, not a second live inventory balance.')
entity('production_plan', '''
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
''')
entity('sales_invoice', '''
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
''', 'Invoice follows PO acceptance before payment/JO in documented use cases; JO/client derive through PO, avoiding a circular mandatory JO FK.')
entity('client_receipt', '''
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
''', 'Revised proof submission, not a payment; document_id expands to client_receipt_file for explicitly documented multi-photo submissions.')
entity('payment_transaction', '''
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
''', 'Confirmed-only money, one row per partial/full payment; optional nonunique receipt FK does not impose allocation cardinality or copy attachment amounts.')
entity('delivery', '''
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
''', 'Revised delivery aggregate, many deliveries per JO. PO/invoice/client derive through JO; document numbers and signed files live in required document entities.')
entity('delivery_item', '''
  delivery_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL,
  jo_item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_delivery_item (delivery_id,jo_item_id),
  FOREIGN KEY (delivery_id) REFERENCES delivery(delivery_id),
  FOREIGN KEY (jo_item_id) REFERENCES job_order_item(jo_item_id),
  CONSTRAINT ck_delivery_item_quantity CHECK (quantity>0)
''')
entity('notification', '''
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
''')

# Only workflow-required extensions, each separately justified (not legacy tables).
entity('client_receipt_file', '''
  receipt_id BIGINT UNSIGNED NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (receipt_id,document_id),
  FOREIGN KEY (receipt_id) REFERENCES client_receipt(receipt_id),
  FOREIGN KEY (document_id) REFERENCES document(document_id)
''', 'Final.pdf scope p12 explicitly requires multi-photo receipt uploads; one submission amount is independent from the number of documents.')
entity('waybill', '''
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
''', 'Documented Warehouse generation/printing and Logistics QR verification; waybill is not a shipment or second delivery aggregate.')
entity('delivery_receipt', '''
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
''', 'Final.pdf pp47-49: Accounting generates a DR after dispatch; unlike waybill, it is a different document and responsible role.')
entity('signed_delivery_receipt', '''
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
''', 'Final.pdf pp50-51: signed DR upload/retention by Client or Logistics after delivery. Multiple retained uploads do not overwrite one file on delivery.')
entity('production_stage_event', '''
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
''', 'Backlog requires timestamped staff attribution and required reversion reason; this append-only event trail is not a second stage-state tracker.')
entity('audit_event', '''
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
''', 'Explicit inventory audit/reason and cross-role historical traceability requirements; polymorphic historical subject IDs intentionally survive lifecycle changes.')

def trigger(name, timing, operation, table, body):
    triggers.append({'name':name,'table':table,'timing':timing,'event':operation,'body':body.strip()})

# Small ownership guards enforce multiple parent paths WITHOUT copying entire
# client/inquiry/quote/PO/invoice chains into every child table.
def guard_pair(name, table, condition, message):
    for op in ('INSERT','UPDATE'):
        trigger(name + ('_bi' if op=='INSERT' else '_bu'), 'BEFORE', op, table,
                f"IF {condition} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='{message}'; END IF;")

guard_pair('client_user_role', 'client_user',
    "(SELECT r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=NEW.client_user_id)<>'Client'",
    'Portal profile requires Client role')
guard_pair('quote_item_source', 'quotation_item',
    "NEW.inquiry_item_id IS NOT NULL AND (SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id)<>(SELECT inquiry_id FROM inquiry_item WHERE inquiry_item_id=NEW.inquiry_item_id)",
    'Quotation item must belong to the same inquiry')
guard_pair('jo_item_source', 'job_order_item',
    "(SELECT p.quotation_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id WHERE j.jo_id=NEW.jo_id)<>(SELECT quotation_id FROM quotation_item WHERE quotation_item_id=NEW.quotation_item_id)",
    'JO item must reference its PO accepted quotation')
guard_pair('delivery_item_owner', 'delivery_item',
    "(SELECT jo_id FROM delivery WHERE delivery_id=NEW.delivery_id)<>(SELECT jo_id FROM job_order_item WHERE jo_item_id=NEW.jo_item_id)",
    'Delivery item must belong to the same JO')
guard_pair('shortage_stage_owner', 'material_shortage_report',
    "NEW.jo_stage_id IS NOT NULL AND NEW.jo_id<>(SELECT jo_id FROM job_order_stage WHERE jo_stage_id=NEW.jo_stage_id)",
    'Shortage stage must belong to its JO')
client_of_invoice = '(SELECT i.client_id FROM sales_invoice s JOIN purchase_order p ON p.po_id=s.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE s.invoice_id=NEW.invoice_id)'
guard_pair('receipt_client_owner', 'client_receipt',
    f"{client_of_invoice}<>(SELECT client_id FROM client_user WHERE client_user_id=NEW.client_user_id)",
    'Receipt submitter must own the invoice client')
client_of_jo = '(SELECT i.client_id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE j.jo_id=NEW.jo_id)'
guard_pair('plan_client_owner', 'production_plan',
    f"(NEW.finished_good_id IS NOT NULL AND NEW.client_id<>(SELECT client_id FROM finished_good WHERE finished_good_id=NEW.finished_good_id)) OR (NEW.jo_id IS NOT NULL AND NEW.client_id<>{client_of_jo})",
    'Production plan sources must belong to its client')
guard_pair('movement_jo_client', 'stock_movement',
    f"NEW.finished_good_id IS NOT NULL AND NEW.jo_id IS NOT NULL AND (SELECT client_id FROM finished_good WHERE finished_good_id=NEW.finished_good_id)<>{client_of_jo}",
    'Finished good and JO must belong to the same client')

# Parent identities cannot be reassigned after dependent business records exist.
# Non-key state/detail updates remain available; this protects ownership guards.
for table, field, predicate in [
    ('inquiry','client_id','EXISTS(SELECT 1 FROM quotation WHERE inquiry_id=OLD.inquiry_id)'),
    ('quotation','inquiry_id','EXISTS(SELECT 1 FROM quotation_item WHERE quotation_id=OLD.quotation_id) OR EXISTS(SELECT 1 FROM purchase_order WHERE quotation_id=OLD.quotation_id)'),
    ('inquiry_item','inquiry_id','EXISTS(SELECT 1 FROM quotation_item WHERE inquiry_item_id=OLD.inquiry_item_id)'),
    ('purchase_order','quotation_id','EXISTS(SELECT 1 FROM job_order WHERE po_id=OLD.po_id) OR EXISTS(SELECT 1 FROM sales_invoice WHERE po_id=OLD.po_id)'),
    ('job_order','po_id','EXISTS(SELECT 1 FROM job_order_item WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM delivery WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM production_plan WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM stock_movement WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM job_order_stage WHERE jo_id=OLD.jo_id) OR EXISTS(SELECT 1 FROM material_shortage_report WHERE jo_id=OLD.jo_id)'),
    ('quotation_item','quotation_id','EXISTS(SELECT 1 FROM job_order_item WHERE quotation_item_id=OLD.quotation_item_id) OR EXISTS(SELECT 1 FROM cost_estimate WHERE quotation_item_id=OLD.quotation_item_id)'),
    ('job_order_item','jo_id','EXISTS(SELECT 1 FROM delivery_item WHERE jo_item_id=OLD.jo_item_id)'),
    ('delivery','jo_id','EXISTS(SELECT 1 FROM delivery_item WHERE delivery_id=OLD.delivery_id) OR EXISTS(SELECT 1 FROM waybill WHERE delivery_id=OLD.delivery_id) OR EXISTS(SELECT 1 FROM delivery_receipt WHERE delivery_id=OLD.delivery_id)'),
    ('job_order_stage','jo_id','EXISTS(SELECT 1 FROM material_shortage_report WHERE jo_stage_id=OLD.jo_stage_id) OR EXISTS(SELECT 1 FROM production_stage_event WHERE jo_stage_id=OLD.jo_stage_id)'),
    ('finished_good','client_id','EXISTS(SELECT 1 FROM production_plan WHERE finished_good_id=OLD.finished_good_id) OR EXISTS(SELECT 1 FROM stock_movement WHERE finished_good_id=OLD.finished_good_id)'),
    ('sales_invoice','po_id','EXISTS(SELECT 1 FROM client_receipt WHERE invoice_id=OLD.invoice_id) OR EXISTS(SELECT 1 FROM payment_transaction WHERE invoice_id=OLD.invoice_id)'),
    ('client_user','client_id','EXISTS(SELECT 1 FROM client_receipt WHERE client_user_id=OLD.client_user_id) OR EXISTS(SELECT 1 FROM inquiry WHERE submitted_by_client_user_id=OLD.client_user_id)'),
]:
    trigger(f'{table}_{field}_history', 'BEFORE','UPDATE',table,
            f"IF NOT(NEW.{field}<=>OLD.{field}) AND ({predicate}) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;")

for table in ('audit_event','production_stage_event','stock_movement'):
    for op in ('UPDATE','DELETE'):
        trigger(f'{table}_append_only_{op.lower()}', 'BEFORE',op,table,
                "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Historical event is append only';")

trigger('user_account_portal_role', 'BEFORE','UPDATE','user_account',
    "IF EXISTS(SELECT 1 FROM client_user WHERE client_user_id=OLD.user_id) AND (SELECT role_name FROM role WHERE role_id=NEW.role_id)<>'Client' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Portal identity must retain Client role'; END IF;")
trigger('role_identity_history', 'BEFORE','UPDATE','role',
    "IF NOT(NEW.role_name<=>OLD.role_name) AND EXISTS(SELECT 1 FROM user_account WHERE role_id=OLD.role_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot relabel a role used by accounts'; END IF;")
trigger('raw_material_unit_history', 'BEFORE','UPDATE','raw_material',
    "IF NEW.uom_id<>OLD.uom_id AND (EXISTS(SELECT 1 FROM stock_movement WHERE raw_material_id=OLD.material_id) OR EXISTS(SELECT 1 FROM stock_request_item WHERE raw_material_id=OLD.material_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unit conversion requires separate approved reconciliation'; END IF;")
guard_pair('raw_movement_unit', 'stock_movement',
    "NEW.raw_material_id IS NOT NULL AND NEW.uom_id<>(SELECT uom_id FROM raw_material WHERE material_id=NEW.raw_material_id)",
    'Raw movement must use the recorded stock unit')

# Extra physical attributes are precision/security/provenance safeguards, not
# copied compatibility columns. All departures from revised attribute lists are
# enumerated rather than silently treated as an exact verbatim ERD.
attribute_resolution = {
 'client_user': {'email':'user_account.email','password_hash':'user_account.password_hash',
    'must_change_password':'user_account.must_change_password','status':'user_account.status',
    'last_login_at':'user_account.last_login_at','created_at':'user_account.created_at'},
 'purchase_order': {'inquiry_id':'derived quotation.inquiry_id','client_id':'derived quotation -> inquiry.client_id',
    'downpayment_required':'derived accepted quotation.requires_downpayment','downpayment_percent':'derived accepted quotation.downpayment_percent',
    'downpayment_amount':'derived accepted quotation.downpayment_amount','downpayment_confirmed':'derived confirmed invoice payment facts; no duplicate mutable flag',
    'downpayment_confirmed_date':'derived confirmed invoice payment review history; no fabricated allocation/date'},
 'job_order': {'client_id':'derived po -> quotation -> inquiry.client_id',
    'issue_sales_invoice':'omitted: invoice precedes JO in documented workflow'},
 'sales_invoice': {'jo_id':'derived job_order.po_id; no mandatory pre-JO cycle','client_id':'derived po -> quotation -> inquiry.client_id'},
 'client_receipt': {'document_id':'client_receipt_file.document_id (one logical submission, many photos)'},
 'delivery': {'po_id':'derived job_order.po_id','invoice_id':'derived sales_invoice.po_id unique relation',
    'client_id':'derived JO -> PO -> quotation -> inquiry.client_id','dr_no':'delivery_receipt.dr_no',
    'waybill_no':'waybill.waybill_no','signed_dr_document_id':'signed_delivery_receipt.document_id via delivery_receipt'},
 'document': {'file_path':'storage_key','file_path or storage_key':'storage_key'},
}
source = REFERENCE.read_text(encoding='utf-8')
source_attributes = {}
for name, block in re.findall(r'^#{2,3} (\w+)\n(.*?)(?=^#{2,3} |\Z)', source, re.M|re.S):
    attrs = re.findall(r'^- `([^`]+)`', block, re.M)
    if name in tables:
        source_attributes[name] = attrs
        for attr in attrs:
            # Narrative compound alternative is resolved explicitly above.
            if not re.search(r'(?:^|[,\n])\s*' + re.escape(attr) + r'\s+(?:BIGINT|INT|SMALLINT|VARCHAR|CHAR|TEXT|JSON|DATE|DATETIME|DECIMAL|BOOLEAN|ENUM)\b', tables[name], re.M):
                if attr not in attribute_resolution.get(name, {}):
                    raise ValueError(f'Unaccounted revised ERD attribute {name}.{attr}')

header = '''-- P2B002: revised EnterFlow ERD greenfield schema, 2026-11-22.
-- Design input: EnterFlow_ERD_Revised.md + documented project workflows ONLY.
-- No old DDL, old dictionary, P2B001 or database backup was used to author this.
-- No persistent INSERTs/reference/sample rows. FK actions are RESTRICT.
-- Target is an empty schema selected by the guarded executor; no USE/CREATE DATABASE.
-- DDL implicitly commits: stop on error, preserve evidence, never blindly rerun.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET SESSION time_zone='+00:00';
'''
sql = header + '\n\n'.join('CREATE TABLE ' + name + ' (\n' + body + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
                         for name,body in tables.items()) + '\n\nDELIMITER $$\n'
for t in triggers:
    sql += f"CREATE TRIGGER {t['name']} {t['timing']} {t['event']} ON {t['table']} FOR EACH ROW\nBEGIN\n{t['body']}\nEND$$\n\n"
sql += 'DELIMITER ;\n'
manifest = {'designAuthority': str(REFERENCE.relative_to(ROOT)),
            'tables': {name:{'justification':reasons[name],'revisedAttributes':source_attributes.get(name,[]),
                              'attributeResolution':attribute_resolution.get(name,{})} for name in tables},
            'triggers':triggers,
            'extensions':['client_receipt_file','waybill','delivery_receipt','signed_delivery_receipt','production_stage_event','audit_event']}
(OUT/'P2B002_revised_erd_greenfield.sql').write_text(sql,encoding='utf-8')
(OUT/'P2B002_design_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(f'Authored revised entities and justified workflow extensions: {len(tables)} tables. No database connection.')
