# Phase 2 revised-ERD migration report

## Executed bootstrap — 2026-11-22, Asia/Singapore

**The corrected schema was created in the isolated Phase 2 database.** The authoritative execution record is [execution.json](../database/phase2-execution/2026-11-22-bootstrap/execution.json). The prior authored-only and unavailable-target entries below are preserved historical evidence, superseded for this new target by the actual results in this section.

| Result | Observed value |
| --- | --- |
| Bootstrap migration | [P2B001_corrected_database_bootstrap.sql](../database/phase2-bootstrap/P2B001_corrected_database_bootstrap.sql) |
| Execution window | 2026-11-22 01:33:19–01:33:24 +08:00 |
| Database / container | `enterflow_phase2_db` / `enterflow-phase2-mysql` |
| Published local endpoint | `127.0.0.1:62286` |
| Persistent volume | `enterflow-phase2-data`, mounted at `/var/lib/mysql` |
| MySQL / server UUID | `8.4.13` / `0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8` |
| Container ID | `2acac2d1b6069b6ed30a95b69eb582bd68ef9f365bc092f46530306f34a9eb73` |
| Before bootstrap | Zero tables, routines and triggers; empty-target metadata captured |
| Actual tables / primary keys | **71 / 71** |
| Actual foreign keys | **153**; complete child/parent column tuples match authored SQL |
| Actual unique constraints, excluding PKs | **76**; names, columns and uniqueness match authored SQL |
| Actual CHECK constraints | **47**, all reported `ENFORCED=YES`; clauses retained in evidence |
| Actual indexes | **294**, including PK, unique and automatically created FK-supporting indexes; every explicitly authored index present with intended columns |
| Actual data | Exact `COUNT(*)` per table: **0 rows in every table**, total 0; no reference/business seed or import |
| Execution status | DDL batch exit 0; no execution failure, no partial application or automatic rerun; final database UUID/name/version unchanged |

The 71-table **set** exactly matches [P2B001_tables.txt](../database/phase2-bootstrap/P2B001_tables.txt); it is not merely a count match. Full observed columns, defaults, generated expressions, keys, indexes, CHECK clauses and FK actions are in [after-metadata.json](../database/phase2-execution/2026-11-22-bootstrap/after-metadata.json). Every actual CREATE definition is retained in [actual-show-create-tables.txt](../database/phase2-execution/2026-11-22-bootstrap/actual-show-create-tables.txt). FK delete/update actions are RESTRICT/NO ACTION; no cascading history deletion was introduced.

The bootstrap emitted **one nonfatal MySQL warning, code 3135**, concerning future consolidation of SQL modes with strict mode. It did not prevent DDL execution; [bootstrap-output.txt](../database/phase2-execution/2026-11-22-bootstrap/bootstrap-output.txt) retains the warning. There were no failed or skipped CREATE statements. Metadata verification is not presented as authenticated application, negative-fixture or concurrent-write acceptance.

### Backup and execution safeguards actually used

Created a **new** 1,609-byte [pre-bootstrap-empty.sql](../database/phase2-execution/2026-11-22-bootstrap/pre-bootstrap-empty.sql), SHA-256 `be8188fe36d4e01199a4d7b06b791e7c89504fff0484b4897d47f0073eec0c62`. Its inspected content contains the specified empty target database declaration and session settings, no table definitions or INSERTs. It was successfully replayed on the **same still-empty Phase 2 target** before bootstrap; zero tables were reconfirmed. This proves the empty-target backup can be read by the actual MySQL client; it is not a recovery test for future populated data and will not undo CREATE TABLE statements by itself. No pre-existing backup was opened, overwritten, cloned or imported.

All SQL was supplied through stdin to `docker exec -i enterflow-phase2-mysql`, using its own container environment password without printing it or reading the DPAPI credential file. Before DDL, the guarded [executor](../database/phase2-bootstrap/execute_bootstrap.py) checked exact container ID/image, running state, published port, persistent mount, database, MySQL version, server UUID, empty schema and new-backup fingerprint. The SQL independently checks target name/version/UUID and emptiness using a session-local temporary guard table, which is removed before persistent DDL. The guard is not a seed/business record. A persistent execution journal precedes DDL; any failure stops and captures actual schema state. Existing journal detection prevents blind replay. No existing migration CLI or ledger is used.

