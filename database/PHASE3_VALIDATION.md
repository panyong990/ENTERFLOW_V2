# Phase 3 — local MariaDB validation report

**PASS: the reviewed migrations and reference seeds work on XAMPP MariaDB 10.4.32.**

All database writes targeted the newly created `enterflow_test_db`. **The main `enterflow_db` was not migrated or modified. The test database remains in place.** Frontend, migration/seed files, users/grants, global server settings, backend and GCP resources were not changed.

Technical migration readiness is established for this exact draft on this MariaDB installation. Main-database execution still requires explicit approval and a fresh preflight. The provisional billing/delivery model still needs approval or revision; testing does not settle those policies or certify Cloud SQL MySQL.

## Environment and isolation

| Item | Observed |
| --- | --- |
| Server | 10.4.32-MariaDB; mariadb.org binary distribution |
| Connection | XAMPP mysql.exe, local TCP 127.0.0.1:3306, existing administrative login |
| InnoDB | Available/default; 16 KiB pages |
| Server encoding | utf8mb4 / utf8mb4_general_ci |
| Test schema/tables | utf8mb4 / utf8mb4_unicode_ci; explicit ASCII binary columns preserved |
| Enforcement | foreign_key_checks=1, unique_checks=1, check_constraint_checks=1 |
| Global SQL mode | NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION |
| Test-session SQL mode | STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION |
| Other test-session settings | UTC; utf8mb4 connection; FK/unique/CHECK enforcement explicitly enabled |

Live catalog inspection confirmed `enterflow_test_db` was absent. Creation deliberately omitted IF NOT EXISTS: an existing/concurrently created schema would have caused a stop. Only this database was created; every migration/test connection explicitly selected it.

All setting changes were SESSION-scoped. The global SQL mode was checked after testing and is unchanged. The main database's read-only catalog snapshots before/after were identical: no tables/views. No connection selected it for writes. All 141 created FKs point into enterflow_test_db. No unrelated database was a write target; normal internal MariaDB logging/metadata is distinct from application-database writes.

## File identity and execution

All five SHA-256 hashes matched STATIC_CHECKS.json before execution and after testing. Exact fingerprints and diagnostics are retained in the results artifact. No migrations were edited or repaired during execution.

| Order | File | Tables | Result |
| --- | --- | --- | --- |
| 1 | migrations/001_identity_catalog.sql | 16 | Exit 0; no errors/warnings |
| 2 | migrations/002_orders_quotations.sql | 14 | Exit 0; no errors/warnings |
| 3 | migrations/003_operations_billing.sql | 29 | Exit 0; no errors/warnings |
| 4 | migrations/004_attachments_audit.sql | 11 | Exit 0; no errors/warnings |
| 5 | seeds/001_reference_data.sql | 0 | Exit 0; no errors/warnings |

The batch client did not use --force for migrations/seeds. All five completion markers exist. DDL persists in the retained test database; no rollback of CREATE TABLE is claimed.

## Schema and seed comparison

The actual schema was compared with the SQL before and after integrity tests. **No differences were found.**

| Check | Result |
| --- | --- |
| Table set/type | All 70 expected base tables; no extras |
| Columns | All 562: name/order, type/enum labels, signedness, precision/scale/length, nullability, defaults, AUTO_INCREMENT, ON UPDATE, charset/collation |
| Primary/unique keys | All 123 match: 70 primary keys plus 53 other unique constraints, including composite column order |
| Indexes | 255 physical indexes; all declared indexes match; 107 additional InnoDB indexes support FKs |
| Foreign keys | All 141 child/parent definitions, column order, schema and restrictive update/delete actions match |
| CHECK constraints | All 26 names and parsed expressions match, allowing server formatting/backticks/redundant parentheses |
| Engine/collation | All 70 InnoDB / utf8mb4_unicode_ci |
| Orphans | 141 relation-specific anti-join checks; zero orphans |
| Seeds | Every value compared, not just counts; all match |
| Final rows | 126 reference rows plus 5 ledger markers; other 59 tables empty |

MariaDB integer display widths, BOOLEAN as tinyint(1), quoted defaults, TRUE/1, DECIMAL zero scale and current_timestamp formatting were normalized as equivalent representations. Migration applied_at columns were verified in the metadata/default comparison; ledger versions were compared exactly.

| Seed table | Rows |
| --- | --- |
| roles | 9 |
| modules | 18 |
| role_modules | 40 |
| payment_terms | 2 |
| filter_types | 16 |
| material_categories | 8 |
| units | 8 |
| delivery_methods | 5 |
| order_stages | 11 |
| production_stages | 9 |
| schema_migrations | 5 |

No real accounts, clients, balances, credentials, documents or operational records were seeded. Synthetic file metadata did not upload or create any GCS object.

## Integrity tests and rollback

**Final run: 81/81 cases passed, with zero unexpected SQL errors/warnings.** The fixture setup used 81 successful INSERT statements. Cases were isolated with savepoints inside one transaction, followed by ROLLBACK. Fixtures included two clients, multiple orders for the same client, another client's order, specifications, quotes/revisions, JOs, stock responses, delivery receipts and payments.

