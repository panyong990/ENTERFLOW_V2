-- REVIEW ONLY: isolated synthetic fixture schema, NOT a migration or baseline.
-- No ledger table/marker, application data, held file or real database input.

-- roles; source 001_identity_catalog.sql
CREATE TABLE roles (
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- modules; source 001_identity_catalog.sql
CREATE TABLE modules (
  code VARCHAR(40) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- role_modules; source 001_identity_catalog.sql
CREATE TABLE role_modules (
  role_code VARCHAR(24) NOT NULL,
  module_code VARCHAR(40) NOT NULL,
  PRIMARY KEY (role_code, module_code),
  FOREIGN KEY (role_code) REFERENCES roles(code),
  FOREIGN KEY (module_code) REFERENCES modules(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payment_terms; source 001_identity_catalog.sql
CREATE TABLE payment_terms (
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  days_after_receipt SMALLINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- clients; source 001_identity_catalog.sql
CREATE TABLE clients (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- users; source 001_identity_catalog.sql
CREATE TABLE users (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- client_applications; source 001_identity_catalog.sql
CREATE TABLE client_applications (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- filter_types; source 001_identity_catalog.sql
CREATE TABLE filter_types (
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  template_group VARCHAR(24) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- product_specifications; source 001_identity_catalog.sql
CREATE TABLE product_specifications (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- order_stages; source 002_orders_quotations.sql
CREATE TABLE order_stages (
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- delivery_methods; source 002_orders_quotations.sql
CREATE TABLE delivery_methods (
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- orders; source 002_orders_quotations.sql
CREATE TABLE orders (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- order_items; source 002_orders_quotations.sql
CREATE TABLE order_items (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- quotation_references; source 002_orders_quotations.sql
CREATE TABLE quotation_references (
  reference VARCHAR(60) NOT NULL PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_quote_reference_owner (reference, order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- quotations; source 002_orders_quotations.sql
CREATE TABLE quotations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- quotation_lines; source 002_orders_quotations.sql
CREATE TABLE quotation_lines (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- quotation_costing; source 002_orders_quotations.sql
CREATE TABLE quotation_costing (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- purchase_orders; source 002_orders_quotations.sql
CREATE TABLE purchase_orders (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- production_stages; source 003_operations_billing.sql
CREATE TABLE production_stages (
  position SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  CONSTRAINT ck_production_position CHECK (position BETWEEN 0 AND 8)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- replacement_requests; source 003_operations_billing.sql
CREATE TABLE replacement_requests (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- job_orders; source 003_operations_billing.sql
CREATE TABLE job_orders (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- shipments; source 003_operations_billing.sql
CREATE TABLE shipments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- invoices; source 003_operations_billing.sql
CREATE TABLE invoices (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payments; source 003_operations_billing.sql
CREATE TABLE payments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- notifications; source 003_operations_billing.sql
CREATE TABLE notifications (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- notification_recipients; source 003_operations_billing.sql
CREATE TABLE notification_recipients (
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME(3) NULL,
  dismissed_at DATETIME(3) NULL,
  PRIMARY KEY (notification_id, user_id),
  KEY ix_user_notifications (user_id, dismissed_at, read_at),
  FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- audit_events; source 004_attachments_audit.sql
CREATE TABLE audit_events (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_sessions; source 005_user_sessions.sql
CREATE TABLE user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_activity_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_user_sessions_token_hash (token_hash),
  KEY ix_user_sessions_user_id (user_id),
  KEY ix_user_sessions_expires_at (expires_at),

  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
  ADD CONSTRAINT uq_user_client_account
  UNIQUE (client_id);
