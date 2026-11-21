-- OPERATOR-ONLY read-only post-expansion evidence; never invoked by Codex.
-- Run only after approved E01-E03 on an approved isolated restoration.
-- No migration ledger, credentials, sessions or file contents are queried.
SELECT table_name, column_name, ordinal_position, column_type, is_nullable,
       column_default, extra, collation_name
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name IN
 ('stock_request_lines','quotation_costing','job_order','job_order_item',
  'job_order_stage','material_shortage_report','production_plan',
  'client_receipt','client_receipt_file','payment_transaction',
  'stock_movement','delivery','delivery_item')
ORDER BY table_name, ordinal_position;

SELECT table_name, index_name, non_unique, seq_in_index, column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name IN
 ('users','materials','purchase_orders','quotation_lines','quotation_costing',
  'job_order','job_order_item','job_order_stage','material_shortage_report',
  'production_plan','client_receipt','client_receipt_file','payment_transaction',
  'stock_movement','delivery','delivery_item')
ORDER BY table_name, index_name, seq_in_index;

SELECT k.table_name, k.constraint_name, k.column_name, k.ordinal_position,
       k.referenced_table_name, k.referenced_column_name,
       r.update_rule, r.delete_rule
FROM information_schema.key_column_usage k
JOIN information_schema.referential_constraints r
 ON r.constraint_schema=k.constraint_schema AND r.table_name=k.table_name
 AND r.constraint_name=k.constraint_name
WHERE k.constraint_schema=DATABASE() AND k.table_name IN
 ('quotation_costing','job_order','job_order_item','job_order_stage',
  'material_shortage_report','production_plan','client_receipt',
  'client_receipt_file','payment_transaction','stock_movement','delivery','delivery_item')
ORDER BY k.table_name,k.constraint_name,k.ordinal_position;

SELECT t.table_name, c.constraint_name, c.check_clause, t.enforced
FROM information_schema.table_constraints t
JOIN information_schema.check_constraints c
 ON c.constraint_schema=t.constraint_schema AND c.constraint_name=t.constraint_name
WHERE t.constraint_schema=DATABASE() AND t.table_name IN
 ('stock_request_lines','job_order','job_order_item','job_order_stage',
  'material_shortage_report','production_plan','client_receipt',
  'payment_transaction','stock_movement','delivery_item')
ORDER BY t.table_name,c.constraint_name;

SELECT 'job_order' AS entity, COUNT(*) AS target_rows FROM job_order
UNION ALL SELECT 'job_order_item',COUNT(*) FROM job_order_item
UNION ALL SELECT 'job_order_stage',COUNT(*) FROM job_order_stage
UNION ALL SELECT 'material_shortage_report',COUNT(*) FROM material_shortage_report
UNION ALL SELECT 'production_plan',COUNT(*) FROM production_plan
UNION ALL SELECT 'client_receipt',COUNT(*) FROM client_receipt
UNION ALL SELECT 'client_receipt_file',COUNT(*) FROM client_receipt_file
UNION ALL SELECT 'payment_transaction',COUNT(*) FROM payment_transaction
UNION ALL SELECT 'stock_movement',COUNT(*) FROM stock_movement
UNION ALL SELECT 'delivery',COUNT(*) FROM delivery
UNION ALL SELECT 'delivery_item',COUNT(*) FROM delivery_item;

SELECT COUNT(*) AS unclassified_request_snapshots
FROM stock_request_lines WHERE quantity_status_at_request IS NULL;
SELECT COUNT(*) AS unresolved_costing_lineage
FROM quotation_costing WHERE quotation_line_id IS NULL;
-- These counts are unresolved populations, not permission to fill them.
