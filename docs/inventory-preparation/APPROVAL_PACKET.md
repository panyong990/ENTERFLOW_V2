# Section 24 inventory decision and import approval packet

Prepared November 18, 2026 (Asia/Manila). **Review only. No execution authorized.**

Primary reference: COMPREHENSIVE DEVELOPMENT HANDOFF §§14–17,24–28. Initial approved rules: original 28-page handoff §§5.4,5.7,7.4–7.5,7.9–7.10. Reuses docs/WAREHOUSE_INVENTORY_PHASE_1_REPORT.md and its completed source reconciliation. No MAIN extraction/comparison was repeated. Existing catalog and registry files are unchanged.

## 1. Decisions presented separately

| Decision | Exact proposal | Not implied by approval |
|---|---|---|
| A — unknown-stock representation | materials.quantity_on_hand remains DECIMAL(15,4); change NOT NULL/default zero to NULL/default NULL; retain CHECK and all keys | Import, converting existing zeros, BOM population or runtime execution |
| B — catalog candidate | Review all 71 exact rows in material-import-review.csv and nullable-import-proposal.json, with all unknown quantities explicitly SQL NULL | Current schema compatibility, actual absence of existing rows, target identity or operational approval |
| C — identities | Review all 71 code/reference records in reference-and-id-validation.json; numeric IDs remain null/unassigned in proposal | Invented IDs, registry publication or equivalence of code and primary key |
| D — BOM information | Obtain the separate business inputs in bom-business-data-required.json and BOM_REQUIREMENTS.md | Any template/line INSERT or guessed manufacturing rules |

The proposal is approval-ready as a precise design/candidate dataset. It is **not execution-ready**: current schema/lookup/material state, permitted operator, maintenance window, verified backup/restore and final reviewed plan digest remain gates. Approval of A does not approve B. The nullable-policy candidate cannot run through the existing verified-only executor; an isolated fake test verifies that its digest is refused.

## 2. Authoritative inputs and deliverables

- ../inventory-reconciliation/integrated-main-catalog.json: previously reconciled 71 rows, source commit e59364c1c9bd0257c82319df29e84081740ff694. Exact source fields are embedded in each proposal row, without stock defaults.
- ../inventory-reconciliation/catalog-reconciliation.csv: retained original reconciliation evidence; not regenerated or reverified against MAIN.
- ../inventory-reconciliation/quantity-evidence.template.json: 71 blank evidence entries retained unchanged; null is unknown.
- ../../config/material-catalog-ids.json: current empty registry retained unchanged; all proposed database IDs remain null, not row positions.
- nullable-import-proposal.json: precise target proposal, source digest, candidate operation digest, full reviewDigest binding target/schema/rows, all 71 parameterized operations and exact database-column values. Neither digest grants execution authority.
- material-import-review.csv: the same 71 review rows; quantity NULL is an explicit review marker, not a CSV import instruction. JSON parameter null is the authoritative binding.
- verified-only-current-schema-plan.json: default policy still blocks all 71 missing quantities; no weakening of current-schema safety.
- reference-and-id-validation.json: six distinct required catalog unit codes and eight category codes validated against repository allowlists; all database checks explicitly pending.
- bom-business-data-required.json: empty templates/lines plus required fields/evidence; no business values guessed.

Deterministically regenerate only these five generated review artifacts with `node scripts/prepare-section24-inventory.mjs --write`; verify them with `node scripts/prepare-section24-inventory.mjs --check`. Both are offline, fixed-path artifact operations; no environment, driver, MySQL, Docker, migration discovery or execution mode. Changing any authoritative input requires review and new digests, not silent approval rollover.

## 3. Exact schema proposal — only materials

Recorded source definition (database/SCHEMA.md) and historical November 18 snapshot: quantity_on_hand DECIMAL(15,4) NOT NULL DEFAULT 0.0000. This is not a current live schema verification.

Proposed DDL, **text for review only; no migration created**:

```sql
ALTER TABLE materials
  MODIFY quantity_on_hand DECIMAL(15,4) NULL DEFAULT NULL;
```

Meaning: NULL = quantity not recorded/verified; 0 = physically verified zero; positive value = verified recorded quantity. Negative and invalid values stay prohibited. No existing row is updated. Existing zeros are preserved without asserting their provenance; never mass-convert them to NULL or reinterpret them as verified counts. Future importer always binds an explicit quantity; default NULL prevents omitted stock from fabricating zero.

Retain ck_material_values: unit_price >= 0 AND quantity_on_hand >= 0 AND reorder_threshold >= 0. MySQL permits a CHECK result of UNKNOWN for NULL, while false non-negative checks still fail. No constraint removal/rewrite is proposed. [MySQL 8.4 CHECK documentation](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html).

No change to finished_goods.quantity_on_hand, stock_request_lines nullable snapshot columns, stock_response_lines required observed quantities, primary keys, foreign keys, indexes, defaults on other columns, prices, units, categories or privileges. Do not edit old migrations, baseline manifests, protected migration history/checksums or use the held migration runner to make this change. Future delivery mechanism needs its own authorization under the existing hold.

