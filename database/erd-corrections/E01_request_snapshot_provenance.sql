-- REVIEW CANDIDATE ONLY. Not registered with the historical migration runner.
-- Require reconciled metadata, D01 disposition, backup and operator approval.
-- MySQL DDL commits implicitly. Do not use --force or replay this file.
-- NULL provenance means legacy/unrecorded, never a verified observation.
ALTER TABLE stock_request_lines
  ADD COLUMN quantity_status_at_request
    ENUM('unknown','provisional_sample','verified') NULL DEFAULT NULL,
  ADD CONSTRAINT ck_request_provenance CHECK (
    quantity_status_at_request IS NULL
    OR (quantity_status_at_request = 'verified'
        AND stock_at_request IS NOT NULL AND shortage_at_request IS NOT NULL
        AND shortage_at_request = GREATEST(required_quantity - stock_at_request, 0))
    OR (quantity_status_at_request IN ('unknown','provisional_sample')
        AND stock_at_request IS NULL AND shortage_at_request IS NULL)
  );
