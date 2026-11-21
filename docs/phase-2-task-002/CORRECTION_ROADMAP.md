# Phase 2 Task 002 prioritized database correction roadmap

Date: 2026-11-21, Asia/Singapore. **Proposals for review only. No correction, migration, import or verification has begun.** Read the [findings/evidence matrix](FINDINGS_AND_RECONCILIATION.md) and [operator handoff](README.md) before selecting work.

## 1 Approval and evidence gates

First collect and review M metadata, C counts and selected F/K/P profiles. Establish actual tables, column contracts, parent-key uniqueness, provenance states, affected populations and unresolved exceptions. A blocked profile is an evidence gap; do not migrate to make it runnable. No deployed-schema or data-integrity defect is currently established because operator results are pending.

Approve one measurable correction at a time. A source correction does not authorize historical repair, DDL, an import, new BOMs, different business restrictions or RBAC. Preserve nine-role visibility and endpoint authorization, source-string BIGINT IDs, exact money, private file handling and existing frontend layouts.

**D01 is a global hold before any inventory DDL**, regardless of where a schema work package appears in the sequence. The current migration runner is not a safe execution path under the protected-history restriction. No alteration of migration files/history, lifting of a hold, manual replay or checksum acceptance is authorized. Select an approved compliant execution procedure before any future migration work.

## 2 Implementation sequence

| Order | Proposed bounded outcome | Evidence and dependency |
| --- | --- | --- |
| Gate 0 | Reconcile deployed schema and affected populations | M00–M09, C/F/K/P; no implementation. Determine D01 state without querying either migration ledger. |
| Q01 | D07 count each verified payment once | Payment identities/keys, P12/P13; candidate first backend-only fix. |
| Q02 | D02 keep unverified stock out of operational availability; S13 record explicit same-value observations | Material provenance shape, P01–P05/P09; approval of exact consumer/observation contract. |
| Q03 | D09 preserve exact decimal arithmetic across existing financial formulas | Actual numeric scales and agreed rounding compatibility; P16–P18. |
| Q04 | D08 stable replay identity for proof submissions | Q03's canonical amount handling and approved rejected-proof resubmission contract. |
| Q05 | D04 make operational units coherent | P04, current prices/counts/BOM references and owner decisions on aliases/conversions. |
| Q06 | D03 assess whole-order shared demand | Q02/Q05; approved template/quantity/waste basis; P07 candidates. |
| Q07 | D06 preserve manufacturing specification/BOM snapshots | P08/P29/P30, approved source completeness policy and authentic accepted quote inputs. |
| Q08 | D05 atomically preserve structured count evidence | Q02, P09–P11/P22 and approved unknown-first-observation/history contract. |
| Q09 | D12 retrieve the recorded object identity | File metadata compatibility, P20 and existing authorized retrieval path. |
| Q10 | D11 make upload outcomes reconcilable | Q09 and approved durable lifecycle/replay design; no storage provisioning implied. |
| Q11 | D10 separate customer/internal PO identity | Deployed uniqueness, P19 and owner-approved numbering/namespace policy. |
| Conditional schema package | D01 plus selected R safeguards | Only exact, approved DDL/DML justified by reconciled actual state. This is not permission to apply an old migration. |
| Later optional packages | Measured indexes, R03 typed lineage and other approved R changes | Actual plans/volume and explicit contract decisions; no broad redesign. |

If operator evidence exposes immediate unverified-stock reliance, Q02 may precede Q01. If there are no existing qualifying rows, a latent source defect remains; choose regression coverage for future supported states without creating business data. Do not make “all warning counts zero” an implementation target by deleting valid records.

## 3 Correction specifications

### Q01 Payment attachment cardinality

**Exact defect:** D07 sums a payment once per file link and projects several payment rows where the UI expects one payment. **Affected fields:** `payments.id/order_id/invoice_id/verified_amount/verification_status/payment_type/submitted_by`; `payment_files.payment_id/file_id/purpose`; `files.id/state`; invoice/order/client identity carriers.

**Dependencies:** `sales-orders.service.js` JO eligibility and `accounting.service.js` payment reads; `document-workflows.service.js` queue shape. Endpoints: `POST /api/sales/orders/:id/job-orders`, `GET /api/accounting/payments`, `GET /api/accounting/payments/:id`, `GET /api/documents/accounting/payment-proof-queue`. Frontend: Sales JO actions, `RealAccounting.tsx`, `RealPaymentProofQueue.tsx` and Client payment status consumers.