## 4. Exact catalog data proposal

Proposed target: documented local enterflow_db on 127.0.0.1:3308; container/UUID/version/TLS/database identity are **not freshly verified**. Target details are the documented proposal, not environment output. No credentials are included.

Only new missing approved materials would use:

```sql
INSERT INTO materials
  (name, category_code, unit_code, unit_price, quantity_on_hand, reorder_threshold, supplier_name)
VALUES (?, ?, ?, ?, ?, ?, ?);
```

Each of the 71 exact parameter arrays is in nullable-import-proposal.json under candidatePlan.operations. Price/threshold use the catalog's exact decimal meaning as strings, not recalculated prices. Names, categories, units and supplied suppliers are preserved. An absent supplier binds NULL, not a fabricated supplier. Every unknown quantity binds NULL, never zero, blank or a string 'NULL'. No explicit ID/active/timestamp is supplied; existing schema defaults/auto-increment remain authoritative. Approval assumes those defaults are first verified on the exact target.

The candidate assumes no existing materials solely to present all 71 proposed rows. Historical snapshot material/BOM counts of zero are not fresh evidence. Existing rows must be reconciled before a final executable plan: exact-match reuse preserves quantity, conflicts stop, missing rows alone insert. A changed insert/reuse set or any parameter changes the digest and requires renewed exact-plan approval.

## 5. Mapping, references and duplicate controls

1. Before any later writes, separately authorize retrieval of explicit material columns: id (decimal string), name, category_code, unit_code, unit_price, quantity_on_hand, reorder_threshold, supplier_name, active and updated_at. Obtain units.code and material_categories.code and verify target schema/defaults/checks. Do not inspect migration history or protected values. No such retrieval happened here.
2. All six actually referenced unit codes and eight category codes must exist exactly. Historical counts of 8/8 do not prove codes, labels or current state. No lookup INSERT or conversion is proposed.
3. Catalog codes/names must be unique; planner conservatively detects case/accent-normalized collisions. JavaScript normalization is not proof of MySQL collation equivalence: authoritative target collation collision checks remain mandatory.
4. Registry entries must reference known catalog codes, unique unsigned BIGINT decimal strings within 1..18446744073709551615. Unknown, duplicate, absent or conflicting mappings stop. Never cast codes to numeric IDs or Number; never infer IDs from sequence/order.
5. Existing-row reuse requires exact approved name/category/unit/price/threshold/supplier and acceptable active state. Do not overwrite differences or quantities. Name matching is a candidate-discovery step, not a trusted runtime identity mapping. Inactive/ambiguous rows require manual review.
6. Future inserts must capture actual generated IDs on the same connection as strings and verify the inserted row/reference values before commit. Persist the code→ID result only after acknowledged commit or resolved commit ambiguity. Then separately review/publish config/material-catalog-ids.json. A file write and database commit are not one atomic transaction: retain a protected operator execution manifest to recover publication failures.

The registry is external; materials has no catalog-code unique constraint. This proposal adds none. Do not claim race-proof or globally enforced idempotency: require an exclusive reviewed maintenance window preventing all concurrent catalog writers, re-read/lock target rows, validate MySQL collation collisions, and recheck just before inserts. Do not rely on a SELECT FOR UPDATE over an initially empty table or an advisory lock ignored by other writers as a universal uniqueness guarantee.

## 6. Transaction, validation and recovery strategy

Schema step and import are separate approval/execution stages. ALTER TABLE causes implicit commit; DDL cannot be rolled back by the later import transaction. [MySQL implicit commit documentation](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html). Do not specify an untested ALGORITHM/LOCK guarantee; measure table size, engine and metadata-lock behavior in an authorized isolated environment first.

Future approved import sequence: confirm target/operator/strict TLS and schema → verified restorable backup and exclusive maintenance → acquire connection → revalidate exact references and current rows → construct final deterministic insert/reuse plan with explicit quantity policy and approved digest → begin reviewed DML transaction/locking protocol → re-read under lock and reject drift → insert only missing rows → require one affected row, no warnings, valid unique string ID and exact read-back → verify all approved rows/mappings/counts within transaction → commit once → persist execution/mapping manifest → publish reviewed registry → authorized read/API/browser validation. The existing dormant executor is not a complete deployment runbook: it accepts caller-supplied lookups, lacks target/TLS/backup/maintenance/read-back/warning/commit-ambiguity operational verification, and intentionally cannot execute the nullable candidate. Do not invoke it live based on this packet.

Pre-commit failure: rollback DML, release locks, discard uncertain connection; reused records remain unchanged. Lost commit acknowledgment: classify outcome unknown, stop retries, reconcile explicit target rows/IDs using separately authorized reads and operator manifest; rollback after a network failure does not prove no commit. Post-commit rollback: no generic DELETE or automatic replay. First determine references/concurrent changes; propose exact IDs and a separately approved targeted recovery or verified backup restore. Never delete reused rows or reset employee accounts.

