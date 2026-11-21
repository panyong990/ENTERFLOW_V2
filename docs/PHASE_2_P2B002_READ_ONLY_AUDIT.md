# P2B002 read-only database audit

Final result: **PASS**. Fresh query window: 2026-11-22T02:36:29.837317+08:00 to 2026-11-22T02:36:34.084568+08:00, Asia/Singapore.

This audit used fresh SELECT results, not prior execution results. No bootstrap/executor/authoring helper was imported or run. The four named authoritative files were read completely and fingerprinted unchanged at the end. Only this requested audit file was written. No DDL/DML, restore, reset, configuration change or correction was executed.

## Actual connection identity

| Property | Actual observation |
| --- | --- |
| Container | /enterflow-phase2-mysql |
| Container ID | 2acac2d1b6069b6ed30a95b69eb582bd68ef9f365bc092f46530306f34a9eb73 |
| Image | mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902 |
| Running | True |
| 3306/tcp published binding | [{"HostIp": "127.0.0.1", "HostPort": "62286"}] |
| Persistent mounts | [{"Destination": "/var/lib/mysql", "Driver": "local", "Mode": "z", "Name": "enterflow-phase2-data", "Propagation": "", "RW": true, "Source": "/var/lib/docker/volumes/enterflow-phase2-data/_data", "Type": "volume"}] |

| Schema | Actual DATABASE() | MySQL | Server UUID | Hostname | Internal port | Connection ID | UTC query time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| enterflow_phase2_db | enterflow_phase2_db | 8.4.13 | 0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8 | 2acac2d1b606 | 3306 | 208 | 2026-11-21 18:36:30.106000 |
| enterflow_phase2_restore_p2b002 | enterflow_phase2_restore_p2b002 | 8.4.13 | 0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8 | 2acac2d1b606 | 3306 | 221 | 2026-11-21 18:36:31.985000 |

The read-only mysql sessions traveled via stdin and the container local socket. The separately inspected published binding confirms 127.0.0.1:62286. Both sessions report the same actual server UUID/hostname, the expected MySQL version and their correct separate DATABASE(). The container-held password was used without printing it, reading DPAPI credentials or inspecting the container environment.

## Expected contract and actual summary

Tables, ordered columns and all declared contracts were independently parsed from P2B002 SQL. Physical ERD Mermaid entities and embedded MySQL CREATE definitions were cross-checked against that SQL. The ERD also supplies complete names/columns of automatically created FK indexes. CHECK and generated expressions were compared as parsed expression trees, preserving operator precedence while accepting redundant MySQL parentheses and equivalent utf8mb4 literal introducers.

| Metric | enterflow_phase2_db | enterflow_phase2_restore_p2b002 |
| --- | --- | --- |
| tables | 40 | 40 |
| columns | 412 | 412 |
| PK | 40 | 40 |
| FK | 95 | 95 |
| UQ | 40 | 40 |
| CHECK | 40 | 40 |
| enforcedCHECK | 40 | 40 |
| indexes | 167 | 167 |
| triggers | 39 | 39 |
| autoIncrementColumns | 38 | 38 |
| exactRows | 0 | 0 |

The expected table set is the 40 named definitions in P2B002 and the physical ERD. Counts alone are not acceptance evidence. Each object and column contract was compared; exact per-table COUNT(*) was executed in both schemas, never substituted with estimated TABLE_ROWS.

## Complete actual inventory and exact row counts

| Table | Primary rows | Restored rows | Columns primary / restored | Engine | Collation | AUTO_INCREMENT next primary / restored |
| --- | --- | --- | --- | --- | --- | --- |
| audit_event | 0 | 0 | 9 / 9 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| client | 0 | 0 | 16 / 16 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| client_receipt | 0 | 0 | 11 / 11 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| client_receipt_file | 0 | 0 | 2 / 2 | InnoDB | utf8mb4_unicode_ci | None / None |
| client_user | 0 | 0 | 2 / 2 | InnoDB | utf8mb4_unicode_ci | None / None |
| cost_estimate | 0 | 0 | 15 / 15 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| cost_estimate_material | 0 | 0 | 8 / 8 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| delivery | 0 | 0 | 15 / 15 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| delivery_item | 0 | 0 | 4 / 4 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| delivery_method | 0 | 0 | 3 / 3 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| delivery_receipt | 0 | 0 | 6 / 6 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| document | 0 | 0 | 11 / 11 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| filter_type | 0 | 0 | 4 / 4 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| finished_good | 0 | 0 | 14 / 14 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| inquiry | 0 | 0 | 15 / 15 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| inquiry_item | 0 | 0 | 22 / 22 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| job_order | 0 | 0 | 17 / 17 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| job_order_item | 0 | 0 | 25 / 25 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| job_order_stage | 0 | 0 | 9 / 9 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| material_category | 0 | 0 | 2 / 2 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| material_shortage_report | 0 | 0 | 10 / 10 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| notification | 0 | 0 | 8 / 8 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| payment_method | 0 | 0 | 4 / 4 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| payment_transaction | 0 | 0 | 16 / 16 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| production_plan | 0 | 0 | 10 / 10 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| production_stage | 0 | 0 | 4 / 4 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| production_stage_event | 0 | 0 | 6 / 6 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| purchase_order | 0 | 0 | 9 / 9 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| quotation | 0 | 0 | 25 / 25 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| quotation_item | 0 | 0 | 9 / 9 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| raw_material | 0 | 0 | 18 / 18 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| role | 0 | 0 | 4 / 4 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| sales_invoice | 0 | 0 | 11 / 11 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| signed_delivery_receipt | 0 | 0 | 6 / 6 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| stock_movement | 0 | 0 | 17 / 17 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| stock_request | 0 | 0 | 9 / 9 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| stock_request_item | 0 | 0 | 13 / 13 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| unit_of_measure | 0 | 0 | 3 / 3 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| user_account | 0 | 0 | 12 / 12 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |
| waybill | 0 | 0 | 8 / 8 | InnoDB | utf8mb4_unicode_ci | 1 / 1 |

## Exact discrepancies and column-level differences

**None found.** No missing/extra/mismatched tables, columns, PKs, FKs, unique constraints, CHECKs, indexes or triggers. No unintended routines or scheduled events. No differences in column types, ordinal positions, nullability, defaults, auto-increment flags, generated expressions, ON UPDATE properties or declared text character sets/collations. Every table in both schemas contains zero rows.

## Complete fresh column evidence

Each row includes both actual definitions. AUTO_INCREMENT is checked for expected columns and its absence on all other columns; runtime next values are shown in the inventory. CHECK/generation expression comparisons do not erase operator precedence.