**Existing records:** P12 quantifies arithmetic multiplication; P13 identifies missing/multiple proof associations. No existing payment/file is deleted or reclassified. **Change class:** backend/query and compatible projection changes; no DDL/DML required for the minimal correction. A one-proof unique constraint is a separate business/schema decision.

**Preconditions:** actual payment PK uniqueness, same-order invoice/client links and file multiplicity are understood. Approve whether a qualifying proof requires available state and how multiple files are presented; do not silently add an eligibility restriction. **Postconditions:** the same legitimate payment contributes once, separate equal-value payments both contribute, and client ownership/prerequisite behavior is preserved. Use an existence check or independently aggregated relation, not `SUM(DISTINCT amount)`.

**Backup/rollback:** preserve pre-change code and operator read-only aggregate evidence. No database backup/write is needed for the query-only scope. Reverting code must not resume a known unsafe financial calculation; retain a fail-closed/unavailable path if needed. **Operator regression:** zero/one/many file links; proof versus receipt; unavailable proof; two equal payments; wrong-client invoice; Accounting one-payment projection; no JO or stock mutation on rejected prerequisites. Genuine persistence verification needs a separately approved isolated target.

### Q02 Operational stock provenance and explicit observations

**Exact defect:** D02 treats sample counts as operational facts; S13 skips verification when an explicitly entered number equals a provisional value. **Affected fields:** `materials.quantity_on_hand/quantity_status/reorder_threshold/threshold_status`; request-time quantity/shortage snapshots in `stock_request_lines`; existing audit values and response provenance.

**Dependencies:** `sales-orders.service.js` stock assessment, `stock-requests.service.js` request creation, `inventory.service.js` material maintenance, and future operational import planning. Endpoints: `GET /api/sales/orders/:id/stock-availability`, `POST /api/stock-requests`, `PATCH /api/inventory/materials/:id`; preserve existing Warehouse Stock Request `PATCH /api/stock-requests/:id`. Frontend: `Inventory.tsx`, inventory adapter/store, `RealQuotationPreparation.tsx`, Sales/Warehouse Stock Request modules.

**Existing records:** P01/P02 expose current states; P09/P22 describe audit coverage. Sample counts remain preserved until separately reviewed; current unknown is not zero. **Change class:** backend/frontend projection plus provenance-only update logic for an authorized explicit observation. No migration or blanket data repair is necessary for the minimal patch. Any importer correction changes future plans only; no execution is authorized.

**Preconditions:** approve verified-only operational stock interpretation and exactly which explicit maintenance submission establishes an observation; distinguish count verification from a display edit. **Postconditions:** samples/unknowns cannot become available/shortage facts; explicit observed zero is valid; re-entering the observed sample number records verification and audit atomically; unchanged verified values remain no-ops.

**Backup/rollback:** code rollback preserves accepted count/audit records. If a new response field is added, keep old-reader compatibility without mislabelling samples. Historical sample-to-NULL or verified repair needs reviewed row before-images and separate DML approval. **Operator regression:** NULL, verified zero/positive, sample zero/positive, same-value sample observation, same-value verified no-op, blank rejection, failed audit rollback, and no stock reservation/deduction on reads or quote/JO creation.

### Q03 Exact financial arithmetic

**Exact defect:** D09 converts decimal inputs to binary arithmetic. **Affected fields:** quote line prices/quantities, costing labor/markup/discount/VAT/material snapshots, quotation total/downpayment, invoice required downpayment and payment submitted/verified amount.

**Dependencies:** `sales-orders.service.js`, sales validation, `document-workflows.service.js`, existing Client/Sales valid-downpayment helpers. Endpoints: quotation creation, PO process, invoice issue, JO creation, Client payment-proof upload and Accounting proof verification. Frontend: original quotation/cost panels through Real Sales adapters, invoice previews, Client proof submission and Accounting queue.

**Existing records:** P16–P18 measure stored consistency, not the causal rounding population. Issued prices/totals remain immutable. **Change class:** source arithmetic/validation; no money-type DDL for the minimal correction. Any repair is separately reviewed, version-aware DML based on contemporaneous inputs.

**Preconditions:** approve exact scales, existing formula order and rounding points for labor/markup/discount/VAT and 20%/50% payable totals; inspect actual limits and legacy draft behavior. **Postconditions:** calculations/eligibility use exact decimal semantics and string transport; exactly 20/50 remains mandatory; no unsolicited formula or tax-policy change.

**Backup/rollback:** preserve code and calculation-policy compatibility. Read issued records as stored through either application version; do not recalculate history as a rollback. **Operator regression:** half-cent/scale boundaries, maximum supported amounts, enabled/disabled labor/markup/VAT, supported VAT modes, discounts including full discount, exact invoice/proof/JO agreement, invalid percentages, no repricing of old revisions.

