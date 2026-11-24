-- PROPOSAL ONLY - DO NOT APPLY TO SHARED DATABASE
-- Support incomplete Step 3 fields for quotation status=draft.
-- Existing finalized quotation rows remain unchanged.

ALTER TABLE quotation
  MODIFY valid_until DATE NULL,
  MODIFY terms_of_payment VARCHAR(80) NULL,
  MODIFY time_of_delivery VARCHAR(255) NULL,
  MODIFY place_of_delivery TEXT NULL,
  MODIFY downpayment_percent DECIMAL(5,2) NULL,
  MODIFY downpayment_amount DECIMAL(19,2) NULL;

-- Allow incomplete fields only for drafts.
-- Non-drafts must retain the existing 20%/50% downpayment rule.
-- This requires reviewing all existing quotation statuses and
-- their transition rules before applying.

ALTER TABLE quotation
  DROP CHECK ck_quotation_dates,
  ADD CONSTRAINT ck_quotation_dates CHECK (
    status = 'draft'
    OR (valid_until IS NOT NULL AND valid_until >= quotation_date)
  );

-- The existing ck_quotation_money must also be revised
-- in the final migration, after confirming the actual deployed
-- constraint and historical quotation statuses.
-- No live migration should use this proposal as-is.