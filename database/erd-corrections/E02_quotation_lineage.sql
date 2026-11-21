-- REVIEW CANDIDATE ONLY. No historical rows are linked automatically.
-- Parent key additions deliberately use complete ownership carriers.
ALTER TABLE users ADD UNIQUE KEY uq_erd_user_client (id, client_id);
ALTER TABLE materials ADD UNIQUE KEY uq_erd_material_unit (id, unit_code);
ALTER TABLE purchase_orders
  ADD UNIQUE KEY uq_erd_po_quote (id, order_id, accepted_quotation_id);
ALTER TABLE quotation_lines
  ADD UNIQUE KEY uq_erd_quote_line_owner
    (id, quotation_id, order_id, order_item_id);
ALTER TABLE quotation_costing
  ADD COLUMN quotation_line_id BIGINT UNSIGNED NULL DEFAULT NULL,
  ADD UNIQUE KEY uq_erd_costing_line (quotation_line_id),
  ADD CONSTRAINT fk_erd_costing_line
    FOREIGN KEY (quotation_line_id, quotation_id, order_id, order_item_id)
    REFERENCES quotation_lines(id, quotation_id, order_id, order_item_id);
-- Existing NULL lineage remains unresolved. Never infer by line number/description.
