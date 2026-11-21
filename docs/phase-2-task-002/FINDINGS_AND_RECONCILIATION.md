# Phase 2 Task 002 database findings and reconciliation framework

Date: 2026-11-21, Asia/Singapore. **Preparation complete for operator review; deployed-state investigation is pending execution and supplied results.** No current database result or affected-record count has been supplied. No database connection, query, test, build, lint, runtime check or verification command was executed by Codex.

This advances the [Task 001 source review](../PHASE_2_TASK_001_DATABASE_ARCHITECTURE_REVIEW_2026-11-21.md) by supplying a metadata-gated [SQL evidence package](READ_ONLY_EVIDENCE.sql), evidence classifications and correction decision criteria. It does not repeat the 73-table purpose inventory or represent source SQL as deployed fact. Operator instructions and evidence limitations are in the [handoff](README.md); implementation proposals are in the [roadmap](CORRECTION_ROADMAP.md).

## 1 Evidence status and finding categories

| Category required by the brief | Current state | Evidence needed before promotion |
| --- | --- | --- |
| Confirmed source defects | D01–D12 retained, with qualifications below; S13 adds a focused source finding. | Cited application/definition behavior establishes a source problem, not deployment or actual corruption. |
| Confirmed deployed-schema defects | **Not established.** | M metadata must show an actual discrepancy that conflicts with an approved invariant or current application requirement. |
| Confirmed data-integrity defects | **Not established.** | Executed C/F/K/P results, target/time, compatible actual schema, and business interpretation. Nonzero warnings alone are insufficient. |
| Backend/query defects potentially requiring no DDL | D02/D03/D07/D09/D10/D12 and S13 have bounded source-first options. | Confirm deployed compatibility, exact endpoint/response behavior and required decisions before choosing a patch. |
| Recommendations requiring business approval | R01–R09 remain separate. | Owner decision, current affected population, dependent consumers and migration/recovery scope. |
| Cannot yet be determined | Actual table universe, constraint effectiveness, counts, record populations, past corruption, physical counts, object existence and runtime concurrency. | Operator metadata/profiles plus separately approved evidence where read-only database data cannot answer the question. |

“Not established” is not zero defects, zero affected rows or a clean database verdict. `BLOCKED`, `EXCLUDED`, no output, SQL error and no operator execution must never be entered as zero. An empty table count does not validate its future workflow or make it redundant.

Task 001 contains the original scope of 73 known names. The two migration ledgers are excluded from this task's metadata comparison and all record queries. The remaining 71 names are the reconciliation set; additional visible objects remain unclassified until their purpose and dependencies are reviewed. No content, history or checksum of Migration 007 is required or permitted.

## 2 Source to deployed schema reconciliation

### Collection and comparison units

Use M00 identity/settings, M01 database defaults, M02/M03 object inventory, M04 column declarations, M05 index components, M06 constraints, M07 ordered key carriers/FK actions, M08 CHECK definitions/enforcement and M09 execution-capable object names. No broad dump, ledger query, migration runner or Task 002/003 infrastructure is needed.

For every known non-ledger table, retain this worksheet. Repeat rows for each column/key/relationship, rather than collapsing a table into “matches.”

| Worksheet field | Required content |
| --- | --- |
| Object | Table plus column, index or relationship identity; exact case where relevant. |
| Purpose and consumers | Established Task 001 purpose; actual backend service/read or write SQL and consuming API/UI. Additional objects need their own evidence. |
| Source baseline | Original declaration, permitted material change, or service-required field. Distinguish the session/service inference from fully reviewed DDL. |
| Expected contract | Exact type/length/precision/scale/signedness; nullable/default/generated/auto-increment attributes; or ordered FK/index carrier and parent columns. |
| Deployed evidence | Exact M result, target and capture time; record `PENDING` until supplied. |
| Relationship semantics | Parent uniqueness, child uniqueness, carrier nullability, parent ownership, delete/update action and CHECK enforcement. |
| Data evidence | Related C/F/K/P result IDs, capture times and interpretation; absent execution is not zero. |
| Difference | Exact difference, including an absent/not-visible distinction. Extra fields or stricter checks are not automatically defects. |
| Application consequence | A real source query cannot bind, an allowed state cannot persist, cross-client linkage is possible, or only documentation has drifted. |
| Disposition | Compatible, intentional historical/planned structure, source defect, deployed-schema defect, data defect, recommendation, or unresolved. |
| Correction gate | Required approval/owner decision, affected population, dependency and rollback path. |