### Q04 Stable payment submission identity

**Exact defect:** D08's timestamp-based key does not bind a client retry to a persisted submission. **Affected fields:** `payments.idempotency_key`, order/invoice/actor/payment type, exact submitted amount and proof identity; new receipt/digest fields only if approved.

**Dependencies:** `document-workflows.service.js`, document routes/upload adapter and Accounting review; reuse established Engineer Sketch replay concepts without copying its business contract blindly. Endpoints: `POST /api/documents/client/orders/:id/payment-proof`, Accounting verify/reject endpoints. Frontend: `RealClientPortal.tsx`/Client workspace and proof upload recovery.

**Existing records:** P14/P15 produce candidates, never an automatic duplicate list. Preserve rejected/verified submissions and all proofs. **Change class:** backend and Client submission contract; DDL conditional on existing key/receipt capacity; no historical deletion or unverification.

**Preconditions:** Q03 or agreed canonical decimal encoding; stable client key scope, digest binding, replay status retrieval and rejected-proof resubmission behavior approved. **Postconditions:** same request/key returns its original persisted result, conflicting reuse is rejected, distinct legitimate payments remain possible, ambiguous commit is reconciled rather than blindly retried.

**Backup/rollback:** preserve accepted replay identities/receipts even if code is rolled back; an old writer must not bypass new idempotency guarantees. Extra schema, if approved, stays additive until compatibility is proven. **Operator regression:** retry after lost response, concurrent same key, conflicting payload/file, same amount different legitimate requests, rejected-proof resubmission, authorization and ambiguous commit recovery on an approved isolated target.

### Q05 Coherent operational units

**Exact defect:** D04 permits pcs fallback and unit-label edits that reinterpret existing values. **Affected fields:** `materials.unit_code/source_unit`, balances, thresholds and approved price; `units.code`; template/quotation/JO consumption and unit snapshots.

**Dependencies:** inventory maintenance, source import planner, Sales stock/costing SQL and adapters. Endpoints: inventory GET/material PATCH, stock-availability GET, quotation POST and Stock Request POST. Frontend: inventory forms/details, Cost Estimation, quotation preparation and stock selectors.

**Existing records:** P04 identifies mapping differences; C/F and P41 describe dependencies. Spelling aliases can be valid and snapshots can correctly differ. **Change class:** initially source mapping/projection; an approved conversion model may require DDL and explicit conversion DML. No guessed conversions or price approval.

**Preconditions:** owner-approved operational/pricing unit and alias policy, authentic conversion evidence if needed, treatment of established counts/prices/recipes and approval of any new maintenance restriction. **Postconditions:** every operational comparison uses compatible units; source text remains provenance; a label edit cannot silently change the meaning of stock or price.

**Backup/rollback:** retain original unit/numeric before-images for any approved conversion. Reverse units only with the corresponding approved numeric conversion; preserve issued snapshots. **Operator regression:** supported unit, legitimate alias, unsupported unit unavailable, existing stock/price/BOM dependencies, historical snapshot retention, no kg/metre/roll assumption.

### Q06 Whole-order availability

**Exact defect:** D03 compares several item demands against the same undivided stock. **Affected fields:** order/item quantity; selected template material/consumption; materials verified balance/unit; associated finished-good identity.

**Dependencies:** Sales availability assessment and compatible detail projection, after Q02/Q05. Endpoint: `GET /api/sales/orders/:id/stock-availability`; frontend quotation preparation/stock modal and any derived order availability label.

**Existing records:** P07 measures saved-snapshot candidates only. **Change class:** backend/projection correction; no DDL/DML, reservation, deduction or BOM import. **Preconditions:** approved template/quantity/waste basis; confirm whether finished goods replace or merely accompany raw-material assessments. Do not invent netting/allocation policy.

**Postconditions:** combined demand by material and compatible unit drives whole-order assessment while product detail remains explainable; unknown input cannot produce available. **Backup/rollback:** code/response compatibility; preserve unavailable presentation if older consumers cannot safely interpret a new aggregate. **Operator regression:** two individually sufficient lines whose combined demand is short, repeated material within a recipe, different materials/units, unknown/sample stock, matching finished-good candidates and a read that produces no writes.

### Q07 Manufacturing snapshots

**Exact defect:** D06 does not create JO-owned spec/BOM snapshots. **Affected fields:** `job_orders.specification_id/costing_id/order_item_id/order_id/client_id`; `product_specifications` fields; `job_bom_lines` frozen material/name/unit/price/consumption/waste; accepted quotation costing links.

