# Phase 2 — revised migration readiness report

Historical pre-execution review. Phase 3 subsequently tested these drafts in enterflow_test_db; see PHASE3_VALIDATION.md for current results. Policy decisions recorded here remain open, and enterflow_db is still unmigrated.

**Status: integrity fixes completed in drafts; offline checks passed. Live MariaDB/MySQL execution is untested. Billing/cardinality decisions below still require approval before finalizing the schema.**

No SQL has been executed. No frontend, XAMPP database, backend or GCP resource has been changed. The unapplied migrations 001?003 were revised in place; 004 and the reference seed are unchanged. If any copy was applied outside this session, stop and reconcile it instead of rerunning these files.

## Completed changes

| Concern | Database enforcement now drafted | Backend responsibility remaining |
| --- | --- | --- |
| Order/client/specification consistency | `orders(id, client_id)` and `product_specifications(id, client_id)` unique parent keys; order_items uses both composite FKs. A specification row is client-owned; equal dimensions for another client can use a separate row | Choose correct product/specification within that client; freeze issued JO copies |
| JO ownership | JO references `(order_item_id, order_id, client_id)` and `(specification_id, client_id)`; existing costing/item/order and replacement/order guards retained | Approve spec overrides, snapshot BOM, quantity/release rules |
| Invoice versus signed receipt | Order ID flows through JO -> shipment -> generated DR -> signed copy. `invoice_delivery_receipts` uses the same non-null order_id in both FKs | Select which accepted receipt(s) establish billing evidence under an approved billing policy |
| Accepted evidence only | Invoice link requires accepted_slot=1 through CHECK and a three-column FK to the signed-copy state | Authorize acceptance and verify the actual available GCS object/document |
| Quotation versus Warehouse response | Stock response references its request plus order; quotation/response junction references both parents with the same non-null order_id | Choose the correct response revision and enforce business lead-time rules |
| Finished goods versus order items | Junction references both parents with the same non-null client_id; specifications and optional JO-linked movements also enforce same client | Confirm part-number/product match; this link is not a stock allocation |
| Quote reference reused by another order | New `quotation_references` table owns each unique number once; quotation revisions reference `(reference, order_id)` | Allocate references transactionally and decide presentation/version formats |
| Reorders / related notifications | Reorder source must share client; order-related notification must carry that order's actual client | Authenticated visibility, role/action permissions and per-user targeting |
| Payment/invoice and PO/quote | Existing shared-order composite FKs retained and checked | Payment allowance/verification arithmetic, pending totals, accepted quote state and release gates |

Redundant order/client columns are intentional **constraint carriers**, not independently editable sources of truth. The backend supplies parent values, and composite FKs reject disagreement; it must not trust IDs supplied by a browser. Core parent IDs/ownership columns used for these consistency guards are non-null. Nullable source/association IDs remain allowed only for optional relationships such as pre-invoice payments and non-JO stock movements.

## One accepted signed copy per generated DR

`signed_delivery_receipts.accepted_slot` is an ordinary nullable SMALLINT, not a generated column or trigger:

- Pending: received_at NULL, discarded_at NULL, slot NULL.
- Discarded staged copy: received_at NULL, discarded_at set, slot NULL.
- Accepted: received_at set, discarded_at NULL, slot exactly 1.

`ck_signed_dr_state` includes explicit IS NULL/IS NOT NULL guards, so SQL's CHECK-UNKNOWN behavior cannot admit an accepted receipt with a NULL slot. `UNIQUE(delivery_receipt_id, accepted_slot)` permits multiple staged/discarded rows with NULL slots but at most one accepted row with slot=1 per DR, including under competing writes when constraint enforcement is enabled. No limit on staged/discarded history is introduced.

The invoice junction's non-null slot is CHECKed to 1 and references `(signed_copy_id, order_id, accepted_slot)`. It therefore cannot select a pending/discarded copy, an accepted copy for another order, or a nonexistent copy. Default restrictive FKs also prevent clearing the acceptance marker of a copy while an invoice references it. This does not make every accepted row permanently immutable; the service must prohibit unauthorized edits/deletes and enforce any future approved correction policy. No receipt replacement/revocation policy is invented.

