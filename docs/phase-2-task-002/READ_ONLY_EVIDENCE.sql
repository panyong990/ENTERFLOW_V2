-- ENTER-FLOW V2 Phase 2 Task 002 read-only operator evidence package
-- Prepared 2026-11-21 Asia/Singapore. NOT EXECUTED by Codex.
-- Read README.md before use. No new connection method or credentials are supplied.
-- Replace EVERY __APPROVED_DATABASE__ token with the operator-approved database
-- name using only [a-z][a-z0-9_]{0,63}. Do not substitute a historical name by guess.
-- Select that database in the existing authorized client before running M00.
-- This file contains SELECT / WITH queries only, no automatically executed SQL.
-- M00-M10 inspect metadata; C/F/K/P sections EMIT query text, not record results.
-- Review READY query text and the current metadata, then execute selected emitted
-- statements manually. Never pipe, batch-replay or automatically execute output.
-- Both migration ledgers, protected artifacts and private values are excluded.
-- No locking reads, stored function calls, connection changes, schema dumps,
-- migration CLI, mutation, object-storage access or EXPLAIN ANALYZE.
-- Ordinary SELECTs can still consume resources: run one section at a time.
-- STOP on wrong target, version, insufficient visibility, truncation or SQL error.

-- M00: target identity and settings; first result must say READY_FOR_METADATA.
-- This is a display/selection check, not cryptographic target attestation.
SELECT 'M00' AS evidence_id,UTC_TIMESTAMP(3) AS captured_at_utc,
       DATABASE() AS selected_database,VERSION() AS server_version,
       CASE WHEN BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
            THEN 'READY_FOR_METADATA' ELSE 'STOP_TARGET_OR_VERSION' END AS operator_gate,
       @@session.sql_mode AS session_sql_mode,@@global.sql_mode AS global_sql_mode,
       @@session.time_zone AS session_time_zone,@@global.time_zone AS global_time_zone,
       @@system_time_zone AS system_time_zone,@@lower_case_table_names AS lower_case_table_names,
       @@character_set_connection AS connection_charset,@@collation_connection AS connection_collation,
       @@auto_increment_increment AS auto_increment_increment,
       @@auto_increment_offset AS auto_increment_offset,
       @@group_concat_max_len AS generator_concat_limit;

-- M01: database defaults. Missing output can mean wrong selection or visibility.
SELECT 'M01' AS evidence_id,SCHEMA_NAME,DEFAULT_CHARACTER_SET_NAME,DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=DATABASE() AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]';

-- M02: deployed object inventory; no approximate row statistics.
-- Ledger objects are intentionally excluded, not classified as missing.
SELECT 'M02' AS evidence_id,TABLE_NAME,TABLE_TYPE,ENGINE,TABLE_COLLATION,AUTO_INCREMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE() AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
  AND TABLE_NAME NOT IN ('schema_migrations','_enterflow_migration_history')
ORDER BY TABLE_NAME;

-- M03: compare 71 known non-ledger names with visible deployed objects.
-- MISSING_OR_NOT_VISIBLE is not proof of absence when metadata privileges are limited.
WITH known_tables AS (
  SELECT 'roles' AS table_name
  UNION ALL SELECT 'modules'
  UNION ALL SELECT 'role_modules'
  UNION ALL SELECT 'payment_terms'
  UNION ALL SELECT 'clients'
  UNION ALL SELECT 'users'
  UNION ALL SELECT 'client_applications'
  UNION ALL SELECT 'filter_types'
  UNION ALL SELECT 'product_specifications'
  UNION ALL SELECT 'material_categories'
  UNION ALL SELECT 'units'
  UNION ALL SELECT 'materials'
  UNION ALL SELECT 'bom_templates'
  UNION ALL SELECT 'bom_template_lines'
  UNION ALL SELECT 'files'
  UNION ALL SELECT 'order_stages'
  UNION ALL SELECT 'delivery_methods'
  UNION ALL SELECT 'orders'
  UNION ALL SELECT 'order_items'
  UNION ALL SELECT 'quotation_references'
  UNION ALL SELECT 'quotations'
  UNION ALL SELECT 'quotation_lines'
  UNION ALL SELECT 'quotation_costing'
  UNION ALL SELECT 'quotation_bom_lines'
  UNION ALL SELECT 'quotation_discounts'
  UNION ALL SELECT 'quotation_addons'
  UNION ALL SELECT 'purchase_orders'
  UNION ALL SELECT 'order_requests'
  UNION ALL SELECT 'document_sequences'
  UNION ALL SELECT 'production_stages'
  UNION ALL SELECT 'replacement_requests'
  UNION ALL SELECT 'job_orders'
  UNION ALL SELECT 'job_bom_lines'
  UNION ALL SELECT 'production_events'
  UNION ALL SELECT 'material_movements'
  UNION ALL SELECT 'material_changes'
  UNION ALL SELECT 'finished_goods'
  UNION ALL SELECT 'finished_good_movements'
  UNION ALL SELECT 'finished_good_order_items'
  UNION ALL SELECT 'stock_requests'
  UNION ALL SELECT 'stock_request_lines'
  UNION ALL SELECT 'stock_responses'
  UNION ALL SELECT 'stock_response_lines'
  UNION ALL SELECT 'quotation_stock_responses'
  UNION ALL SELECT 'shipments'
  UNION ALL SELECT 'waybills'
  UNION ALL SELECT 'shipment_events'
  UNION ALL SELECT 'delivery_receipts'
  UNION ALL SELECT 'signed_delivery_receipts'
  UNION ALL SELECT 'invoices'
  UNION ALL SELECT 'invoice_delivery_receipts'
  UNION ALL SELECT 'payments'
  UNION ALL SELECT 'payment_instructions'
  UNION ALL SELECT 'company_settings'
  UNION ALL SELECT 'company_payment_methods'
  UNION ALL SELECT 'notifications'
  UNION ALL SELECT 'notification_roles'
  UNION ALL SELECT 'notification_recipients'
  UNION ALL SELECT 'order_files'
  UNION ALL SELECT 'specification_files'
  UNION ALL SELECT 'quotation_files'
  UNION ALL SELECT 'purchase_order_files'
  UNION ALL SELECT 'job_order_files'
  UNION ALL SELECT 'payment_files'
  UNION ALL SELECT 'invoice_files'
  UNION ALL SELECT 'waybill_files'
  UNION ALL SELECT 'delivery_receipt_files'
  UNION ALL SELECT 'replacement_request_files'
  UNION ALL SELECT 'audit_events'
  UNION ALL SELECT 'material_import_review'
  UNION ALL SELECT 'user_sessions'
),
visible AS (SELECT TABLE_NAME,TABLE_TYPE FROM information_schema.TABLES
 WHERE TABLE_SCHEMA=DATABASE() AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
 AND TABLE_NAME NOT IN ('schema_migrations','_enterflow_migration_history'))
SELECT 'M03' AS evidence_id,k.table_name AS object_name,v.TABLE_TYPE,
 CASE WHEN v.TABLE_NAME IS NULL THEN 'MISSING_OR_NOT_VISIBLE'
      WHEN v.TABLE_TYPE<>'BASE TABLE' THEN 'EXPECTED_TABLE_IS_OTHER_OBJECT'
      ELSE 'PRESENT' END AS reconciliation
FROM known_tables k LEFT JOIN visible v ON BINARY v.TABLE_NAME=BINARY k.table_name
WHERE BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
UNION ALL
SELECT 'M03',v.TABLE_NAME,v.TABLE_TYPE,'UNEXPECTED_REQUIRES_METADATA_REVIEW'
FROM visible v LEFT JOIN known_tables k ON BINARY v.TABLE_NAME=BINARY k.table_name
WHERE k.table_name IS NULL
ORDER BY object_name;

-- M04: exact visible column shape, defaults, generated and auto-increment attributes.
SELECT 'M04' AS evidence_id,TABLE_NAME,ORDINAL_POSITION,COLUMN_NAME,DATA_TYPE,COLUMN_TYPE,
 CHARACTER_MAXIMUM_LENGTH,NUMERIC_PRECISION,NUMERIC_SCALE,DATETIME_PRECISION,
 IS_NULLABLE,
 CASE WHEN LOWER(COLUMN_NAME) REGEXP 'password|token|object_path|checksum|sha256|account_number'
      THEN '[REDACTED_SENSITIVE_DEFAULT]' ELSE COLUMN_DEFAULT END AS COLUMN_DEFAULT,
 EXTRA,CHARACTER_SET_NAME,COLLATION_NAME,
 CASE WHEN LOWER(COLUMN_NAME) REGEXP 'password|token|object_path|checksum|sha256|account_number'
      THEN '[REDACTED_SENSITIVE_EXPRESSION]' ELSE GENERATION_EXPRESSION END AS GENERATION_EXPRESSION
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
 AND TABLE_NAME NOT IN ('schema_migrations','_enterflow_migration_history')
ORDER BY TABLE_NAME,ORDINAL_POSITION;

-- M05: indexes, ordered columns, prefixes, direction, visibility and expressions.
-- Compare full signatures; a useful left prefix is not automatically redundant.
SELECT 'M05' AS evidence_id,TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,
 COLUMN_NAME,SUB_PART,COLLATION,INDEX_TYPE,IS_VISIBLE,EXPRESSION
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA=DATABASE() AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
 AND TABLE_NAME NOT IN ('schema_migrations','_enterflow_migration_history')
ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX;

-- M06: declared constraints and enforcement; no ledger rows are read.
SELECT 'M06' AS evidence_id,TABLE_NAME,CONSTRAINT_NAME,CONSTRAINT_TYPE,ENFORCED
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA=DATABASE() AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
 AND TABLE_NAME NOT IN ('schema_migrations','_enterflow_migration_history')
ORDER BY TABLE_NAME,CONSTRAINT_TYPE,CONSTRAINT_NAME;

-- M07: complete ordered key carriers and referenced keys.
SELECT 'M07' AS evidence_id,k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION,
 k.COLUMN_NAME,k.POSITION_IN_UNIQUE_CONSTRAINT,k.REFERENCED_TABLE_SCHEMA,
 k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.UNIQUE_CONSTRAINT_NAME,
 r.MATCH_OPTION,r.UPDATE_RULE,r.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE k
LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS r
 ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME
 AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
WHERE k.TABLE_SCHEMA=DATABASE() AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
 AND k.TABLE_NAME NOT IN ('schema_migrations','_enterflow_migration_history')
 AND (k.REFERENCED_TABLE_NAME IS NULL OR k.REFERENCED_TABLE_NAME NOT IN ('schema_migrations','_enterflow_migration_history'))
ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION;

-- M08: CHECK expressions; review NULL behavior and state coverage.
SELECT 'M08' AS evidence_id,t.TABLE_NAME,t.CONSTRAINT_NAME,t.ENFORCED,c.CHECK_CLAUSE
FROM information_schema.TABLE_CONSTRAINTS t
JOIN information_schema.CHECK_CONSTRAINTS c
 ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME
WHERE t.CONSTRAINT_SCHEMA=DATABASE() AND t.CONSTRAINT_TYPE='CHECK' AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
 AND t.TABLE_NAME NOT IN ('schema_migrations','_enterflow_migration_history')
ORDER BY t.TABLE_NAME,t.CONSTRAINT_NAME;

-- M09: unexpected execution-capable objects, names and association only.
-- Definitions/bodies are intentionally not retrieved. Do not call routines.
SELECT 'M09' AS evidence_id,'TRIGGER' AS object_kind,TRIGGER_NAME AS object_name,
 EVENT_OBJECT_TABLE AS associated_table,ACTION_TIMING AS detail
FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
 AND EVENT_OBJECT_TABLE NOT IN ('schema_migrations','_enterflow_migration_history')
UNION ALL
SELECT 'M09',ROUTINE_TYPE,ROUTINE_NAME,NULL,DATA_TYPE
FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
UNION ALL
SELECT 'M09','EVENT',EVENT_NAME,NULL,STATUS
FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE() AND BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
ORDER BY object_kind,object_name;

