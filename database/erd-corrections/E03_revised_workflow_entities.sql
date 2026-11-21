-- REVIEW CANDIDATE ONLY; requires E02 and exact reconciled parent definitions.
-- Empty target entities for an approved expand/transfer/cutover sequence.
-- No INSERT/UPDATE/DELETE, automatic balances, seed stages or historical inference.
-- Existing job_orders contains product-level legacy rows, not these JO headers.
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
  legacy_job_order_id BIGINT UNSIGNED NULL,
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
  filtration_rating VARCHAR(120) NULL, others TEXT NULL, notes TEXT NULL,
  final_sketch_file_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_erd_jo_item_line (job_order_id, line_number),
  UNIQUE KEY uq_erd_jo_item_pair (id, job_order_id),
  UNIQUE KEY uq_erd_legacy_jo_item (legacy_job_order_id),
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
  legacy_payment_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_erd_receipt_operation (idempotency_key),
  UNIQUE KEY uq_erd_receipt_owner (id, invoice_id, order_id, client_id),
  UNIQUE KEY uq_erd_receipt_legacy (legacy_payment_id),
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
  legacy_payment_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_erd_transaction_operation (idempotency_key),
  UNIQUE KEY uq_erd_transaction_legacy (legacy_payment_id),
  KEY ix_erd_transaction_invoice (invoice_id, paid_on),
  FOREIGN KEY (invoice_id, order_id) REFERENCES invoices(id, order_id),
  FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (client_receipt_id, invoice_id, order_id, client_id)
    REFERENCES client_receipt(id, invoice_id, order_id, client_id),
  FOREIGN KEY (recorded_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
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
  legacy_shipment_id BIGINT UNSIGNED NULL,
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
  updated_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NULL DEFAULT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_erd_delivery_legacy (legacy_shipment_id),
  UNIQUE KEY uq_erd_delivery_order (id, order_id),
  UNIQUE KEY uq_erd_delivery_job (id, job_order_id),
  KEY ix_erd_delivery_queue (status, estimated_delivery_date),
  FOREIGN KEY (job_order_id, order_id) REFERENCES job_order(id, order_id),
  FOREIGN KEY (delivery_method_code) REFERENCES delivery_methods(code),
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