This uses ordinary UNIQUE, CHECK and composite FK syntax shared by MariaDB 10.4 and MySQL 8.0.16+/8.4, without filtered indexes, generated-column FK differences, functions or triggers. Both engines allow multiple NULLs in nullable unique keys: [MariaDB NULL documentation](https://mariadb.com/docs/server/reference/data-types/null-values), [MySQL unique indexes](https://dev.mysql.com/doc/refman/8.0/en/create-index.html). Live acceptance/race tests are not claimed.

## Table-count review

The full original 69-table inventory and overlaps are in [TABLE_REVIEW.md](TABLE_REVIEW.md). No table was removed merely to reduce count. Templates, quotation/JO BOM snapshots, generated versus signed DR, domain ledgers and typed attachment links have distinct lifecycles. Optional simplifications and data-duplication risks are documented there.

One ownership table was added: `quotation_references`. A single globally unique reference on every quotation revision would incorrectly reject the frontend's reuse of quotationNo across revisions. A reference-to-order parent supports that workflow without permitting the same number to move between orders, and does not force only one reference per order. **Total: 70 tables.**

## Decisions still requiring approval

| Decision | Existing evidence | Approval needed / current draft |
| --- | --- | --- |
| Invoice scope for split JOs | `orders.tsx` finalizeProductJOs replaces the source Inquiry with per-product children, copies other fields and sets per-product quotedTotal. Source has no durable invoice-allocation model | One consolidated invoice per original order, one invoice per JO, or staged invoices? Current `UNIQUE(invoices.order_id)` permits one invoice per order; it remains provisional. Per-JO/staged billing needs approved invoice-line/JO allocation design, not just removing a key |
| PO / dispatch cardinality | Shared PO/quotation fields are copied into children; current UI dispatches each JO | Confirm one PO per original order and one shipment/DR per JO. Current unique keys express those draft choices; partial shipments or consolidated delivery require review |
| Payment allocation across split JOs | Payments carry Inquiry IDs and may be copied with source state; canonical payment types exist but no cross-invoice allocation entity | Are downpayments applied to the whole order or allocated per JO/invoice? Confirm no double-counting, allocation/reversal behavior and replacement charges. Draft stores order-level payments and optional same-order invoice_id; no allocation policy implemented |
| Effective due-date event | **Corrected analysis:** store/orders effect around lines 961?992 recalculates cycle/due date from a valid `signedDeliveryReceiptReceivedAt`. Older generateInvoice/markDelivered actions still read `clientSignedDRUploadedAt`, but the effect repairs/clears derived values. Logistics also uses the newer accepted timestamp | Approve the newer accepted-receipt event as the backend authority. It is the current effective single-record behavior, not yet an approved split-order billing policy. No due-date trigger was added |
| Multiple accepted receipts for one invoice across JOs | A consolidated order may have several DRs, one per JO | Start terms from first receipt, final receipt, or a separate per-invoice/partial-billing event? The junction records same-order accepted evidence without selecting MIN/MAX or calculating a due date |
| Calendar / invoice timing | Frontend adds 15/30 calendar days using browser Date and formats local dates; receipt can exist before invoice sending | Confirm Asia/Manila calendar-day boundary, invoice-before/after-receipt behavior, and whether later receipt or invoice edits can reset an existing cycle. No business-day/holiday adjustment or automatic reset is inferred |
| COD and replacement rules | Flowchart distinguishes COD; UI terms are 15/30 days. Replacement store/actions conflict with no-replacement quote terms | Confirm DP release requirements, COD representation, replacement eligibility/charges and correction policy. Current lookup seed remains NET15/NET30 only |

The original general questions about rounding/VAT/discount order, document immutability, file limits/retention and endpoint permissions remain in FRONTEND_ANALYSIS.md. Constraint fixes establish relational consistency, not those business decisions. A choice that changes cardinality or allocation must be reflected in the drafts before migration approval.

## Offline verification

Reproducible command (no database connection):

```powershell
python database/validate_drafts.py
```

`--write-docs` also refreshes SCHEMA.md and STATIC_CHECKS.json. The checker accepts only the draft SQL subset; it is not a MySQL/MariaDB syntax parser or database emulator. Results and reviewed file hashes are recorded in [STATIC_CHECKS.json](STATIC_CHECKS.json).

- **70 tables, 562 columns, 141 foreign keys, 26 named CHECKs.**
- All FK parents appear earlier or are valid self-references; referenced parent keys are explicitly primary/unique; matching arity, types/unsignedness and explicit charset/collation signatures passed.
- Every table explicitly InnoDB/utf8mb4/utf8mb4_unicode_ci. No duplicate table/column/named CHECK definitions or unrecognized constraint declarations found.
- Seed references/unique keys passed: unchanged 126 reference rows and five ledger markers; no accounts, credentials, banking data or operational balances seeded.
- 24 targeted ownership FK regression checks passed, plus non-null guard checks, accepted-slot CHECK/UNIQUE/FK checks and a small offline state truth table. These are structural/model checks, not attempted inserts or concurrent server tests.
- No destructive/cross-schema statements, database creation, schema switches, triggers, routines, executable comments or global setting writes found.
- Manual review found no apparent DDL syntax error. Engine parsing, FK/CHECK enforcement, server settings, live database contents and target MySQL remain untested.

## Execution plan after explicit SQL approval

1. Recheck reviewed hashes; authenticate to local 127.0.0.1:3306 with `--database=enterflow_db` and confirm DATABASE(), runtime version/settings, InnoDB, strict mode and FK/unique/CHECK enforcement. Use session settings only; do not alter global configuration or create accounts/databases.
2. Inspect only enterflow_db's live tables/views/triggers/routines/events. Last filesystem observation showed only db.opt, suggesting empty, but it is not catalog proof. If the database is absent or any existing object is found, stop before DDL; report/reconcile it. No replacement, cleanup or automatic rerun is authorized.
3. Take a protected target-only logical baseline backup outside Git. Apply with foreign-key and CHECK enforcement enabled, one batch file per explicit target connection, without --force; stop on any error:

   | Order | File | Tables |
   | --- | --- | --- |
   | 1 | migrations/001_identity_catalog.sql | 16 |
   | 2 | migrations/002_orders_quotations.sql | 14 |
   | 3 | migrations/003_operations_billing.sql | 29 |
   | 4 | migrations/004_attachments_audit.sql | 11 |
   | 5 | seeds/001_reference_data.sql | 0 |

4. Compare all tables/columns/defaults/indexes/FKs/CHECKs against the current drafts, including column order in ownership keys, delete/update actions, engine/collation, all seed values and five completion markers. Confirm business tables remain empty after seed.
5. Run approved non-destructive metadata/orphan/duplicate checks and rollback-only integrity tests. New test cases must exercise cross-order invoice/DR, pending/discarded evidence, cross-order quote/stock response, cross-client finished-good/order-item/specification, same-client valid links, quote-number ownership and two accepted copies of one DR. Also test multiple staged/discarded copies are allowed, different DRs may each have an accepted copy, and NULL cannot bypass state constraints. Use clearly tagged synthetic data, never existing business records, and confirm no test rows remain.
6. Lookup-only smoke tests do not consume AUTO_INCREMENT identifiers. A full rollback-only business-fixture test can advance AUTO_INCREMENT counters even though rows roll back; disclose/approve that test scope before running it, never reseed counters to hide gaps. A true two-session race test may require an approved committed fixture; it remains separately untested unless such a fixture is authorized. No new database will be created for testing in this task.
7. Report each engine/metadata/seed/test result and failures precisely. Node.js connectivity, application transactions/authorization, GCS, concurrency and Cloud SQL are not automatically passed by schema creation.

No SQL is currently approved. Migration files use unqualified application object names; explicit database selection plus a checked DATABASE() is mandatory. They contain no commands switching schemas or writing to another database.

## Compatibility and persistent effects

- Draft target remains MariaDB 10.4.32 and Cloud SQL MySQL 8.4; MySQL must separately execute these migrations later. Referenced composite keys are explicitly unique. No MariaDB-specific feature was introduced. Keep CHECKs enabled (MySQL before 8.0.16 is not a supported target). Ordinary nullable-marker constraints avoid generated-column foreign-key portability issues. [MySQL CHECK restrictions](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html), [MySQL FKs](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html).
+- Parent relationships are restrictive by default; no ON DELETE/UPDATE cascade or generated-column referential action is used. File-content validity, uploader authority, privacy, record immutability and financial calculations require service checks; FKs do not prove them. Shared file metadata can still be linked to more than one record: the service must verify all parent scopes before reuse and before access.
+- DDL implicitly commits. CREATE TABLE persists and cannot be undone with ROLLBACK; a failure may leave partial tables without a completion marker. No DROP/DELETE/TRUNCATE/automatic restore or down migration is planned. Seed/ledger inserts persist intentionally; only uncommitted seed DML rolls back on failure. [MariaDB implicit commits](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit).
+- Migration review is complete for these integrity fixes. **Execution still waits for explicit approval, and final integration readiness waits for applicable billing decisions and live verification.**