### Rules for structural comparison

1. **Use columns and key order, not autogenerated constraint names, as relationship identity.** Compare child and parent schema/columns, complete composite width and delete/update actions. `NO ACTION` versus `RESTRICT` should be interpreted against the actual engine, not treated as an automatic business difference.
2. **Derive cardinality from uniqueness and nullability, then measure occupancy.** A FK alone is not a one-to-one constraint. Child uniqueness establishes at-most-one; non-NULL mandatory carriers establish required linkage. F reports observed maximum children and complete-carrier orphans. Observed maximum one does not prove a structural uniqueness guarantee; zero current children does not invalidate planned functionality.
3. **Review NULL semantics explicitly.** Optional composite relationships can contain one NULL ID alongside a mandatory order/client carrier. Those partial carriers are counted for interpretation, not automatically declared orphans. Mandatory source relationships and lifecycle-specific prerequisites require separate state checks.
4. **Distinguish exact and approximate evidence.** C emits `COUNT(*)` queries; the package does not use approximate table statistics as record counts. Index usefulness cannot be proven from column metadata alone.
5. **Compare full index signatures.** Include uniqueness, access type, ordered key parts, direction, prefix length, expression and visibility. A longer composite index or ownership unique key may be needed for an FK. Do not label it redundant merely because another index starts with similar columns; do not remove anything during investigation.
6. **Review numeric and temporal contracts before interpreting profiles.** Type-family gates block obvious unsupported shapes but do not establish exact scale, unsigned range, collation equivalence or UTC semantics. Financial DECIMAL-to-FLOAT drift is material; a wider VARCHAR may be compatible. Normal-runtime driver time-zone configuration and SQL session time zone are separate settings.
7. **Reconcile backend assumptions.** Inventory requires source-aware price/stock columns; Sales requires quote/costing snapshots, accepted PO/invoice relationships and stock units; Production requires JO/item/specification/lineage structures; session services rely on defaults, unique token lookup, expiry/activity and revocation. M metadata, not old reports, decides whether those structures exist.
8. **Treat unexpected objects conservatively.** A view replacing a base table can alter read/write semantics; an execution-capable object needs separate definition review before trust. The package lists names only. Do not retrieve a definition that crosses a protected boundary or invoke a routine to inspect it.

F's 144 relationship templates come from the preserved Task 001 source dictionary: 143 inspected-definition relationships plus the clearly labelled session-to-user service requirement. Missing deployed FKs still receive an orphan query if all necessary base tables/columns are visible. Additional deployed relationships outside these expectations require follow-up using M07; they are not silently treated as covered.

### Critical source baseline distinctions

- Original `materials` requires non-NULL zero-default balances. The later permitted material definition introduces NULL/provenance, source identity and approved-versus-reference prices. An old original-only dictionary is not current deployed evidence.
- `users(client_id)` uniqueness is recorded historically as a later change; Task 001 did not establish that later exact DDL. Verify actual key carriers and client identity CHECK without querying migration history.
- `user_sessions` is required by current application SQL. Establish exact deployed fields/defaults/keys from M04–M08, without reading any token values.
- The material source-row review table and legacy/current migration marker tables have distinct purposes. No ledger reconciliation is part of this task, and no conclusion about a protected migration's contents is inferred.