MySQL CREATE TABLE commits implicitly, so the batch was **not** misrepresented as one rollback-capable transaction. Each CREATE is a committed checkpoint; full successful metadata reconciliation established that all intended statements completed. A future recovery must preserve this evidence and use an explicitly scoped forward repair or separately authorized empty-target rebuild; replaying the empty backup alone does not delete the new tables.

Bootstrap SHA-256: `1181e3ed51b17057648d9d6c9efa63190eb65299ecffb2534673be1eda3125ec`. It was authored before execution and not edited afterward. The SQL authoring helper only reads the reviewed E03 candidate; it neither reads nor executes historical migrations. E01/E02/E03 themselves remain unchanged and were **not** run against the empty database.

### How the executed schema accounts for E01–E03 and the revised ERD

| Requirement | Executed implementation |
| --- | --- |
| E01 request provenance | `stock_request_lines.quantity_status_at_request` is mandatory for new records, with verified numeric/arithmetic and unavailable NULL-pair CHECKs. No legacy NULL escape is needed in a new empty schema. |
| E02 costing lineage | Mandatory unique `quotation_costing.quotation_line_id` and complete quote/inquiry/item composite FK. Parent unique owner keys are created directly, not appended in a prerequisite migration. |
| E03 workflow targets | All eleven reviewed target entities are created with their owner keys and constraints. Transfer-only `legacy_*` IDs are omitted because this build imports no legacy records. |
| Accounts / roles / documents | `users` implements employee/client subtypes, identity CHECK and approved one-login-per-company uniqueness; no second credentials table. Nine permitted role codes are constrained, with no users/roles seeded. `files` and typed links preserve private object identities and backend physical names. |
| Inquiry / quote / costing | Existing physical names `orders`, `order_items`, `product_specifications`, `quotations`, `quotation_lines`, `quotation_costing`, `quotation_bom_lines` implement the revised entities. Full template attributes survive. Quote reference+revision ownership remains, with at most one `sent` revision via a generated unique slot. Exact mandatory downpayment percentages 20/50 and rounded amounts are checked. |
| PO / JO / manufacturing snapshots | Accepted quote/inquiry composite ownership; one `job_order` per PO; `job_order_item` carries complete copied specification fields and exact accepted quote-line linkage. `job_bom_lines` points to the item, never to a header masquerading as the old per-product JO ID. |
| Production | One `job_order_stage` state record per header/definition, staff/timestamps; `production_events` is reasoned event history, not a duplicate tracker. Definition positions permit exactly ten distinct slots 0–9. No old completion cursor or invented stage rows/history. |
| Raw / finished stock | Separate client-specific finished goods and raw materials, each with nullable unknown balances/thresholds and independent provenance. No zero default invents stock. Raw reference prices are separate from approver-attributed costing prices. One typed XOR `stock_movement`, including NULL before/delta for first unknown/sample observations, exact known-balance arithmetic and required actor/reason/replay identity. |
| Stock checks / shortages / plans | Request and response history remains separate from changes in physical inventory; typed shortage with optional same-JO stage and raw material; repeat-item/JO production plans have same-client FKs and positive quantities. No automatic reservation, deduction, procurement or forecast population. |
| Invoice / proof / confirmed money | Invoice has explicit same-inquiry PO FK and no mandatory pre-JO dependency. Separate many-file `client_receipt` and confirmed `payment_transaction`; when linked, a transaction's composite FK requires a verified receipt from the same invoice/order/client. Partial payments remain distinct records; official-receipt files link to confirmed transactions. |
| Delivery / waybill / DR | Intended `delivery` + `delivery_item`, repeat/partial deliveries with same-JO item ownership. Waybills, delivery events and Accounting DRs reference delivery directly. Signed DR states/files and accepted-signature invoice links remain normalized. **No `shipments`, `shipment_events` or old combined `payments` table was created.** Existing shared shipments are untouched. |
| Audit / notifications / reporting | Actor-attributed event/history and notification recipient/read state, role audiences and typed document links; no invented report, supplier purchasing, courier integration or duplicate document system. |

### Conflicts and unimplemented activation requirements

