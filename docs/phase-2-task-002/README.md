# Phase 2 Task 002 operator handoff

Prepared 2026-11-21, Asia/Singapore. **Investigation package prepared; live reconciliation pending operator results. No corrections implemented.** This is Phase 2 database investigation, not the completed Phase 1 Task 002 isolated integration exercise.

Start with the [findings and reconciliation framework](FINDINGS_AND_RECONCILIATION.md), execute only the reviewed sections of the [read-only SQL package](READ_ONLY_EVIDENCE.sql) through your existing authorized SQL client in the VS Code terminal, then review the [correction roadmap](CORRECTION_ROADMAP.md). The original [Task 001 review](../PHASE_2_TASK_001_DATABASE_ARCHITECTURE_REVIEW_2026-11-21.md) and [source dictionary](../PHASE_2_TASK_001_SCHEMA_SOURCE_APPENDIX_2026-11-21.md) are preserved unchanged.

## What the package does

One SQL file contains three stages:

1. **M00–M09 display identity/settings and deployed metadata.** M10 is a label pointing to the gated role-vocabulary profile P43; it does not directly query role data. The package inspects visible tables, columns, indexes, ordered key carriers, CHECK enforcement, FK actions and execution-capable object names. It excludes both migration ledgers and does not retrieve routine/trigger/event bodies.
2. **C, F, K and P generate SELECT text for operator review.** C covers exact counts for 71 known non-ledger tables; F covers 144 expected relationships, including a separately labelled service-inferred session-to-user relationship; K handles eligible deployed unique indexes; P contains 43 targeted integrity profiles. A generator result is not a record-profile result.
3. **The operator executes selected eligible statements separately.** Every emitted statement identifies its evidence ID, selected database and UTC capture time. Business tables are explicitly qualified with the approved database name. The package never automatically executes generated statements.

The original 73-name inventory includes two deliberately excluded migration ledgers. A known name missing from metadata is **missing or not visible**, not automatically absent. Unexpected objects receive metadata review before any record-query preparation. A table with zero rows is not unused functionality.

## Before execution

Confirm the approved target and an existing read-only connection with the responsible operator. Use the project's established credential and verified TLS handling. No new credentials, connection workaround, grants, container operation, migration status command, API login or storage access is supplied or authorized by this package. Record a non-secret operator confirmation of the intended endpoint/database; M00's name/version display is not independent target attestation.

Create a local review copy of the SQL file. Replace **every** `__APPROVED_DATABASE__` token with the reviewed database name, using only `[a-z][a-z0-9_]{0,63}`. Select that database in the authorized client before execution. Do not fill it from an old report by assumption. Keep credential files and private result artifacts outside tracked documentation using an existing approved local evidence location. Do not put credentials in terminal command arguments or shared output.

The package assumes MySQL 8.4 features, matching project architecture. M00 must show the expected database, reviewed version and `READY_FOR_METADATA`. Otherwise stop. If the live server differs, revise the package against that evidence rather than changing the server or disabling the gate.

Review metadata visibility with the operator. Do not use `SHOW GRANTS`, broad dumps, migration ledgers, migration CLI, schema initialization, seeders or importer commands as substitutes. Missing metadata can result from insufficient visibility; do not request new grants as an automatic troubleshooting step.

## Execution order and interpretation

| Stage | Operator action | Result meaning and stop conditions |
| --- | --- | --- |
| M00 | Execute first, retain identity/settings and UTC time. | Stop on selection/version mismatch. Check UTC/session configuration; `SYSTEM` needs interpretation against the displayed system zone. |
| M01–M09 | Execute one labelled statement at a time. | Compare actual shape with the source dictionary and backend requirements. Review engines, numeric scales, nullable carriers, source-aware material fields, session defaults, key order and FK/CHECK enforcement before record profiles. |
| C | Generate exact count statements, then review and select them. | Counts refer to the capture time. Approximate table statistics are not used. Extra tables are not automatically queried. |
| F | Generate expected relationship statements. | A missing FK does not block an orphan profile when its columns exist. `matching_deployed_fk_count=0` needs structural review. Partial NULL carriers can be legitimate optional relationships. Nonzero complete-carrier orphan counts require investigation. |
| K | Generate unique-key duplicate statements. | Expressions and sensitive key carriers are excluded or blocked. Prefix lengths and original comparison collations are preserved. A count of zero proves only the eligible key's observed duplicate result, not every identity constraint. |
| P | Generate targeted profiles and review their individual metadata evidence. | `READY` means eligible for review based on current visible tables, columns and type families. It is not a pass verdict or execution evidence. |
| Selected C/F/K/P statements | Copy complete `ready_sql` cells and execute individually. | Retain the whole result, evidence ID, selected database, UTC time and any client error. Do not automate replay or paste several hundred statements blindly. |