## 3 D01 through D12 evidence matrix

Every “deployed” and “population” cell below is pending operator evidence. Counts refer only to executed profile results at their capture time. Task 001's symbolic examples and historical counts are not rows in this matrix.

| Issue | What the source proves | What deployed evidence must establish | Population/count evidence and limits | Correction classification and dependency |
| --- | --- | --- | --- | --- |
| **D01** material transition and verified zero preservation | The inspected material change adds status defaults plus a provenance check before reconciling non-NULL old values; later blanket zero-to-NULL statements cannot distinguish verified zero from a default. | M04/M08: actual material shape, defaults and enforced check. No migration history inquiry or replay. **Pending.** | C materials; P01/P02 current status/zero contradictions. Present NULLs cannot prove a past verified zero was lost. Exact historical loss count **not measurable without before-evidence**. | Schema/data reconciliation first. No DDL/DML decision until actual shape, before-images and operator authority are known. Never edit or replay an applied file. |
| **D02** samples used as stock | Import source assigns sample 10/2; Sales stock and request snapshot SQL ignore quantity provenance. Warehouse sample labels do not protect those consumers. | M04/M08: provenance columns and contract; actual material values from P01/P02. **Pending.** | P01 sample population; P03 reference-only prices; stock-line counts and F relationships. Historical reliance on a sample needs more evidence. | Backend/projection correction can need no DDL. Sample repair, new snapshot provenance and future importer changes require separate approval. |
| **D03** repeated shared demand | Availability assesses each product/material against the full balance and derives an order result without first aggregating shared demand. | Current schema supports item/template and saved-costing relationships. **Pending.** | P07 saved snapshot candidates; no replay of height parsing or current approved template selection. Not a historical shortage count. Empty BOMs do not close the latent defect. | Backend query/assessment correction first after unit/provenance decisions. No reservation/deduction and no BOM population. |
| **D04** units | Unknown units map internally to pcs; stock versus costing use different unit projections; maintenance can change labels without converting dependent values. | M04 units/source columns and F links; actual differences from P04. **Pending.** | P04 mapping candidates; P41 historical differences are not bad snapshots. Current data cannot prove past reinterpretation. | Source/projection correction; explicit unit mapping/conversion and restrictions require approval. DDL/DML only if the chosen approved representation needs them. |
| **D05** stock ledger bypass | Active count writers save balance and generic audit without material movements; defined movement before/delta/after fields cannot represent unknown opening stock faithfully. | M04/M08 ledger representation, C ledger/material counts. **Pending.** | P09 audit/movement coverage; P10 arithmetic; P11 latest-balance differences; P22 action counts. Missing movements do not imply missing all audit evidence. | Choose authoritative count history and unknown-first-observation semantics before a ledger write/schema change. Do not fabricate historical deltas. |
| **D06** JO snapshots | JO writer passes the inquiry specification ID and does not copy quote BOM lines to job BOM. | M04/M07 JO/item/spec/BOM/costing structure. **Pending.** | P08 shared specifications/missing job BOM, P29 ownership, P30 lineage. Existing shared rows are not proof of an actual later edit. | New-row source correction can use existing tables. Historical backfill needs contemporaneous evidence and separate approval; no invented recipe. |
| **D07** attachment multiplication | JO sum joins every payment file; one payment with several links is counted repeatedly. Accounting rows likewise assume a single effective file. | M05–M07 must confirm payment identity, file multiplicity and ownership before treating a once-per-payment sum as canonical. **Pending.** | P12 actual multiplication difference; P13 proof availability/cardinality; K eligible keys. P12 covers the relational part of the JO gate, not all quote/PO/invoice lifecycle prerequisites. | Strong first candidate for a bounded backend-only correction. Do not delete files/payments or add one-proof uniqueness by assumption. |
| **D08** payment replay identity | Timestamp-generated operation keys change across retries; review contains no sibling matching-submission check. Its locking join can also lock the invoice; that does not establish stable request identity. | M04/M05 operation-key capacity/uniqueness; C payments and P15 pattern coverage. **Pending.** | P14 similar groups and P15 key-pattern counts are candidates only. Legitimate equal payments cannot be labelled duplicates from amount/day alone. | Stable request identity, payload binding and rejected-proof resubmission decision. DDL conditional; historical repair separate. |
| **D09** exact arithmetic | Source converts decimal strings to binary Number and rounds/compares with decimal presentation/epsilon. | M04 actual precision/scale and P16–P18 stored invariants. **Pending.** | P17/P18 inconsistency counts do not establish causal rounding errors. Historical formula accuracy needs approved input snapshots and rounding policy. | Backend arithmetic correction can avoid DDL. Preserve 20/50 and existing formulas; do not reprice issued history. |
| **D10** PO reference namespace | Client-supplied PO reference or filename fills a globally unique internal reference, despite a separate client-reference field. | M05/M07 actual reference uniqueness, order ownership and one-PO-per-order contract. **Pending.** | P19 overlap/cross-company client-reference groups; rejected collisions leave no successful row and cannot be counted from surviving POs. | New-record writer correction after approved numbering policy. No blanket renumbering or relaxed uniqueness. |
| **D11** upload/SQL split outcome | PO/proof upload precedes durable SQL commit; later failure can leave external content without durable metadata. Temporary pending key also creates contention. | M04–M08 metadata/file-link shape, not object existence. **Pending.** | P20 lifecycle, P21 unlinked metadata, P22 event counts. No database-only orphan-object count or past commit-outcome proof. | Source lifecycle/reconciliation design; existing Engineer Sketch approach is a reuse candidate. Storage evidence or cleanup needs separate approval. |
| **D12** persisted object identity ignored | PO/proof retrieval omits stored bucket/generation although adapter supports them. | M04 identity columns and P20 presence counts. **Pending.** | Missing generations are measurable; wrong retrieved bytes/bucket/version and object existence remain unproved without separately authorized storage evidence. | Backend retrieval correction can avoid DDL. No guessed generations, global bucket rewrite or new cloud resource. |