1. Both PDFs place the invoice before processed payment/JO. The revised text's mandatory invoice-to-JO edge would be circular; the executed invoice references PO, and JO is derivable through the one-PO header relationship. Sales-versus-Accounting issuer wording remains a permission decision; no existing permissions changed.
2. Ten stage **names and approved order** are still absent from inspected text. The schema has ten ordered slots; it has zero stage definitions and zero stage history. Real definitions and sequential transition/reversion enforcement need approved reference values and later authorized writers. Capacity is not claimed as completed production setup.
3. The revised receipt cardinality allows one or many confirmed transactions; the executed optional, nonunique receipt FK preserves that representational capacity without authorizing new allocation or proofless-JO policy. Approval and amount/allocation/retry transaction rules remain an application activation dependency.
4. Partial/repeat delivery structures permit multiple deliveries but do not invent allocations or enforce a cross-row cumulative shipped-total policy. Later authorized writers must lock and validate quantities, stage prerequisites, dispatch and DR role restrictions.
5. The ledger can represent unknown first observations, verified zero and known adjustments, but **atomic balance+movement+audit maintenance and prevention of direct-write bypass remain unimplemented writer/privilege requirements**. No triggers, grants or automated inventory mutation were introduced. The empty database has no inconsistency to repair; its structure alone is not evidence of future writer correctness.
6. Issued JO/specification/BOM immutability, mandatory item sets, exact ten per-JO stage instances, approved-price eligibility and cross-row financial totals need coordinated transactions/authorization. No fictional source data or historical grouping was created to satisfy them.
7. Existing APIs/services still query old per-product `job_orders`, combined `payments` and `shipments`, omit new mandatory lineage/provenance, and contain legacy stage/price assumptions. **The current application was not switched to this database and is not claimed compatible.** Keep configuration unchanged until a separate authorized compatibility task. Nine-role data access, manual review and Q01/Q02 behavior remain unchanged in existing code.
8. Payment methods retain configured company methods/instructions and immutable text snapshots on receipts/transactions; no speculative canonical payment lookup or automatic price/unit conversion was seeded. Demand rates/averages derive from genuine orders; no invented metrics were stored. Rush fields are absent from the new target; shared historical rush data was not removed.

### Current Database Change Report

Reviewed revised ERD, documented workflow, existing candidates and relevant backend SQL as naming/compatibility evidence. Created one new forward-only bootstrap, 71 tables and the actual constraints/indexes listed above **only in `enterflow_phase2_db`**. Persistent business/reference DML/imports: zero; all 71 exact row counts are zero. E01/E02/E03 and historical migrations were not executed or modified. Migration 007, Migration 008, protected history, existing backups, Task 002 environment, shared `enterflow_db`, production, shared Compose, frontend/backend application files and completed Q01/Q02 work were untouched. No container, volume, credential or grant was changed. No unrelated tests/build/lint/browser suites were run. Existing uncommitted files, including `database/phase2-target.local.json`, were preserved. Schema bootstrap and its required metadata verification are complete; the listed reference-data and application activation requirements are not claimed complete. No next task started.

## Historical planning and earlier execution discovery

Date: 2026-11-21, Asia/Singapore. **Authored only. No connection, migration, query, tests, build, lint or runtime verification executed.** Database correction at runtime is not complete.

## Authorized execution attempt — 2026-11-21

The subsequent user instruction authorizes backing up an isolated local implementation database, applying the existing E01–E03 unchanged, and obtaining actual metadata. Execution authorization is present; no further generic migration approval is requested. **Target identification is blocked**, before any database connection or write.

Actual discovery results: `database/.env.dev` points to `127.0.0.1:3308`, database `enterflow_db`, which the user explicitly excludes. Credentials were not printed. A search including ignored/hidden environment and Compose filenames found no separate isolated implementation connection configuration. No relevant target connection variables were present in the current shell. `mysql.exe`, `mysqldump.exe` and `mysql_config_editor.exe` were not found on PATH; Node and the installed `mysql2/promise` dependency are available.

An authorized local Docker container-name/status/port listing succeeded: `enterflow-mysql-dev` is running on `127.0.0.1:3308`; `enterflow-browser-test-2f90dcd2bbc8a779` is stopped with a recorded `127.0.0.1:32768` mapping. Neither database was connected to. The stopped test container was not inspected, started or used. The listing does not rule out another schema or non-Docker server, but no configuration identifies one as the intended target. No target or credentials were invented and no resources were created.

Required input: intended existing isolated target host, port, database name and the path to its credential configuration, together with identification that it is separate from protected Task 002/shared/production data. If no such target exists, its creation and approved base-data source must be resolved explicitly; these candidates assume existing application tables and cannot bootstrap an empty database. Do not copy from excluded databases or apply historical/deferred migrations to manufacture prerequisites.

