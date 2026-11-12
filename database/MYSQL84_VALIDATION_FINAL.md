# MySQL 8.4 validation — passed after approved identifier fix

**PASS on actual MySQL Community Server 8.4.13.** Only the explicitly authorized isolated test schema was reset. XAMPP, enterflow_db, enterflow_test_db, React frontend and GCP were not accessed for changes.

## SQL and reserved identifiers

- Applied the approved backticks around `document_sequences.last_value` in migration 002. Reversing those backticks reproduces the exact prior reviewed file hash; the other three migrations and seed are unchanged.
- Scanned all draft table, column, key/constraint and FK identifiers against the running MySQL 8.4 reserved-keyword catalog. No additional unquoted reserved identifiers or required SQL corrections were found. LAST_VALUE remains deliberately quoted.
- Updated offline parsers to recognize quoted column declarations, regenerated the schema dictionary and refreshed the migration fingerprint. No schema redesign or business-rule change.

## Fresh execution results

| Check | Result |
| --- | --- |
| All four migrations and reference seed | Passed in order; zero migration/seed SQL errors or warnings |
| Tables | 70/70 match |
| Columns | 562/562 match, including types, defaults, nullability and charset/collation |
| Foreign keys | 141/141 definitions match; all remain inside the isolated schema |
| Primary/unique constraints | 123/123 match |
| CHECK constraints | 26/26 definitions match and are ENFORCED |
| Reference records | All 126 values match, plus 5 migration/seed ledger rows |
| Orphan checks | 141 checks; zero orphans |
| Targeted runtime cases | 81/81 passed |
| Rollback | All table counts and seed contents restored; all other 59 tables empty |
| Final schema | Compared again after tests; no metadata or seed differences |

Runtime cases included every named CHECK, cross-client/order consistency, accepted-only invoice evidence, one accepted signed copy per DR, allowed pending/discarded copies, quote revisions/ownership, unique identities/document references, idempotency and restrictive parent operations. UTF-8 and exact DECIMAL values round-tripped.

The 73 expected constraint rejections were 29 CHECK errors (3819), 30 child-FK errors (1452), 2 restrictive-parent errors (1451), and 12 duplicate-key errors (1062). Eight valid cases passed before rollback. No unexpected final test errors or warnings. All key definitions were verified; runtime cases are targeted, not an exhaustive violation attempt for every possible key/value.

## Harness differences resolved

The initial comparison flagged two metadata representation differences: MySQL returns the unquoted string default STABLE with its case preserved, and its CHECK metadata escapes literal delimiters. The comparison adapter was corrected to preserve default case and normalize those escaped delimiters while retaining raw CHECK text. No SQL change was needed for either; subsequent full comparisons and runtime enforcement passed. Earlier diagnostic records remain in the machine-readable results/history.

## Preserved environment and limits

- Container: `enterflow-mysql84-validation`, running, bound only to `127.0.0.1:3307`.
- Existing dedicated volume: `enterflow_mysql84_validation_data`, retained.
- Schema: `enterflow_mysql84_test_db`, retained with seed/ledger rows and no fixture rows.
- Official image digest unchanged: `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902`.
- The approved DROP/CREATE affected only that application test schema in the verified container/server UUID; Docker resources and system schemas were not replaced.
- Rollback may consume AUTO_INCREMENT IDs; no counters were reseeded. Cached table metadata was not treated as proof of counter rollback. Startup-image certificate/PID-directory warnings from the prior report remain separate from SQL execution; no production configuration was inferred from this container.
- Strict mode and standard referenced-key restrictions remained enabled. No constraints were disabled to obtain a pass.
- Actual local MySQL compatibility is now established for this corrected draft. Cloud SQL networking/IAM/flags, Node/Express, GCS and true application concurrency remain untested. Billing/delivery policy decisions remain open.
- XAMPP was not retested: the earlier MariaDB evidence applies to the prior draft, whose only SQL difference is this identifier quoting. No main-database migration or GCP deployment is authorized by this result.

Evidence: [current results](validation_mysql84/mysql84_results.json), [actual MySQL metadata](validation_mysql84/phase3_metadata.json), [test SQL](validation_mysql84/phase3_integrity_tests.sql), [expected test errors](validation_mysql84/phase3_integrity_stderr.txt). The original failed state is preserved in `validation_mysql84/mysql84_failed_reserved_identifier.json` and the old manifest in `reviewed_hashes_before_quote.json`.