### Source clarification and additional finding

**S13 — unchanged numeric observations do not promote provisional provenance.** In [inventory.service.js](../../backend/src/services/inventory.service.js:227), threshold and quantity changes are detected by numeric/null comparison. Entering the same number as an existing sample skips both the value assignment and its verified-status assignment. If no other field changes, the service returns success with the old provenance. This conflicts with the current UI wording that saving an entered count/threshold records it as verified. Source consequence: a Warehouse/Admin user can re-enter the observed value and fail to establish verification. No such live submission was executed.

Affected fields are `materials.quantity_on_hand`, `quantity_status`, `reorder_threshold`, `threshold_status`, plus the existing material update audit. P01 counts the sample population potentially exposed; it cannot identify which counts were re-observed and silently skipped. The source-only correction candidate is to detect an explicit approved observation transition as well as numeric change, preserving audit and transaction behavior. It needs no new business data, automatic sample promotion or DDL. Required future operator regression: same-value sample-to-verified observation; unchanged verified value remains a no-op; NULL remains unknown; failure preserves input and prior state. Include S13 in the D02/manual-count work package only after approval.

**D08 wording refinement:** the Task 001 description of review locking is narrower than the actual joined `FOR UPDATE` query. The established defect is absent stable replay identity and absent sibling deduplication, not an assertion that the invoice is never locked. Task 001 is retained unchanged as dated evidence; use this qualification for the correction design.

**D07 scope refinement:** a query fan-out defect does not prove the exact matching-downpayment submission path allowed an underpayment or that a JO was issued incorrectly. P12 measures arithmetic multiplication on qualifying relational rows; actual workflow impact requires order-level review after that aggregate evidence, without exposing customer data unnecessarily.

## 4 R01 through R09 review matrix