**Dependencies:** Sales JO writer and Production/Operations/client JO readers. Endpoints: Sales create/list JOs and Production `GET /api/production/job-orders[/:id]`; Client JO projections. Frontend: Sales JO flow, `ProductionRealJobOrders.tsx`, Operations production view and JO document previews.

**Existing records:** P08/P29/P30 establish candidates/lineage. **Change class:** new-row transaction writes using existing tables if actual shape supports them; no DDL for that minimum. Historical copies require separate repair approval and surviving issue-time evidence.

**Preconditions:** authentic accepted quote/specification/BOM basis; owner decision on missing costing/BOM and issuance eligibility. **Postconditions:** known issued spec/BOM is copied atomically and remains stable under later authorized master changes; creation still does not reserve/deduct inventory. **Backup/rollback:** retain issued snapshots and references through code rollback; no JO deletion or current-master historical backfill. **Operator regression:** multi-item issuance, exact copies, audit/link failure rollback, repeat submission, missing approved source behavior, historical reads and no inventory mutation.

### Q08 Structured count history

**Exact defect:** D05's active count writers bypass the defined movement ledger, whose current shape cannot represent unknown prior stock. **Affected fields:** material balance/status, movement kind/before/after/delta/operation identity, material/audit history and Stock Request observations.

**Dependencies:** inventory PATCH and Warehouse Stock Request PATCH, history consumers and future reconciliation; Q02 explicit-observation semantics. **Existing records:** P09–P11/P22 separate movement arithmetic, coverage and audit presence. **Change class:** source plus an approved first-observation representation; DDL conditional, historical reconciliation DML separately authorized.

**Preconditions:** choose authoritative count evidence, first-known observation, audit presentation, reason/actor and idempotency policy. **Postconditions:** accepted count and its evidence are atomic; no invented previous zero or reconstructed consumption. **Backup/rollback:** preserve old audit streams, append compensating approved observations rather than rewriting history; retain additive schema if older records depend on it. **Operator regression:** unknown-to-known, explicit zero, known adjustment, same-value verification, retry, audit/ledger failure rollback, concurrency under approved isolation, and no invented opening deltas.

### Q09 Historical object identity retrieval

**Exact defect:** D12 ignores persisted bucket/generation. **Affected fields:** `files.bucket/object_path/object_generation/state`; typed PO/payment links. **Dependencies:** document retrieval query and storage adapter. Endpoints: `/api/documents/{client,sales}/purchase-order-files/:fileId` and `/api/documents/{client,accounting}/payment-files/:fileId`; frontend authorized previews.

**Existing records:** P20 measures missing non-path identity metadata; object existence is unknown. **Change class:** backend query/adapter, no initial DDL or metadata rewrite. **Preconditions:** actual columns, generation handling and cross-parent authorization; approved behavior for legacy NULL generation. **Postconditions:** retrieves recorded identity without granting access across client/order scopes; no global-bucket substitution.

**Backup/rollback:** retain recorded old locations/generations; never rewrite them to match an environment setting. **Operator regression:** recorded bucket differs from default, recorded generation differs from latest, missing legacy generation, unavailable/deleted state, wrong-owner and mock adapter call contract. Live object access needs separate approval; no bucket setup is included.

### Q10 Upload outcome reconciliation

**Exact defect:** D11's external upload is not rolled back with SQL and its failure marker may also disappear. **Affected fields:** `files` pending/available/failed lifecycle and generation metadata, typed links, durable attempt/replay evidence; temporary object identity.

**Dependencies:** PO/proof uploads, storage adapter, Q09 and Q04 replay semantics where shared. Endpoints: document Client PO and payment-proof POSTs; Client retry/recovery and Sales/Accounting file readers. **Existing records:** P20/P21/P22 measure metadata only; no alleged orphan-object list can be produced by this package.

**Change class:** backend lifecycle and recovery contract; additive DDL only if existing metadata/audit infrastructure is insufficient. No storage cleanup, data repair or cloud activation. **Preconditions:** approved durable journal, ownership, generation preconditions, failure/commit-ambiguity handling and retention. **Postconditions:** every attempted upload has reconcilable evidence; no cleanup assumes rollback undid a successful commit; unrelated uploads do not share a fake pending identity.

**Backup/rollback:** preserve attempts, accepted links and object generations through deployment rollback. Deletion requires separate object-level approval and verified ownership. **Operator regression:** upload success plus link/audit failure, process interruption, ambiguous commit, concurrent uploads, generation-bound compensation and retry without duplicate accepted records on an approved isolated setup.

### Q11 Customer and internal PO namespaces

