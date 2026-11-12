-- DRAFT. Apply after 001, only with approval.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE order_stages (
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_methods (
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- A quote number has one order owner; revisions may reuse it only for that order.
-- Separate ownership permits more than one number per order without inventing a
-- new numbering policy or forcing a globally unique number on each revision.
CREATE TABLE quotation_references (
  reference VARCHAR(60) NOT NULL PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_quote_reference_owner (reference, order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per revision. Sent documents and their children are immutable in the API.
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

CREATE TABLE quotation_bom_lines (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_discounts (
  quotation_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  label VARCHAR(160) NOT NULL,
  percent DECIMAL(7,4) NOT NULL,
  PRIMARY KEY (quotation_id, line_number),
  CONSTRAINT ck_quote_discount CHECK (percent BETWEEN 0 AND 100),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_addons (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE order_requests (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Locked counter row per document prefix and year; do not generate with COUNT/MAX.
CREATE TABLE document_sequences (
  document_type VARCHAR(16) NOT NULL,
  document_year SMALLINT UNSIGNED NOT NULL,
  `last_value` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (document_type, document_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations(version) VALUES ('002_orders_quotations');