`BLOCKED_MISSING_COLUMN_TABLE_OR_VISIBILITY` and related statuses mean no record statement is emitted. `BLOCKED_INCOMPATIBLE_TYPE_REVIEW` prevents exact-numeric profiles from silently coercing FLOAT/DOUBLE or text money. Source-consistent numeric scale, signedness, collation, defaults, CHECKs and keys still need M04–M08 review; the type-family gate is not a full schema-equivalence check. A view is not treated as a confirmed base table.

F/K generators use `GROUP_CONCAT` only for SQL construction. Their byte-length checks suppress statements when the server's current concatenation limit would truncate fragments. Do not raise session limits through this package or execute a truncated statement. Retain the blocked status for a reviewed follow-up. Also inspect client output limits: a visually clipped `ready_sql` or requirement JSON cell must not be copied as a complete statement. Use the existing client's full-cell display/export; missing output is not a passing result.

Run M00 again manually before a later batch if the connection or selected database may have changed. Regenerate statements if schema metadata changes. The fully qualified target in emitted SQL prevents accidental use of similarly named tables in another selected database, but does not establish endpoint identity or protect against changes on the intended database.

Ordinary SELECTs can consume resources. Record counts, relationship anti-joins, grouping and correlated payment/file queries may be expensive on a larger database. Schedule them with the operator, one at a time; stop on an error or unacceptable resource impact. No locking read, `EXPLAIN ANALYZE`, server setting change or test fixture is included.

## Evidence limitations

Individual SELECTs do not constitute a shared cross-statement snapshot. Each result has a capture time; concurrent business activity can legitimately change counts or balances. No transaction/session command is included because the brief permits SELECT-based investigation only. If evidence must be mutually consistent across statements, request a separate approved collection strategy rather than inventing a maintenance freeze or silently using locks.

The package returns aggregate counts, state vocabulary and metadata. It does not return passwords, login identities, token values, operation-key values, file names, private object paths, bucket names, raw digests, customer documents or full audit payloads. Sensitive column defaults/generated expressions are redacted; their exact secret-bearing text is not required for reconciliation. Sensitive unique keys are excluded even from duplicate grouping. The file profile tests presence of bucket/generation/digest metadata without returning their values; it never evaluates private object paths. Audit profiles read only event action/subject metadata.

Consequently:

- Lost historical verified zeros cannot be reconstructed from present NULLs. Before-images or separately approved minimal historical evidence are required.
- Current sample counts do not prove how they were originally authorized or whether anyone relied on them.
- Shared-demand profile P07 uses saved quotation BOM snapshots and inquiry quantities. It cannot reproduce current text-height parsing, establish approved template selection, decide waste policy or prove a historical stock shortage.
- Similar payments are candidates, not proven duplicate submissions. SQL cannot recover an absent stable request identity.
- Stored financial inconsistencies do not prove binary rounding caused them; a consistent result does not certify the complete calculation algorithm.
- Unlinked file metadata is not an orphaned GCS object. No bucket listing, object existence, object content, generation retrieval or rollback outcome is established.
- Current units and snapshots cannot prove an earlier unit edit occurred. Differences from a current master can be valid historical preservation.
- Read-only data results do not establish actor authorization, transaction atomicity, replay handling, lock behavior or all nine-role runtime acceptance.

## Targeted profile catalog

These are query templates, not observed results. Every row remains pending operator execution; missing prerequisites produce a blocked generator status.