**Exact defect:** D10 stores the customer's number/filename as a globally unique internal reference. **Affected fields:** `purchase_orders.reference/client_reference/order_id/accepted_quotation_id`; reference uniqueness and document sequence contract.

**Dependencies:** `client-portal.service.js`, `document-workflows.service.js`, PO projections; Client metadata/upload routes and Sales PO reads/process. Frontend: Client submission/PO preview and Sales PO dialogs. **Existing records:** P19 overlap/reuse candidates; failed collisions are not surviving records. **Change class:** new-record source correction, usually no DDL/DML.

**Preconditions:** owner-approved internal numbering and customer-number scope, current one-PO-per-order behavior and display/search compatibility. **Postconditions:** independent customers can supply the same external number if the approved contract allows it; internal identity remains unique; no customer text is silently truncated into the identity. **Backup/rollback:** preserve historical numbers and document links; do not renumber old records during rollback. **Operator regression:** same customer number for separate companies/orders, common upload filenames, concurrent issuance, repeat upload and historical search/read-back.

### Conditional inventory schema transition and R safeguards

**Exact defect/decision:** D01 plus only selected R01–R09 items supported by actual evidence. Exact table/column/constraint operations remain **undetermined until M/F/K/P results**. Do not present an unverified source definition as an executable migration plan.

If a schema change is needed, review an exact before/after contract, affected IDs/counts held privately, service/UI compatibility, staged validation and a compliant execution path that preserves the protected-history boundary. Preserve verified zeros and all historical records. No default-to-verified classification, zero fabrication, BOM import, blanket deduplication, dropped table or renumbering is permitted.

Every chosen R correction needs its own bounded task. Examples: R03 typed lineage needs unambiguous same-order evidence; R04 nullable finished stock needs all consumers audited; R07 state CHECKs need legitimate pending states preserved; R09 uniqueness requires a confirmed split-line policy. An index change requires actual index signatures, query shape/plan and useful selectivity—not a duplicate-looking name.

## 4 Required migration and data repair protocol

For **each** later approved DDL/DML proposal, specify before execution:

1. Exact operator/target, permitted execution mechanism and protected exclusions; current schema preconditions and affected population from fresh reads.
2. Exact table/column/index/check/relationship changes, any backfill sources, ambiguity handling, order of operations and dependent application versions. Separate DDL from data classification and final constraint enforcement.
3. A narrowly scoped backup/before-image plan for the affected permitted business records/schema, stored privately with retention and restoration authority. No broad dump or protected ledger export is authorized. No backup operation is performed during this task.
4. Lock/availability budget, concurrent-writer strategy and failure/ambiguous-commit stop conditions. No new freeze, server setting or resource change is implied.
5. An independently approved isolated rehearsal and operator-run targeted checks. Do not reuse preserved Phase 1 Task 002 resources or Task 003 artifacts without separate authorization.
6. Postconditions: retained rows/history, exact money/provenance, complete same-client/same-order relationships, expected key/CHECK enforcement, unchanged role boundaries and successful permitted read-back.
7. Rollback: application compatibility plus approved row before-images or compensating entries; no destructive automatic down migration, history rewrite, assumed DDL transaction rollback, deletion of accepted evidence or unknown-to-zero substitution. Keep additive schema if removing it would strand valid new data.

No data repair is approved merely because a query returns warnings. Genuine inconsistency requires an approved authoritative correction source. If it is missing, flag the record and stop dependent repair.

## 5 Operator regression responsibilities

Tests, builds, lint, runtime and database verification remain the operator's responsibility. No verification command was executed by Codex. Task 001 contains candidate focused commands; after a work package and new regression cases are approved, select exact existing test files and review their import isolation before running them. Do not run migration tests, importer commands or `*.mysql.integration.js` as a shortcut.

Every selected change must cover its scenarios above plus existing permission denial, client ownership, valid pending/history states, failure recovery, exact decimal/string ID contracts and preserved frontend behavior. Source/unit/mock evidence does not establish authenticated API-to-MySQL persistence. That later evidence requires an explicit isolated target and authorization for its writes; no runtime setup or execution is included here.

## 6 Review decision

The first approval can be limited to **Q01 D07 query cardinality**, after compatible metadata and payment/file evidence are reviewed, with no database schema/data correction. Decide proof eligibility and compatible Accounting presentation in that approval. If stock evidence is more urgent, select Q02 explicitly instead. Do not start both automatically.

All deployed-schema and data-integrity conclusions remain pending. This roadmap authorizes no migration, backfill, cleanup, BOM, price approval, permission change, infrastructure action or deployment. Stop for operator review and result reconciliation.