-- M10: required lookup vocabulary only; emitted through the P gate below as P43.
-- No roles/lookup data are read directly before their deployed columns are known.

-- C: exact business-table count QUERY GENERATOR.
-- Only known, visible BASE TABLE names are eligible. Extra tables require review.
WITH known_tables AS (
  SELECT 'roles' AS table_name
  UNION ALL SELECT 'modules'
  UNION ALL SELECT 'role_modules'
  UNION ALL SELECT 'payment_terms'
  UNION ALL SELECT 'clients'
  UNION ALL SELECT 'users'
  UNION ALL SELECT 'client_applications'
  UNION ALL SELECT 'filter_types'
  UNION ALL SELECT 'product_specifications'
  UNION ALL SELECT 'material_categories'
  UNION ALL SELECT 'units'
  UNION ALL SELECT 'materials'
  UNION ALL SELECT 'bom_templates'
  UNION ALL SELECT 'bom_template_lines'
  UNION ALL SELECT 'files'
  UNION ALL SELECT 'order_stages'
  UNION ALL SELECT 'delivery_methods'
  UNION ALL SELECT 'orders'
  UNION ALL SELECT 'order_items'
  UNION ALL SELECT 'quotation_references'
  UNION ALL SELECT 'quotations'
  UNION ALL SELECT 'quotation_lines'
  UNION ALL SELECT 'quotation_costing'
  UNION ALL SELECT 'quotation_bom_lines'
  UNION ALL SELECT 'quotation_discounts'
  UNION ALL SELECT 'quotation_addons'
  UNION ALL SELECT 'purchase_orders'
  UNION ALL SELECT 'order_requests'
  UNION ALL SELECT 'document_sequences'
  UNION ALL SELECT 'production_stages'
  UNION ALL SELECT 'replacement_requests'
  UNION ALL SELECT 'job_orders'
  UNION ALL SELECT 'job_bom_lines'
  UNION ALL SELECT 'production_events'
  UNION ALL SELECT 'material_movements'
  UNION ALL SELECT 'material_changes'
  UNION ALL SELECT 'finished_goods'
  UNION ALL SELECT 'finished_good_movements'
  UNION ALL SELECT 'finished_good_order_items'
  UNION ALL SELECT 'stock_requests'
  UNION ALL SELECT 'stock_request_lines'
  UNION ALL SELECT 'stock_responses'
  UNION ALL SELECT 'stock_response_lines'
  UNION ALL SELECT 'quotation_stock_responses'
  UNION ALL SELECT 'shipments'
  UNION ALL SELECT 'waybills'
  UNION ALL SELECT 'shipment_events'
  UNION ALL SELECT 'delivery_receipts'
  UNION ALL SELECT 'signed_delivery_receipts'
  UNION ALL SELECT 'invoices'
  UNION ALL SELECT 'invoice_delivery_receipts'
  UNION ALL SELECT 'payments'
  UNION ALL SELECT 'payment_instructions'
  UNION ALL SELECT 'company_settings'
  UNION ALL SELECT 'company_payment_methods'
  UNION ALL SELECT 'notifications'
  UNION ALL SELECT 'notification_roles'
  UNION ALL SELECT 'notification_recipients'
  UNION ALL SELECT 'order_files'
  UNION ALL SELECT 'specification_files'
  UNION ALL SELECT 'quotation_files'
  UNION ALL SELECT 'purchase_order_files'
  UNION ALL SELECT 'job_order_files'
  UNION ALL SELECT 'payment_files'
  UNION ALL SELECT 'invoice_files'
  UNION ALL SELECT 'waybill_files'
  UNION ALL SELECT 'delivery_receipt_files'
  UNION ALL SELECT 'replacement_request_files'
  UNION ALL SELECT 'audit_events'
  UNION ALL SELECT 'material_import_review'
  UNION ALL SELECT 'user_sessions'
)
SELECT CONCAT('C:',k.table_name) AS evidence_id,
 CASE WHEN t.TABLE_NAME IS NULL THEN 'BLOCKED_MISSING_OR_NOT_VISIBLE'
      WHEN t.TABLE_TYPE<>'BASE TABLE' THEN 'BLOCKED_NOT_BASE_TABLE' ELSE 'READY' END AS status,
 CASE WHEN t.TABLE_TYPE='BASE TABLE' THEN CONCAT(
 'SELECT ',QUOTE(CONCAT('C:',k.table_name)), ' AS evidence_id,DATABASE() AS evidence_database,UTC_TIMESTAMP(3) AS captured_at_utc,r.* FROM (SELECT COUNT(*) AS exact_rows FROM ',
 CHAR(96),'__APPROVED_DATABASE__',CHAR(96),'.',CHAR(96),REPLACE(k.table_name,CHAR(96),CONCAT(CHAR(96),CHAR(96))),CHAR(96),
 ') r WHERE BINARY DATABASE()=BINARY ',QUOTE('__APPROVED_DATABASE__'),';') END AS ready_sql
FROM known_tables k LEFT JOIN information_schema.TABLES t
 ON t.TABLE_SCHEMA=DATABASE() AND BINARY t.TABLE_NAME=BINARY k.table_name
WHERE BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
ORDER BY k.table_name;