Execution outcome: backup not attempted because no permitted target is identified; E01 not attempted; E02 not attempted; E03 not attempted; zero database statements executed and no partial migration. No schema/data changes, migrations/history modifications, application edits or Q01/Q02 changes occurred. Migration 007/008 and protected history were untouched. Once the target configuration is supplied, continue the already authorized backup, metadata preflight and exact SQL application; do not repeat ERD planning.

## Authored package and exact scope

The candidates live in `database/erd-corrections/`, deliberately outside `database/migrations/`. E01–E03 are package-local identifiers, not claims about the next historical migration version. They neither register themselves in a ledger nor read protected history. Registration and an execution procedure must be approved before application. The existing CLI is prohibited: it connects and its history reader retrieves every column. This package does not lift the D01/Task 28 hold or authorize deferred migrations.

| File | Exact schema effects | Dependencies and recovery checkpoint |
| --- | --- | --- |
| [E01_request_snapshot_provenance.sql](../database/erd-corrections/E01_request_snapshot_provenance.sql) | One nullable ENUM column on `stock_request_lines`, default NULL; `ck_request_provenance` validates a verified numeric stock/shortage pair and arithmetic, or unavailable NULL pairs. Legacy NULL status bypasses new classification deliberately. | Existing nullable numeric snapshot columns/checks confirmed by metadata. No old row reclassification. Later Q02 writer must explicitly persist provenance; additive schema alone cannot recover it. |
| [E02_quotation_lineage.sql](../database/erd-corrections/E02_quotation_lineage.sql) | Unique parent keys `users(id,client_id)`, `materials(id,unit_code)`, `purchase_orders(id,order_id,accepted_quotation_id)`, `quotation_lines(id,quotation_id,order_id,order_item_id)`; nullable `quotation_costing.quotation_line_id`, unique key and complete composite source FK. | Verify exact parent types/collations/index capacity, all target names absent, actual key inventory. No automatic line mapping or NOT NULL conversion. Each ALTER is an independent implicit-commit checkpoint. |
| [E03_revised_workflow_entities.sql](../database/erd-corrections/E03_revised_workflow_entities.sql) | Eleven empty revised entities, with PKs, owner FKs, UQs, CHECKs and history/queue indexes listed in full in the ERD/dictionary. | Requires E02. Targets must not already exist. No IF NOT EXISTS hides drift. Stage definitions, active write paths, historical transfer and retirement are **not** implemented by empty tables. |

E03 adds `job_order`, `job_order_item`, `job_order_stage`, `material_shortage_report`, `production_plan`, `client_receipt`, `client_receipt_file`, `payment_transaction`, `stock_movement`, `delivery`, `delivery_item`. It does not create duplicate role/client credentials, lookups, document storage, notification or reporting tables. Physical schema changes performed: zero; no table actually added, renamed or removed. Existing columns changed/removed: zero. New column additions and all constraints remain unapplied candidates.

Review the exact SQL for every index/constraint name. The [corrected ERD](PHASE_2_DATABASE_CORRECTED_ERD.md) includes all CREATE statements. E01's historical NULL escape and E02's nullable lineage are intentional expansion states; they are not final completeness guarantees.

## Execution gates

1. Select the responsible operator under `database/TEAM_MIGRATIONS.md`; approval for authoring does not appoint a replacement recovery operator. Approve a distinct isolated restoration target, connection/TLS identity, credentials already managed outside the patch and operator procedure. Never use protected Task 002 or shared `enterflow_db` for experimentation.
2. Obtain approved current metadata and record profiles using the existing [evidence procedure](phase-2-task-002/README.md), respecting its metadata-first conditions. Inspect only allowed schema objects; retrieve neither ledger contents nor Migration 007. Do not invoke migration/status/baseline/importer/snapshot commands. No such command was run here.
3. Reconcile source versus current types/nulls/defaults/PK/UQ/CHECK/FK actions/indexes, triggers, views, procedures and event dependencies. Confirm original schemas already exist; this package cannot bootstrap a fresh database without permitted base-schema restoration. Resolve D01 independently without replaying 008. Preserve verified zero and unknown distinctions and price approvals.
4. Approve stage names/order, header grouping and replacement treatment, receipt cardinality, delivery policy and unknown FG provenance. E03 proposal includes pending choices; do not activate before decision. Approve the exact additive SQL against reviewed metadata; resolve redundant deployed key names before execution rather than blindly replaying.
5. Take an approved recoverable backup outside this tool, including data/definitions/private file metadata and ownership mapping. Exercise restore through the approved operator process. Do not run an unrestricted full dump that reads protected migration rows; the backup procedure itself must respect that restriction and protected-environment boundaries. Preserve files, not just SQL attachment links.
6. Apply on the approved isolated restoration only, in order, with writers disabled under the later compatibility plan. Record statement-by-statement outcomes. MySQL ALTER/CREATE commits implicitly: BEGIN/ROLLBACK is **not** DDL recovery. Stop on the first error; do not use `--force`, blind reruns, FOREIGN_KEY_CHECKS=0, ignored errors or auto-repair.
7. Supply schema results and negative-case/failure/concurrency evidence before any historical transformation or development/production cutover approval. No cloud provisioning/deployment is implied.