| ID | Issue | What it establishes | Interpretation or warning |
| --- | --- | --- | --- |
| P01 | D01 D02 R04 | Raw stock provenance and explicit zeros | Samples are not verified stock. Zero is recorded zero only with evidence; current NULLs cannot prove a historical zero was lost. |
| P02 | D01 D02 | Quantity and threshold status contradictions | Nonzero contradiction counts violate the source provenance invariant, subject to actual deployed enum/check contract. Empty tables return zero counts. |
| P03 | D02 D09 R08 | Approved price and actor completeness | Reference prices are not approved prices. Actor existence and nonnegative values are necessary, not proof of authorized approval. |
| P04 | D04 | Unit mapping difference counts | Different spellings can be valid aliases. These counts establish candidates, not an approved conversion or evidence of a unit edit. |
| P05 | D01 D02 R08 | Material source identity completeness | Partially present provenance needs review. This does not fetch source digests, codes, prices, names or document paths. |
| P06 | R02 | Competing BOM templates and empty recipes | Multiple templates or empty templates can be intentional drafts. No candidate is automatically approved or selected by this query. |
| P07 | D03 | Shared demand in saved quotation BOM snapshots | Counts saved snapshot candidates using inquiry quantities and base consumption without waste. It does not reproduce current height parsing/template selection or establish current stock at quotation time. |
| P08 | D06 | JO snapshot coverage | Sharing the inquiry spec proves no independent row; missing BOM is an observation, not proof that a historical recipe can be reconstructed. |
| P09 | D05 | Raw inventory structured movement and audit coverage | A material without movements is not necessarily corrupt; imported or unknown balances may have no approved opening event. Audit counts establish event presence only. |
| P10 | D05 | Movement arithmetic | Nonzero arithmetic errors conflict with the source movement invariant. Zero errors do not prove ledger completeness or serialization. |
| P11 | D05 | Current balance versus latest structured movement | Difference is a reconciliation candidate, including legitimate newer manual counts. Ordering by timestamp/id is not proof of transaction serialization. |
| P12 | D07 | Attachment multiplication of eligible payment totals | Same client/invoice/order eligibility as JO query; compares all links with once-per-payment. A positive difference proves query multiplication on these rows, not an incorrect issued JO. |
| P13 | D07 D11 D12 | Payment proof association completeness | Receipt-only links are not proofs. Multiple proofs can be legitimate history until the owner specifies active-proof selection. |
| P14 | D08 | Similar payment submissions | Grouped identity/amount/day/method/reference matches are candidates only. Values and keys are not returned; legitimate repeated payments must be preserved. |
| P15 | D08 | Timestamp-style operation identities | Counts a source key pattern without returning keys. A matching pattern proves key format, not that two requests were retries. |
| P16 | D09 | Payment review state coherence | Violations concern stored state; no binary-arithmetic error is proven by this query. |
| P17 | D09 R01 | Stored quote downpayment consistency | Draft/legacy values require classification. Rounding comparison follows stated two-decimal amount policy only; it does not recompute the complete pricing algorithm. |
| P18 | D09 | Invoice and accepted quotation amount agreement | A mismatch is a candidate pending historical adjustment policy and confirmation of the same accepted quotation basis. |
| P19 | D10 | Internal and customer PO namespace overlap | Equal references demonstrate namespace use. Reused customer references across companies are permitted candidates, not inherently corrupt. |
| P20 | D11 D12 | Non-sensitive file lifecycle metadata | No private object path, bucket name, digest value, filename or contents are selected or evaluated. Available metadata does not prove an object exists. |
| P21 | D11 | Unlinked metadata across typed file relations | Unlinked metadata may be pending or abandoned, not an orphan storage object. No cleanup or object existence conclusion is authorized. |
| P22 | D11 R03 | Audit event coverage without payload retrieval | Action counts show recorded events only; no old/new payload, private path or request identifier is accessed. |
| P23 | R07 | Order archival metadata combinations | Unusual combinations require owner policy and history review; a missing archive reason does not authorize deleting an order. |
| P24 | R07 | PO lifecycle actor and timestamp pairs | Pairs and order are review candidates. The source metadata path can create a PO before received/cleared timestamps exist. |
| P25 | R07 | Quotation sent metadata | Superseded quotes can retain sent metadata. Review draft and sent states separately before declaring an error. |
| P26 | R07 | Signed DR state and duplicate accepted copies | Nonzero state/accepted-duplicate counts conflict with the inspected source invariant, subject to deployed metadata. |
| P27 | R07 | Invoice delivery evidence ownership and acceptance | Nonzero counts identify mismatched or missing parents/accepted state. No first-versus-last receipt policy is inferred. |
| P28 | OWNERSHIP | Item to order and specification client consistency | Checks expected semantic relationships even if the deployed FK is absent. Missing parents and differing owners are structural candidates. |
| P29 | D06 OWNERSHIP | JO owner, source item and specification consistency | Missing/cross-owner parents violate expected ownership; a same-client independent JO specification is valid. |
| P30 | R03 | JO costing lineage versus PO accepted quotation | A mismatch is a lineage candidate, not approval to replace it with the current PO. Missing costing is reported separately. |
| P31 | R09 | Several quotation lines for one item | Multiple lines may be legitimate document layout; they violate the JO reader assumption, not necessarily the business contract. |
| P32 | IDENTITY | Account role and company identity coherence | Does not access login names, email, passwords or session tokens. Distinguish missing optional employee number from actual account-type contradictions. |
| P33 | IDENTITY | Multiple client accounts per company | Multiple accounts conflict with the historical one-client-account decision if still applicable. Employee NULL client IDs are excluded. |
| P34 | IDENTITY R07 | Application decision metadata | Profiles only status and aggregate completeness. Credential data and application personal details are not read. |
| P35 | R08 | Source review resolution metadata | A resolution without a material may be intentional exclusion or need reconciliation. Notes and source content are not retrieved. |
| P36 | R04 | Finished-good quantity state | Zero counts do not establish whether the zero is physical or defaulted. No source provenance policy is invented. |
| P37 | R07 | Stock response arithmetic and state | Uses stored requested quantities and observed counts. Any disagreement is a candidate for the established four-decimal shortage contract. |
| P38 | R07 | Shipment lifecycle timing candidates | Delivered/picked-up timestamps and completion policy require owner interpretation. This query does not infer legal dispatch transitions. |
| P39 | OWNERSHIP | Notification client and recipient scope | Employees can receive cross-client work notifications. Only explicit client-recipient scope contradictions are counted. |
| P40 | R07 | Pending requests sharing order and kind | Several pending requests can be historical/legitimate until the approved workflow defines exclusivity. |
| P41 | D06 HISTORY | Snapshot differences from current master | Differences can prove the value of historical snapshots; they are not corruption and must not be synchronized automatically. |
| P42 | R07 | Production cursor and pause metadata | Cursor 9 is the completion sentinel, not a missing production-stage FK. Pause reason requirement needs approved policy. |
| P43 | NINE_ROLES | Role vocabulary and actual account distribution | Preserve all nine roles. A role with no accounts is not unused functionality; no extra privilege is inferred. |