-- F: expected relationship QUERY GENERATOR.
-- All source relationships are checked even when no deployed FK enforces them.
-- Session-to-user is labelled service-inferred, not an established source DDL.
-- Only confirmed visible column pairs and BASE TABLEs yield runnable statements.
-- Partial NULL carriers can be legitimate optional composite FKs.
WITH expected_edges(edge_id,child_table,parent_table,pairs,basis) AS (
 SELECT 'F001','role_modules','roles',CAST('[{"child":"role_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F002','role_modules','modules',CAST('[{"child":"module_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F003','clients','payment_terms',CAST('[{"child":"payment_term_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F004','users','roles',CAST('[{"child":"role_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F005','users','clients',CAST('[{"child":"client_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F006','client_applications','users',CAST('[{"child":"decided_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F007','client_applications','clients',CAST('[{"child":"approved_client_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F008','product_specifications','clients',CAST('[{"child":"client_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F009','product_specifications','filter_types',CAST('[{"child":"filter_type_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F010','materials','material_categories',CAST('[{"child":"category_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F011','materials','units',CAST('[{"child":"unit_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F012','bom_templates','filter_types',CAST('[{"child":"filter_type_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F013','bom_templates','users',CAST('[{"child":"created_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F014','bom_template_lines','bom_templates',CAST('[{"child":"template_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F015','bom_template_lines','materials',CAST('[{"child":"material_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F016','files','users',CAST('[{"child":"uploaded_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F017','orders','clients',CAST('[{"child":"client_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F018','orders','order_stages',CAST('[{"child":"stage_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F019','orders','payment_terms',CAST('[{"child":"payment_term_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F020','orders','delivery_methods',CAST('[{"child":"delivery_method_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F021','orders','users',CAST('[{"child":"created_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F022','orders','users',CAST('[{"child":"archived_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F023','orders','orders',CAST('[{"child":"reorder_source_id","parent":"id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F024','order_items','orders',CAST('[{"child":"order_id","parent":"id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F025','order_items','product_specifications',CAST('[{"child":"specification_id","parent":"id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F026','quotation_references','orders',CAST('[{"child":"order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F027','quotations','quotation_references',CAST('[{"child":"reference","parent":"reference"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F028','quotations','payment_terms',CAST('[{"child":"payment_term_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F029','quotations','users',CAST('[{"child":"prepared_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F030','quotations','users',CAST('[{"child":"sent_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F031','quotation_lines','quotations',CAST('[{"child":"quotation_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F032','quotation_lines','order_items',CAST('[{"child":"order_item_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F033','quotation_costing','quotations',CAST('[{"child":"quotation_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F034','quotation_costing','order_items',CAST('[{"child":"order_item_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F035','quotation_bom_lines','quotation_costing',CAST('[{"child":"costing_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F036','quotation_bom_lines','materials',CAST('[{"child":"material_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F037','quotation_discounts','quotations',CAST('[{"child":"quotation_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F038','quotation_addons','quotations',CAST('[{"child":"quotation_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F039','quotation_addons','materials',CAST('[{"child":"material_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F040','purchase_orders','orders',CAST('[{"child":"order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F041','purchase_orders','quotations',CAST('[{"child":"accepted_quotation_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F042','purchase_orders','users',CAST('[{"child":"uploaded_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F043','purchase_orders','users',CAST('[{"child":"received_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F044','purchase_orders','users',CAST('[{"child":"cleared_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F045','order_requests','orders',CAST('[{"child":"order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F046','order_requests','users',CAST('[{"child":"requested_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F047','order_requests','users',CAST('[{"child":"decided_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F048','replacement_requests','orders',CAST('[{"child":"order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F049','replacement_requests','users',CAST('[{"child":"requested_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F050','replacement_requests','users',CAST('[{"child":"resolved_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F051','job_orders','order_items',CAST('[{"child":"order_item_id","parent":"id"},{"child":"order_id","parent":"order_id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F052','job_orders','product_specifications',CAST('[{"child":"specification_id","parent":"id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F053','job_orders','replacement_requests',CAST('[{"child":"replacement_request_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F054','job_orders','quotation_costing',CAST('[{"child":"costing_id","parent":"id"},{"child":"order_item_id","parent":"order_item_id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F055','job_orders','users',CAST('[{"child":"created_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F056','job_bom_lines','job_orders',CAST('[{"child":"job_order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F057','job_bom_lines','materials',CAST('[{"child":"material_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F058','production_events','job_orders',CAST('[{"child":"job_order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F059','production_events','production_stages',CAST('[{"child":"stage_position","parent":"position"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F060','production_events','users',CAST('[{"child":"performed_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F061','material_movements','materials',CAST('[{"child":"material_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F062','material_movements','job_orders',CAST('[{"child":"job_order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F063','material_movements','users',CAST('[{"child":"performed_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F064','material_changes','materials',CAST('[{"child":"material_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F065','material_changes','users',CAST('[{"child":"performed_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F066','finished_goods','clients',CAST('[{"child":"client_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F067','finished_goods','product_specifications',CAST('[{"child":"specification_id","parent":"id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F068','finished_goods','users',CAST('[{"child":"updated_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F069','finished_good_movements','finished_goods',CAST('[{"child":"finished_good_id","parent":"id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F070','finished_good_movements','job_orders',CAST('[{"child":"job_order_id","parent":"id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F071','finished_good_movements','users',CAST('[{"child":"performed_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F072','finished_good_order_items','finished_goods',CAST('[{"child":"finished_good_id","parent":"id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F073','finished_good_order_items','order_items',CAST('[{"child":"order_item_id","parent":"id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F074','stock_requests','orders',CAST('[{"child":"order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F075','stock_requests','users',CAST('[{"child":"requested_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F076','stock_request_lines','stock_requests',CAST('[{"child":"stock_request_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F077','stock_request_lines','materials',CAST('[{"child":"material_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F078','stock_responses','stock_requests',CAST('[{"child":"stock_request_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F079','stock_responses','users',CAST('[{"child":"responded_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F080','stock_response_lines','stock_responses',CAST('[{"child":"stock_response_id","parent":"id"},{"child":"stock_request_id","parent":"stock_request_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F081','stock_response_lines','stock_request_lines',CAST('[{"child":"stock_request_line_id","parent":"id"},{"child":"stock_request_id","parent":"stock_request_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F082','quotation_stock_responses','quotations',CAST('[{"child":"quotation_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F083','quotation_stock_responses','stock_responses',CAST('[{"child":"stock_response_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F084','shipments','job_orders',CAST('[{"child":"job_order_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F085','shipments','delivery_methods',CAST('[{"child":"delivery_method_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F086','shipments','users',CAST('[{"child":"updated_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F087','waybills','shipments',CAST('[{"child":"shipment_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F088','waybills','users',CAST('[{"child":"printed_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F089','shipment_events','shipments',CAST('[{"child":"shipment_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F090','shipment_events','users',CAST('[{"child":"performed_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F091','delivery_receipts','shipments',CAST('[{"child":"shipment_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F092','delivery_receipts','users',CAST('[{"child":"generated_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F093','delivery_receipts','users',CAST('[{"child":"sent_to_logistics_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F094','delivery_receipts','users',CAST('[{"child":"sent_to_client_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F095','signed_delivery_receipts','delivery_receipts',CAST('[{"child":"delivery_receipt_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F096','signed_delivery_receipts','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F097','signed_delivery_receipts','users',CAST('[{"child":"submitted_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F098','invoices','orders',CAST('[{"child":"order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F099','invoices','payment_terms',CAST('[{"child":"payment_term_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F100','invoices','users',CAST('[{"child":"created_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F101','invoices','users',CAST('[{"child":"sent_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F102','invoice_delivery_receipts','invoices',CAST('[{"child":"invoice_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F103','invoice_delivery_receipts','signed_delivery_receipts',CAST('[{"child":"signed_delivery_receipt_id","parent":"id"},{"child":"order_id","parent":"order_id"},{"child":"accepted_slot","parent":"accepted_slot"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F104','payments','orders',CAST('[{"child":"order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F105','payments','invoices',CAST('[{"child":"invoice_id","parent":"id"},{"child":"order_id","parent":"order_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F106','payments','users',CAST('[{"child":"submitted_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F107','payments','users',CAST('[{"child":"reviewed_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F108','payment_instructions','orders',CAST('[{"child":"order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F109','payment_instructions','users',CAST('[{"child":"sent_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F110','company_settings','users',CAST('[{"child":"updated_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F111','company_payment_methods','company_settings',CAST('[{"child":"company_settings_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F112','notifications','modules',CAST('[{"child":"module_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F113','notifications','orders',CAST('[{"child":"order_id","parent":"id"},{"child":"client_id","parent":"client_id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F114','notifications','clients',CAST('[{"child":"client_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F115','notifications','notifications',CAST('[{"child":"reply_to_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F116','notifications','users',CAST('[{"child":"created_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F117','notification_roles','notifications',CAST('[{"child":"notification_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F118','notification_roles','roles',CAST('[{"child":"role_code","parent":"code"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F119','notification_recipients','notifications',CAST('[{"child":"notification_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F120','notification_recipients','users',CAST('[{"child":"user_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F121','order_files','orders',CAST('[{"child":"order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F122','order_files','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F123','specification_files','product_specifications',CAST('[{"child":"specification_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F124','specification_files','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F125','quotation_files','quotations',CAST('[{"child":"quotation_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F126','quotation_files','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F127','purchase_order_files','purchase_orders',CAST('[{"child":"purchase_order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F128','purchase_order_files','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F129','job_order_files','job_orders',CAST('[{"child":"job_order_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F130','job_order_files','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F131','payment_files','payments',CAST('[{"child":"payment_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F132','payment_files','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F133','invoice_files','invoices',CAST('[{"child":"invoice_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F134','invoice_files','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F135','waybill_files','waybills',CAST('[{"child":"waybill_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F136','waybill_files','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F137','delivery_receipt_files','delivery_receipts',CAST('[{"child":"delivery_receipt_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F138','delivery_receipt_files','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F139','replacement_request_files','replacement_requests',CAST('[{"child":"replacement_request_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F140','replacement_request_files','files',CAST('[{"child":"file_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F141','audit_events','users',CAST('[{"child":"actor_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F142','material_import_review','materials',CAST('[{"child":"resolved_material_id","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F143','materials','users',CAST('[{"child":"costing_price_approved_by","parent":"id"}]' AS JSON),'inspected_definition'
 UNION ALL SELECT 'F144','user_sessions','users',CAST('[{"child":"user_id","parent":"id"}]' AS JSON),'service_relationship_requires_metadata_confirmation'
),
pair_rows AS (
 SELECT e.edge_id,e.child_table,e.parent_table,e.basis,JSON_LENGTH(e.pairs) pair_count,
 j.ord,j.child_col,j.parent_col,cc.COLUMN_NAME child_exists,pc.COLUMN_NAME parent_exists,
 ct.TABLE_TYPE child_type,pt.TABLE_TYPE parent_type,
 CONCAT('c.',CHAR(96),j.child_col,CHAR(96)) child_expr,
 CONCAT('c.',CHAR(96),j.child_col,CHAR(96),' IS NOT NULL') nn_expr,
 CONCAT('c.',CHAR(96),j.child_col,CHAR(96),'=p.',CHAR(96),j.parent_col,CHAR(96)) join_expr
 FROM expected_edges e
 CROSS JOIN JSON_TABLE(e.pairs,'$[*]' COLUMNS (
   ord FOR ORDINALITY,child_col VARCHAR(64) PATH '$.child',parent_col VARCHAR(64) PATH '$.parent'
 )) j
 LEFT JOIN information_schema.COLUMNS cc ON cc.TABLE_SCHEMA=DATABASE()
  AND BINARY cc.TABLE_NAME=BINARY e.child_table AND BINARY cc.COLUMN_NAME=BINARY j.child_col
 LEFT JOIN information_schema.COLUMNS pc ON pc.TABLE_SCHEMA=DATABASE()
  AND BINARY pc.TABLE_NAME=BINARY e.parent_table AND BINARY pc.COLUMN_NAME=BINARY j.parent_col
 LEFT JOIN information_schema.TABLES ct ON ct.TABLE_SCHEMA=DATABASE() AND BINARY ct.TABLE_NAME=BINARY e.child_table
 LEFT JOIN information_schema.TABLES pt ON pt.TABLE_SCHEMA=DATABASE() AND BINARY pt.TABLE_NAME=BINARY e.parent_table
), matched_fks AS (
 SELECT x.edge_id,k.CONSTRAINT_NAME
 FROM pair_rows x JOIN information_schema.KEY_COLUMN_USAGE k
 ON k.TABLE_SCHEMA=DATABASE() AND BINARY k.TABLE_NAME=BINARY x.child_table
 AND k.ORDINAL_POSITION=x.ord AND BINARY k.COLUMN_NAME=BINARY x.child_col
 AND k.REFERENCED_TABLE_SCHEMA=DATABASE() AND BINARY k.REFERENCED_TABLE_NAME=BINARY x.parent_table
 AND BINARY k.REFERENCED_COLUMN_NAME=BINARY x.parent_col
 GROUP BY x.edge_id,k.TABLE_NAME,k.CONSTRAINT_NAME
 HAVING COUNT(*)=MAX(x.pair_count) AND COUNT(*)=(
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE k2
  WHERE k2.TABLE_SCHEMA=DATABASE() AND k2.TABLE_NAME=k.TABLE_NAME AND k2.CONSTRAINT_NAME=k.CONSTRAINT_NAME
 )
), fragments AS (
 SELECT edge_id,child_table,parent_table,basis,
 COUNT(CASE WHEN child_exists IS NULL OR parent_exists IS NULL OR child_type IS NULL OR parent_type IS NULL OR child_type<>'BASE TABLE' OR parent_type<>'BASE TABLE' THEN 1 END) missing_pairs,
 GROUP_CONCAT(nn_expr ORDER BY ord SEPARATOR ' AND ') all_nn,
 GROUP_CONCAT(nn_expr ORDER BY ord SEPARATOR ' OR ') any_nn,
 GROUP_CONCAT(join_expr ORDER BY ord SEPARATOR ' AND ') parent_join,
 GROUP_CONCAT(child_expr ORDER BY ord SEPARATOR ',') group_cols,
 GREATEST(SUM(OCTET_LENGTH(nn_expr))+5*(COUNT(*)-1),
          SUM(OCTET_LENGTH(join_expr))+5*(COUNT(*)-1),
          SUM(OCTET_LENGTH(child_expr))+COUNT(*)-1) needed_concat_bytes
 FROM pair_rows GROUP BY edge_id,child_table,parent_table,basis
), ready_fragments AS (
 SELECT f.*,CONCAT(CHAR(96),'__APPROVED_DATABASE__',CHAR(96),'.',CHAR(96),child_table,CHAR(96)) child_q,
 CONCAT(CHAR(96),'__APPROVED_DATABASE__',CHAR(96),'.',CHAR(96),parent_table,CHAR(96)) parent_q
 FROM fragments f
)
SELECT edge_id AS evidence_id,child_table,parent_table,basis,
 (SELECT COUNT(*) FROM matched_fks m WHERE m.edge_id=f.edge_id) matching_deployed_fk_count,
 CASE WHEN missing_pairs>0 THEN 'BLOCKED_MISSING_COLUMN_TABLE_OR_VISIBILITY'
      WHEN needed_concat_bytes>@@group_concat_max_len THEN 'BLOCKED_CONCAT_LIMIT'
      ELSE 'READY' END AS status,
 CASE WHEN missing_pairs=0 AND needed_concat_bytes<=@@group_concat_max_len THEN CONCAT(
 'SELECT ',QUOTE(edge_id),' AS evidence_id,DATABASE() AS evidence_database,UTC_TIMESTAMP(3) AS captured_at_utc,r.* FROM (SELECT COUNT(*) child_rows,',
 'COUNT(CASE WHEN ',all_nn,' THEN 1 END) complete_carriers,',
 'COUNT(CASE WHEN NOT (',any_nn,') THEN 1 END) all_null_carriers,',
 'COUNT(CASE WHEN (',any_nn,') AND NOT (',all_nn,') THEN 1 END) partial_null_carriers,',
 'COUNT(CASE WHEN (',all_nn,') AND NOT EXISTS (SELECT 1 FROM ',parent_q,' p WHERE ',parent_join,') THEN 1 END) orphan_complete_carriers,',
 '(SELECT COALESCE(MAX(n),0) FROM (SELECT COUNT(*) n FROM ',child_q,' c WHERE ',all_nn,
 ' AND EXISTS (SELECT 1 FROM ',parent_q,' p WHERE ',parent_join,') GROUP BY ',group_cols,
 ') child_groups) max_children_per_existing_parent FROM ',child_q,' c) r WHERE BINARY DATABASE()=BINARY ',
 QUOTE('__APPROVED_DATABASE__'),';') END AS ready_sql
FROM ready_fragments f
WHERE BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
ORDER BY edge_id;

-- K: declared unique-key duplicate QUERY GENERATOR.
-- Metadata-only skips for expressions and sensitive key carriers are deliberate.
-- No token/password/path/credential identity values are read, including grouping.
-- Nullable unique-key rows with any NULL component are excluded, matching MySQL
-- uniqueness semantics. Prefix lengths and column collations are retained.
WITH known_tables AS (
  SELECT 'roles' AS table_name
  UNION ALL SELECT 'modules'
  UNION ALL SELECT 'role_modules'
  UNION ALL SELECT 'payment_terms'
  UNION ALL SELECT 'clients'
  UNION ALL SELECT 'users'
  UNION ALL SELECT 'client_applications'
  UNION ALL SELECT 'filter_types'
  UNION ALL SELECT 'product_specifications'
  UNION ALL SELECT 'material_categories'
  UNION ALL SELECT 'units'
  UNION ALL SELECT 'materials'
  UNION ALL SELECT 'bom_templates'
  UNION ALL SELECT 'bom_template_lines'
  UNION ALL SELECT 'files'
  UNION ALL SELECT 'order_stages'
  UNION ALL SELECT 'delivery_methods'
  UNION ALL SELECT 'orders'
  UNION ALL SELECT 'order_items'
  UNION ALL SELECT 'quotation_references'
  UNION ALL SELECT 'quotations'
  UNION ALL SELECT 'quotation_lines'
  UNION ALL SELECT 'quotation_costing'
  UNION ALL SELECT 'quotation_bom_lines'
  UNION ALL SELECT 'quotation_discounts'
  UNION ALL SELECT 'quotation_addons'
  UNION ALL SELECT 'purchase_orders'
  UNION ALL SELECT 'order_requests'
  UNION ALL SELECT 'document_sequences'
  UNION ALL SELECT 'production_stages'
  UNION ALL SELECT 'replacement_requests'
  UNION ALL SELECT 'job_orders'
  UNION ALL SELECT 'job_bom_lines'
  UNION ALL SELECT 'production_events'
  UNION ALL SELECT 'material_movements'
  UNION ALL SELECT 'material_changes'
  UNION ALL SELECT 'finished_goods'
  UNION ALL SELECT 'finished_good_movements'
  UNION ALL SELECT 'finished_good_order_items'
  UNION ALL SELECT 'stock_requests'
  UNION ALL SELECT 'stock_request_lines'
  UNION ALL SELECT 'stock_responses'
  UNION ALL SELECT 'stock_response_lines'
  UNION ALL SELECT 'quotation_stock_responses'
  UNION ALL SELECT 'shipments'
  UNION ALL SELECT 'waybills'
  UNION ALL SELECT 'shipment_events'
  UNION ALL SELECT 'delivery_receipts'
  UNION ALL SELECT 'signed_delivery_receipts'
  UNION ALL SELECT 'invoices'
  UNION ALL SELECT 'invoice_delivery_receipts'
  UNION ALL SELECT 'payments'
  UNION ALL SELECT 'payment_instructions'
  UNION ALL SELECT 'company_settings'
  UNION ALL SELECT 'company_payment_methods'
  UNION ALL SELECT 'notifications'
  UNION ALL SELECT 'notification_roles'
  UNION ALL SELECT 'notification_recipients'
  UNION ALL SELECT 'order_files'
  UNION ALL SELECT 'specification_files'
  UNION ALL SELECT 'quotation_files'
  UNION ALL SELECT 'purchase_order_files'
  UNION ALL SELECT 'job_order_files'
  UNION ALL SELECT 'payment_files'
  UNION ALL SELECT 'invoice_files'
  UNION ALL SELECT 'waybill_files'
  UNION ALL SELECT 'delivery_receipt_files'
  UNION ALL SELECT 'replacement_request_files'
  UNION ALL SELECT 'audit_events'
  UNION ALL SELECT 'material_import_review'
  UNION ALL SELECT 'user_sessions'
),
key_columns AS (
 SELECT s.TABLE_NAME,s.INDEX_NAME,s.SEQ_IN_INDEX,s.COLUMN_NAME,s.SUB_PART,
 t.TABLE_TYPE,k.table_name known_name,
 CASE WHEN s.COLUMN_NAME IS NULL THEN 1 ELSE 0 END expression_key,
 CASE WHEN LOWER(COALESCE(s.COLUMN_NAME,'')) REGEXP 'password|token|object_path|checksum|sha256|email|username|account_number|phone|address'
      THEN 1 ELSE 0 END sensitive_key,
 CONCAT('c.',CHAR(96),REPLACE(s.COLUMN_NAME,CHAR(96),CONCAT(CHAR(96),CHAR(96))),CHAR(96),' IS NOT NULL') nn_expr,
 CASE WHEN s.SUB_PART IS NULL THEN CONCAT('c.',CHAR(96),REPLACE(s.COLUMN_NAME,CHAR(96),CONCAT(CHAR(96),CHAR(96))),CHAR(96))
      ELSE CONCAT('LEFT(c.',CHAR(96),REPLACE(s.COLUMN_NAME,CHAR(96),CONCAT(CHAR(96),CHAR(96))),CHAR(96),',',s.SUB_PART,')') END key_expr
 FROM information_schema.STATISTICS s
 JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=s.TABLE_SCHEMA AND t.TABLE_NAME=s.TABLE_NAME
 LEFT JOIN known_tables k ON BINARY k.table_name=BINARY s.TABLE_NAME
 WHERE s.TABLE_SCHEMA=DATABASE() AND s.NON_UNIQUE=0
 AND s.TABLE_NAME NOT IN ('schema_migrations','_enterflow_migration_history')
), key_fragments AS (
 SELECT TABLE_NAME,INDEX_NAME,MAX(TABLE_TYPE) table_type,MAX(known_name) known_name,
 MAX(expression_key) expression_key,MAX(sensitive_key) sensitive_key,
 GROUP_CONCAT(nn_expr ORDER BY SEQ_IN_INDEX SEPARATOR ' AND ') all_nn,
 GROUP_CONCAT(key_expr ORDER BY SEQ_IN_INDEX SEPARATOR ',') key_cols,
 GREATEST(SUM(OCTET_LENGTH(nn_expr))+5*(COUNT(*)-1),SUM(OCTET_LENGTH(key_expr))+COUNT(*)-1) needed_concat_bytes
 FROM key_columns GROUP BY TABLE_NAME,INDEX_NAME
)
SELECT CONCAT('K:',TABLE_NAME,':',INDEX_NAME) evidence_id,
 CASE WHEN known_name IS NULL THEN 'BLOCKED_UNEXPECTED_TABLE'
      WHEN table_type<>'BASE TABLE' THEN 'BLOCKED_NOT_BASE_TABLE'
      WHEN sensitive_key=1 THEN 'EXCLUDED_SENSITIVE_KEY'
      WHEN expression_key=1 THEN 'BLOCKED_FUNCTIONAL_INDEX_REVIEW'
      WHEN needed_concat_bytes>@@group_concat_max_len THEN 'BLOCKED_CONCAT_LIMIT'
      ELSE 'READY' END AS status,
 CASE WHEN known_name IS NOT NULL AND table_type='BASE TABLE' AND sensitive_key=0
 AND expression_key=0 AND needed_concat_bytes<=@@group_concat_max_len THEN CONCAT(
 'SELECT ',QUOTE(CONCAT('K:',TABLE_NAME,':',INDEX_NAME)),
 ' AS evidence_id,DATABASE() AS evidence_database,UTC_TIMESTAMP(3) AS captured_at_utc,r.* FROM (SELECT COUNT(*) duplicate_groups,COALESCE(SUM(n),0) rows_in_duplicate_groups FROM (SELECT COUNT(*) n FROM ',
 CHAR(96),'__APPROVED_DATABASE__',CHAR(96),'.',CHAR(96),REPLACE(TABLE_NAME,CHAR(96),CONCAT(CHAR(96),CHAR(96))),CHAR(96),
 ' c WHERE ',all_nn,' GROUP BY ',key_cols,' HAVING COUNT(*)>1) d) r WHERE BINARY DATABASE()=BINARY ',
 QUOTE('__APPROVED_DATABASE__'),';') END AS ready_sql
FROM key_fragments
WHERE BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
ORDER BY TABLE_NAME,INDEX_NAME;

-- P: targeted record-profile QUERY GENERATOR, P01-P43.
-- Required column/table/family gates run against current metadata before emission.
-- READY means structurally eligible for operator review, not already executed.
-- Families deliberately exclude FLOAT/DOUBLE from exact-numeric profiles.
-- Definitions, meanings and warning conditions accompany each generated statement.
WITH query_catalog(query_id,issue,purpose,interpretation,requirements,body_sql) AS (
 SELECT 'P01','D01 D02 R04','Raw stock provenance and explicit zeros','Samples are not verified stock. Zero is recorded zero only with evidence; current NULLs cannot prove a historical zero was lost.',CAST('[{"path":"materials.quantity_status","family":"text"},{"path":"materials.threshold_status","family":"text"},{"path":"materials.quantity_on_hand","family":"exact_numeric"},{"path":"materials.reorder_threshold","family":"exact_numeric"},{"path":"materials.approved_costing_price","family":"exact_numeric"}]' AS JSON),'SELECT quantity_status,threshold_status,COUNT(*) records,COUNT(CASE WHEN quantity_on_hand IS NULL THEN 1 END) null_quantities,COUNT(CASE WHEN quantity_on_hand=0 THEN 1 END) numeric_zero_quantities,COUNT(CASE WHEN reorder_threshold=0 THEN 1 END) numeric_zero_thresholds,COUNT(CASE WHEN approved_costing_price IS NOT NULL THEN 1 END) with_approved_price FROM `__APPROVED_DATABASE__`.`materials` GROUP BY quantity_status,threshold_status'
 UNION ALL SELECT 'P02','D01 D02','Quantity and threshold status contradictions','Nonzero contradiction counts violate the source provenance invariant, subject to actual deployed enum/check contract. Empty tables return zero counts.',CAST('[{"path":"materials.quantity_status","family":"text"},{"path":"materials.threshold_status","family":"text"},{"path":"materials.quantity_on_hand","family":"exact_numeric"},{"path":"materials.reorder_threshold","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) records,COUNT(CASE WHEN quantity_status IS NULL OR quantity_status NOT IN (''unknown'',''provisional_sample'',''verified'') OR (quantity_on_hand IS NULL AND quantity_status<>''unknown'') OR (quantity_on_hand IS NOT NULL AND quantity_status=''unknown'') OR quantity_on_hand<0 THEN 1 END) quantity_contradictions,COUNT(CASE WHEN threshold_status IS NULL OR threshold_status NOT IN (''unknown'',''provisional_sample'',''verified'') OR (reorder_threshold IS NULL AND threshold_status<>''unknown'') OR (reorder_threshold IS NOT NULL AND threshold_status=''unknown'') OR reorder_threshold<0 THEN 1 END) threshold_contradictions FROM `__APPROVED_DATABASE__`.`materials`'
 UNION ALL SELECT 'P03','D02 D09 R08','Approved price and actor completeness','Reference prices are not approved prices. Actor existence and nonnegative values are necessary, not proof of authorized approval.',CAST('[{"path":"materials.approved_costing_price","family":"exact_numeric"},{"path":"materials.costing_price_approved_by","family":"text"},{"path":"materials.costing_price_approved_at","family":"temporal"},{"path":"materials.reference_unit_price","family":"exact_numeric"},{"path":"materials.unit_price","family":"exact_numeric"},{"path":"users.id","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) records,COUNT(CASE WHEN m.reference_unit_price IS NOT NULL AND m.approved_costing_price IS NULL THEN 1 END) reference_only,COUNT(CASE WHEN m.approved_costing_price IS NULL AND (m.costing_price_approved_by IS NOT NULL OR m.costing_price_approved_at IS NOT NULL) THEN 1 END) approval_metadata_without_price,COUNT(CASE WHEN m.approved_costing_price IS NOT NULL AND (m.costing_price_approved_by IS NULL OR m.costing_price_approved_at IS NULL OR u.id IS NULL) THEN 1 END) price_without_complete_actor_evidence,COUNT(CASE WHEN m.unit_price<0 OR m.reference_unit_price<0 OR m.approved_costing_price<0 THEN 1 END) negative_prices FROM `__APPROVED_DATABASE__`.`materials` m LEFT JOIN `__APPROVED_DATABASE__`.`users` u ON u.id=m.costing_price_approved_by'
 UNION ALL SELECT 'P04','D04','Unit mapping difference counts','Different spellings can be valid aliases. These counts establish candidates, not an approved conversion or evidence of a unit edit.',CAST('[{"path":"materials.source_unit","family":"text"},{"path":"materials.unit_code","family":"text"}]' AS JSON),'SELECT COUNT(*) records,COUNT(CASE WHEN source_unit IS NULL THEN 1 END) no_source_unit,COUNT(CASE WHEN source_unit IS NOT NULL AND BINARY source_unit<>BINARY unit_code THEN 1 END) different_source_and_internal_unit,COUNT(CASE WHEN source_unit IS NOT NULL AND LOWER(TRIM(source_unit)) NOT IN (''roll'',''plate'',''sheet'',''kg'',''gal'',''pcs'',''set'',''sets'',''m'') AND unit_code=''pcs'' THEN 1 END) outside_supported_set_mapped_to_pcs FROM `__APPROVED_DATABASE__`.`materials`'
 UNION ALL SELECT 'P05','D01 D02 R08','Material source identity completeness','Partially present provenance needs review. This does not fetch source digests, codes, prices, names or document paths.',CAST('[{"path":"materials.reference_price_source_sha256","family":"text"},{"path":"materials.reference_price_page","family":"exact_numeric"},{"path":"materials.reference_price_row","family":"exact_numeric"},{"path":"materials.item_code","family":"text"},{"path":"materials.reference_price_status","family":"text"}]' AS JSON),'SELECT reference_price_status,COUNT(*) records,COUNT(CASE WHEN item_code IS NULL THEN 1 END) uncoded,COUNT(CASE WHEN (reference_price_source_sha256 IS NULL)+(reference_price_page IS NULL)+(reference_price_row IS NULL) BETWEEN 1 AND 2 THEN 1 END) partial_source_identity,COUNT(CASE WHEN reference_price_page=0 OR reference_price_row=0 THEN 1 END) zero_source_coordinates FROM `__APPROVED_DATABASE__`.`materials` GROUP BY reference_price_status'
 UNION ALL SELECT 'P06','R02','Competing BOM templates and empty recipes','Multiple templates or empty templates can be intentional drafts. No candidate is automatically approved or selected by this query.',CAST('[{"path":"bom_templates.id","family":"exact_numeric"},{"path":"bom_templates.filter_type_code","family":"text"},{"path":"bom_templates.size_label","family":"text"},{"path":"bom_template_lines.template_id","family":"exact_numeric"}]' AS JSON),'SELECT (SELECT COUNT(*) FROM (SELECT filter_type_code,size_label FROM `__APPROVED_DATABASE__`.`bom_templates` GROUP BY filter_type_code,size_label HAVING COUNT(*)>1) d) competing_type_size_groups,(SELECT COUNT(*) FROM `__APPROVED_DATABASE__`.`bom_templates` t WHERE NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`bom_template_lines` l WHERE l.template_id=t.id)) empty_templates'
 UNION ALL SELECT 'P07','D03','Shared demand in saved quotation BOM snapshots','Counts saved snapshot candidates using inquiry quantities and base consumption without waste. It does not reproduce current height parsing/template selection or establish current stock at quotation time.',CAST('[{"path":"quotation_bom_lines.costing_id","family":"exact_numeric"},{"path":"quotation_bom_lines.material_id","family":"exact_numeric"},{"path":"quotation_bom_lines.unit_snapshot","family":"text"},{"path":"quotation_bom_lines.quantity_per_filter","family":"exact_numeric"},{"path":"quotation_costing.id","family":"exact_numeric"},{"path":"quotation_costing.quotation_id","family":"exact_numeric"},{"path":"quotation_costing.order_item_id","family":"exact_numeric"},{"path":"quotation_costing.order_id","family":"exact_numeric"},{"path":"order_items.id","family":"exact_numeric"},{"path":"order_items.order_id","family":"exact_numeric"},{"path":"order_items.quantity","family":"exact_numeric"},{"path":"materials.id","family":"exact_numeric"},{"path":"materials.quantity_on_hand","family":"exact_numeric"},{"path":"materials.quantity_status","family":"text"},{"path":"materials.source_unit","family":"text"},{"path":"materials.unit_code","family":"text"}]' AS JSON),'WITH per_item AS (SELECT qc.quotation_id,qc.order_item_id,b.material_id,b.unit_snapshot,SUM(b.quantity_per_filter*oi.quantity) demand FROM `__APPROVED_DATABASE__`.`quotation_costing` qc JOIN `__APPROVED_DATABASE__`.`quotation_bom_lines` b ON b.costing_id=qc.id JOIN `__APPROVED_DATABASE__`.`order_items` oi ON oi.id=qc.order_item_id AND oi.order_id=qc.order_id GROUP BY qc.quotation_id,qc.order_item_id,b.material_id,b.unit_snapshot), shared AS (SELECT quotation_id,material_id,unit_snapshot,COUNT(*) item_count,SUM(demand) total_demand,MAX(demand) max_item_demand FROM per_item GROUP BY quotation_id,material_id,unit_snapshot HAVING COUNT(*)>1) SELECT COUNT(*) shared_snapshot_material_groups,COUNT(CASE WHEN m.quantity_status=''verified'' AND BINARY s.unit_snapshot=BINARY COALESCE(m.source_unit,m.unit_code) AND s.max_item_demand<=m.quantity_on_hand AND s.total_demand>m.quantity_on_hand THEN 1 END) individual_pass_but_total_short_now,COUNT(CASE WHEN m.quantity_status<>''verified'' OR m.quantity_status IS NULL OR m.quantity_on_hand IS NULL OR BINARY s.unit_snapshot<>BINARY COALESCE(m.source_unit,m.unit_code) THEN 1 END) not_comparable FROM shared s LEFT JOIN `__APPROVED_DATABASE__`.`materials` m ON m.id=s.material_id'
 UNION ALL SELECT 'P08','D06','JO snapshot coverage','Sharing the inquiry spec proves no independent row; missing BOM is an observation, not proof that a historical recipe can be reconstructed.',CAST('[{"path":"job_orders.id","family":"exact_numeric"},{"path":"job_orders.order_item_id","family":"exact_numeric"},{"path":"job_orders.specification_id","family":"exact_numeric"},{"path":"job_orders.costing_id","family":"exact_numeric"},{"path":"order_items.id","family":"exact_numeric"},{"path":"order_items.specification_id","family":"exact_numeric"},{"path":"job_bom_lines.job_order_id","family":"exact_numeric"},{"path":"quotation_bom_lines.costing_id","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) jobs,COUNT(CASE WHEN jo.specification_id=oi.specification_id THEN 1 END) shared_inquiry_spec,COUNT(CASE WHEN jo.costing_id IS NULL THEN 1 END) no_costing_link,COUNT(CASE WHEN NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`job_bom_lines` b WHERE b.job_order_id=jo.id) THEN 1 END) no_job_bom,COUNT(CASE WHEN NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`job_bom_lines` b WHERE b.job_order_id=jo.id) AND EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`quotation_bom_lines` qb WHERE qb.costing_id=jo.costing_id) THEN 1 END) no_job_bom_with_linked_quote_bom FROM `__APPROVED_DATABASE__`.`job_orders` jo LEFT JOIN `__APPROVED_DATABASE__`.`order_items` oi ON oi.id=jo.order_item_id'
 UNION ALL SELECT 'P09','D05','Raw inventory structured movement and audit coverage','A material without movements is not necessarily corrupt; imported or unknown balances may have no approved opening event. Audit counts establish event presence only.',CAST('[{"path":"materials.id","family":"exact_numeric"},{"path":"material_movements.material_id","family":"exact_numeric"},{"path":"audit_events.subject_type","family":"text"},{"path":"audit_events.subject_identifier","family":"text"},{"path":"audit_events.action","family":"text"}]' AS JSON),'SELECT COUNT(*) materials,COUNT(CASE WHEN NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`material_movements` mm WHERE mm.material_id=m.id) THEN 1 END) without_movements,COUNT(CASE WHEN EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`audit_events` a WHERE a.subject_type=''material'' AND a.subject_identifier=CAST(m.id AS CHAR) AND a.action=''inventory.material.updated'') THEN 1 END) with_material_update_audit FROM `__APPROVED_DATABASE__`.`materials` m'
 UNION ALL SELECT 'P10','D05','Movement arithmetic','Nonzero arithmetic errors conflict with the source movement invariant. Zero errors do not prove ledger completeness or serialization.',CAST('[{"path":"material_movements.quantity_before","family":"exact_numeric"},{"path":"material_movements.quantity_after","family":"exact_numeric"},{"path":"material_movements.quantity_delta","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) movements,COUNT(CASE WHEN quantity_before IS NULL OR quantity_after IS NULL OR quantity_delta IS NULL OR quantity_before<0 OR quantity_after<0 OR quantity_after<>quantity_before+quantity_delta THEN 1 END) arithmetic_or_missing_value_errors FROM `__APPROVED_DATABASE__`.`material_movements`'
 UNION ALL SELECT 'P11','D05','Current balance versus latest structured movement','Difference is a reconciliation candidate, including legitimate newer manual counts. Ordering by timestamp/id is not proof of transaction serialization.',CAST('[{"path":"materials.id","family":"exact_numeric"},{"path":"materials.quantity_on_hand","family":"exact_numeric"},{"path":"material_movements.id","family":"exact_numeric"},{"path":"material_movements.material_id","family":"exact_numeric"},{"path":"material_movements.quantity_after","family":"exact_numeric"},{"path":"material_movements.occurred_at","family":"temporal"}]' AS JSON),'WITH ranked AS (SELECT material_id,quantity_after,ROW_NUMBER() OVER (PARTITION BY material_id ORDER BY occurred_at DESC,id DESC) rn FROM `__APPROVED_DATABASE__`.`material_movements`) SELECT COUNT(*) materials_with_latest_movement,COUNT(CASE WHEN NOT (m.quantity_on_hand<=>r.quantity_after) THEN 1 END) latest_balance_differences FROM `__APPROVED_DATABASE__`.`materials` m JOIN ranked r ON r.material_id=m.id AND r.rn=1'
 UNION ALL SELECT 'P12','D07','Attachment multiplication of eligible payment totals','Same client/invoice/order eligibility as JO query; compares all links with once-per-payment. A positive difference proves query multiplication on these rows, not an incorrect issued JO.',CAST('[{"path":"payments.id","family":"exact_numeric"},{"path":"payments.order_id","family":"exact_numeric"},{"path":"payments.invoice_id","family":"exact_numeric"},{"path":"payments.payment_type","family":"text"},{"path":"payments.verification_status","family":"text"},{"path":"payments.verified_amount","family":"exact_numeric"},{"path":"payments.submitted_by","family":"text"},{"path":"payment_files.payment_id","family":"exact_numeric"},{"path":"orders.id","family":"exact_numeric"},{"path":"orders.client_id","family":"exact_numeric"},{"path":"users.id","family":"exact_numeric"},{"path":"users.account_type","family":"text"},{"path":"users.client_id","family":"exact_numeric"},{"path":"invoices.id","family":"exact_numeric"},{"path":"invoices.order_id","family":"exact_numeric"}]' AS JSON),'WITH eligible AS (SELECT p.verified_amount,(SELECT COUNT(*) FROM `__APPROVED_DATABASE__`.`payment_files` pf WHERE pf.payment_id=p.id) links FROM `__APPROVED_DATABASE__`.`payments` p JOIN `__APPROVED_DATABASE__`.`orders` o ON o.id=p.order_id JOIN `__APPROVED_DATABASE__`.`invoices` i ON i.id=p.invoice_id AND i.order_id=p.order_id JOIN `__APPROVED_DATABASE__`.`users` u ON u.id=p.submitted_by AND u.account_type=''client'' AND u.client_id=o.client_id WHERE p.payment_type=''DOWNPAYMENT'' AND p.verification_status=''verified'') SELECT COUNT(*) verified_downpayments,COUNT(CASE WHEN links>1 THEN 1 END) multiply_linked,COALESCE(SUM(CASE WHEN links>0 THEN verified_amount ELSE 0 END),0) once_per_linked_payment,COALESCE(SUM(verified_amount*links),0) current_join_total,COALESCE(SUM(CASE WHEN links>1 THEN verified_amount*(links-1) ELSE 0 END),0) multiplication_difference FROM eligible'
 UNION ALL SELECT 'P13','D07 D11 D12','Payment proof association completeness','Receipt-only links are not proofs. Multiple proofs can be legitimate history until the owner specifies active-proof selection.',CAST('[{"path":"payments.id","family":"exact_numeric"},{"path":"payments.payment_type","family":"text"},{"path":"payments.verification_status","family":"text"},{"path":"payment_files.payment_id","family":"exact_numeric"},{"path":"payment_files.file_id","family":"exact_numeric"},{"path":"payment_files.purpose","family":"text"},{"path":"files.id","family":"exact_numeric"},{"path":"files.state","family":"text"}]' AS JSON),'WITH proof_counts AS (SELECT p.payment_type,p.verification_status,(SELECT COUNT(*) FROM `__APPROVED_DATABASE__`.`payment_files` pf WHERE pf.payment_id=p.id) all_links,(SELECT COUNT(*) FROM `__APPROVED_DATABASE__`.`payment_files` pf WHERE pf.payment_id=p.id AND pf.purpose=''proof_of_payment'') proof_links,(SELECT COUNT(*) FROM `__APPROVED_DATABASE__`.`payment_files` pf JOIN `__APPROVED_DATABASE__`.`files` f ON f.id=pf.file_id AND f.state=''available'' WHERE pf.payment_id=p.id AND pf.purpose=''proof_of_payment'') available_proofs FROM `__APPROVED_DATABASE__`.`payments` p) SELECT payment_type,verification_status,COUNT(*) payments,COUNT(CASE WHEN proof_links=0 THEN 1 END) no_proof,COUNT(CASE WHEN proof_links>1 THEN 1 END) multiple_proofs,COUNT(CASE WHEN available_proofs=0 THEN 1 END) no_available_proof,COUNT(CASE WHEN all_links>0 AND proof_links=0 THEN 1 END) only_nonproof_links FROM proof_counts GROUP BY payment_type,verification_status'
 UNION ALL SELECT 'P14','D08','Similar payment submissions','Grouped identity/amount/day/method/reference matches are candidates only. Values and keys are not returned; legitimate repeated payments must be preserved.',CAST('[{"path":"payments.invoice_id","family":"exact_numeric"},{"path":"payments.order_id","family":"exact_numeric"},{"path":"payments.submitted_by","family":"text"},{"path":"payments.payment_type","family":"text"},{"path":"payments.submitted_amount","family":"exact_numeric"},{"path":"payments.paid_on","family":"temporal"},{"path":"payments.method","family":"text"},{"path":"payments.reference_number","family":"text"}]' AS JSON),'SELECT COUNT(*) similar_groups,COALESCE(SUM(n),0) rows_in_similar_groups FROM (SELECT COUNT(*) n FROM `__APPROVED_DATABASE__`.`payments` GROUP BY invoice_id,order_id,submitted_by,payment_type,submitted_amount,paid_on,method,reference_number HAVING COUNT(*)>1) d'
 UNION ALL SELECT 'P15','D08','Timestamp-style operation identities','Counts a source key pattern without returning keys. A matching pattern proves key format, not that two requests were retries.',CAST('[{"path":"payments.idempotency_key","family":"text"}]' AS JSON),'SELECT COUNT(*) payments,COUNT(CASE WHEN idempotency_key LIKE ''downpayment:%:%:%'' THEN 1 END) timestamp_style_candidates,COUNT(CASE WHEN idempotency_key IS NULL OR idempotency_key='''' THEN 1 END) absent_operation_identity FROM `__APPROVED_DATABASE__`.`payments`'
 UNION ALL SELECT 'P16','D09','Payment review state coherence','Violations concern stored state; no binary-arithmetic error is proven by this query.',CAST('[{"path":"payments.verification_status","family":"text"},{"path":"payments.submitted_amount","family":"exact_numeric"},{"path":"payments.verified_amount","family":"exact_numeric"},{"path":"payments.reviewed_by","family":"text"},{"path":"payments.reviewed_at","family":"temporal"}]' AS JSON),'SELECT verification_status,COUNT(*) payments,COUNT(CASE WHEN submitted_amount IS NULL OR submitted_amount<=0 OR (verification_status=''pending'' AND (verified_amount IS NOT NULL OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)) OR (verification_status=''verified'' AND (verified_amount IS NULL OR verified_amount<=0 OR reviewed_by IS NULL OR reviewed_at IS NULL)) OR (verification_status=''rejected'' AND (verified_amount IS NOT NULL OR reviewed_by IS NULL OR reviewed_at IS NULL)) THEN 1 END) contradictory_records FROM `__APPROVED_DATABASE__`.`payments` GROUP BY verification_status'
 UNION ALL SELECT 'P17','D09 R01','Stored quote downpayment consistency','Draft/legacy values require classification. Rounding comparison follows stated two-decimal amount policy only; it does not recompute the complete pricing algorithm.',CAST('[{"path":"quotations.status","family":"text"},{"path":"quotations.total_amount","family":"exact_numeric"},{"path":"quotations.downpayment_percent","family":"exact_numeric"},{"path":"quotations.downpayment_amount","family":"exact_numeric"}]' AS JSON),'SELECT status,COUNT(*) quotations,COUNT(CASE WHEN downpayment_percent IS NULL OR downpayment_percent NOT IN (20,50) THEN 1 END) outside_20_or_50,COUNT(CASE WHEN total_amount IS NULL OR total_amount<0 OR downpayment_amount IS NULL OR downpayment_amount<>ROUND(total_amount*downpayment_percent/100,2) THEN 1 END) amount_inconsistency FROM `__APPROVED_DATABASE__`.`quotations` GROUP BY status'
 UNION ALL SELECT 'P18','D09','Invoice and accepted quotation amount agreement','A mismatch is a candidate pending historical adjustment policy and confirmation of the same accepted quotation basis.',CAST('[{"path":"invoices.order_id","family":"exact_numeric"},{"path":"invoices.amount","family":"exact_numeric"},{"path":"invoices.required_downpayment","family":"exact_numeric"},{"path":"purchase_orders.order_id","family":"exact_numeric"},{"path":"purchase_orders.accepted_quotation_id","family":"exact_numeric"},{"path":"quotations.id","family":"exact_numeric"},{"path":"quotations.order_id","family":"exact_numeric"},{"path":"quotations.total_amount","family":"exact_numeric"},{"path":"quotations.downpayment_amount","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) matched_invoices,COUNT(CASE WHEN i.amount<>q.total_amount OR i.required_downpayment<>q.downpayment_amount THEN 1 END) amount_differences FROM `__APPROVED_DATABASE__`.`invoices` i JOIN `__APPROVED_DATABASE__`.`purchase_orders` po ON po.order_id=i.order_id JOIN `__APPROVED_DATABASE__`.`quotations` q ON q.id=po.accepted_quotation_id AND q.order_id=i.order_id'
 UNION ALL SELECT 'P19','D10','Internal and customer PO namespace overlap','Equal references demonstrate namespace use. Reused customer references across companies are permitted candidates, not inherently corrupt.',CAST('[{"path":"purchase_orders.reference","family":"text"},{"path":"purchase_orders.client_reference","family":"text"},{"path":"purchase_orders.order_id","family":"exact_numeric"},{"path":"orders.id","family":"exact_numeric"},{"path":"orders.client_id","family":"exact_numeric"}]' AS JSON),'SELECT (SELECT COUNT(*) FROM `__APPROVED_DATABASE__`.`purchase_orders` WHERE BINARY reference=BINARY client_reference) identical_internal_and_client_reference,(SELECT COUNT(*) FROM (SELECT po.client_reference FROM `__APPROVED_DATABASE__`.`purchase_orders` po JOIN `__APPROVED_DATABASE__`.`orders` o ON o.id=po.order_id WHERE po.client_reference IS NOT NULL GROUP BY po.client_reference HAVING COUNT(DISTINCT o.client_id)>1) d) customer_reference_groups_shared_across_companies'
 UNION ALL SELECT 'P20','D11 D12','Non-sensitive file lifecycle metadata','No private object path, bucket name, digest value, filename or contents are selected or evaluated. Available metadata does not prove an object exists.',CAST('[{"path":"files.state","family":"text"},{"path":"files.bucket","family":"text"},{"path":"files.object_generation","family":"text"},{"path":"files.sha256","family":"text"},{"path":"files.deleted_at","family":"temporal"}]' AS JSON),'SELECT state,COUNT(*) files,COUNT(CASE WHEN bucket IS NULL OR bucket='''' THEN 1 END) missing_bucket_identity,COUNT(CASE WHEN object_generation IS NULL OR object_generation='''' THEN 1 END) missing_generation,COUNT(CASE WHEN sha256 IS NULL THEN 1 END) missing_digest,COUNT(CASE WHEN state=''available'' AND deleted_at IS NOT NULL THEN 1 END) available_with_deletion_time FROM `__APPROVED_DATABASE__`.`files` GROUP BY state'
 UNION ALL SELECT 'P21','D11','Unlinked metadata across typed file relations','Unlinked metadata may be pending or abandoned, not an orphan storage object. No cleanup or object existence conclusion is authorized.',CAST('[{"path":"files.id","family":"exact_numeric"},{"path":"files.state","family":"text"},{"path":"order_files.file_id","family":"exact_numeric"},{"path":"specification_files.file_id","family":"exact_numeric"},{"path":"quotation_files.file_id","family":"exact_numeric"},{"path":"purchase_order_files.file_id","family":"exact_numeric"},{"path":"job_order_files.file_id","family":"exact_numeric"},{"path":"payment_files.file_id","family":"exact_numeric"},{"path":"invoice_files.file_id","family":"exact_numeric"},{"path":"waybill_files.file_id","family":"exact_numeric"},{"path":"delivery_receipt_files.file_id","family":"exact_numeric"},{"path":"replacement_request_files.file_id","family":"exact_numeric"},{"path":"signed_delivery_receipts.file_id","family":"exact_numeric"}]' AS JSON),'SELECT f.state,COUNT(*) unlinked_metadata FROM `__APPROVED_DATABASE__`.`files` f WHERE NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`order_files` x WHERE x.file_id=f.id) AND NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`specification_files` x WHERE x.file_id=f.id) AND NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`quotation_files` x WHERE x.file_id=f.id) AND NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`purchase_order_files` x WHERE x.file_id=f.id) AND NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`job_order_files` x WHERE x.file_id=f.id) AND NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`payment_files` x WHERE x.file_id=f.id) AND NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`invoice_files` x WHERE x.file_id=f.id) AND NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`waybill_files` x WHERE x.file_id=f.id) AND NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`delivery_receipt_files` x WHERE x.file_id=f.id) AND NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`replacement_request_files` x WHERE x.file_id=f.id) AND NOT EXISTS (SELECT 1 FROM `__APPROVED_DATABASE__`.`signed_delivery_receipts` x WHERE x.file_id=f.id) GROUP BY f.state'
 UNION ALL SELECT 'P22','D11 R03','Audit event coverage without payload retrieval','Action counts show recorded events only; no old/new payload, private path or request identifier is accessed.',CAST('[{"path":"audit_events.action","family":"text"},{"path":"audit_events.subject_type","family":"text"}]' AS JSON),'SELECT subject_type,action,COUNT(*) events FROM `__APPROVED_DATABASE__`.`audit_events` WHERE action IN (''inventory.material.created'',''inventory.material.updated'',''stock_request.updated'',''job_order.created'',''payment.proof_submitted'',''payment.proof_verified'',''payment.proof_rejected'',''purchase_order.document_uploaded'',''inquiry.upload_planned'',''inquiry.upload_cleaned'',''inquiry.upload_cleanup_required'') GROUP BY subject_type,action'
 UNION ALL SELECT 'P23','R07','Order archival metadata combinations','Unusual combinations require owner policy and history review; a missing archive reason does not authorize deleting an order.',CAST('[{"path":"orders.archived_at","family":"temporal"},{"path":"orders.archived_by","family":"text"},{"path":"orders.archive_reason","family":"text"},{"path":"orders.fulfillment_completed_at","family":"temporal"},{"path":"orders.stage_code","family":"text"}]' AS JSON),'SELECT stage_code,COUNT(*) orders,COUNT(CASE WHEN (archived_at IS NULL)<>(archived_by IS NULL) THEN 1 END) incomplete_archive_actor_time,COUNT(CASE WHEN archived_at IS NOT NULL AND archive_reason IS NULL THEN 1 END) archived_without_reason,COUNT(CASE WHEN archived_at IS NULL AND archive_reason IS NOT NULL THEN 1 END) reason_without_archive_time FROM `__APPROVED_DATABASE__`.`orders` GROUP BY stage_code'
 UNION ALL SELECT 'P24','R07','PO lifecycle actor and timestamp pairs','Pairs and order are review candidates. The source metadata path can create a PO before received/cleared timestamps exist.',CAST('[{"path":"purchase_orders.received_at","family":"temporal"},{"path":"purchase_orders.received_by","family":"text"},{"path":"purchase_orders.cleared_at","family":"temporal"},{"path":"purchase_orders.cleared_by","family":"text"},{"path":"purchase_orders.uploaded_at","family":"temporal"}]' AS JSON),'SELECT COUNT(*) purchase_orders,COUNT(CASE WHEN (received_at IS NULL)<>(received_by IS NULL) OR (cleared_at IS NULL)<>(cleared_by IS NULL) THEN 1 END) incomplete_actor_time_pairs,COUNT(CASE WHEN cleared_at IS NOT NULL AND (received_at IS NULL OR cleared_at<received_at) THEN 1 END) clearance_order_candidates FROM `__APPROVED_DATABASE__`.`purchase_orders`'
 UNION ALL SELECT 'P25','R07','Quotation sent metadata','Superseded quotes can retain sent metadata. Review draft and sent states separately before declaring an error.',CAST('[{"path":"quotations.status","family":"text"},{"path":"quotations.sent_at","family":"temporal"},{"path":"quotations.sent_by","family":"text"},{"path":"quotations.issued_on","family":"temporal"},{"path":"quotations.valid_until","family":"temporal"}]' AS JSON),'SELECT status,COUNT(*) quotations,COUNT(CASE WHEN (sent_at IS NULL)<>(sent_by IS NULL) THEN 1 END) incomplete_sent_pair,COUNT(CASE WHEN status=''sent'' AND sent_at IS NULL THEN 1 END) sent_without_time,COUNT(CASE WHEN valid_until<issued_on THEN 1 END) invalid_date_range FROM `__APPROVED_DATABASE__`.`quotations` GROUP BY status'
 UNION ALL SELECT 'P26','R07','Signed DR state and duplicate accepted copies','Nonzero state/accepted-duplicate counts conflict with the inspected source invariant, subject to deployed metadata.',CAST('[{"path":"signed_delivery_receipts.delivery_receipt_id","family":"exact_numeric"},{"path":"signed_delivery_receipts.received_at","family":"temporal"},{"path":"signed_delivery_receipts.accepted_slot","family":"exact_numeric"},{"path":"signed_delivery_receipts.discarded_at","family":"temporal"}]' AS JSON),'SELECT (SELECT COUNT(*) FROM `__APPROVED_DATABASE__`.`signed_delivery_receipts` WHERE NOT ((received_at IS NULL AND accepted_slot IS NULL) OR (received_at IS NOT NULL AND discarded_at IS NULL AND accepted_slot IS NOT NULL AND accepted_slot=1))) contradictory_states,(SELECT COUNT(*) FROM (SELECT delivery_receipt_id FROM `__APPROVED_DATABASE__`.`signed_delivery_receipts` WHERE accepted_slot=1 GROUP BY delivery_receipt_id HAVING COUNT(*)>1) d) multiple_accepted_groups'
 UNION ALL SELECT 'P27','R07','Invoice delivery evidence ownership and acceptance','Nonzero counts identify mismatched or missing parents/accepted state. No first-versus-last receipt policy is inferred.',CAST('[{"path":"invoice_delivery_receipts.invoice_id","family":"exact_numeric"},{"path":"invoice_delivery_receipts.signed_delivery_receipt_id","family":"exact_numeric"},{"path":"invoice_delivery_receipts.order_id","family":"exact_numeric"},{"path":"invoice_delivery_receipts.accepted_slot","family":"exact_numeric"},{"path":"invoices.id","family":"exact_numeric"},{"path":"invoices.order_id","family":"exact_numeric"},{"path":"signed_delivery_receipts.id","family":"exact_numeric"},{"path":"signed_delivery_receipts.order_id","family":"exact_numeric"},{"path":"signed_delivery_receipts.accepted_slot","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) links,COUNT(CASE WHEN i.id IS NULL OR s.id IS NULL OR x.order_id<>i.order_id OR x.order_id<>s.order_id OR x.accepted_slot<>1 OR s.accepted_slot IS NULL OR s.accepted_slot<>1 THEN 1 END) invalid_evidence_links FROM `__APPROVED_DATABASE__`.`invoice_delivery_receipts` x LEFT JOIN `__APPROVED_DATABASE__`.`invoices` i ON i.id=x.invoice_id LEFT JOIN `__APPROVED_DATABASE__`.`signed_delivery_receipts` s ON s.id=x.signed_delivery_receipt_id'
 UNION ALL SELECT 'P28','OWNERSHIP','Item to order and specification client consistency','Checks expected semantic relationships even if the deployed FK is absent. Missing parents and differing owners are structural candidates.',CAST('[{"path":"order_items.order_id","family":"exact_numeric"},{"path":"order_items.client_id","family":"exact_numeric"},{"path":"order_items.specification_id","family":"exact_numeric"},{"path":"orders.id","family":"exact_numeric"},{"path":"orders.client_id","family":"exact_numeric"},{"path":"product_specifications.id","family":"exact_numeric"},{"path":"product_specifications.client_id","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) items,COUNT(CASE WHEN o.id IS NULL OR s.id IS NULL OR oi.client_id IS NULL OR oi.client_id<>o.client_id OR oi.client_id<>s.client_id THEN 1 END) missing_or_cross_client FROM `__APPROVED_DATABASE__`.`order_items` oi LEFT JOIN `__APPROVED_DATABASE__`.`orders` o ON o.id=oi.order_id LEFT JOIN `__APPROVED_DATABASE__`.`product_specifications` s ON s.id=oi.specification_id'
 UNION ALL SELECT 'P29','D06 OWNERSHIP','JO owner, source item and specification consistency','Missing/cross-owner parents violate expected ownership; a same-client independent JO specification is valid.',CAST('[{"path":"job_orders.order_id","family":"exact_numeric"},{"path":"job_orders.client_id","family":"exact_numeric"},{"path":"job_orders.order_item_id","family":"exact_numeric"},{"path":"job_orders.specification_id","family":"exact_numeric"},{"path":"orders.id","family":"exact_numeric"},{"path":"orders.client_id","family":"exact_numeric"},{"path":"order_items.id","family":"exact_numeric"},{"path":"order_items.order_id","family":"exact_numeric"},{"path":"order_items.client_id","family":"exact_numeric"},{"path":"product_specifications.id","family":"exact_numeric"},{"path":"product_specifications.client_id","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) jobs,COUNT(CASE WHEN o.id IS NULL OR oi.id IS NULL OR ps.id IS NULL OR jo.client_id IS NULL OR jo.order_id<>oi.order_id OR jo.client_id<>o.client_id OR jo.client_id<>oi.client_id OR jo.client_id<>ps.client_id THEN 1 END) missing_or_inconsistent_parents FROM `__APPROVED_DATABASE__`.`job_orders` jo LEFT JOIN `__APPROVED_DATABASE__`.`orders` o ON o.id=jo.order_id LEFT JOIN `__APPROVED_DATABASE__`.`order_items` oi ON oi.id=jo.order_item_id LEFT JOIN `__APPROVED_DATABASE__`.`product_specifications` ps ON ps.id=jo.specification_id'
 UNION ALL SELECT 'P30','R03','JO costing lineage versus PO accepted quotation','A mismatch is a lineage candidate, not approval to replace it with the current PO. Missing costing is reported separately.',CAST('[{"path":"job_orders.order_id","family":"exact_numeric"},{"path":"job_orders.order_item_id","family":"exact_numeric"},{"path":"job_orders.costing_id","family":"exact_numeric"},{"path":"quotation_costing.id","family":"exact_numeric"},{"path":"quotation_costing.quotation_id","family":"exact_numeric"},{"path":"quotation_costing.order_id","family":"exact_numeric"},{"path":"quotation_costing.order_item_id","family":"exact_numeric"},{"path":"purchase_orders.order_id","family":"exact_numeric"},{"path":"purchase_orders.accepted_quotation_id","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) jobs,COUNT(CASE WHEN jo.costing_id IS NULL THEN 1 END) absent_costing,COUNT(CASE WHEN jo.costing_id IS NOT NULL AND (qc.id IS NULL OR qc.order_id<>jo.order_id OR qc.order_item_id<>jo.order_item_id) THEN 1 END) invalid_costing_owner,COUNT(CASE WHEN qc.id IS NOT NULL AND po.order_id IS NOT NULL AND qc.quotation_id<>po.accepted_quotation_id THEN 1 END) differs_from_current_po_quote FROM `__APPROVED_DATABASE__`.`job_orders` jo LEFT JOIN `__APPROVED_DATABASE__`.`quotation_costing` qc ON qc.id=jo.costing_id LEFT JOIN `__APPROVED_DATABASE__`.`purchase_orders` po ON po.order_id=jo.order_id'
 UNION ALL SELECT 'P31','R09','Several quotation lines for one item','Multiple lines may be legitimate document layout; they violate the JO reader assumption, not necessarily the business contract.',CAST('[{"path":"quotation_lines.quotation_id","family":"exact_numeric"},{"path":"quotation_lines.order_item_id","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) multi_line_item_groups,COALESCE(SUM(n),0) associated_lines FROM (SELECT COUNT(*) n FROM `__APPROVED_DATABASE__`.`quotation_lines` WHERE order_item_id IS NOT NULL GROUP BY quotation_id,order_item_id HAVING COUNT(*)>1) d'
 UNION ALL SELECT 'P32','IDENTITY','Account role and company identity coherence','Does not access login names, email, passwords or session tokens. Distinguish missing optional employee number from actual account-type contradictions.',CAST('[{"path":"users.account_type","family":"text"},{"path":"users.role_code","family":"text"},{"path":"users.client_id","family":"exact_numeric"},{"path":"users.employee_number","family":"text"},{"path":"clients.id","family":"exact_numeric"}]' AS JSON),'SELECT u.account_type,u.role_code,COUNT(*) accounts,COUNT(CASE WHEN u.account_type=''client'' AND (u.role_code<>''client'' OR u.client_id IS NULL OR c.id IS NULL OR u.employee_number IS NOT NULL) THEN 1 END) invalid_client_identity,COUNT(CASE WHEN u.account_type=''employee'' AND (u.role_code=''client'' OR u.client_id IS NOT NULL) THEN 1 END) invalid_employee_identity FROM `__APPROVED_DATABASE__`.`users` u LEFT JOIN `__APPROVED_DATABASE__`.`clients` c ON c.id=u.client_id GROUP BY u.account_type,u.role_code'
 UNION ALL SELECT 'P33','IDENTITY','Multiple client accounts per company','Multiple accounts conflict with the historical one-client-account decision if still applicable. Employee NULL client IDs are excluded.',CAST('[{"path":"users.account_type","family":"text"},{"path":"users.client_id","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) multiple_client_account_groups,COALESCE(SUM(n),0) accounts_in_groups FROM (SELECT COUNT(*) n FROM `__APPROVED_DATABASE__`.`users` WHERE account_type=''client'' AND client_id IS NOT NULL GROUP BY client_id HAVING COUNT(*)>1) d'
 UNION ALL SELECT 'P34','IDENTITY R07','Application decision metadata','Profiles only status and aggregate completeness. Credential data and application personal details are not read.',CAST('[{"path":"client_applications.status","family":"text"},{"path":"client_applications.decided_at","family":"temporal"},{"path":"client_applications.decided_by","family":"text"},{"path":"client_applications.approved_client_id","family":"exact_numeric"}]' AS JSON),'SELECT status,COUNT(*) applications,COUNT(CASE WHEN status=''pending'' AND (decided_at IS NOT NULL OR decided_by IS NOT NULL OR approved_client_id IS NOT NULL) THEN 1 END) pending_with_decision_metadata,COUNT(CASE WHEN status=''approved'' AND (decided_at IS NULL OR decided_by IS NULL OR approved_client_id IS NULL) THEN 1 END) approved_incomplete,COUNT(CASE WHEN status=''rejected'' AND (decided_at IS NULL OR decided_by IS NULL OR approved_client_id IS NOT NULL) THEN 1 END) rejected_inconsistent FROM `__APPROVED_DATABASE__`.`client_applications` GROUP BY status'
 UNION ALL SELECT 'P35','R08','Source review resolution metadata','A resolution without a material may be intentional exclusion or need reconciliation. Notes and source content are not retrieved.',CAST('[{"path":"material_import_review.review_status","family":"text"},{"path":"material_import_review.resolved_material_id","family":"exact_numeric"},{"path":"materials.id","family":"exact_numeric"}]' AS JSON),'SELECT r.review_status,COUNT(*) review_records,COUNT(CASE WHEN r.review_status=''resolved'' AND (r.resolved_material_id IS NULL OR m.id IS NULL) THEN 1 END) resolved_without_material,COUNT(CASE WHEN r.resolved_material_id IS NOT NULL AND m.id IS NULL THEN 1 END) dangling_material FROM `__APPROVED_DATABASE__`.`material_import_review` r LEFT JOIN `__APPROVED_DATABASE__`.`materials` m ON m.id=r.resolved_material_id GROUP BY r.review_status'
 UNION ALL SELECT 'P36','R04','Finished-good quantity state','Zero counts do not establish whether the zero is physical or defaulted. No source provenance policy is invented.',CAST('[{"path":"finished_goods.quantity_on_hand","family":"exact_numeric"},{"path":"finished_goods.buffer_minimum","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) finished_goods,COUNT(CASE WHEN quantity_on_hand IS NULL THEN 1 END) null_quantities,COUNT(CASE WHEN quantity_on_hand=0 THEN 1 END) zero_quantities,COUNT(CASE WHEN quantity_on_hand<0 OR buffer_minimum<0 THEN 1 END) negative_values FROM `__APPROVED_DATABASE__`.`finished_goods`'
 UNION ALL SELECT 'P37','R07','Stock response arithmetic and state','Uses stored requested quantities and observed counts. Any disagreement is a candidate for the established four-decimal shortage contract.',CAST('[{"path":"stock_response_lines.stock_request_line_id","family":"exact_numeric"},{"path":"stock_response_lines.stock_request_id","family":"exact_numeric"},{"path":"stock_response_lines.current_quantity","family":"exact_numeric"},{"path":"stock_response_lines.shortage_quantity","family":"exact_numeric"},{"path":"stock_response_lines.status","family":"text"},{"path":"stock_request_lines.id","family":"exact_numeric"},{"path":"stock_request_lines.stock_request_id","family":"exact_numeric"},{"path":"stock_request_lines.required_quantity","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) response_lines,COUNT(CASE WHEN l.id IS NULL OR x.stock_request_id<>l.stock_request_id THEN 1 END) wrong_request_line,COUNT(CASE WHEN x.current_quantity IS NULL OR x.current_quantity<0 OR x.shortage_quantity IS NULL OR x.shortage_quantity<>ROUND(GREATEST(0,l.required_quantity-x.current_quantity),4) OR (x.status=''sufficient'' AND x.shortage_quantity<>0) OR (x.status=''shortage'' AND x.shortage_quantity<=0) THEN 1 END) arithmetic_or_status_disagreements FROM `__APPROVED_DATABASE__`.`stock_response_lines` x LEFT JOIN `__APPROVED_DATABASE__`.`stock_request_lines` l ON l.id=x.stock_request_line_id'
 UNION ALL SELECT 'P38','R07','Shipment lifecycle timing candidates','Delivered/picked-up timestamps and completion policy require owner interpretation. This query does not infer legal dispatch transitions.',CAST('[{"path":"shipments.status","family":"text"},{"path":"shipments.dispatched_at","family":"temporal"},{"path":"shipments.delivered_at","family":"temporal"},{"path":"shipments.fulfillment_completed_at","family":"temporal"}]' AS JSON),'SELECT status,COUNT(*) shipments,COUNT(CASE WHEN delivered_at IS NOT NULL AND dispatched_at IS NOT NULL AND delivered_at<dispatched_at THEN 1 END) delivery_precedes_dispatch,COUNT(CASE WHEN status IN (''delivered'',''picked_up'') AND fulfillment_completed_at IS NULL THEN 1 END) completed_status_without_fulfillment_time FROM `__APPROVED_DATABASE__`.`shipments` GROUP BY status'
 UNION ALL SELECT 'P39','OWNERSHIP','Notification client and recipient scope','Employees can receive cross-client work notifications. Only explicit client-recipient scope contradictions are counted.',CAST('[{"path":"notifications.id","family":"exact_numeric"},{"path":"notifications.order_id","family":"exact_numeric"},{"path":"notifications.client_id","family":"exact_numeric"},{"path":"orders.id","family":"exact_numeric"},{"path":"orders.client_id","family":"exact_numeric"},{"path":"notification_recipients.notification_id","family":"exact_numeric"},{"path":"notification_recipients.user_id","family":"exact_numeric"},{"path":"users.id","family":"exact_numeric"},{"path":"users.account_type","family":"text"},{"path":"users.client_id","family":"exact_numeric"}]' AS JSON),'SELECT (SELECT COUNT(*) FROM `__APPROVED_DATABASE__`.`notifications` n LEFT JOIN `__APPROVED_DATABASE__`.`orders` o ON o.id=n.order_id WHERE n.order_id IS NOT NULL AND (o.id IS NULL OR n.client_id IS NULL OR n.client_id<>o.client_id)) wrong_order_scope,(SELECT COUNT(*) FROM `__APPROVED_DATABASE__`.`notification_recipients` nr JOIN `__APPROVED_DATABASE__`.`notifications` n ON n.id=nr.notification_id JOIN `__APPROVED_DATABASE__`.`users` u ON u.id=nr.user_id WHERE u.account_type=''client'' AND n.client_id IS NOT NULL AND (u.client_id IS NULL OR u.client_id<>n.client_id)) explicitly_cross_client_recipients'
 UNION ALL SELECT 'P40','R07','Pending requests sharing order and kind','Several pending requests can be historical/legitimate until the approved workflow defines exclusivity.',CAST('[{"path":"order_requests.order_id","family":"exact_numeric"},{"path":"order_requests.kind","family":"text"},{"path":"order_requests.status","family":"text"}]' AS JSON),'SELECT kind,COUNT(*) duplicate_pending_groups,COALESCE(SUM(n),0) pending_rows FROM (SELECT kind,COUNT(*) n FROM `__APPROVED_DATABASE__`.`order_requests` WHERE status=''pending'' GROUP BY order_id,kind HAVING COUNT(*)>1) d GROUP BY kind'
 UNION ALL SELECT 'P41','D06 HISTORY','Snapshot differences from current master','Differences can prove the value of historical snapshots; they are not corruption and must not be synchronized automatically.',CAST('[{"path":"quotation_bom_lines.material_id","family":"exact_numeric"},{"path":"quotation_bom_lines.material_name_snapshot","family":"text"},{"path":"quotation_bom_lines.unit_snapshot","family":"text"},{"path":"quotation_bom_lines.unit_price_snapshot","family":"exact_numeric"},{"path":"materials.id","family":"exact_numeric"},{"path":"materials.name","family":"text"},{"path":"materials.source_unit","family":"text"},{"path":"materials.unit_code","family":"text"},{"path":"materials.approved_costing_price","family":"exact_numeric"}]' AS JSON),'SELECT COUNT(*) quotation_bom_lines,COUNT(CASE WHEN BINARY b.material_name_snapshot<>BINARY m.name OR BINARY b.unit_snapshot<>BINARY COALESCE(m.source_unit,m.unit_code) OR NOT (b.unit_price_snapshot<=>m.approved_costing_price) THEN 1 END) differing_from_current_master FROM `__APPROVED_DATABASE__`.`quotation_bom_lines` b JOIN `__APPROVED_DATABASE__`.`materials` m ON m.id=b.material_id'
 UNION ALL SELECT 'P42','R07','Production cursor and pause metadata','Cursor 9 is the completion sentinel, not a missing production-stage FK. Pause reason requirement needs approved policy.',CAST('[{"path":"job_orders.status","family":"text"},{"path":"job_orders.current_stage_cursor","family":"exact_numeric"},{"path":"job_orders.paused","family":"exact_numeric"},{"path":"job_orders.pause_reason","family":"text"}]' AS JSON),'SELECT status,COUNT(*) jobs,COUNT(CASE WHEN current_stage_cursor IS NULL OR current_stage_cursor NOT BETWEEN 0 AND 9 THEN 1 END) invalid_cursor,COUNT(CASE WHEN current_stage_cursor=9 THEN 1 END) completion_sentinel,COUNT(CASE WHEN paused=1 AND (pause_reason IS NULL OR TRIM(pause_reason)='''') THEN 1 END) paused_without_reason FROM `__APPROVED_DATABASE__`.`job_orders` GROUP BY status'
 UNION ALL SELECT 'P43','NINE_ROLES','Role vocabulary and actual account distribution','Preserve all nine roles. A role with no accounts is not unused functionality; no extra privilege is inferred.',CAST('[{"path":"roles.code","family":"text"},{"path":"users.role_code","family":"text"},{"path":"users.account_type","family":"text"}]' AS JSON),'SELECT r.code AS role_code,u.account_type,COUNT(u.role_code) AS accounts FROM `__APPROVED_DATABASE__`.`roles` r LEFT JOIN `__APPROVED_DATABASE__`.`users` u ON u.role_code=r.code GROUP BY r.code,u.account_type'
), required_columns AS (
 SELECT q.query_id,j.requirement,j.family,
 SUBSTRING_INDEX(j.requirement,'.',1) table_name,
 SUBSTRING_INDEX(j.requirement,'.',-1) column_name
 FROM query_catalog q CROSS JOIN JSON_TABLE(q.requirements,'$[*]' COLUMNS (
 requirement VARCHAR(140) PATH '$.path',family VARCHAR(24) PATH '$.family'
 )) j
), eligibility AS (
 SELECT r.query_id,COUNT(*) required_count,
 COUNT(CASE WHEN c.COLUMN_NAME IS NULL OR t.TABLE_TYPE IS NULL OR t.TABLE_TYPE<>'BASE TABLE' THEN 1 END) missing_count,
 COUNT(CASE WHEN c.COLUMN_NAME IS NOT NULL AND
 ((r.family='exact_numeric' AND c.DATA_TYPE NOT IN ('tinyint','smallint','mediumint','int','bigint','decimal','numeric'))
 OR (r.family='temporal' AND c.DATA_TYPE NOT IN ('date','datetime','timestamp'))
 OR (r.family='text' AND c.DATA_TYPE NOT IN ('char','varchar','tinytext','text','mediumtext','longtext','enum','set')))
 THEN 1 END) incompatible_type_count,
 JSON_ARRAYAGG(JSON_OBJECT('required',r.requirement,'expected_family',r.family,
 'visible_type',c.COLUMN_TYPE,'table_type',t.TABLE_TYPE)) required_column_evidence
 FROM required_columns r
 LEFT JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=DATABASE()
 AND BINARY c.TABLE_NAME=BINARY r.table_name AND BINARY c.COLUMN_NAME=BINARY r.column_name
 LEFT JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=DATABASE() AND BINARY t.TABLE_NAME=BINARY r.table_name
 GROUP BY r.query_id
)
SELECT q.query_id AS evidence_id,q.issue,q.purpose,q.interpretation,
 CASE WHEN e.missing_count>0 THEN 'BLOCKED_MISSING_COLUMN_TABLE_OR_VISIBILITY'
      WHEN e.incompatible_type_count>0 THEN 'BLOCKED_INCOMPATIBLE_TYPE_REVIEW'
      ELSE 'READY' END AS status,
 e.required_count,e.missing_count,e.incompatible_type_count,e.required_column_evidence,
 CASE WHEN e.missing_count=0 AND e.incompatible_type_count=0 THEN CONCAT(
 'SELECT ',QUOTE(q.query_id),' AS evidence_id,DATABASE() AS evidence_database,UTC_TIMESTAMP(3) AS captured_at_utc,r.* FROM (',
 q.body_sql,') r WHERE BINARY DATABASE()=BINARY ',QUOTE('__APPROVED_DATABASE__'),';') END AS ready_sql
FROM query_catalog q JOIN eligibility e ON e.query_id=q.query_id
WHERE BINARY DATABASE()=BINARY '__APPROVED_DATABASE__' AND VERSION() REGEXP '^8[.]4[.]'
ORDER BY q.query_id;

-- END OF PREPARATION PACKAGE.
-- No record-profile result has been produced by running the generator sections.
-- Preserve M/C/F/K/P output, including blocked/excluded statuses and timestamps.
-- Execute selected READY statements separately only after operator review.
-- No execution here can establish object-store existence, original physical counts,
-- past unit edits, financial binary-rounding causality or historical commit outcomes.

