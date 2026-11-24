-- REVIEW ONLY — NOT APPROVED FOR EXECUTION
-- Target: MySQL 8.4 / ENTER-FLOW Phase 2
-- Allow partial Step 3 fields for draft quotations.

-- Existing constraints must be reviewed against the deployed schema
-- before preparing the executable migration.

ALTER TABLE quotation
  DROP CHECK ck_quotation_dates,
  DROP CHECK ck_quotation_money;

ALTER TABLE quotation
  MODIFY valid_until DATE NULL,
  MODIFY terms_of_payment VARCHAR(80) NULL,
  MODIFY time_of_delivery VARCHAR(255) NULL,
  MODIFY place_of_delivery TEXT NULL,
  MODIFY downpayment_percent DECIMAL(5,2) NULL,
  MODIFY downpayment_amount DECIMAL(19,2) NULL;

ALTER TABLE quotation
  ADD CONSTRAINT ck_quotation_dates CHECK (
    (valid_until IS NULL AND status = 'draft')
    OR (valid_until IS NOT NULL AND valid_until >= quotation_date)
  ),
  ADD CONSTRAINT ck_quotation_money CHECK (
    subtotal >= 0
    AND addons_total >= 0
    AND total_amount >= 0
    AND requires_downpayment = 1
    AND (
      (
        status = 'draft'
        AND downpayment_percent IS NULL
        AND downpayment_amount IS NULL
      )
      OR (
        downpayment_percent IN (20,50)
        AND downpayment_amount IS NOT NULL
        AND downpayment_amount =
          ROUND(total_amount * downpayment_percent / 100,2)
      )
    )
  ),
  ADD CONSTRAINT ck_quotation_send_fields CHECK (
    status = 'draft'
    OR (
      valid_until IS NOT NULL
      AND terms_of_payment IS NOT NULL
      AND TRIM(terms_of_payment) <> ''
      AND time_of_delivery IS NOT NULL
      AND TRIM(time_of_delivery) <> ''
      AND place_of_delivery IS NOT NULL
      AND TRIM(place_of_delivery) <> ''
      AND downpayment_percent IS NOT NULL
      AND downpayment_amount IS NOT NULL
    )
  );

-- Before execution:
-- 1. Verify deployed SHOW CREATE TABLE quotation.
-- 2. Verify existing statuses and historical records.
-- 3. Confirm read APIs, frontend restore behavior, and transitions.
-- 4. Prepare rollback and migration approval.