## Preservation and transfer specifications

These are exact transformation requirements and approval gates, not executable blanket backfills. Actual populations and exception IDs remain unknown. A later transfer migration must encode the approved mapping explicitly and fail if its source evidence changed. Do not infer missing historic values from current masters.

### JO header, items, BOM and stages

Source keys: `job_orders.id`, `order_id`, `order_item_id`, `client_id`, `specification_id`, `costing_id`, `replacement_request_id`, `reference`, quantity, due date, cursor, status, pause fields, material-deduction marker, completion/creation/actor. Candidate ordinary header grouping is a single verified `purchase_orders.id` per inquiry. Require its accepted quote, every legacy item's accepted-line linkage and same client. A PO has UQ(order_id); the target header additionally has UQ(purchase_order_id).

Approve a mapping with one legacy JO ID -> one target item ID and target header ID, preserving **every old reference** in immutable legacy evidence. `job_order_item.legacy_job_order_id` carries the numeric mapping but does not replace the legacy row's other fields/history. Multiple different references, due dates, cursors, pause reasons, cancelled rows, replacement requests and mixed accepted revisions are exceptions. Never choose MIN(reference), MAX(cursor), newest master specification or an arbitrary costing. The target item's mandatory accepted quotation line prevents silently inventing lineage for replacement or manually added items; unresolved items remain unmigrated and block retirement.

Copy authentic issue-time complete specifications and final sketch association; all existing template dimensions/text fields are available in the target. If only a mutable current specification survives, mark the item unresolved and retain the original references; no historical snapshot is fabricated. Copy existing `job_bom_lines` names/units/prices/quantities/waste exactly, after mapping them to target items. No new BOM materials or reference-price promotion.

Contract migration after reconciliation: add a nullable target item carrier to `job_bom_lines` and `job_order_files`; backfill only approved maps, validate complete populations, replace legacy JO FKs with item/owner FKs, then make required carriers mandatory. Keep file IDs, BOM IDs and original source identifiers. Current `job_bom_lines.job_order_id` is per-item, so it must not be redirected to a header as if IDs had the same meaning.

Expand existing `production_stages` in a **new** approved migration after the ten names and old-position mapping are supplied. Replace the 0..8 check only then. Stage 9 cannot be inferred from the old completion cursor. Populate `job_order_stage` only from authentic state/events; a cursor is not proof of started/completed timestamps. Reconcile divergent product progress before grouping. Adapt existing `production_events` with target stage/item/header references as appropriate, preserving every event/reversion and original key. It remains audit history, not a second state tracker. Require reason on reversion and atomic stage/event updates in later authorized writers. Do not seed ten fictitious historical completions.

### Proof submission versus money

For each legacy `payments.id`, establish owning client from order and submitter, actual invoice by the existing same-order FK, every `payment_files` association/purpose, review state/amount/actor/time, replay key and genuine paid date. NULL-invoice, staff-origin, wrong-owner, missing proof, duplicate-retry and ambiguous resubmission rows are exceptions requiring decision; do not manufacture invoice, submitter or review attribution.

Receipt target: preserve submission amount/method/reference/paid date/note/type/state/submitter/time and reviewer metadata, one submission identity per legacy ID. `legacy_payment_id` is unique. Proof-purpose files map to `client_receipt_file` with unchanged file IDs and object generation; do not mistake official-receipt files for uploaded payment proofs. Preserve all original file purposes in retained `payment_files` until a reviewed official-receipt association is implemented. Rejected/pending source rows create no financial transaction.