| Table.column | Ordinal | Primary actual | Restored actual |
| --- | --- | --- | --- |
| audit_event.audit_event_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| audit_event.actor_user_id | 2 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| audit_event.action | 3 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| audit_event.subject_type | 4 | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| audit_event.subject_id | 5 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| audit_event.before_value | 6 | json; nullable=YES; default=None; EXTRA=none; collation=None | json; nullable=YES; default=None; EXTRA=none; collation=None |
| audit_event.after_value | 7 | json; nullable=YES; default=None; EXTRA=none; collation=None | json; nullable=YES; default=None; EXTRA=none; collation=None |
| audit_event.reason | 8 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| audit_event.occurred_at | 9 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| client.client_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| client.company_name | 2 | varchar(200); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(200); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.industry | 3 | varchar(120); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(120); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.contact_person | 4 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.phone | 5 | varchar(40); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.email | 6 | varchar(254); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(254); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.address_line1 | 7 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.address_line2 | 8 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.city_province | 9 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.zip_code | 10 | varchar(20); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(20); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.default_payment_terms | 11 | varchar(80); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.preferred_delivery_method_id | 12 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| client.internal_notes | 13 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.status | 14 | varchar(30); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(30); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client.client_since | 15 | date; nullable=YES; default=None; EXTRA=none; collation=None | date; nullable=YES; default=None; EXTRA=none; collation=None |
| client.created_at | 16 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| client_receipt.receipt_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| client_receipt.invoice_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| client_receipt.client_user_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| client_receipt.payment_method_id | 4 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| client_receipt.amount_declared | 5 | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None |
| client_receipt.note | 6 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client_receipt.review_status | 7 | enum('pending','verified','rejected'); nullable=NO; default='pending'; EXTRA=none; collation=utf8mb4_unicode_ci | enum('pending','verified','rejected'); nullable=NO; default='pending'; EXTRA=none; collation=utf8mb4_unicode_ci |
| client_receipt.reviewed_by_user_id | 8 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| client_receipt.reviewed_at | 9 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| client_receipt.review_note | 10 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| client_receipt.sent_at | 11 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| client_receipt_file.receipt_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| client_receipt_file.document_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| client_user.client_user_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| client_user.client_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.estimate_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| cost_estimate.quotation_item_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.labor_cost_per_unit | 3 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.include_labor | 4 | tinyint(1); nullable=NO; default=None; EXTRA=none; collation=None | tinyint(1); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.markup_percent | 5 | decimal(9,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(9,4); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.apply_markup | 6 | tinyint(1); nullable=NO; default=None; EXTRA=none; collation=None | tinyint(1); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.vat_type | 7 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| cost_estimate.vat_rate | 8 | decimal(7,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(7,4); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.apply_vat | 9 | tinyint(1); nullable=NO; default=None; EXTRA=none; collation=None | tinyint(1); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.material_cost_per_unit | 10 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.unit_cost_with_markup | 11 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.unit_cost_with_vat | 12 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.is_locked | 13 | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None |
| cost_estimate.created_by_user_id | 14 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate.created_at | 15 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| cost_estimate_material.estimate_material_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| cost_estimate_material.estimate_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate_material.material_category_id | 3 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| cost_estimate_material.raw_material_id | 4 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate_material.qty_per_filter | 5 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate_material.uom_id | 6 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate_material.unit_price_snapshot | 7 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| cost_estimate_material.line_cost | 8 | decimal(19,4); nullable=YES; default=None; EXTRA=STORED GENERATED; generated=(qty_per_filter * unit_price_snapshot); collation=None | decimal(19,4); nullable=YES; default=None; EXTRA=STORED GENERATED; generated=(qty_per_filter * unit_price_snapshot); collation=None |
| delivery.delivery_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| delivery.jo_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| delivery.delivery_method_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| delivery.status | 4 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| delivery.dispatch_date | 5 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| delivery.estimated_delivery_date | 6 | date; nullable=YES; default=None; EXTRA=none; collation=None | date; nullable=YES; default=None; EXTRA=none; collation=None |
| delivery.delivered_date | 7 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| delivery.driver_name | 8 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| delivery.driver_contact | 9 | varchar(40); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| delivery.vehicle_plate | 10 | varchar(40); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| delivery.tracking_link | 11 | varchar(2048); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(2048); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| delivery.received_by | 12 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| delivery.notes | 13 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| delivery.dispatched_by_user_id | 14 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| delivery.created_at | 15 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| delivery_item.delivery_item_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| delivery_item.delivery_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| delivery_item.jo_item_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| delivery_item.quantity | 4 | int unsigned; nullable=NO; default=None; EXTRA=none; collation=None | int unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| delivery_method.delivery_method_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| delivery_method.method_name | 2 | varchar(100); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(100); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| delivery_method.is_active | 3 | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None |
| delivery_receipt.delivery_receipt_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| delivery_receipt.delivery_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| delivery_receipt.dr_no | 3 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| delivery_receipt.generated_by_user_id | 4 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| delivery_receipt.generated_at | 5 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| delivery_receipt.document_id | 6 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| document.document_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| document.file_name | 2 | varchar(255); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| document.storage_bucket | 3 | varchar(63); nullable=YES; default=None; EXTRA=none; collation=ascii_bin | varchar(63); nullable=YES; default=None; EXTRA=none; collation=ascii_bin |
| document.storage_key | 4 | varchar(700); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_bin | varchar(700); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_bin |
| document.object_generation | 5 | varchar(40); nullable=YES; default=None; EXTRA=none; collation=ascii_bin | varchar(40); nullable=YES; default=None; EXTRA=none; collation=ascii_bin |
| document.mime_type | 6 | varchar(120); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(120); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| document.size_bytes | 7 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| document.sha256 | 8 | char(64); nullable=YES; default=None; EXTRA=none; collation=ascii_bin | char(64); nullable=YES; default=None; EXTRA=none; collation=ascii_bin |
| document.storage_status | 9 | enum('pending','available','failed','deleted'); nullable=NO; default='pending'; EXTRA=none; collation=utf8mb4_unicode_ci | enum('pending','available','failed','deleted'); nullable=NO; default='pending'; EXTRA=none; collation=utf8mb4_unicode_ci |
| document.uploaded_by_user_id | 10 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| document.uploaded_at | 11 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| filter_type.filter_type_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| filter_type.filter_type_name | 2 | varchar(120); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(120); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| filter_type.template_group | 3 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| filter_type.is_active | 4 | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None |
| finished_good.finished_good_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| finished_good.item_code | 2 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| finished_good.enterfil_pn | 3 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| finished_good.item_name | 4 | varchar(200); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(200); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| finished_good.client_id | 5 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| finished_good.filter_type_id | 6 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| finished_good.qty_in_stock | 7 | int unsigned; nullable=YES; default=None; EXTRA=none; collation=None | int unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| finished_good.quantity_status | 8 | enum('unknown','provisional_sample','verified'); nullable=NO; default='unknown'; EXTRA=none; collation=utf8mb4_unicode_ci | enum('unknown','provisional_sample','verified'); nullable=NO; default='unknown'; EXTRA=none; collation=utf8mb4_unicode_ci |
| finished_good.buffer_min | 9 | int unsigned; nullable=YES; default=None; EXTRA=none; collation=None | int unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| finished_good.threshold_status | 10 | enum('unknown','provisional_sample','verified'); nullable=NO; default='unknown'; EXTRA=none; collation=utf8mb4_unicode_ci | enum('unknown','provisional_sample','verified'); nullable=NO; default='unknown'; EXTRA=none; collation=utf8mb4_unicode_ci |
| finished_good.demand_level | 11 | varchar(40); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| finished_good.order_frequency | 12 | varchar(80); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| finished_good.avg_qty_per_order | 13 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| finished_good.is_active | 14 | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None |
| inquiry.inquiry_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| inquiry.inquiry_no | 2 | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry.client_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| inquiry.contact_person | 4 | varchar(160); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry.payment_terms | 5 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry.source | 6 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry.submitted_by_client_user_id | 7 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry.created_by_user_id | 8 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry.general_notes | 9 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry.required_by_date | 10 | date; nullable=YES; default=None; EXTRA=none; collation=None | date; nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry.due_date | 11 | date; nullable=YES; default=None; EXTRA=none; collation=None | date; nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry.status | 12 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry.rejection_reason | 13 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry.created_at | 14 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| inquiry.updated_at | 15 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED on update CURRENT_TIMESTAMP(3); collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED on update CURRENT_TIMESTAMP(3); collation=None |
| inquiry_item.inquiry_item_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| inquiry_item.inquiry_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| inquiry_item.line_no | 3 | smallint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | smallint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| inquiry_item.filter_type_id | 4 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| inquiry_item.filter_name | 5 | varchar(200); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(200); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry_item.oem_reference | 6 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry_item.od1_mm | 7 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry_item.od2_mm | 8 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry_item.id1_mm | 9 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry_item.id2_mm | 10 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry_item.height_mm | 11 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry_item.overall_height_mm | 12 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry_item.filter_media | 13 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry_item.inner_core | 14 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry_item.outer_core | 15 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry_item.o_ring | 16 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry_item.gasket | 17 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry_item.filtration_rating | 18 | varchar(120); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(120); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry_item.filtration_rating_custom | 19 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| inquiry_item.quantity | 20 | int unsigned; nullable=NO; default=None; EXTRA=none; collation=None | int unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| inquiry_item.template_specifications | 21 | json; nullable=YES; default=None; EXTRA=none; collation=None | json; nullable=YES; default=None; EXTRA=none; collation=None |
| inquiry_item.sketch_document_id | 22 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| job_order.jo_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| job_order.jo_no | 2 | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order.po_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order.jo_date | 4 | date; nullable=NO; default=None; EXTRA=none; collation=None | date; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order.due_date | 5 | date; nullable=NO; default=None; EXTRA=none; collation=None | date; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order.status | 6 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order.payment_terms | 7 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order.delivery_method_id | 8 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order.po_verified | 9 | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None |
| job_order.specs_verified | 10 | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None |
| job_order.terms_verified | 11 | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None |
| job_order.prepared_by_user_id | 12 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order.approved_by_user_id | 13 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| job_order.cancellation_reason | 14 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order.completed_at | 15 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| job_order.archived_at | 16 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| job_order.created_at | 17 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| job_order_item.jo_item_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| job_order_item.jo_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order_item.quotation_item_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order_item.line_no | 4 | smallint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | smallint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order_item.item_code | 5 | varchar(80); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.enterfil_pn | 6 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.item_name | 7 | varchar(200); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(200); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.quantity | 8 | int unsigned; nullable=NO; default=None; EXTRA=none; collation=None | int unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order_item.od1_mm | 9 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_item.od2_mm | 10 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_item.id1_mm | 11 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_item.id2_mm | 12 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_item.height_mm | 13 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_item.overall_height_mm | 14 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_item.filter_media | 15 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.inner_core | 16 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.outer_core | 17 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.end_cap | 18 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.o_ring | 19 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.gasket | 20 | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.oem_pn | 21 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.brand | 22 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.other_specs | 23 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_item.template_specifications_snapshot | 24 | json; nullable=YES; default=None; EXTRA=none; collation=None | json; nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_item.final_sketch_document_id | 25 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_stage.jo_stage_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| job_order_stage.jo_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order_stage.stage_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| job_order_stage.status | 4 | enum('pending','in_progress','completed'); nullable=NO; default='pending'; EXTRA=none; collation=utf8mb4_unicode_ci | enum('pending','in_progress','completed'); nullable=NO; default='pending'; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_stage.started_at | 5 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_stage.completed_at | 6 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_stage.marked_by_user_id | 7 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| job_order_stage.remarks | 8 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| job_order_stage.reverted_count | 9 | int unsigned; nullable=NO; default='0'; EXTRA=none; collation=None | int unsigned; nullable=NO; default='0'; EXTRA=none; collation=None |
| material_category.material_category_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| material_category.category_name | 2 | varchar(100); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(100); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| material_shortage_report.report_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| material_shortage_report.jo_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| material_shortage_report.jo_stage_id | 3 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| material_shortage_report.raw_material_id | 4 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| material_shortage_report.qty_needed | 5 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| material_shortage_report.description | 6 | text; nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| material_shortage_report.status | 7 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| material_shortage_report.reported_by_user_id | 8 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| material_shortage_report.reported_at | 9 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| material_shortage_report.resolved_at | 10 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| notification.notification_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| notification.user_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| notification.title | 3 | varchar(255); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| notification.message | 4 | text; nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| notification.notification_type | 5 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| notification.is_read | 6 | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None |
| notification.created_at | 7 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| notification.read_at | 8 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| payment_method.payment_method_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| payment_method.method_name | 2 | varchar(100); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(100); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| payment_method.instructions | 3 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| payment_method.is_active | 4 | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None |
| payment_transaction.payment_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| payment_transaction.invoice_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| payment_transaction.payment_method_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| payment_transaction.transaction_type | 4 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| payment_transaction.amount | 5 | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None |
| payment_transaction.reference_no | 6 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| payment_transaction.date_paid | 7 | date; nullable=NO; default=None; EXTRA=none; collation=None | date; nullable=NO; default=None; EXTRA=none; collation=None |
| payment_transaction.client_receipt_id | 8 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| payment_transaction.approval_status | 9 | varchar(20); nullable=NO; default='approved'; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(20); nullable=NO; default='approved'; EXTRA=none; collation=utf8mb4_unicode_ci |
| payment_transaction.recorded_by_user_id | 10 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| payment_transaction.approved_by_user_id | 11 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| payment_transaction.approved_at | 12 | datetime(3); nullable=NO; default=None; EXTRA=none; collation=None | datetime(3); nullable=NO; default=None; EXTRA=none; collation=None |
| payment_transaction.notes | 13 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| payment_transaction.created_at | 14 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| payment_transaction.operation_key | 15 | varchar(120); nullable=NO; default=None; EXTRA=none; collation=ascii_bin | varchar(120); nullable=NO; default=None; EXTRA=none; collation=ascii_bin |
| payment_transaction.official_receipt_document_id | 16 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| production_plan.plan_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| production_plan.plan_code | 2 | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| production_plan.client_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| production_plan.finished_good_id | 4 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| production_plan.jo_id | 5 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| production_plan.source | 6 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| production_plan.planned_qty | 7 | int unsigned; nullable=NO; default=None; EXTRA=none; collation=None | int unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| production_plan.week_start_date | 8 | date; nullable=NO; default=None; EXTRA=none; collation=None | date; nullable=NO; default=None; EXTRA=none; collation=None |
| production_plan.week_end_date | 9 | date; nullable=NO; default=None; EXTRA=none; collation=None | date; nullable=NO; default=None; EXTRA=none; collation=None |
| production_plan.created_by_user_id | 10 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| production_stage.stage_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| production_stage.stage_name | 2 | varchar(120); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(120); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| production_stage.stage_order | 3 | smallint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | smallint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| production_stage.is_active | 4 | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None |
| production_stage_event.stage_event_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| production_stage_event.jo_stage_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| production_stage_event.action | 3 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| production_stage_event.reason | 4 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| production_stage_event.performed_by_user_id | 5 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| production_stage_event.occurred_at | 6 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| purchase_order.po_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| purchase_order.po_no | 2 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| purchase_order.quotation_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| purchase_order.po_document_id | 4 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| purchase_order.received_date | 5 | date; nullable=NO; default=None; EXTRA=none; collation=None | date; nullable=NO; default=None; EXTRA=none; collation=None |
| purchase_order.payment_terms | 6 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| purchase_order.delivery_method_id | 7 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| purchase_order.recorded_by_user_id | 8 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| purchase_order.created_at | 9 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| quotation.quotation_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| quotation.quotation_no | 2 | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| quotation.inquiry_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| quotation.revision_no | 4 | smallint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | smallint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| quotation.is_current | 5 | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None |
| quotation.current_inquiry_id | 6 | bigint unsigned; nullable=YES; default=None; EXTRA=STORED GENERATED; generated=(case when (is_current = 1) then inquiry_id else NULL end); collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=STORED GENERATED; generated=(case when (is_current = 1) then inquiry_id else NULL end); collation=None |
| quotation.quotation_date | 7 | date; nullable=NO; default=None; EXTRA=none; collation=None | date; nullable=NO; default=None; EXTRA=none; collation=None |
| quotation.valid_until | 8 | date; nullable=NO; default=None; EXTRA=none; collation=None | date; nullable=NO; default=None; EXTRA=none; collation=None |
| quotation.terms_of_payment | 9 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| quotation.time_of_delivery | 10 | varchar(255); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| quotation.place_of_delivery | 11 | text; nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| quotation.vat_type | 12 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| quotation.highlight_tag | 13 | varchar(80); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| quotation.highlight_note | 14 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| quotation.requires_downpayment | 15 | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None |
| quotation.downpayment_percent | 16 | decimal(5,2); nullable=NO; default=None; EXTRA=none; collation=None | decimal(5,2); nullable=NO; default=None; EXTRA=none; collation=None |
| quotation.downpayment_amount | 17 | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None |
| quotation.subtotal | 18 | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None |
| quotation.addons_total | 19 | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None |
| quotation.total_amount | 20 | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None |
| quotation.status | 21 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| quotation.prepared_by_user_id | 22 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| quotation.approved_by_user_id | 23 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| quotation.sent_at | 24 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| quotation.created_at | 25 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| quotation_item.quotation_item_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| quotation_item.quotation_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| quotation_item.inquiry_item_id | 3 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| quotation_item.line_no | 4 | smallint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | smallint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| quotation_item.description | 5 | varchar(255); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| quotation_item.quantity | 6 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| quotation_item.uom_id | 7 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| quotation_item.unit_price | 8 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| quotation_item.line_total | 9 | decimal(19,2); nullable=YES; default=None; EXTRA=STORED GENERATED; generated=round((quantity * unit_price),2); collation=None | decimal(19,2); nullable=YES; default=None; EXTRA=STORED GENERATED; generated=round((quantity * unit_price),2); collation=None |
| raw_material.material_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| raw_material.material_category_id | 2 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| raw_material.material_name | 3 | varchar(200); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(200); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| raw_material.uom_id | 4 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| raw_material.qty_in_stock | 5 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| raw_material.quantity_status | 6 | enum('unknown','provisional_sample','verified'); nullable=NO; default='unknown'; EXTRA=none; collation=utf8mb4_unicode_ci | enum('unknown','provisional_sample','verified'); nullable=NO; default='unknown'; EXTRA=none; collation=utf8mb4_unicode_ci |
| raw_material.unit_price | 7 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| raw_material.unit_price_approved_by_user_id | 8 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| raw_material.unit_price_approved_at | 9 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| raw_material.reference_unit_price | 10 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| raw_material.reference_document_id | 11 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| raw_material.reference_page | 12 | smallint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | smallint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| raw_material.reorder_threshold | 13 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| raw_material.threshold_status | 14 | enum('unknown','provisional_sample','verified'); nullable=NO; default='unknown'; EXTRA=none; collation=utf8mb4_unicode_ci | enum('unknown','provisional_sample','verified'); nullable=NO; default='unknown'; EXTRA=none; collation=utf8mb4_unicode_ci |
| raw_material.supplier_name | 15 | varchar(200); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(200); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| raw_material.is_active | 16 | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None |
| raw_material.created_at | 17 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| raw_material.updated_at | 18 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED on update CURRENT_TIMESTAMP(3); collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED on update CURRENT_TIMESTAMP(3); collation=None |
| role.role_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| role.role_name | 2 | enum('Client','Sales','Admin','Accounting','Production','Warehouse','Logistics','Owner','Operations'); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | enum('Client','Sales','Admin','Accounting','Production','Warehouse','Logistics','Owner','Operations'); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| role.description | 3 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| role.is_owner_role | 4 | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='0'; EXTRA=none; collation=None |
| sales_invoice.invoice_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| sales_invoice.invoice_no | 2 | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(60); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| sales_invoice.po_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| sales_invoice.invoice_date | 4 | date; nullable=NO; default=None; EXTRA=none; collation=None | date; nullable=NO; default=None; EXTRA=none; collation=None |
| sales_invoice.payment_terms | 5 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| sales_invoice.delivered_date | 6 | date; nullable=YES; default=None; EXTRA=none; collation=None | date; nullable=YES; default=None; EXTRA=none; collation=None |
| sales_invoice.due_date | 7 | date; nullable=YES; default=None; EXTRA=none; collation=None | date; nullable=YES; default=None; EXTRA=none; collation=None |
| sales_invoice.total_amount | 8 | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None | decimal(19,2); nullable=NO; default=None; EXTRA=none; collation=None |
| sales_invoice.status | 9 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| sales_invoice.issued_by_user_id | 10 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| sales_invoice.created_at | 11 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| signed_delivery_receipt.signed_dr_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| signed_delivery_receipt.delivery_receipt_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| signed_delivery_receipt.document_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| signed_delivery_receipt.submitted_by_user_id | 4 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| signed_delivery_receipt.submitted_at | 5 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| signed_delivery_receipt.received_at | 6 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| stock_movement.movement_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| stock_movement.item_type | 2 | enum('raw_material','finished_good'); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | enum('raw_material','finished_good'); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| stock_movement.raw_material_id | 3 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| stock_movement.finished_good_id | 4 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| stock_movement.movement_reason | 5 | text; nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| stock_movement.quantity_status_before | 6 | enum('unknown','provisional_sample','verified'); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | enum('unknown','provisional_sample','verified'); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| stock_movement.qty_before | 7 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| stock_movement.qty_after | 8 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| stock_movement.qty_change | 9 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| stock_movement.uom_id | 10 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| stock_movement.reference_no | 11 | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| stock_movement.supplier_name | 12 | varchar(200); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(200); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| stock_movement.jo_id | 13 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| stock_movement.notes | 14 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| stock_movement.performed_by_user_id | 15 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| stock_movement.operation_key | 16 | varchar(120); nullable=NO; default=None; EXTRA=none; collation=ascii_bin | varchar(120); nullable=NO; default=None; EXTRA=none; collation=ascii_bin |
| stock_movement.created_at | 17 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| stock_request.stock_request_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| stock_request.inquiry_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| stock_request.requested_by_user_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| stock_request.handled_by_user_id | 4 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| stock_request.request_date | 5 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| stock_request.status | 6 | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| stock_request.remarks | 7 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| stock_request.created_at | 8 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| stock_request.updated_at | 9 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED on update CURRENT_TIMESTAMP(3); collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED on update CURRENT_TIMESTAMP(3); collation=None |
| stock_request_item.stock_request_item_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| stock_request_item.stock_request_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| stock_request_item.raw_material_id | 3 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| stock_request_item.qty_requested | 4 | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=NO; default=None; EXTRA=none; collation=None |
| stock_request_item.stock_at_request | 5 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| stock_request_item.qty_available | 6 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| stock_request_item.shortage_at_request | 7 | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None | decimal(15,4); nullable=YES; default=None; EXTRA=none; collation=None |
| stock_request_item.quantity_status_at_request | 8 | enum('unknown','provisional_sample','verified'); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | enum('unknown','provisional_sample','verified'); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| stock_request_item.available_quantity_status | 9 | enum('unknown','provisional_sample','verified'); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | enum('unknown','provisional_sample','verified'); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| stock_request_item.observed_at | 10 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| stock_request_item.observed_by_user_id | 11 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |
| stock_request_item.uom_id | 12 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| stock_request_item.notes | 13 | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | text; nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| unit_of_measure.uom_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| unit_of_measure.uom_name | 2 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| unit_of_measure.abbreviation | 3 | varchar(20); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(20); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| user_account.user_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| user_account.role_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| user_account.full_name | 3 | varchar(160); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(160); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| user_account.email | 4 | varchar(254); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(254); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| user_account.password_hash | 5 | varchar(255); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(255); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| user_account.initials | 6 | varchar(16); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(16); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| user_account.phone | 7 | varchar(40); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(40); nullable=YES; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| user_account.status | 8 | varchar(30); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(30); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| user_account.must_change_password | 9 | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None | tinyint(1); nullable=NO; default='1'; EXTRA=none; collation=None |
| user_account.joined_date | 10 | date; nullable=YES; default=None; EXTRA=none; collation=None | date; nullable=YES; default=None; EXTRA=none; collation=None |
| user_account.last_login_at | 11 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| user_account.created_at | 12 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| waybill.waybill_id | 1 | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=auto_increment; collation=None |
| waybill.delivery_id | 2 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| waybill.waybill_no | 3 | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci | varchar(80); nullable=NO; default=None; EXTRA=none; collation=utf8mb4_unicode_ci |
| waybill.qr_identifier | 4 | varchar(120); nullable=NO; default=None; EXTRA=none; collation=ascii_bin | varchar(120); nullable=NO; default=None; EXTRA=none; collation=ascii_bin |
| waybill.generated_by_user_id | 5 | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=NO; default=None; EXTRA=none; collation=None |
| waybill.generated_at | 6 | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None | datetime(3); nullable=NO; default='CURRENT_TIMESTAMP(3)'; EXTRA=DEFAULT_GENERATED; collation=None |
| waybill.printed_at | 7 | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None | datetime(3); nullable=YES; default=None; EXTRA=none; collation=None |
| waybill.document_id | 8 | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None | bigint unsigned; nullable=YES; default=None; EXTRA=none; collation=None |

## PK / FK / UQ and referential-action verification

| Table | Constraint | Type | Ordered columns | Referenced schema.table(columns) | Update / delete |
| --- | --- | --- | --- | --- | --- |
| audit_event | audit_event_ibfk_1 | FOREIGN KEY | actor_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| audit_event | PRIMARY | PRIMARY KEY | audit_event_id | ? | ? |
| client | client_ibfk_1 | FOREIGN KEY | preferred_delivery_method_id | enterflow_phase2_db.delivery_method(delivery_method_id) | NO ACTION / NO ACTION |
| client | PRIMARY | PRIMARY KEY | client_id | ? | ? |
| client | uq_client_company | UNIQUE | company_name | ? | ? |
| client_receipt | client_receipt_ibfk_1 | FOREIGN KEY | invoice_id | enterflow_phase2_db.sales_invoice(invoice_id) | NO ACTION / NO ACTION |
| client_receipt | client_receipt_ibfk_2 | FOREIGN KEY | client_user_id | enterflow_phase2_db.client_user(client_user_id) | NO ACTION / NO ACTION |
| client_receipt | client_receipt_ibfk_3 | FOREIGN KEY | payment_method_id | enterflow_phase2_db.payment_method(payment_method_id) | NO ACTION / NO ACTION |
| client_receipt | client_receipt_ibfk_4 | FOREIGN KEY | reviewed_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| client_receipt | PRIMARY | PRIMARY KEY | receipt_id | ? | ? |
| client_receipt | uq_receipt_invoice | UNIQUE | receipt_id, invoice_id | ? | ? |
| client_receipt_file | client_receipt_file_ibfk_1 | FOREIGN KEY | receipt_id | enterflow_phase2_db.client_receipt(receipt_id) | NO ACTION / NO ACTION |
| client_receipt_file | client_receipt_file_ibfk_2 | FOREIGN KEY | document_id | enterflow_phase2_db.document(document_id) | NO ACTION / NO ACTION |
| client_receipt_file | PRIMARY | PRIMARY KEY | receipt_id, document_id | ? | ? |
| client_user | client_user_ibfk_1 | FOREIGN KEY | client_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| client_user | client_user_ibfk_2 | FOREIGN KEY | client_id | enterflow_phase2_db.client(client_id) | NO ACTION / NO ACTION |
| client_user | PRIMARY | PRIMARY KEY | client_user_id | ? | ? |
| client_user | uq_client_user_owner | UNIQUE | client_user_id, client_id | ? | ? |
| client_user | uq_company_portal_login | UNIQUE | client_id | ? | ? |
| cost_estimate | cost_estimate_ibfk_1 | FOREIGN KEY | quotation_item_id | enterflow_phase2_db.quotation_item(quotation_item_id) | NO ACTION / NO ACTION |
| cost_estimate | cost_estimate_ibfk_2 | FOREIGN KEY | created_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| cost_estimate | PRIMARY | PRIMARY KEY | estimate_id | ? | ? |
| cost_estimate_material | cost_estimate_material_ibfk_1 | FOREIGN KEY | estimate_id | enterflow_phase2_db.cost_estimate(estimate_id) | NO ACTION / NO ACTION |
| cost_estimate_material | cost_estimate_material_ibfk_2 | FOREIGN KEY | material_category_id | enterflow_phase2_db.material_category(material_category_id) | NO ACTION / NO ACTION |
| cost_estimate_material | cost_estimate_material_ibfk_3 | FOREIGN KEY | raw_material_id | enterflow_phase2_db.raw_material(material_id) | NO ACTION / NO ACTION |
| cost_estimate_material | cost_estimate_material_ibfk_4 | FOREIGN KEY | uom_id | enterflow_phase2_db.unit_of_measure(uom_id) | NO ACTION / NO ACTION |
| cost_estimate_material | PRIMARY | PRIMARY KEY | estimate_material_id | ? | ? |
| delivery | delivery_ibfk_1 | FOREIGN KEY | jo_id | enterflow_phase2_db.job_order(jo_id) | NO ACTION / NO ACTION |
| delivery | delivery_ibfk_2 | FOREIGN KEY | delivery_method_id | enterflow_phase2_db.delivery_method(delivery_method_id) | NO ACTION / NO ACTION |
| delivery | delivery_ibfk_3 | FOREIGN KEY | dispatched_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| delivery | PRIMARY | PRIMARY KEY | delivery_id | ? | ? |
| delivery_item | delivery_item_ibfk_1 | FOREIGN KEY | delivery_id | enterflow_phase2_db.delivery(delivery_id) | NO ACTION / NO ACTION |
| delivery_item | delivery_item_ibfk_2 | FOREIGN KEY | jo_item_id | enterflow_phase2_db.job_order_item(jo_item_id) | NO ACTION / NO ACTION |
| delivery_item | PRIMARY | PRIMARY KEY | delivery_item_id | ? | ? |
| delivery_item | uq_delivery_item | UNIQUE | delivery_id, jo_item_id | ? | ? |
| delivery_method | PRIMARY | PRIMARY KEY | delivery_method_id | ? | ? |
| delivery_method | uq_delivery_method_name | UNIQUE | method_name | ? | ? |
| delivery_receipt | delivery_receipt_ibfk_1 | FOREIGN KEY | delivery_id | enterflow_phase2_db.delivery(delivery_id) | NO ACTION / NO ACTION |
| delivery_receipt | delivery_receipt_ibfk_2 | FOREIGN KEY | generated_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| delivery_receipt | delivery_receipt_ibfk_3 | FOREIGN KEY | document_id | enterflow_phase2_db.document(document_id) | NO ACTION / NO ACTION |
| delivery_receipt | PRIMARY | PRIMARY KEY | delivery_receipt_id | ? | ? |
| delivery_receipt | uq_dr_delivery | UNIQUE | delivery_id | ? | ? |
| delivery_receipt | uq_dr_number | UNIQUE | dr_no | ? | ? |
| document | document_ibfk_1 | FOREIGN KEY | uploaded_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| document | PRIMARY | PRIMARY KEY | document_id | ? | ? |
| document | uq_document_object_version | UNIQUE | storage_bucket, storage_key, object_generation | ? | ? |
| filter_type | PRIMARY | PRIMARY KEY | filter_type_id | ? | ? |
| filter_type | uq_filter_type_name | UNIQUE | filter_type_name | ? | ? |
| finished_good | finished_good_ibfk_1 | FOREIGN KEY | client_id | enterflow_phase2_db.client(client_id) | NO ACTION / NO ACTION |
| finished_good | finished_good_ibfk_2 | FOREIGN KEY | filter_type_id | enterflow_phase2_db.filter_type(filter_type_id) | NO ACTION / NO ACTION |
| finished_good | PRIMARY | PRIMARY KEY | finished_good_id | ? | ? |
| finished_good | uq_finished_item_code | UNIQUE | item_code | ? | ? |
| inquiry | inquiry_ibfk_1 | FOREIGN KEY | client_id | enterflow_phase2_db.client(client_id) | NO ACTION / NO ACTION |
| inquiry | inquiry_ibfk_2 | FOREIGN KEY | submitted_by_client_user_id, client_id | enterflow_phase2_db.client_user(client_user_id, client_id) | NO ACTION / NO ACTION |
| inquiry | inquiry_ibfk_3 | FOREIGN KEY | created_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| inquiry | PRIMARY | PRIMARY KEY | inquiry_id | ? | ? |
| inquiry | uq_inquiry_number | UNIQUE | inquiry_no | ? | ? |
| inquiry_item | inquiry_item_ibfk_1 | FOREIGN KEY | inquiry_id | enterflow_phase2_db.inquiry(inquiry_id) | NO ACTION / NO ACTION |
| inquiry_item | inquiry_item_ibfk_2 | FOREIGN KEY | filter_type_id | enterflow_phase2_db.filter_type(filter_type_id) | NO ACTION / NO ACTION |
| inquiry_item | inquiry_item_ibfk_3 | FOREIGN KEY | sketch_document_id | enterflow_phase2_db.document(document_id) | NO ACTION / NO ACTION |
| inquiry_item | PRIMARY | PRIMARY KEY | inquiry_item_id | ? | ? |
| inquiry_item | uq_inquiry_line | UNIQUE | inquiry_id, line_no | ? | ? |
| job_order | job_order_ibfk_1 | FOREIGN KEY | po_id | enterflow_phase2_db.purchase_order(po_id) | NO ACTION / NO ACTION |
| job_order | job_order_ibfk_2 | FOREIGN KEY | delivery_method_id | enterflow_phase2_db.delivery_method(delivery_method_id) | NO ACTION / NO ACTION |
| job_order | job_order_ibfk_3 | FOREIGN KEY | prepared_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| job_order | job_order_ibfk_4 | FOREIGN KEY | approved_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| job_order | PRIMARY | PRIMARY KEY | jo_id | ? | ? |
| job_order | uq_jo_number | UNIQUE | jo_no | ? | ? |
| job_order | uq_jo_po | UNIQUE | po_id | ? | ? |
| job_order_item | job_order_item_ibfk_1 | FOREIGN KEY | jo_id | enterflow_phase2_db.job_order(jo_id) | NO ACTION / NO ACTION |
| job_order_item | job_order_item_ibfk_2 | FOREIGN KEY | quotation_item_id | enterflow_phase2_db.quotation_item(quotation_item_id) | NO ACTION / NO ACTION |
| job_order_item | job_order_item_ibfk_3 | FOREIGN KEY | final_sketch_document_id | enterflow_phase2_db.document(document_id) | NO ACTION / NO ACTION |
| job_order_item | PRIMARY | PRIMARY KEY | jo_item_id | ? | ? |
| job_order_item | uq_jo_item_line | UNIQUE | jo_id, line_no | ? | ? |
| job_order_stage | job_order_stage_ibfk_1 | FOREIGN KEY | jo_id | enterflow_phase2_db.job_order(jo_id) | NO ACTION / NO ACTION |
| job_order_stage | job_order_stage_ibfk_2 | FOREIGN KEY | stage_id | enterflow_phase2_db.production_stage(stage_id) | NO ACTION / NO ACTION |
| job_order_stage | job_order_stage_ibfk_3 | FOREIGN KEY | marked_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| job_order_stage | PRIMARY | PRIMARY KEY | jo_stage_id | ? | ? |
| job_order_stage | uq_jo_defined_stage | UNIQUE | jo_id, stage_id | ? | ? |
| material_category | PRIMARY | PRIMARY KEY | material_category_id | ? | ? |
| material_category | uq_material_category_name | UNIQUE | category_name | ? | ? |
| material_shortage_report | material_shortage_report_ibfk_1 | FOREIGN KEY | jo_id | enterflow_phase2_db.job_order(jo_id) | NO ACTION / NO ACTION |
| material_shortage_report | material_shortage_report_ibfk_2 | FOREIGN KEY | jo_stage_id | enterflow_phase2_db.job_order_stage(jo_stage_id) | NO ACTION / NO ACTION |
| material_shortage_report | material_shortage_report_ibfk_3 | FOREIGN KEY | raw_material_id | enterflow_phase2_db.raw_material(material_id) | NO ACTION / NO ACTION |
| material_shortage_report | material_shortage_report_ibfk_4 | FOREIGN KEY | reported_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| material_shortage_report | PRIMARY | PRIMARY KEY | report_id | ? | ? |
| notification | notification_ibfk_1 | FOREIGN KEY | user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| notification | PRIMARY | PRIMARY KEY | notification_id | ? | ? |
| payment_method | PRIMARY | PRIMARY KEY | payment_method_id | ? | ? |
| payment_method | uq_payment_method_name | UNIQUE | method_name | ? | ? |
| payment_transaction | payment_transaction_ibfk_1 | FOREIGN KEY | invoice_id | enterflow_phase2_db.sales_invoice(invoice_id) | NO ACTION / NO ACTION |
| payment_transaction | payment_transaction_ibfk_2 | FOREIGN KEY | payment_method_id | enterflow_phase2_db.payment_method(payment_method_id) | NO ACTION / NO ACTION |
| payment_transaction | payment_transaction_ibfk_3 | FOREIGN KEY | client_receipt_id, invoice_id | enterflow_phase2_db.client_receipt(receipt_id, invoice_id) | NO ACTION / NO ACTION |
| payment_transaction | payment_transaction_ibfk_4 | FOREIGN KEY | recorded_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| payment_transaction | payment_transaction_ibfk_5 | FOREIGN KEY | approved_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| payment_transaction | payment_transaction_ibfk_6 | FOREIGN KEY | official_receipt_document_id | enterflow_phase2_db.document(document_id) | NO ACTION / NO ACTION |
| payment_transaction | PRIMARY | PRIMARY KEY | payment_id | ? | ? |
| payment_transaction | uq_payment_operation | UNIQUE | operation_key | ? | ? |
| production_plan | PRIMARY | PRIMARY KEY | plan_id | ? | ? |
| production_plan | production_plan_ibfk_1 | FOREIGN KEY | client_id | enterflow_phase2_db.client(client_id) | NO ACTION / NO ACTION |
| production_plan | production_plan_ibfk_2 | FOREIGN KEY | finished_good_id | enterflow_phase2_db.finished_good(finished_good_id) | NO ACTION / NO ACTION |
| production_plan | production_plan_ibfk_3 | FOREIGN KEY | jo_id | enterflow_phase2_db.job_order(jo_id) | NO ACTION / NO ACTION |
| production_plan | production_plan_ibfk_4 | FOREIGN KEY | created_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| production_plan | uq_plan_code | UNIQUE | plan_code | ? | ? |
| production_stage | PRIMARY | PRIMARY KEY | stage_id | ? | ? |
| production_stage | uq_stage_name | UNIQUE | stage_name | ? | ? |
| production_stage | uq_stage_order | UNIQUE | stage_order | ? | ? |
| production_stage_event | PRIMARY | PRIMARY KEY | stage_event_id | ? | ? |
| production_stage_event | production_stage_event_ibfk_1 | FOREIGN KEY | jo_stage_id | enterflow_phase2_db.job_order_stage(jo_stage_id) | NO ACTION / NO ACTION |
| production_stage_event | production_stage_event_ibfk_2 | FOREIGN KEY | performed_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| purchase_order | PRIMARY | PRIMARY KEY | po_id | ? | ? |
| purchase_order | purchase_order_ibfk_1 | FOREIGN KEY | quotation_id | enterflow_phase2_db.quotation(quotation_id) | NO ACTION / NO ACTION |
| purchase_order | purchase_order_ibfk_2 | FOREIGN KEY | po_document_id | enterflow_phase2_db.document(document_id) | NO ACTION / NO ACTION |
| purchase_order | purchase_order_ibfk_3 | FOREIGN KEY | delivery_method_id | enterflow_phase2_db.delivery_method(delivery_method_id) | NO ACTION / NO ACTION |
| purchase_order | purchase_order_ibfk_4 | FOREIGN KEY | recorded_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| purchase_order | uq_po_number | UNIQUE | po_no | ? | ? |
| quotation | PRIMARY | PRIMARY KEY | quotation_id | ? | ? |
| quotation | quotation_ibfk_1 | FOREIGN KEY | inquiry_id | enterflow_phase2_db.inquiry(inquiry_id) | NO ACTION / NO ACTION |
| quotation | quotation_ibfk_2 | FOREIGN KEY | prepared_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| quotation | quotation_ibfk_3 | FOREIGN KEY | approved_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| quotation | uq_current_quotation | UNIQUE | current_inquiry_id | ? | ? |
| quotation | uq_quotation_number | UNIQUE | quotation_no | ? | ? |
| quotation | uq_quotation_revision | UNIQUE | inquiry_id, revision_no | ? | ? |
| quotation_item | PRIMARY | PRIMARY KEY | quotation_item_id | ? | ? |
| quotation_item | quotation_item_ibfk_1 | FOREIGN KEY | quotation_id | enterflow_phase2_db.quotation(quotation_id) | NO ACTION / NO ACTION |
| quotation_item | quotation_item_ibfk_2 | FOREIGN KEY | inquiry_item_id | enterflow_phase2_db.inquiry_item(inquiry_item_id) | NO ACTION / NO ACTION |
| quotation_item | quotation_item_ibfk_3 | FOREIGN KEY | uom_id | enterflow_phase2_db.unit_of_measure(uom_id) | NO ACTION / NO ACTION |
| quotation_item | uq_quotation_item_line | UNIQUE | quotation_id, line_no | ? | ? |
| raw_material | PRIMARY | PRIMARY KEY | material_id | ? | ? |
| raw_material | raw_material_ibfk_1 | FOREIGN KEY | material_category_id | enterflow_phase2_db.material_category(material_category_id) | NO ACTION / NO ACTION |
| raw_material | raw_material_ibfk_2 | FOREIGN KEY | uom_id | enterflow_phase2_db.unit_of_measure(uom_id) | NO ACTION / NO ACTION |
| raw_material | raw_material_ibfk_3 | FOREIGN KEY | unit_price_approved_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| raw_material | raw_material_ibfk_4 | FOREIGN KEY | reference_document_id | enterflow_phase2_db.document(document_id) | NO ACTION / NO ACTION |
| role | PRIMARY | PRIMARY KEY | role_id | ? | ? |
| role | uq_role_name | UNIQUE | role_name | ? | ? |
| sales_invoice | PRIMARY | PRIMARY KEY | invoice_id | ? | ? |
| sales_invoice | sales_invoice_ibfk_1 | FOREIGN KEY | po_id | enterflow_phase2_db.purchase_order(po_id) | NO ACTION / NO ACTION |
| sales_invoice | sales_invoice_ibfk_2 | FOREIGN KEY | issued_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| sales_invoice | uq_invoice_number | UNIQUE | invoice_no | ? | ? |
| sales_invoice | uq_invoice_po | UNIQUE | po_id | ? | ? |
| signed_delivery_receipt | PRIMARY | PRIMARY KEY | signed_dr_id | ? | ? |
| signed_delivery_receipt | signed_delivery_receipt_ibfk_1 | FOREIGN KEY | delivery_receipt_id | enterflow_phase2_db.delivery_receipt(delivery_receipt_id) | NO ACTION / NO ACTION |
| signed_delivery_receipt | signed_delivery_receipt_ibfk_2 | FOREIGN KEY | document_id | enterflow_phase2_db.document(document_id) | NO ACTION / NO ACTION |
| signed_delivery_receipt | signed_delivery_receipt_ibfk_3 | FOREIGN KEY | submitted_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| signed_delivery_receipt | uq_signed_dr_document | UNIQUE | document_id | ? | ? |
| stock_movement | PRIMARY | PRIMARY KEY | movement_id | ? | ? |
| stock_movement | stock_movement_ibfk_1 | FOREIGN KEY | raw_material_id | enterflow_phase2_db.raw_material(material_id) | NO ACTION / NO ACTION |
| stock_movement | stock_movement_ibfk_2 | FOREIGN KEY | finished_good_id | enterflow_phase2_db.finished_good(finished_good_id) | NO ACTION / NO ACTION |
| stock_movement | stock_movement_ibfk_3 | FOREIGN KEY | uom_id | enterflow_phase2_db.unit_of_measure(uom_id) | NO ACTION / NO ACTION |
| stock_movement | stock_movement_ibfk_4 | FOREIGN KEY | jo_id | enterflow_phase2_db.job_order(jo_id) | NO ACTION / NO ACTION |
| stock_movement | stock_movement_ibfk_5 | FOREIGN KEY | performed_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| stock_movement | uq_stock_operation | UNIQUE | operation_key | ? | ? |
| stock_request | PRIMARY | PRIMARY KEY | stock_request_id | ? | ? |
| stock_request | stock_request_ibfk_1 | FOREIGN KEY | inquiry_id | enterflow_phase2_db.inquiry(inquiry_id) | NO ACTION / NO ACTION |
| stock_request | stock_request_ibfk_2 | FOREIGN KEY | requested_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| stock_request | stock_request_ibfk_3 | FOREIGN KEY | handled_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| stock_request_item | PRIMARY | PRIMARY KEY | stock_request_item_id | ? | ? |
| stock_request_item | stock_request_item_ibfk_1 | FOREIGN KEY | stock_request_id | enterflow_phase2_db.stock_request(stock_request_id) | NO ACTION / NO ACTION |
| stock_request_item | stock_request_item_ibfk_2 | FOREIGN KEY | raw_material_id | enterflow_phase2_db.raw_material(material_id) | NO ACTION / NO ACTION |
| stock_request_item | stock_request_item_ibfk_3 | FOREIGN KEY | uom_id | enterflow_phase2_db.unit_of_measure(uom_id) | NO ACTION / NO ACTION |
| stock_request_item | stock_request_item_ibfk_4 | FOREIGN KEY | observed_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| stock_request_item | uq_request_material | UNIQUE | stock_request_id, raw_material_id | ? | ? |
| unit_of_measure | PRIMARY | PRIMARY KEY | uom_id | ? | ? |
| unit_of_measure | uq_uom_abbreviation | UNIQUE | abbreviation | ? | ? |
| unit_of_measure | uq_uom_name | UNIQUE | uom_name | ? | ? |
| user_account | PRIMARY | PRIMARY KEY | user_id | ? | ? |
| user_account | uq_user_email | UNIQUE | email | ? | ? |
| user_account | user_account_ibfk_1 | FOREIGN KEY | role_id | enterflow_phase2_db.role(role_id) | NO ACTION / NO ACTION |
| waybill | PRIMARY | PRIMARY KEY | waybill_id | ? | ? |
| waybill | uq_waybill_delivery | UNIQUE | delivery_id | ? | ? |
| waybill | uq_waybill_number | UNIQUE | waybill_no | ? | ? |
| waybill | uq_waybill_qr | UNIQUE | qr_identifier | ? | ? |
| waybill | waybill_ibfk_1 | FOREIGN KEY | delivery_id | enterflow_phase2_db.delivery(delivery_id) | NO ACTION / NO ACTION |
| waybill | waybill_ibfk_2 | FOREIGN KEY | generated_by_user_id | enterflow_phase2_db.user_account(user_id) | NO ACTION / NO ACTION |
| waybill | waybill_ibfk_3 | FOREIGN KEY | document_id | enterflow_phase2_db.document(document_id) | NO ACTION / NO ACTION |

The restored schema has the same constraint names, ordered columns, parent table/column paths and actions; its FK schema qualifier points to itself. Both schemas were independently compared with SQL declarations, not just with each other. No FK was accepted merely because its count matched.

## CHECK metadata display format

Fresh INFORMATION_SCHEMA CHECK_CLAUSE text escapes charset-introduced string delimiters (for example `_utf8mb4\\'Owner\\'`). A supplementary read-only SHOW CREATE TABLE role query returned the canonical expression `is_owner_role = (role_name = _utf8mb4'Owner')`. The comparison decodes only those simple literal delimiter escapes; actual clauses are retained verbatim below. This display serialization is not a schema discrepancy. No CHECK was altered.

## CHECK constraints and enforcement

| Table | CHECK | Primary ENFORCED | Restored ENFORCED | Actual clause |
| --- | --- | --- | --- | --- |
| client_receipt | ck_receipt_amount | YES | YES | (amount_declared > 0) |
| client_receipt | ck_receipt_review | YES | YES | (((review_status = _utf8mb4\'pending\') and (reviewed_by_user_id is null) and (reviewed_at is null)) or ((review_status in (_utf8mb4\'verified\',_utf8mb4\'rejected\')) and (reviewed_by_user_id is not null) and (reviewed_at is not null))) |
| cost_estimate | ck_estimate_flags | YES | YES | ((include_labor in (0,1)) and (apply_markup in (0,1)) and (apply_vat in (0,1)) and (is_locked in (0,1))) |
| cost_estimate | ck_estimate_values | YES | YES | ((labor_cost_per_unit >= 0) and (markup_percent >= 0) and (vat_rate between 0 and 100) and (material_cost_per_unit >= 0) and (unit_cost_with_markup >= 0) and (unit_cost_with_vat >= 0)) |
| cost_estimate_material | ck_estimate_material_values | YES | YES | ((qty_per_filter > 0) and (unit_price_snapshot >= 0)) |
| delivery_item | ck_delivery_item_quantity | YES | YES | (quantity > 0) |
| document | ck_document_available | YES | YES | ((storage_status <> _utf8mb4\'available\') or ((storage_bucket is not null) and (storage_key is not null) and (object_generation is not null))) |
| finished_good | ck_finished_average | YES | YES | ((avg_qty_per_order is null) or (avg_qty_per_order >= 0)) |
| finished_good | ck_finished_quantity | YES | YES | (((quantity_status = _utf8mb4\'unknown\') and (qty_in_stock is null)) or ((quantity_status in (_utf8mb4\'provisional_sample\',_utf8mb4\'verified\')) and (qty_in_stock is not null))) |
| finished_good | ck_finished_threshold | YES | YES | (((threshold_status = _utf8mb4\'unknown\') and (buffer_min is null)) or ((threshold_status in (_utf8mb4\'provisional_sample\',_utf8mb4\'verified\')) and (buffer_min is not null))) |
| inquiry | ck_inquiry_creator | YES | YES | ((submitted_by_client_user_id is not null) or (created_by_user_id is not null)) |
| inquiry_item | ck_inquiry_line_quantity | YES | YES | ((quantity > 0) and (line_no > 0)) |
| job_order | ck_jo_verification_flags | YES | YES | ((po_verified in (0,1)) and (specs_verified in (0,1)) and (terms_verified in (0,1))) |
| job_order_item | ck_jo_item_quantity | YES | YES | ((quantity > 0) and (line_no > 0)) |
| job_order_stage | ck_stage_times | YES | YES | (((status = _utf8mb4\'pending\') and (started_at is null) and (completed_at is null)) or ((status = _utf8mb4\'in_progress\') and (started_at is not null) and (completed_at is null) and (marked_by_user_id is not null)) or ((status = _utf8mb4\'completed\') and (started_at is not null) and (completed_at is not null) and (completed_at >= started_at) and (marked_by_user_id is not null))) |
| material_shortage_report | ck_shortage_quantity | YES | YES | (qty_needed > 0) |
| material_shortage_report | ck_shortage_resolved | YES | YES | ((resolved_at is null) or (resolved_at >= reported_at)) |
| notification | ck_notification_read | YES | YES | (((is_read = 0) and (read_at is null)) or ((is_read = 1) and (read_at is not null))) |
| payment_transaction | ck_confirmed_payment | YES | YES | ((amount > 0) and (approval_status = _utf8mb4\'approved\')) |
| production_plan | ck_production_plan | YES | YES | ((planned_qty > 0) and (week_end_date >= week_start_date) and ((finished_good_id is not null) or (jo_id is not null))) |
| production_stage | ck_ten_stage_positions | YES | YES | (stage_order between 1 and 10) |
| production_stage_event | ck_stage_reversion_reason | YES | YES | ((action <> _utf8mb4\'reverted\') or ((reason is not null) and (char_length(trim(reason)) > 0))) |
| quotation | ck_quotation_current | YES | YES | (is_current in (0,1)) |
| quotation | ck_quotation_dates | YES | YES | (valid_until >= quotation_date) |
| quotation | ck_quotation_money | YES | YES | ((subtotal >= 0) and (addons_total >= 0) and (total_amount >= 0) and (requires_downpayment = 1) and (downpayment_percent in (20,50)) and (downpayment_amount = round(((total_amount * downpayment_percent) / 100),2))) |
| quotation_item | ck_quotation_item_values | YES | YES | ((line_no > 0) and (quantity > 0) and (unit_price >= 0)) |
| raw_material | ck_raw_costing_price | YES | YES | (((unit_price is null) and (unit_price_approved_by_user_id is null) and (unit_price_approved_at is null)) or ((unit_price is not null) and (unit_price >= 0) and (unit_price_approved_by_user_id is not null) and (unit_price_approved_at is not null))) |
| raw_material | ck_raw_quantity | YES | YES | (((quantity_status = _utf8mb4\'unknown\') and (qty_in_stock is null)) or ((quantity_status in (_utf8mb4\'provisional_sample\',_utf8mb4\'verified\')) and (qty_in_stock is not null) and (qty_in_stock >= 0))) |
| raw_material | ck_raw_threshold | YES | YES | (((threshold_status = _utf8mb4\'unknown\') and (reorder_threshold is null)) or ((threshold_status in (_utf8mb4\'provisional_sample\',_utf8mb4\'verified\')) and (reorder_threshold is not null) and (reorder_threshold >= 0))) |
| raw_material | ck_reference_price | YES | YES | ((reference_unit_price is null) or (reference_unit_price >= 0)) |
| role | ck_role_owner | YES | YES | (is_owner_role = (role_name = _utf8mb4\'Owner\')) |
| sales_invoice | ck_invoice_total | YES | YES | (total_amount >= 0) |
| stock_movement | ck_finished_movement_units | YES | YES | ((item_type <> _utf8mb4\'finished_good\') or ((qty_after = floor(qty_after)) and ((qty_before is null) or (qty_before = floor(qty_before))))) |
| stock_movement | ck_stock_item_xor | YES | YES | (((item_type = _utf8mb4\'raw_material\') and (raw_material_id is not null) and (finished_good_id is null) and (uom_id is not null)) or ((item_type = _utf8mb4\'finished_good\') and (raw_material_id is null) and (finished_good_id is not null) and (uom_id is null))) |
| stock_movement | ck_stock_observation | YES | YES | ((qty_after >= 0) and (((quantity_status_before = _utf8mb4\'verified\') and (qty_before is not null) and (qty_before >= 0) and (qty_change is not null) and (qty_after = (qty_before + qty_change))) or ((quantity_status_before in (_utf8mb4\'unknown\',_utf8mb4\'provisional_sample\')) and (qty_before is null) and (qty_change is null)))) |
| stock_movement | ck_stock_reason | YES | YES | (char_length(trim(movement_reason)) > 0) |
| stock_request_item | ck_request_response | YES | YES | (((available_quantity_status is null) and (qty_available is null) and (observed_at is null) and (observed_by_user_id is null)) or ((available_quantity_status is not null) and (observed_at is not null) and (observed_by_user_id is not null) and (((available_quantity_status = _utf8mb4\'verified\') and (qty_available is not null) and (qty_available >= 0)) or ((available_quantity_status in (_utf8mb4\'unknown\',_utf8mb4\'provisional_sample\')) and (qty_available is null))))) |
| stock_request_item | ck_request_snapshot_provenance | YES | YES | (((quantity_status_at_request = _utf8mb4\'verified\') and (stock_at_request is not null) and (stock_at_request >= 0) and (shortage_at_request is not null) and (shortage_at_request = greatest((qty_requested - stock_at_request),0))) or ((quantity_status_at_request in (_utf8mb4\'unknown\',_utf8mb4\'provisional_sample\')) and (stock_at_request is null) and (shortage_at_request is null))) |
| stock_request_item | ck_requested_quantity | YES | YES | (qty_requested > 0) |
| user_account | ck_user_password_flag | YES | YES | (must_change_password in (0,1)) |

ENFORCED is read from current information_schema.table_constraints, not inferred from version or prior reports. Every declared CHECK and its parsed expression was compared. No violating INSERT/UPDATE was attempted: metadata enforcement flags do not constitute a behavioral mutation test.

## Complete index verification

| Table | Index | Unique | Ordered columns | Prefix / expression | Direction / type / visible |
| --- | --- | --- | --- | --- | --- |
| audit_event | actor_user_id | False | actor_user_id | None / None | A / BTREE / YES |
| audit_event | ix_audit_subject | False | subject_type, subject_id, occurred_at | None / None; None / None; None / None | A / BTREE / YES; A / BTREE / YES; A / BTREE / YES |
| audit_event | PRIMARY | True | audit_event_id | None / None | A / BTREE / YES |
| client | preferred_delivery_method_id | False | preferred_delivery_method_id | None / None | A / BTREE / YES |
| client | PRIMARY | True | client_id | None / None | A / BTREE / YES |
| client | uq_client_company | True | company_name | None / None | A / BTREE / YES |
| client_receipt | client_user_id | False | client_user_id | None / None | A / BTREE / YES |
| client_receipt | invoice_id | False | invoice_id | None / None | A / BTREE / YES |
| client_receipt | ix_receipt_review | False | review_status, sent_at | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| client_receipt | payment_method_id | False | payment_method_id | None / None | A / BTREE / YES |
| client_receipt | PRIMARY | True | receipt_id | None / None | A / BTREE / YES |
| client_receipt | reviewed_by_user_id | False | reviewed_by_user_id | None / None | A / BTREE / YES |
| client_receipt | uq_receipt_invoice | True | receipt_id, invoice_id | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| client_receipt_file | document_id | False | document_id | None / None | A / BTREE / YES |
| client_receipt_file | PRIMARY | True | receipt_id, document_id | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| client_user | PRIMARY | True | client_user_id | None / None | A / BTREE / YES |
| client_user | uq_client_user_owner | True | client_user_id, client_id | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| client_user | uq_company_portal_login | True | client_id | None / None | A / BTREE / YES |
| cost_estimate | created_by_user_id | False | created_by_user_id | None / None | A / BTREE / YES |
| cost_estimate | ix_estimate_item_history | False | quotation_item_id, created_at | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| cost_estimate | PRIMARY | True | estimate_id | None / None | A / BTREE / YES |
| cost_estimate_material | estimate_id | False | estimate_id | None / None | A / BTREE / YES |
| cost_estimate_material | material_category_id | False | material_category_id | None / None | A / BTREE / YES |
| cost_estimate_material | PRIMARY | True | estimate_material_id | None / None | A / BTREE / YES |
| cost_estimate_material | raw_material_id | False | raw_material_id | None / None | A / BTREE / YES |
| cost_estimate_material | uom_id | False | uom_id | None / None | A / BTREE / YES |
| delivery | delivery_method_id | False | delivery_method_id | None / None | A / BTREE / YES |
| delivery | dispatched_by_user_id | False | dispatched_by_user_id | None / None | A / BTREE / YES |
| delivery | ix_delivery_queue | False | status, estimated_delivery_date | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| delivery | jo_id | False | jo_id | None / None | A / BTREE / YES |
| delivery | PRIMARY | True | delivery_id | None / None | A / BTREE / YES |
| delivery_item | jo_item_id | False | jo_item_id | None / None | A / BTREE / YES |
| delivery_item | PRIMARY | True | delivery_item_id | None / None | A / BTREE / YES |
| delivery_item | uq_delivery_item | True | delivery_id, jo_item_id | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| delivery_method | PRIMARY | True | delivery_method_id | None / None | A / BTREE / YES |
| delivery_method | uq_delivery_method_name | True | method_name | None / None | A / BTREE / YES |
| delivery_receipt | document_id | False | document_id | None / None | A / BTREE / YES |
| delivery_receipt | generated_by_user_id | False | generated_by_user_id | None / None | A / BTREE / YES |
| delivery_receipt | PRIMARY | True | delivery_receipt_id | None / None | A / BTREE / YES |
| delivery_receipt | uq_dr_delivery | True | delivery_id | None / None | A / BTREE / YES |
| delivery_receipt | uq_dr_number | True | dr_no | None / None | A / BTREE / YES |
| document | PRIMARY | True | document_id | None / None | A / BTREE / YES |
| document | uploaded_by_user_id | False | uploaded_by_user_id | None / None | A / BTREE / YES |
| document | uq_document_object_version | True | storage_bucket, storage_key, object_generation | None / None; None / None; None / None | A / BTREE / YES; A / BTREE / YES; A / BTREE / YES |
| filter_type | PRIMARY | True | filter_type_id | None / None | A / BTREE / YES |
| filter_type | uq_filter_type_name | True | filter_type_name | None / None | A / BTREE / YES |
| finished_good | filter_type_id | False | filter_type_id | None / None | A / BTREE / YES |
| finished_good | ix_finished_client | False | client_id, item_name | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| finished_good | PRIMARY | True | finished_good_id | None / None | A / BTREE / YES |
| finished_good | uq_finished_item_code | True | item_code | None / None | A / BTREE / YES |
| inquiry | created_by_user_id | False | created_by_user_id | None / None | A / BTREE / YES |
| inquiry | ix_inquiry_client_queue | False | client_id, status, created_at | None / None; None / None; None / None | A / BTREE / YES; A / BTREE / YES; A / BTREE / YES |
| inquiry | PRIMARY | True | inquiry_id | None / None | A / BTREE / YES |
| inquiry | submitted_by_client_user_id | False | submitted_by_client_user_id, client_id | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| inquiry | uq_inquiry_number | True | inquiry_no | None / None | A / BTREE / YES |
| inquiry_item | filter_type_id | False | filter_type_id | None / None | A / BTREE / YES |
| inquiry_item | PRIMARY | True | inquiry_item_id | None / None | A / BTREE / YES |
| inquiry_item | sketch_document_id | False | sketch_document_id | None / None | A / BTREE / YES |
| inquiry_item | uq_inquiry_line | True | inquiry_id, line_no | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| job_order | approved_by_user_id | False | approved_by_user_id | None / None | A / BTREE / YES |
| job_order | delivery_method_id | False | delivery_method_id | None / None | A / BTREE / YES |
| job_order | ix_jo_queue | False | status, due_date | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| job_order | prepared_by_user_id | False | prepared_by_user_id | None / None | A / BTREE / YES |
| job_order | PRIMARY | True | jo_id | None / None | A / BTREE / YES |
| job_order | uq_jo_number | True | jo_no | None / None | A / BTREE / YES |
| job_order | uq_jo_po | True | po_id | None / None | A / BTREE / YES |
| job_order_item | final_sketch_document_id | False | final_sketch_document_id | None / None | A / BTREE / YES |
| job_order_item | PRIMARY | True | jo_item_id | None / None | A / BTREE / YES |
| job_order_item | quotation_item_id | False | quotation_item_id | None / None | A / BTREE / YES |
| job_order_item | uq_jo_item_line | True | jo_id, line_no | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| job_order_stage | marked_by_user_id | False | marked_by_user_id | None / None | A / BTREE / YES |
| job_order_stage | PRIMARY | True | jo_stage_id | None / None | A / BTREE / YES |
| job_order_stage | stage_id | False | stage_id | None / None | A / BTREE / YES |
| job_order_stage | uq_jo_defined_stage | True | jo_id, stage_id | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| material_category | PRIMARY | True | material_category_id | None / None | A / BTREE / YES |
| material_category | uq_material_category_name | True | category_name | None / None | A / BTREE / YES |
| material_shortage_report | ix_shortage_queue | False | status, reported_at | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| material_shortage_report | jo_id | False | jo_id | None / None | A / BTREE / YES |
| material_shortage_report | jo_stage_id | False | jo_stage_id | None / None | A / BTREE / YES |
| material_shortage_report | PRIMARY | True | report_id | None / None | A / BTREE / YES |
| material_shortage_report | raw_material_id | False | raw_material_id | None / None | A / BTREE / YES |
| material_shortage_report | reported_by_user_id | False | reported_by_user_id | None / None | A / BTREE / YES |
| notification | ix_user_notifications | False | user_id, is_read, created_at | None / None; None / None; None / None | A / BTREE / YES; A / BTREE / YES; A / BTREE / YES |
| notification | PRIMARY | True | notification_id | None / None | A / BTREE / YES |
| payment_method | PRIMARY | True | payment_method_id | None / None | A / BTREE / YES |
| payment_method | uq_payment_method_name | True | method_name | None / None | A / BTREE / YES |
| payment_transaction | approved_by_user_id | False | approved_by_user_id | None / None | A / BTREE / YES |
| payment_transaction | client_receipt_id | False | client_receipt_id, invoice_id | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| payment_transaction | ix_invoice_payments | False | invoice_id, date_paid | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| payment_transaction | official_receipt_document_id | False | official_receipt_document_id | None / None | A / BTREE / YES |
| payment_transaction | payment_method_id | False | payment_method_id | None / None | A / BTREE / YES |
| payment_transaction | PRIMARY | True | payment_id | None / None | A / BTREE / YES |
| payment_transaction | recorded_by_user_id | False | recorded_by_user_id | None / None | A / BTREE / YES |
| payment_transaction | uq_payment_operation | True | operation_key | None / None | A / BTREE / YES |
| production_plan | client_id | False | client_id | None / None | A / BTREE / YES |
| production_plan | created_by_user_id | False | created_by_user_id | None / None | A / BTREE / YES |
| production_plan | finished_good_id | False | finished_good_id | None / None | A / BTREE / YES |
| production_plan | jo_id | False | jo_id | None / None | A / BTREE / YES |
| production_plan | PRIMARY | True | plan_id | None / None | A / BTREE / YES |
| production_plan | uq_plan_code | True | plan_code | None / None | A / BTREE / YES |
| production_stage | PRIMARY | True | stage_id | None / None | A / BTREE / YES |
| production_stage | uq_stage_name | True | stage_name | None / None | A / BTREE / YES |
| production_stage | uq_stage_order | True | stage_order | None / None | A / BTREE / YES |
| production_stage_event | ix_stage_event_history | False | jo_stage_id, occurred_at, stage_event_id | None / None; None / None; None / None | A / BTREE / YES; A / BTREE / YES; A / BTREE / YES |
| production_stage_event | performed_by_user_id | False | performed_by_user_id | None / None | A / BTREE / YES |
| production_stage_event | PRIMARY | True | stage_event_id | None / None | A / BTREE / YES |
| purchase_order | delivery_method_id | False | delivery_method_id | None / None | A / BTREE / YES |
| purchase_order | po_document_id | False | po_document_id | None / None | A / BTREE / YES |
| purchase_order | PRIMARY | True | po_id | None / None | A / BTREE / YES |
| purchase_order | quotation_id | False | quotation_id | None / None | A / BTREE / YES |
| purchase_order | recorded_by_user_id | False | recorded_by_user_id | None / None | A / BTREE / YES |
| purchase_order | uq_po_number | True | po_no | None / None | A / BTREE / YES |
| quotation | approved_by_user_id | False | approved_by_user_id | None / None | A / BTREE / YES |
| quotation | prepared_by_user_id | False | prepared_by_user_id | None / None | A / BTREE / YES |
| quotation | PRIMARY | True | quotation_id | None / None | A / BTREE / YES |
| quotation | uq_current_quotation | True | current_inquiry_id | None / None | A / BTREE / YES |
| quotation | uq_quotation_number | True | quotation_no | None / None | A / BTREE / YES |
| quotation | uq_quotation_revision | True | inquiry_id, revision_no | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| quotation_item | inquiry_item_id | False | inquiry_item_id | None / None | A / BTREE / YES |
| quotation_item | PRIMARY | True | quotation_item_id | None / None | A / BTREE / YES |
| quotation_item | uom_id | False | uom_id | None / None | A / BTREE / YES |
| quotation_item | uq_quotation_item_line | True | quotation_id, line_no | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| raw_material | ix_material_category_name | False | material_category_id, material_name | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| raw_material | PRIMARY | True | material_id | None / None | A / BTREE / YES |
| raw_material | reference_document_id | False | reference_document_id | None / None | A / BTREE / YES |
| raw_material | unit_price_approved_by_user_id | False | unit_price_approved_by_user_id | None / None | A / BTREE / YES |
| raw_material | uom_id | False | uom_id | None / None | A / BTREE / YES |
| role | PRIMARY | True | role_id | None / None | A / BTREE / YES |
| role | uq_role_name | True | role_name | None / None | A / BTREE / YES |
| sales_invoice | issued_by_user_id | False | issued_by_user_id | None / None | A / BTREE / YES |
| sales_invoice | ix_invoice_due | False | status, due_date | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| sales_invoice | PRIMARY | True | invoice_id | None / None | A / BTREE / YES |
| sales_invoice | uq_invoice_number | True | invoice_no | None / None | A / BTREE / YES |
| sales_invoice | uq_invoice_po | True | po_id | None / None | A / BTREE / YES |
| signed_delivery_receipt | delivery_receipt_id | False | delivery_receipt_id | None / None | A / BTREE / YES |
| signed_delivery_receipt | PRIMARY | True | signed_dr_id | None / None | A / BTREE / YES |
| signed_delivery_receipt | submitted_by_user_id | False | submitted_by_user_id | None / None | A / BTREE / YES |
| signed_delivery_receipt | uq_signed_dr_document | True | document_id | None / None | A / BTREE / YES |
| stock_movement | ix_finished_movement_history | False | finished_good_id, created_at, movement_id | None / None; None / None; None / None | A / BTREE / YES; A / BTREE / YES; A / BTREE / YES |
| stock_movement | ix_raw_movement_history | False | raw_material_id, created_at, movement_id | None / None; None / None; None / None | A / BTREE / YES; A / BTREE / YES; A / BTREE / YES |
| stock_movement | jo_id | False | jo_id | None / None | A / BTREE / YES |
| stock_movement | performed_by_user_id | False | performed_by_user_id | None / None | A / BTREE / YES |
| stock_movement | PRIMARY | True | movement_id | None / None | A / BTREE / YES |
| stock_movement | uom_id | False | uom_id | None / None | A / BTREE / YES |
| stock_movement | uq_stock_operation | True | operation_key | None / None | A / BTREE / YES |
| stock_request | handled_by_user_id | False | handled_by_user_id | None / None | A / BTREE / YES |
| stock_request | inquiry_id | False | inquiry_id | None / None | A / BTREE / YES |
| stock_request | ix_stock_request_queue | False | status, request_date | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| stock_request | PRIMARY | True | stock_request_id | None / None | A / BTREE / YES |
| stock_request | requested_by_user_id | False | requested_by_user_id | None / None | A / BTREE / YES |
| stock_request_item | observed_by_user_id | False | observed_by_user_id | None / None | A / BTREE / YES |
| stock_request_item | PRIMARY | True | stock_request_item_id | None / None | A / BTREE / YES |
| stock_request_item | raw_material_id | False | raw_material_id | None / None | A / BTREE / YES |
| stock_request_item | uom_id | False | uom_id | None / None | A / BTREE / YES |
| stock_request_item | uq_request_material | True | stock_request_id, raw_material_id | None / None; None / None | A / BTREE / YES; A / BTREE / YES |
| unit_of_measure | PRIMARY | True | uom_id | None / None | A / BTREE / YES |
| unit_of_measure | uq_uom_abbreviation | True | abbreviation | None / None | A / BTREE / YES |
| unit_of_measure | uq_uom_name | True | uom_name | None / None | A / BTREE / YES |
| user_account | PRIMARY | True | user_id | None / None | A / BTREE / YES |
| user_account | role_id | False | role_id | None / None | A / BTREE / YES |
| user_account | uq_user_email | True | email | None / None | A / BTREE / YES |
| waybill | document_id | False | document_id | None / None | A / BTREE / YES |
| waybill | generated_by_user_id | False | generated_by_user_id | None / None | A / BTREE / YES |
| waybill | PRIMARY | True | waybill_id | None / None | A / BTREE / YES |
| waybill | uq_waybill_delivery | True | delivery_id | None / None | A / BTREE / YES |
| waybill | uq_waybill_number | True | waybill_no | None / None | A / BTREE / YES |
| waybill | uq_waybill_qr | True | qr_identifier | None / None | A / BTREE / YES |

Names, uniqueness, order, prefix lengths, functional expressions, ascending direction, BTREE type and visibility were verified. Expected implicit FK-supporting indexes were obtained from the physical ERD, not treated as unexpected extras. Primary-versus-restoration comparison includes all captured index fields.

## Triggers and other schema objects

| Trigger | Table | Timing / event | Actual body SHA-256 | Source / restored match |
| --- | --- | --- | --- | --- |
| audit_event_append_only_delete | audit_event | BEFORE / DELETE | 0d60bc84e63942c32695d91da9a62bf037697c61f2fef5a1502459edf39bd078 | True |
| audit_event_append_only_update | audit_event | BEFORE / UPDATE | 0d60bc84e63942c32695d91da9a62bf037697c61f2fef5a1502459edf39bd078 | True |
| client_user_client_id_history | client_user | BEFORE / UPDATE | feaeb5d073495529d95d62858b12603ba7c60705c7b29f1bfcc53182e53a9869 | True |
| client_user_role_bi | client_user | BEFORE / INSERT | 5f79988dca02d1a3ac014b71eac1ee82545dfb47da78e0667533babbc769983c | True |
| client_user_role_bu | client_user | BEFORE / UPDATE | 5f79988dca02d1a3ac014b71eac1ee82545dfb47da78e0667533babbc769983c | True |
| delivery_item_owner_bi | delivery_item | BEFORE / INSERT | a74401756671dcbc1ba1d0b5f9e8161fdc15415e65faf0633b2abe2f120ce515 | True |
| delivery_item_owner_bu | delivery_item | BEFORE / UPDATE | a74401756671dcbc1ba1d0b5f9e8161fdc15415e65faf0633b2abe2f120ce515 | True |
| delivery_jo_id_history | delivery | BEFORE / UPDATE | 2859f31d10e9c4f81daa006761aa5586b9e27feda573520456f50c4f5ef7552a | True |
| finished_good_client_id_history | finished_good | BEFORE / UPDATE | 6a91243c67c2af74c22fca533e9142cb2c497a0cbb82e3f316596116b868da4f | True |
| inquiry_client_id_history | inquiry | BEFORE / UPDATE | 79b28346d0c54913349c0f08db9cb99d0790fb21163b6e24435f5a5b666cec48 | True |
| inquiry_item_inquiry_id_history | inquiry_item | BEFORE / UPDATE | 7c8069b64b7733b284d71e84c7804019b8b4823a69b245e5dc252ca4ae2c4d5c | True |
| job_order_item_jo_id_history | job_order_item | BEFORE / UPDATE | 15863172cce758498611ac16cb903884bc7c1a76d81be0c9d567b01d38853064 | True |
| job_order_po_id_history | job_order | BEFORE / UPDATE | 39da9b19c0800920872cc000429fa5f4db53f1faef2e21930ea86d2bc621f431 | True |
| job_order_stage_jo_id_history | job_order_stage | BEFORE / UPDATE | f7c273c043e8f2913ae2e932228bc6123d1685ed211d15f461628b765e02c853 | True |
| jo_item_source_bi | job_order_item | BEFORE / INSERT | 207a73d94dd535797ee66d3283fe304b9dab9e0090f83be84300817a5d9b10ef | True |
| jo_item_source_bu | job_order_item | BEFORE / UPDATE | 207a73d94dd535797ee66d3283fe304b9dab9e0090f83be84300817a5d9b10ef | True |
| movement_jo_client_bi | stock_movement | BEFORE / INSERT | bf32975a80e8e24f52a7ff99fc033286a74d9ec1a098148b5c0e54e8aa322fce | True |
| movement_jo_client_bu | stock_movement | BEFORE / UPDATE | bf32975a80e8e24f52a7ff99fc033286a74d9ec1a098148b5c0e54e8aa322fce | True |
| plan_client_owner_bi | production_plan | BEFORE / INSERT | 8bbf872b8806136eaeaf507d341e3b6b0b40664534646616d71d61b23859571a | True |
| plan_client_owner_bu | production_plan | BEFORE / UPDATE | 8bbf872b8806136eaeaf507d341e3b6b0b40664534646616d71d61b23859571a | True |
| production_stage_event_append_only_delete | production_stage_event | BEFORE / DELETE | 0d60bc84e63942c32695d91da9a62bf037697c61f2fef5a1502459edf39bd078 | True |
| production_stage_event_append_only_update | production_stage_event | BEFORE / UPDATE | 0d60bc84e63942c32695d91da9a62bf037697c61f2fef5a1502459edf39bd078 | True |
| purchase_order_quotation_id_history | purchase_order | BEFORE / UPDATE | f1a5ddf952b9dbd86f010b5c27d10f5cb1e67996787c0f96103655badc4e51b6 | True |
| quotation_inquiry_id_history | quotation | BEFORE / UPDATE | 22107860c05fb8e6e1f1732a85928e88f5e9f9575297fec3ae4867f8ccf7801f | True |
| quotation_item_quotation_id_history | quotation_item | BEFORE / UPDATE | 16fb1020c852c0e12fae5138c0f6610ca37c49f526d0985c5e6d2164c269a6b7 | True |
| quote_item_source_bi | quotation_item | BEFORE / INSERT | 56eebdd130d17a24b62d067ca3c129c0db7044abf859c55d496a432217b9b87d | True |
| quote_item_source_bu | quotation_item | BEFORE / UPDATE | 56eebdd130d17a24b62d067ca3c129c0db7044abf859c55d496a432217b9b87d | True |
| raw_material_unit_history | raw_material | BEFORE / UPDATE | 46cbe8821d4a387ff48be7129bc419d845fc0e658819226ec7995eeb1402e2dd | True |
| raw_movement_unit_bi | stock_movement | BEFORE / INSERT | 7bf4978e8338c695cd69b53d6c381c8aa56b7f2f28af5f965deab9280aebd260 | True |
| raw_movement_unit_bu | stock_movement | BEFORE / UPDATE | 7bf4978e8338c695cd69b53d6c381c8aa56b7f2f28af5f965deab9280aebd260 | True |
| receipt_client_owner_bi | client_receipt | BEFORE / INSERT | b23a82424e071876c5dd98cfe240cb04ba09bd5c2e3fe13f3ac34447dcab0af5 | True |
| receipt_client_owner_bu | client_receipt | BEFORE / UPDATE | b23a82424e071876c5dd98cfe240cb04ba09bd5c2e3fe13f3ac34447dcab0af5 | True |
| role_identity_history | role | BEFORE / UPDATE | 3eb468851879a943e01de76ecf2f25062edd5b2d64d7163c5fc38370c24d5841 | True |
| sales_invoice_po_id_history | sales_invoice | BEFORE / UPDATE | 63a2a5ae5cf2ccd58197b8b8d6ca334c9cc469f398f0de3a62fd6ed9a24b1aa0 | True |
| shortage_stage_owner_bi | material_shortage_report | BEFORE / INSERT | e16bbab1e34522909304356762e3eca4db66f1c8521b5d9a60e471b18ca75d5a | True |
| shortage_stage_owner_bu | material_shortage_report | BEFORE / UPDATE | e16bbab1e34522909304356762e3eca4db66f1c8521b5d9a60e471b18ca75d5a | True |
| stock_movement_append_only_delete | stock_movement | BEFORE / DELETE | 0d60bc84e63942c32695d91da9a62bf037697c61f2fef5a1502459edf39bd078 | True |
| stock_movement_append_only_update | stock_movement | BEFORE / UPDATE | 0d60bc84e63942c32695d91da9a62bf037697c61f2fef5a1502459edf39bd078 | True |
| user_account_portal_role | user_account | BEFORE / UPDATE | 0a6d68481a3ff1fbb72da98e93d79d4089787710aa481ca81402cbf7c6ffb2c6 | True |

Trigger definitions, order, timing/event, definer, creation SQL mode and character/collation settings were compared. No trigger was fired. Primary/restored routine inventories: [] / []. Primary/restored event inventories: [] / [].

## Exact primary-versus-restoration structural comparison

| Component | Exact match |
| --- | --- |
| schema | True |
| tables | True |
| columns | True |
| constraints | True |
| keys | True |
| indexes | True |
| checks | True |
| actions | True |
| triggers | True |
| routines | True |
| events | True |
| rowCounts | True |

Only the expected local referenced-schema qualifier is normalized to <current-schema>. Actual table/column/index/check/trigger names, definitions and properties?including AUTO_INCREMENT next values?remain in the comparison. Creation timestamps and estimated cardinality are volatile data, not structural fields, and were not used. Schema default charset/collation and exact row counts are included.

## Read-only query evidence

For each named schema, mysql was invoked with --database=<schema>, --batch --raw --skip-column-names --show-warnings. The following exact SELECT statements supplied the evidence. No CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/SET/restore statement was sent. Docker inspection selected identity/image/state/ports/mounts only.

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('database',DATABASE(),'version',VERSION(),'uuid',@@server_uuid,'hostname',@@hostname,'internalPort',@@port,'connectionId',CONNECTION_ID(),'user',CURRENT_USER(),'utcTime',UTC_TIMESTAMP(3));
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('charset',default_character_set_name,'collation',default_collation_name) FROM information_schema.schemata WHERE schema_name=DATABASE();
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('table',table_name,'kind',table_type,'engine',engine,'collation',table_collation,'autoNext',auto_increment,'options',create_options) FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name;
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('table',table_name,'column',column_name,'position',ordinal_position,'type',column_type,'nullable',is_nullable,'default',column_default,'extra',extra,'generated',generation_expression,'charset',character_set_name,'collation',collation_name,'precision',numeric_precision,'scale',numeric_scale,'datetimePrecision',datetime_precision) FROM information_schema.columns WHERE table_schema=DATABASE() ORDER BY table_name,ordinal_position;
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'type',constraint_type,'enforced',enforced) FROM information_schema.table_constraints WHERE table_schema=DATABASE() ORDER BY table_name,constraint_name;
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'position',ordinal_position,'column',column_name,'parentSchema',referenced_table_schema,'parent',referenced_table_name,'parentColumn',referenced_column_name) FROM information_schema.key_column_usage WHERE table_schema=DATABASE() ORDER BY table_name,constraint_name,ordinal_position;
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('table',s.table_name,'name',s.index_name,'position',s.seq_in_index,'column',s.column_name,'expression',s.expression,'prefix',s.sub_part,'direction',s.collation,'type',s.index_type,'visible',s.is_visible,'nonUnique',s.non_unique) FROM information_schema.statistics s WHERE s.table_schema=DATABASE() ORDER BY s.table_name,s.index_name,s.seq_in_index;
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('name',constraint_name,'clause',check_clause) FROM information_schema.check_constraints WHERE constraint_schema=DATABASE() ORDER BY constraint_name;
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'update',update_rule,'delete',delete_rule) FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() ORDER BY table_name,constraint_name;
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('name',trigger_name,'table',event_object_table,'timing',action_timing,'event',event_manipulation,'order',action_order,'body',action_statement,'definer',definer,'sqlMode',sql_mode,'charset',character_set_client,'connectionCollation',collation_connection,'databaseCollation',database_collation) FROM information_schema.triggers WHERE trigger_schema=DATABASE() ORDER BY trigger_name;
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('name',routine_name,'kind',routine_type) FROM information_schema.routines WHERE routine_schema=DATABASE() ORDER BY routine_name;
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('name',event_name,'status',status) FROM information_schema.events WHERE event_schema=DATABASE() ORDER BY event_name;
```

Schema: `enterflow_phase2_db`

```sql
SELECT JSON_OBJECT('table','audit_event','rows',COUNT(*)) FROM `audit_event` UNION ALL SELECT JSON_OBJECT('table','client','rows',COUNT(*)) FROM `client` UNION ALL SELECT JSON_OBJECT('table','client_receipt','rows',COUNT(*)) FROM `client_receipt` UNION ALL SELECT JSON_OBJECT('table','client_receipt_file','rows',COUNT(*)) FROM `client_receipt_file` UNION ALL SELECT JSON_OBJECT('table','client_user','rows',COUNT(*)) FROM `client_user` UNION ALL SELECT JSON_OBJECT('table','cost_estimate','rows',COUNT(*)) FROM `cost_estimate` UNION ALL SELECT JSON_OBJECT('table','cost_estimate_material','rows',COUNT(*)) FROM `cost_estimate_material` UNION ALL SELECT JSON_OBJECT('table','delivery','rows',COUNT(*)) FROM `delivery` UNION ALL SELECT JSON_OBJECT('table','delivery_item','rows',COUNT(*)) FROM `delivery_item` UNION ALL SELECT JSON_OBJECT('table','delivery_method','rows',COUNT(*)) FROM `delivery_method` UNION ALL SELECT JSON_OBJECT('table','delivery_receipt','rows',COUNT(*)) FROM `delivery_receipt` UNION ALL SELECT JSON_OBJECT('table','document','rows',COUNT(*)) FROM `document` UNION ALL SELECT JSON_OBJECT('table','filter_type','rows',COUNT(*)) FROM `filter_type` UNION ALL SELECT JSON_OBJECT('table','finished_good','rows',COUNT(*)) FROM `finished_good` UNION ALL SELECT JSON_OBJECT('table','inquiry','rows',COUNT(*)) FROM `inquiry` UNION ALL SELECT JSON_OBJECT('table','inquiry_item','rows',COUNT(*)) FROM `inquiry_item` UNION ALL SELECT JSON_OBJECT('table','job_order','rows',COUNT(*)) FROM `job_order` UNION ALL SELECT JSON_OBJECT('table','job_order_item','rows',COUNT(*)) FROM `job_order_item` UNION ALL SELECT JSON_OBJECT('table','job_order_stage','rows',COUNT(*)) FROM `job_order_stage` UNION ALL SELECT JSON_OBJECT('table','material_category','rows',COUNT(*)) FROM `material_category` UNION ALL SELECT JSON_OBJECT('table','material_shortage_report','rows',COUNT(*)) FROM `material_shortage_report` UNION ALL SELECT JSON_OBJECT('table','notification','rows',COUNT(*)) FROM `notification` UNION ALL SELECT JSON_OBJECT('table','payment_method','rows',COUNT(*)) FROM `payment_method` UNION ALL SELECT JSON_OBJECT('table','payment_transaction','rows',COUNT(*)) FROM `payment_transaction` UNION ALL SELECT JSON_OBJECT('table','production_plan','rows',COUNT(*)) FROM `production_plan` UNION ALL SELECT JSON_OBJECT('table','production_stage','rows',COUNT(*)) FROM `production_stage` UNION ALL SELECT JSON_OBJECT('table','production_stage_event','rows',COUNT(*)) FROM `production_stage_event` UNION ALL SELECT JSON_OBJECT('table','purchase_order','rows',COUNT(*)) FROM `purchase_order` UNION ALL SELECT JSON_OBJECT('table','quotation','rows',COUNT(*)) FROM `quotation` UNION ALL SELECT JSON_OBJECT('table','quotation_item','rows',COUNT(*)) FROM `quotation_item` UNION ALL SELECT JSON_OBJECT('table','raw_material','rows',COUNT(*)) FROM `raw_material` UNION ALL SELECT JSON_OBJECT('table','role','rows',COUNT(*)) FROM `role` UNION ALL SELECT JSON_OBJECT('table','sales_invoice','rows',COUNT(*)) FROM `sales_invoice` UNION ALL SELECT JSON_OBJECT('table','signed_delivery_receipt','rows',COUNT(*)) FROM `signed_delivery_receipt` UNION ALL SELECT JSON_OBJECT('table','stock_movement','rows',COUNT(*)) FROM `stock_movement` UNION ALL SELECT JSON_OBJECT('table','stock_request','rows',COUNT(*)) FROM `stock_request` UNION ALL SELECT JSON_OBJECT('table','stock_request_item','rows',COUNT(*)) FROM `stock_request_item` UNION ALL SELECT JSON_OBJECT('table','unit_of_measure','rows',COUNT(*)) FROM `unit_of_measure` UNION ALL SELECT JSON_OBJECT('table','user_account','rows',COUNT(*)) FROM `user_account` UNION ALL SELECT JSON_OBJECT('table','waybill','rows',COUNT(*)) FROM `waybill`;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('database',DATABASE(),'version',VERSION(),'uuid',@@server_uuid,'hostname',@@hostname,'internalPort',@@port,'connectionId',CONNECTION_ID(),'user',CURRENT_USER(),'utcTime',UTC_TIMESTAMP(3));
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('charset',default_character_set_name,'collation',default_collation_name) FROM information_schema.schemata WHERE schema_name=DATABASE();
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('table',table_name,'kind',table_type,'engine',engine,'collation',table_collation,'autoNext',auto_increment,'options',create_options) FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('table',table_name,'column',column_name,'position',ordinal_position,'type',column_type,'nullable',is_nullable,'default',column_default,'extra',extra,'generated',generation_expression,'charset',character_set_name,'collation',collation_name,'precision',numeric_precision,'scale',numeric_scale,'datetimePrecision',datetime_precision) FROM information_schema.columns WHERE table_schema=DATABASE() ORDER BY table_name,ordinal_position;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'type',constraint_type,'enforced',enforced) FROM information_schema.table_constraints WHERE table_schema=DATABASE() ORDER BY table_name,constraint_name;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'position',ordinal_position,'column',column_name,'parentSchema',referenced_table_schema,'parent',referenced_table_name,'parentColumn',referenced_column_name) FROM information_schema.key_column_usage WHERE table_schema=DATABASE() ORDER BY table_name,constraint_name,ordinal_position;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('table',s.table_name,'name',s.index_name,'position',s.seq_in_index,'column',s.column_name,'expression',s.expression,'prefix',s.sub_part,'direction',s.collation,'type',s.index_type,'visible',s.is_visible,'nonUnique',s.non_unique) FROM information_schema.statistics s WHERE s.table_schema=DATABASE() ORDER BY s.table_name,s.index_name,s.seq_in_index;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('name',constraint_name,'clause',check_clause) FROM information_schema.check_constraints WHERE constraint_schema=DATABASE() ORDER BY constraint_name;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'update',update_rule,'delete',delete_rule) FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() ORDER BY table_name,constraint_name;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('name',trigger_name,'table',event_object_table,'timing',action_timing,'event',event_manipulation,'order',action_order,'body',action_statement,'definer',definer,'sqlMode',sql_mode,'charset',character_set_client,'connectionCollation',collation_connection,'databaseCollation',database_collation) FROM information_schema.triggers WHERE trigger_schema=DATABASE() ORDER BY trigger_name;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('name',routine_name,'kind',routine_type) FROM information_schema.routines WHERE routine_schema=DATABASE() ORDER BY routine_name;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('name',event_name,'status',status) FROM information_schema.events WHERE event_schema=DATABASE() ORDER BY event_name;
```

Schema: `enterflow_phase2_restore_p2b002`

```sql
SELECT JSON_OBJECT('table','audit_event','rows',COUNT(*)) FROM `audit_event` UNION ALL SELECT JSON_OBJECT('table','client','rows',COUNT(*)) FROM `client` UNION ALL SELECT JSON_OBJECT('table','client_receipt','rows',COUNT(*)) FROM `client_receipt` UNION ALL SELECT JSON_OBJECT('table','client_receipt_file','rows',COUNT(*)) FROM `client_receipt_file` UNION ALL SELECT JSON_OBJECT('table','client_user','rows',COUNT(*)) FROM `client_user` UNION ALL SELECT JSON_OBJECT('table','cost_estimate','rows',COUNT(*)) FROM `cost_estimate` UNION ALL SELECT JSON_OBJECT('table','cost_estimate_material','rows',COUNT(*)) FROM `cost_estimate_material` UNION ALL SELECT JSON_OBJECT('table','delivery','rows',COUNT(*)) FROM `delivery` UNION ALL SELECT JSON_OBJECT('table','delivery_item','rows',COUNT(*)) FROM `delivery_item` UNION ALL SELECT JSON_OBJECT('table','delivery_method','rows',COUNT(*)) FROM `delivery_method` UNION ALL SELECT JSON_OBJECT('table','delivery_receipt','rows',COUNT(*)) FROM `delivery_receipt` UNION ALL SELECT JSON_OBJECT('table','document','rows',COUNT(*)) FROM `document` UNION ALL SELECT JSON_OBJECT('table','filter_type','rows',COUNT(*)) FROM `filter_type` UNION ALL SELECT JSON_OBJECT('table','finished_good','rows',COUNT(*)) FROM `finished_good` UNION ALL SELECT JSON_OBJECT('table','inquiry','rows',COUNT(*)) FROM `inquiry` UNION ALL SELECT JSON_OBJECT('table','inquiry_item','rows',COUNT(*)) FROM `inquiry_item` UNION ALL SELECT JSON_OBJECT('table','job_order','rows',COUNT(*)) FROM `job_order` UNION ALL SELECT JSON_OBJECT('table','job_order_item','rows',COUNT(*)) FROM `job_order_item` UNION ALL SELECT JSON_OBJECT('table','job_order_stage','rows',COUNT(*)) FROM `job_order_stage` UNION ALL SELECT JSON_OBJECT('table','material_category','rows',COUNT(*)) FROM `material_category` UNION ALL SELECT JSON_OBJECT('table','material_shortage_report','rows',COUNT(*)) FROM `material_shortage_report` UNION ALL SELECT JSON_OBJECT('table','notification','rows',COUNT(*)) FROM `notification` UNION ALL SELECT JSON_OBJECT('table','payment_method','rows',COUNT(*)) FROM `payment_method` UNION ALL SELECT JSON_OBJECT('table','payment_transaction','rows',COUNT(*)) FROM `payment_transaction` UNION ALL SELECT JSON_OBJECT('table','production_plan','rows',COUNT(*)) FROM `production_plan` UNION ALL SELECT JSON_OBJECT('table','production_stage','rows',COUNT(*)) FROM `production_stage` UNION ALL SELECT JSON_OBJECT('table','production_stage_event','rows',COUNT(*)) FROM `production_stage_event` UNION ALL SELECT JSON_OBJECT('table','purchase_order','rows',COUNT(*)) FROM `purchase_order` UNION ALL SELECT JSON_OBJECT('table','quotation','rows',COUNT(*)) FROM `quotation` UNION ALL SELECT JSON_OBJECT('table','quotation_item','rows',COUNT(*)) FROM `quotation_item` UNION ALL SELECT JSON_OBJECT('table','raw_material','rows',COUNT(*)) FROM `raw_material` UNION ALL SELECT JSON_OBJECT('table','role','rows',COUNT(*)) FROM `role` UNION ALL SELECT JSON_OBJECT('table','sales_invoice','rows',COUNT(*)) FROM `sales_invoice` UNION ALL SELECT JSON_OBJECT('table','signed_delivery_receipt','rows',COUNT(*)) FROM `signed_delivery_receipt` UNION ALL SELECT JSON_OBJECT('table','stock_movement','rows',COUNT(*)) FROM `stock_movement` UNION ALL SELECT JSON_OBJECT('table','stock_request','rows',COUNT(*)) FROM `stock_request` UNION ALL SELECT JSON_OBJECT('table','stock_request_item','rows',COUNT(*)) FROM `stock_request_item` UNION ALL SELECT JSON_OBJECT('table','unit_of_measure','rows',COUNT(*)) FROM `unit_of_measure` UNION ALL SELECT JSON_OBJECT('table','user_account','rows',COUNT(*)) FROM `user_account` UNION ALL SELECT JSON_OBJECT('table','waybill','rows',COUNT(*)) FROM `waybill`;
```

## Unchanged authoritative sources

| Source | SHA-256 before and unchanged after |
| --- | --- |
| database/phase2-bootstrap/P2B002_revised_erd_greenfield.sql | 7db7d58d82599a3d81f9edc27a7bc83a2b34c2721a08593c67e85d5bce49c8b1 |
| docs/PHASE_2_DATABASE_CORRECTED_ERD.md | a245fb66f93a4c2b936625efb342fc8d3e7f6a70aaeb2cc1fe63d027fc414039 |
| docs/PHASE_2_DATABASE_ERD_CORRECTION_REPORT.md | c8e5ee1785f939704a9a862d93fc74da6bd8ef4877c6a2340dfd18a74f5ed637 |
| docs/PHASE_2_DATABASE_MIGRATION_REPORT.md | 317c90f98499d801acf4cc4af7a770bd863ddcebc3e2242d106a48448ecc21a4 |

Query warnings: none.

Database Change Report: both named schemas reviewed using fresh metadata and exact row counts. DDL/DML/schema or data changes, migrations, imports/restores, grants, fixes and application changes performed: none. Only docs/PHASE_2_P2B002_READ_ONLY_AUDIT.md was created. Existing SQL, reports and application files remain unchanged. Protected history, Migration 007/008, existing backups, shared and Task 002 databases were not accessed. No application was switched; no frontend/backend/browser or unrelated tests were run.

Final scope: PASS applies to this read-only structural/emptiness audit. It does not certify unresolved business policy, populated workflows, concurrency, grants or authenticated application behavior. Stop here; no correction or next task was started.
