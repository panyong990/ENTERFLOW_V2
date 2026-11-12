-- DRAFT. Apply after 002, only with approval.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE production_stages (
  position SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  CONSTRAINT ck_production_position CHECK (position BETWEEN 0 AND 8)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- Multiple JOs per inquiry use real children rather than cloned Inquiry rows.
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

CREATE TABLE job_bom_lines (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE production_events (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_movements (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_changes (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE finished_goods (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE finished_good_movements (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Explicit match replaces brittle client-name / OEM-text matching for analytics.
CREATE TABLE finished_good_order_items (
  finished_good_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (finished_good_id, order_item_id),
  FOREIGN KEY (finished_good_id, client_id) REFERENCES finished_goods(id, client_id),
  FOREIGN KEY (order_item_id, client_id) REFERENCES order_items(id, client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_requests (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_request_lines (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_responses (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_response_lines (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_stock_responses (
  quotation_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  stock_response_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (quotation_id, order_id) REFERENCES quotations(id, order_id),
  FOREIGN KEY (stock_response_id, order_id) REFERENCES stock_responses(id, order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE waybills (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE shipment_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(80) NOT NULL,
  note TEXT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_shipment_events (shipment_id, occurred_at),
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_receipts (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE signed_delivery_receipts (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- Supports the billing receipt basis without silently selecting first/last split JO.
CREATE TABLE invoice_delivery_receipts (
  invoice_id BIGINT UNSIGNED NOT NULL,
  signed_delivery_receipt_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  accepted_slot SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (invoice_id, signed_delivery_receipt_id),
  CONSTRAINT ck_invoice_receipt_accepted CHECK (accepted_slot = 1),
  FOREIGN KEY (invoice_id, order_id) REFERENCES invoices(id, order_id),
  FOREIGN KEY (signed_delivery_receipt_id, order_id, accepted_slot)
    REFERENCES signed_delivery_receipts(id, order_id, accepted_slot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order FK permits pre-invoice downpayments; invoice FK may be assigned later.
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

CREATE TABLE payment_instructions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE company_settings (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE company_payment_methods (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_settings_id SMALLINT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  type ENUM('bank_transfer','gcash','cash','check','other') NOT NULL,
  details TEXT NOT NULL,
  FOREIGN KEY (company_settings_id) REFERENCES company_settings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE notification_roles (
  notification_id BIGINT UNSIGNED NOT NULL,
  role_code VARCHAR(24) NOT NULL,
  PRIMARY KEY (notification_id, role_code),
  FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (role_code) REFERENCES roles(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API snapshots authorized recipients at send time; read/delete is per user.
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

INSERT INTO schema_migrations(version) VALUES ('003_operations_billing');
