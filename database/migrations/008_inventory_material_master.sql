-- Add source-aware material identity and price provenance without touching
-- Migration 007, changing RBAC, or altering any order/BOM records.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

ALTER TABLE materials
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
  ADD CONSTRAINT fk_material_costing_price_approver FOREIGN KEY (costing_price_approved_by) REFERENCES users(id);

-- The prior NOT NULL DEFAULT 0 quantity cannot distinguish a default from a
-- verified count. Preserve existing audit events, but require a new count to
-- record any legacy zero as verified zero.
UPDATE materials SET quantity_on_hand = NULL WHERE quantity_on_hand = 0;

-- Thresholds had no supported recording workflow before this migration.
UPDATE materials SET reorder_threshold = NULL WHERE reorder_threshold = 0;

-- Legacy unit_price values have no approval provenance. Keep them intact, but
-- do not promote them to approved_costing_price or use them in new quotations.
CREATE TABLE material_import_review (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