| Recommendation | Existing question and evidence package coverage | What remains a business decision |
| --- | --- | --- |
| R01 quote invariants | M04/M08 exact checks/scales; P17 by revision state, P18 downstream amount agreement. | Handling legacy drafts and applying exact 20/50 consistency without rewriting issued documents. |
| R02 recipe applicability | M04 template/version/approval shape; P06 competing/empty templates; P07 shared snapshot demand; C template counts. | Approved BOM inputs, version/selection owner, dimension units and waste inclusion. No price/unit/recipe inference. |
| R03 typed decisions/lineage | M04/M07 actual typed links; P22 audit action coverage; P30 JO costing versus current accepted quote. | Whether to introduce typed lineage/decisions and how to handle ambiguous historical evidence. Full audit payloads are outside this package. |
| R04 finished-good unknown state | M04 null/default/provenance structure, P36 balance states, F client/spec relationships. | Whether unknown stock exists and approved representation; zeros are not automatically false. |
| R05 numbering | M04/M05 counter and unique-reference shape, C counter/JO counts, K reference duplicates. | Numbering format, sequence initialization and safe concurrent allocation. No existing reference renumbering. |
| R06 overlapping settings/contacts | M04 and existing source field ownership; C settings/method counts and F ownership. Private bank/contact values are not retrieved. | Authoritative editable fields, synchronization and retention. No account/contact merger or deletion. |
| R07 lifecycle state checks | M08 check coverage; P23–P27/P37/P38/P40/P42; F order/client/evidence relationships. | Legitimate pending/terminal combinations, receipt selection, replacement/dispatch policies and request exclusivity. |
| R08 approval/review accountability | M04/M07 approval/review metadata; P03/P05/P35; generic actor/parent F profiles. | Which role can approve a price, resolution actor/time requirements and treatment of uncoded/excluded rows. Actor FK is not RBAC. |
| R09 quote-line multiplicity | M05 actual uniqueness, P31 multi-line item groups and F same-order relationships. | Split-line behavior and mapping to one manufacturing item; preserve legitimate issued layouts. |

## 5 Architecture quality beyond the twelve issues

### Normalization and intentional duplication

No new evidence supports table removal. Company versus account, application versus approved identity, reusable BOM versus quote versus JO snapshot, generated DR versus signed copy, and message versus recipient state have distinct responsibilities. Repeated client/order carriers enforce ownership. A generic attachment table would weaken real parent FKs; a generic audit event is not a substitute for every typed lifecycle relationship.

Actual anomalies must be established by their effect: D04 permits a unit-label change to reinterpret established numbers; D01 makes classification/constraint sequencing unsafe; D05 has a defined ledger the active count paths do not maintain; S13 misses a provenance-only observation transition. Valid master/snapshot differences in P41 must be retained, not “normalized” into current values.

### Ownership and cardinality

F checks all source-defined relationships whose actual fields are present, including composite order/client carriers. P28/P29/P30/P39 add semantic checks even where FKs are absent or insufficient. M05–M08 establish whether the database structurally enforces that same ownership. Deployed `foreign_key_checks` history and past repair activity are not inferable from current correct rows; no bypass or disabling is proposed.

An FK does not enforce who can act. Preserve role/action middleware, account type, server-derived client identity, safe projections, origin handling and auditability. P43 shows actual role vocabulary/account distribution without implying permissions. The nine roles remain Owner, Operations, Sales, Accounting, Production, Warehouse, Logistics, Admin and Client; their approved Task 001 workflow boundaries remain authoritative.

### Transactions and archival

Metadata cannot prove balance/audit atomicity, parent-lock conventions, retry safety, ambiguous-commit recovery or storage compensation. Source review identifies where multi-table writes belong to one transaction; future tests remain operator responsibilities. No new write workflow is introduced during investigation.