Transaction target: map only authenticated, reviewed verified records using verified amount and genuine approval actor/time; preserve one unique `legacy_payment_id`. `recorded_by` must be an authentic staff actor, not a client submitter cast as Accounting. If historic recorder is unknown, stop rather than invent it; a later reviewed nullable legacy metadata exception may be needed. Transaction identity is independent from attachment count and from amount; two equal partial payments remain distinct. Do not use SUM(DISTINCT), one-row-per-image or blanket deduplication. Reconcile totals per invoice/type across distinct source payment IDs before and after. Review NULL-invoice rows and stable replay ownership separately.

E03 leaves receipt FK optional and nonunique as a **pending allocation proposal**, not permission for a new no-proof workflow or double posting. Before activation choose receipt-to-transaction cardinality and validate receipt review state/authorized approver atomically; if one-to-one is selected, add the unique FK in a new candidate after evidence. Sum all confirmed transactions once by invoice; expose proofs as children. New writers need durable request identity; a SQL unique key cannot repair timestamp-generated retries automatically.

Retain original payments/file associations, exact IDs and rejection history as read-only legacy evidence until every exception and official-receipt link is resolved. Do not drop them merely because target totals match.

### Inventory ledger and provenance

No balance backfill is authored. Reconcile `materials` number/status, unit, threshold/status, approved/reference prices separately. E01 does not infer historical request provenance from current materials. Old request numeric pairs remain byte-for-byte business values with NULL status; only new explicitly recorded observations classify snapshots.

Inventory target chooses the revised ERD's XOR typed FKs, rather than a speculative shared inventory master. Raw-material movement has material + canonical unit, finished movement has client-specific FG and whole-piece quantities. Raw unit FK to `(materials.id,unit_code)` prevents later master unit changes from silently reinterpreting new ledger values; approve unit migrations/conversions explicitly. No FK can validate that a legacy free-text unit snapshot has the same physical meaning as today's code.

For old movement transfer, preserve source table + ID, actor, time, reason and source references in an approved crosswalk/export; legacy numeric IDs collide across raw and finished tables and cannot both become a single target ID space unchanged. Do not invent provenance/operation tokens to claim replay of historic events. Preserve old streams separately if their evidence does not meet new constraints. Generic audit payloads and stock-response counts are historical evidence, not enough to derive missing consumption, deltas or initial physical counts. Do not create opening balances from zero or treat samples as verified.

Before activation require the atomic lock/append/balance/audit contract in the correction report plus an approved write boundary preventing bypass. Application writers are deliberately unchanged; the known inconsistency risk remains open. FG balance/threshold provenance needs an evidence-based additive classification migration and compatibility task; existing 0 cannot be assumed observed. Do not activate target FG movements until that is resolved. No automatic inventory trigger/reservation/deduction is introduced.

### Controlled removal of standalone shipments

Current source has **no existing `delivery` table**, so the legitimate destination is the intended revised `delivery` + `delivery_item`; it is not a renamed independent shipment entity. The target owns header-level dispatch and item allocations, deriving PO/invoice/client via JO. Keep waybill/DR/signatures as existing document entities.