Reverse schema statement, conditional review only:

```sql
ALTER TABLE materials
  MODIFY quantity_on_hand DECIMAL(15,4) NOT NULL DEFAULT 0;
```

This reverse is forbidden while any NULL remains or its meaning would be lost. Never fill NULL with zero to force rollback. Retain nullable schema if safe reversal cannot be justified; obtain actual counts or an approved restoration plan. No reverse operation is approved or executed.

## 7. Affected tables and files

| Object | Proposal now | Future operation requires separate approval |
|---|---|---|
| materials | One nullable/default DDL proposal plus exact 71-row conditional INSERT candidate | Schema delivery, insert/reuse reconciliation, read-back, any recovery |
| units; material_categories | Reference validation requirements only; no data changes | Exact permitted lookup reads |
| bom_templates; bom_template_lines | Missing-data requirements only; no row values or DML proposed | Separate business-approved BOM plan |
| stock_request_lines; stock_response_lines; stock_responses; stock_requests | Impact review only, unchanged schema/data | Real Stock Request/manual count tests |
| quotations; quotation_costing; quotation_bom_lines; order_items; product_specifications; finished_goods | Impact review only, unchanged schema/data | Authorized costing/availability/persistence tests |
| config/material-catalog-ids.json | Existing empty registry unchanged; 71 pending mapping review records supplied separately | Publication after actual committed/reconciled IDs exist |
| migration files/history, RBAC/users/sessions/audit records | No proposed changes | No permission granted by this packet |

No BOM, lookup, inventory count, price update, stock deduction/reservation, procurement, role or audit write is bundled into catalog import approval.

## 8. Impact and consumer acceptance

| Consumer | Current source finding | Required verification before execution/acceptance |
|---|---|---|
| Inventory API | inventory.service.js selects quantity directly; inventory.service.test.js covers NULL vs recorded zero | Actual JSON NULL read after authorized schema/import |
| Warehouse | inventoryModel.inventoryNumber(null) is NaN for unknown display; materials/Inventory distinguish Not recorded from zero; explicit numeric mapping checked | Render unknown/zero/positive/invalid states, thresholds and provenance; ensure no ON STOCK for unknown |
| Sales availability | inventoryQuantity/materialAssessment return inventory_unavailable and null shortage for unknown; overall unavailable differs from unmapped | BOM known/unknown/zero/insufficient/available cases; no arithmetic NULL→0; no reservation/deduction |
| Quotation costing | Uses material unit prices and approved BOM quantities/waste, not quantity_on_hand as price; missing/invalid pricing/BOM fails MATERIAL_COSTING_INCOMPLETE | Unknown stock may affect availability, not invent prices; insufficient stock must not itself block quotations. Catalog alone does not supply BOMs. Preserve 20%/50%, labor/markup/VAT/discount and immutable snapshots |
| Stock Request creation | quantityOnHand NULL accepted; stock_at_request and shortage_at_request bind NULL; recorded zero binds zero | Both cases remain distinct; numeric ID only; request requires positive demand |
| Warehouse response/update | Recorded current/shortage quantities required; null manual response/update rejected; operational bound is 1e9, narrower than DECIMAL(15,4) storage | Physically verify counts; no bulk replacement of unknowns; matching line/material sets and explicit zero confirmation; preserve transaction/audit |
| Finished goods | Separate non-null integer stock column; no schema change | Regress finished-goods presentation; do not infer its counts from material policy |
| Cloud SQL | Standard MySQL DECIMAL/NULL/CHECK/DML design, not container-specific storage or identity | Approve actual Cloud SQL engine/version, collation, SQL mode, privileges/TLS/pool/maintenance, backup/restore and migration process before deployment |

Cloud SQL documents MySQL 8.4 support; that does not verify a configured project instance or exact local minor-version parity. [Official version policy](https://docs.cloud.google.com/sql/docs/mysql/db-versions). No cloud resource, connection or migration is created by this work.

## 9. Approval record — intentionally blank

Approver/decision/date: __________. Design A accepted/rejected: __________. Import B selected rows/target/final digest: __________. Operator and maintenance window: __________. Backup/restore evidence: __________. Required live metadata/read authorization: __________. Mapping publication reviewer: __________. BOM owner/next review: __________.

Use the designated recovery/operator restrictions in database/TEAM_MIGRATIONS.md; no alternate identity or credentials workaround is authorized. This form's blank fields mean approval is outstanding, not implicit consent.

## 10. Database change report

Connections, executed SQL, records inspected, schema/data changes, migrations created/executed, imports, Docker operations, guessed stock/BOM/IDs, credential and RBAC changes: none. Protected Migration 007 and checksum/history untouched and uninspected. Exact DDL/DML above and JSON arrays are proposals only. Runtime application files and the live registry were not changed for this preparation task.