Restrictive FK actions and archived commercial records preserve lineage. An inactive user/client, superseded quote, rejected application, discarded signed copy, unresolved import review or empty planned table is not automatically stale/corrupt. Retention policy, ledger immutability and document generation retention must be reviewed before any cleanup proposal. Do not cascade-delete business evidence.

### Workflow support and limits

The existing structures can represent inquiry → revisions/costing → accepted PO → issued invoice → verified downpayment → product JOs → production → shipment/DR → later billing/payment. These are separate states, not a single universal status. The pre-JO downpayment and later billing cycles must both remain possible. One invoice/PO per order and one shipment per JO are existing cardinalities pending any owner-approved expansion.

Warehouse observations are manual count evidence, not procurement receiving. Quote/stock reads and JO issuance must not reserve or deduct inventory. Production, logistics, replacement, balance-payment and reporting policies that remain incomplete cannot be inferred from available status columns. Do not add a Procurement module or fill empty recipes to make downstream paths appear complete.

### Deployment readiness

M00–M09 support engine/charset/collation/SQL-mode/time-zone and actual schema assessment. They do not certify Cloud SQL compatibility, total Cloud Run pool budgets, least-privilege grants, backups/restoration, private GCS lifecycle or production acceptance. Existing local-only migration/import procedures remain outside the evidence package. No provisioning or deployment is authorized.

## 6 Operator evidence ledger and unresolved requirements

Use this record for each returned result:

| Field | Entry |
| --- | --- |
| Evidence ID and query section | M/C/F/K/P ID, exact authored or emitted statement. |
| Target and time | Operator-confirmed endpoint/database, M00 selection/version, statement capture time. No credentials. |
| Status | Not executed, blocked, excluded, executed with result, failed, or truncated. |
| Schema prerequisite | Metadata rows establishing required tables/columns/types/key assumptions. |
| Result | Exact permitted aggregate/metadata output, including zero when actually returned. |
| Interpretation | Valid state, candidate warning, confirmed invariant violation or unresolved. |
| Defect mapping | D/R/S13/ownership category and affected populations measured. |
| Limits | Concurrent activity, privileges, excluded sensitive keys, unmatched source versions or unavailable historical/storage evidence. |
| Next action | Scoped evidence follow-up, owner decision, correction approval or no correction. |

Outstanding evidence: all M results; exact known-table counts; all selected eligible F/K/P results; explanations of blocked/excluded queries; metadata for unexpected objects; record populations for proposed backfills; authoritative historical evidence for verified zeros/units/snapshots where required; approved recipe/price/rounding/PO numbering decisions; and separate storage or isolated runtime authorization if needed later. None is replaced by a past Task 002 result.

## 7 Database Change Report

**Tables reviewed:** the inherited 73-name source inventory; current source consumers for materials, stock requests, quotations/costing/BOM, PO/invoice/payment/files, JO/specification/production, ownership/audit/session configuration; source-dictionary relationships for all 71 non-ledger names. No deployed table or record was accessed. Ledger structure was not re-investigated and no ledger query is included.

**Proposals:** read-only metadata, conditional count/relationship/key/integrity SELECTs, D01–D12 evidence criteria, R01–R09 decisions, S13 source finding and conditional correction roadmap. **DDL/DML performed:** none. **Migrations created/applied:** none. **Application source edits:** none. **Database connections, queries, tests, builds, lint, runtime checks or verification commands executed:** none.

**Protections:** Migration 007 and its contents/history/checksum remained unaccessed; protected Task 003 artifacts and preserved Phase 1 Task 002 infrastructure were untouched. No Docker, grants, credentials, cloud changes, BOM population, imports, commit or destructive Git action occurred. Pre-existing untracked Task 001 documents were preserved.

**Pending approvals:** operator target and selected query execution; business decisions stated in the roadmap; separate bounded implementation, any DDL/DML/data repair, verification writes, storage access or deployment. The package is ready for review, not a live database health certificate. Stop here for operator review.