1. Approve current source metadata, contents/population and **every inbound reference**. Known source dependents: `waybills.shipment_id`, `shipment_events.shipment_id`, `delivery_receipts(shipment_id,order_id)`. Include views/triggers/procedures and app queries; source inventory is not proof of no additional live dependencies.
2. Approve complete JO/item mapping first. For each `shipments.id`, preserve same ID as `delivery.id` if the isolated target is empty and collision-free; always retain `legacy_shipment_id` unique. Map its legacy product JO to target header and item. Preserve source `order_id`, delivery method, status, tracking reference/link, recipient contact/address, driver/vehicle, pickup contact/vehicle/ID requirement, office contact, estimated delivery/expected pickup, dispatch/delivery/fulfillment timestamps, updater/time **without substitutions**. Source has no creation timestamp: target `created_at` stays NULL for these rows. Do not set it to migration time. New deliveries should supply genuine creation time.
3. Populate `delivery_item` only from authentic dispatch/item evidence. A product JO's ordered quantity is **not** proof that the entire quantity was shipped. Missing shipped quantity or unsupported partial delivery blocks that row's final acceptance; retain original shipment unchanged.
4. Preserve each waybill ID/reference/QR/printing attribution and its file links. Add nullable delivery carrier; backfill via approved shipment map; compare one-to-one identities and uniqueness, then replace FK/column only after compatibility. Keep one waybill per delivery unless separately approved.
5. Transfer `shipment_events` to intended delivery event history by a controlled rename/column/FK migration or a reviewed exact copy with ID mapping; do not create a second active shipment tracker. Preserve every status/note/actor/time. Actual autogenerated FK names must come from approved metadata; guessed DROP FOREIGN KEY names are unsafe.
6. Add nullable `delivery_receipts.delivery_id` plus composite `(delivery_id,order_id)` FK to target delivery. Backfill approved identity map, compare order ownership and counts; keep DR IDs/reference and all send metadata. Preserve signed DR accepted-slot checks, files, discarded copies and invoice links unchanged. A DR is not itself the dispatch record. Logistics handles signed evidence; Accounting creates DR after dispatch; Warehouse creates waybill.
7. After operator approval, pause relevant writers; use transactional DML for a reviewed copy batch where possible; record per-ID exceptions, row-field equality, child identity/ownership, business totals, document associations and secure object identity. Restore/test on isolated target before coordinated app switch. Keep source data recoverable and immutable after switching; don't write both sources indefinitely.
8. Only after zero unresolved references, accepted reconciliation, retention approval, restored backup evidence and later app cutover: replace old FK/columns, rename delivery event history, remove obsolete source uniqueness assumptions, and drop standalone `shipments` in a **separate approved contract migration**. The actual DROP SQL is withheld because live dependency names/contents and retention approval are missing. This is scheduled controlled removal, not permanent retention. No renaming shipments alone is presented as the correction.

### Remaining contract changes

`invoices` remains the sales-invoice entity. One invoice per inquiry and one PO per inquiry allow derivation without a mandatory pre-JO relationship. A later explicit PO FK, if required, must backfill from genuine same-inquiry PO records and preserve pre-JO issuance; it is not necessary just to rename entities.

Revised urgent exclusion: preserve `orders(id,urgent)` and relevant original audit/history in approved retention evidence, update dependent queues/readers in a later authorized compatibility patch, replace `ix_order_queue` with an approved nonurgent index, then remove `orders.urgent` in a separate contract migration. No copied `is_rush` on new entities. Historical reference retains the old attribute only until retirement.

Mandatory downpayment stays exactly 20% or 50% under existing policy. Current database range check permits other percentages; do not silently rewrite historical rows or break incomplete drafts. Profile sent/superseded versus draft values and determine authentic required amounts/rounding; then authorize a lifecycle-aware constraint in a new file. Current app restrictions remain in effect. Quote reference/revision uniqueness is retained; no global UQ(reference) per revision is proposed.

## Recovery and rollback

These are forward-only expansions, not reversible transactions. Stop after any failed statement and compare actual metadata with the last checkpoint. No IF NOT EXISTS or automatic retry may conceal partial application. Restore the isolated target from approved backup, or author a reviewed forward repair for the known partial state. Do not edit prior files/checksums or migration histories.

After new data exists, retain columns/tables through an application rollback; dropping them loses evidence. Before activation old application still uses old structures, so additive targets can remain inactive. After cutover, rollback requires paused writers and approved reverse mapping of **all newly committed** target records; simply restoring old code loses new receipts/movements/deliveries. Keep historical IDs/crosswalks and private file identities until retention disposition. Business-data rollback uses compensating approved events or restored approved snapshots, never deletion to make checks pass. Stock rollback must not re-enable sample-as-stock behavior; payment rollback must preserve Q01 fan-out correction.

## Operator commands, after separate approval only

Nothing below was executed. These are templates with an intentionally unresolved isolated database name and preconfigured login path; an actual target cannot be safely invented. Obtain identity/TLS approval first. Do not substitute `enterflow_db`, the Task 002 database/container, migration CLI, or a cloud target. This patch does not create a login path, privileges, database or container.

From the repository root, set only the approved isolated restoration database and existing approved login path. Native `mysql.exe` must be available; connection/TLS options must match the approved procedure. The following file input uses UTF-8, password-free arguments and MySQL batch stop-on-error; no `--force`.