| Actual expected outcome | Cases | Coverage |
| --- | --- | --- |
| Error 4025 | 29 | A violating statement for each of all 26 named CHECKs, confirming the expected constraint name; three extra receipt-state/NULL-bypass cases |
| Error 1452 | 30 | Cross-order/client links, pending/discarded invoice evidence and related FK violations |
| Error 1451 | 2 | Referenced client deletion and unaccepting invoice-linked evidence |
| Error 1062 | 12 | Selected unique keys: one accepted copy, quote-reference ownership, identities, document refs, file object, idempotency |
| Accepted, then rolled back | 8 | Quote revision/reference reuse, additional staged/discarded copies, same-order accepted evidence, pre-invoice payment, complete verification state, same-client reorder |

Positive setup also accepted one signed copy each for three different DRs, plus multiple staged/discarded copies of one DR. UTF-8 text `T3 Client A — 測試` and exact DECIMAL(15,4) value `1.2345` round-tripped. Due-date/allocation policy was not calculated or inferred.

All FK/unique definitions were validated through metadata; all 26 CHECKs were exercised by runtime rejection. Runtime FK and uniqueness cases target important defects rather than independently testing every possible violation of all 141 FKs/123 keys. Empty-table orphan checks after rollback are a baseline, not proof of future application correctness.

After **every attempt**, all 70 row counts returned to the seed baseline. Final seed contents were compared again and match. No fixture rows remain. AUTO_INCREMENT counters advanced in **30 test-database tables** across the attempts despite rollback; this expected sequence side effect was retained, not reseeded. No main counters were used.

--force was used only for the integrity-test connection to capture explicitly expected failures and reach the final ROLLBACK. Every error was classified. It was never used for migration import. No test DDL, persistent cleanup DELETE, database drop or automatic restore was performed.

## Errors, warnings and harness corrections

Migrations/seeds: **zero errors, zero warnings**. Final tests: 73 expected constraint-rejection messages above, no unexpected errors/warnings.

Earlier harness issues are preserved in the evidence:

1. A read-only environment query returned unquoted ON tokens from MariaDB JSON_OBJECT for boolean server variables. Python JSON decoding failed before creation; the diagnostic query was corrected to cast those variables with +0. No migration was affected.
2. Attempt 1 matched 77/81 expected outcomes. Four invalid changes were rejected by earlier valid constraints: two restrictive parent FKs and two unique keys, instead of the particular FK targeted. All fixture rows rolled back.
3. Attempt 2 matched 80/81. One fixture still occupied the JO uniqueness key being bypassed. All fixture rows rolled back.
4. Only the harness/fixtures changed: invalid child INSERTs and unoccupied JO/shipment records isolated the intended relationships. Attempt 3 passed 81/81. SQL drafts were not modified. The earlier SQL, stdout/stderr and summaries remain available.

## Remaining limits and readiness

- **Cloud SQL MySQL remains untested.** Later reproduce these exact migrations on the approved MySQL version; MariaDB success does not certify its parser, constraints, authentication, query plans or runtime behavior. No cloud resources were created.
- Global defaults lack strict mode. The successful tests used strict sessions. Future Express connections must establish/verify the intended modes, UTC and enforcement; no backend configuration was implemented.
- One-accepted-copy rejection was tested sequentially within a transaction. A true two-connection race, locks/deadlocks, concurrent numbering, performance and application concurrency remain untested.
- Node.js driver access, restricted runtime-user permissions, API authorization, stock/payment calculations, immutable document handling, GCS and full business workflows remain untested. Administrative CLI access does not establish them.
- The observed empty main catalog is a point-in-time finding. Obtain explicit main-database approval and repeat preflight before any installation; stop if existing objects/data are found.

The provisional one-invoice/PO-per-order and one-shipment/DR-per-JO keys were tested as drafted. These policies still need approval or revision: consolidated/per-JO/staged billing, downpayment allocation, partial/consolidated deliveries, first/final/per-invoice signed-receipt basis, calendar/timezone/cycle reset rules, COD gates and replacement eligibility/charges. PHASE2_REVIEW.md records the source evidence and alternatives. No successful test grants policy approval.

**Recommendation:** no MariaDB execution blockers were found for these reviewed files. They are technically ready for a controlled main-schema installation once explicitly approved and the provisional model is accepted or revised. If schema decisions change the drafts, review and retest them; do not overwrite the retained test database.

## Evidence

- [Results, hashes, comparisons and test history](validation/phase3_results.json)
- [Final actual MariaDB metadata](validation/phase3_metadata.json)
- [Final test SQL](validation/phase3_integrity_attempt3_tests.sql), [stdout](validation/phase3_integrity_attempt3_stdout.txt), [expected errors](validation/phase3_integrity_attempt3_stderr.txt)
- Earlier run files: `validation/phase3_integrity_*` and `validation/phase3_integrity_attempt2_*`.
- Harness: `phase3_validate.py`. --prepare refuses an existing database; --verify reads this run's test schema; --test uses rollback fixtures and may advance test counters. Do not run raw fixture SQL standalone against another selected database.

The test database remains visible in phpMyAdmin as **enterflow_test_db**. Deleting it or migrating enterflow_db requires a separate explicit instruction.