## Results to return

Return M00–M09, generator statuses including blocked/excluded rows, and the complete selected C/F/K/P result sets. Keep sensitive local evidence private and share only the permitted aggregate/metadata outputs. Include execution times, any errors/truncation, known concurrent activity and visibility limitations. Do not replace pending results with zeroes or historical Task 002 evidence.

Use the worksheet in [FINDINGS_AND_RECONCILIATION.md](FINDINGS_AND_RECONCILIATION.md) to record actual source-to-deployment differences. Additional tables, views, functional indexes, cross-schema references or blocked profiles require a scoped follow-up after their metadata is supplied. Do not change the database to make a query run.

## First correction after evidence review

Prefer a bounded **D07 payment-query cardinality correction** if deployed metadata confirms the payment/file relationship and no dependency blocker is found. It can preserve all records and use an existence check for proof rather than multiplying payments by file links. Approval must settle proof eligibility and the Accounting response shape; the operator runs regressions. This does not approve additional restrictions on proof purpose/availability by implication.

If evidence instead identifies an immediate operational stock-provenance risk, prioritize the bounded D02 read-consumer correction with explicit approval of the verified-only operational interpretation. Neither package requires historical data repair merely to fix query semantics. D01 remains a hold on any inventory schema execution, not a reason to apply or edit migration history.

## Preparation record

Only these new Task 002 documentation artifacts and the read-only SQL text were authored. The two pre-existing untracked Task 001 reports were preserved. No application source was changed. No database connection/query, tests, build, lint, runtime/verification command, migration, import, Docker/cloud operation, commit or protected artifact access occurred. Migration 007, its history/checksum and preserved Phase 1 Task 002 resources were untouched. Stop for operator review and evidence collection.