```powershell
$erdTarget = '__APPROVED_ISOLATED_RESTORE__'
$erdLoginPath = '__APPROVED_EXISTING_LOGIN_PATH__'
if ($erdTarget -eq '__APPROVED_ISOLATED_RESTORE__' -or $erdTarget -eq 'enterflow_db') { throw 'Select the separately approved isolated restoration target first.' }
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Get-Content -Raw -Encoding UTF8 -LiteralPath './database/erd-corrections/E01_request_snapshot_provenance.sql' | & mysql.exe "--login-path=$erdLoginPath" "--database=$erdTarget" --batch --show-warnings
if ($LASTEXITCODE -ne 0) { throw 'E01 failed; preserve output and stop.' }
```

Review E01 metadata/output before issuing the next block; these are separate operator checkpoints.

```powershell
Get-Content -Raw -Encoding UTF8 -LiteralPath './database/erd-corrections/E02_quotation_lineage.sql' | & mysql.exe "--login-path=$erdLoginPath" "--database=$erdTarget" --batch --show-warnings
if ($LASTEXITCODE -ne 0) { throw 'E02 failed; preserve output and stop.' }
```

```powershell
Get-Content -Raw -Encoding UTF8 -LiteralPath './database/erd-corrections/E03_revised_workflow_entities.sql' | & mysql.exe "--login-path=$erdLoginPath" "--database=$erdTarget" --batch --show-warnings
if ($LASTEXITCODE -ne 0) { throw 'E03 failed; preserve output and stop.' }
```

For exact post-expansion read-only output, after the same approval:

```powershell
Get-Content -Raw -Encoding UTF8 -LiteralPath './database/erd-corrections/VERIFY_TARGET.sql' | & mysql.exe "--login-path=$erdLoginPath" "--database=$erdTarget" --batch --show-warnings
if ($LASTEXITCODE -ne 0) { throw 'Evidence query failed; preserve output and stop.' }
```

These commands deliberately bypass the unsafe existing runner but **do not authorize bypassing the migration safety hold**. Approve how the operator records package execution without reading/changing protected history before running them. Do not run all files with a wildcard or whole-directory tool.

## Required acceptance evidence

Compare schema/keys/checks/indexes against the exact candidate DDL and approved current metadata. Verify no old row/value/count/attachment/history changed by expansion. Eleven empty new tables are expected, not proof that data was migrated. Legacy snapshot statuses and costing links remain NULL; count these explicitly as unresolved. Verify all nine role codes/account ownership and no new permissions.

On a separately approved isolated fixture, later negative tests must reject wrong-order PO/quote/item, wrong-client receipt/FG/JO, duplicate header PO, duplicate stage, mismatched quote costing line, stock both/neither item, unknown-before with fabricated zero/delta, negative stock, fractional FG, verified arithmetic mismatch, and duplicate operation keys. Verify unknown-to-known zero, positive/negative known adjustments, corrections and same-value sample observation. Require actual rollback/failure and concurrent-write evidence for balance+movement+audit and receipt-review+transaction; static checks cannot establish those guarantees.

After transfer approval compare distinct verified payment totals per invoice/type, receipt/file purpose mappings including rejected/resubmitted proofs, full shipment/delivery field equality and event/waybill/DR/signature identities, accepted quote and manufacturing snapshots, BOM and all production event histories. Validate no ordered quantity substituted for shipped quantity and no current specification substituted for historical issue-time facts. No destructive fixture SQL, test runner or broad regression command is authorized here. Exact fixture commands depend on the approved ten stages, target shape and later compatibility implementation; do not invent runnable acceptance against shared data.

## Database Change Report

Auxiliary local review files remain in `.codex/erd-review/`: the documentation authoring helper and rendered PDF pages 65/66. They contain source-document material only and are not migrations or application code. A normal-shell attempt to remove these three newly created files was denied by filesystem permissions; no elevated cleanup or recursive operation was attempted. They are outside the migration execution package.

Tables reviewed and dispositions: [correction report](PHASE_2_DATABASE_ERD_CORRECTION_REPORT.md). Proposed changes: E01–E03 plus gated transfer/contract specifications above. DDL/DML performed: none. Applied migrations: none. Historical files/checksums changed: none. Database/runtime/test/build/lint commands executed: none. Migration 007 and its history/checksum, Migration 008 execution, Task 002 runtime and protected Task 003 artifacts: untouched. Pending approval: actual metadata/record investigation through permitted operator process, D01 disposition, open business mappings, candidate DDL and compliant registration/execution/recovery, historical transfer, compatibility cutover and eventual physical retirement. Stop for review; no deployment or next task started.
