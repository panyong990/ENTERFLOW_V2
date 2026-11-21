# Phase 2 Q02 operational stock provenance correction report

Date: 2026-11-21, Asia/Singapore. **D02/S13 application corrections and focused regressions authored. Operator execution and runtime acceptance remain pending.** No database connection, SQL execution, tests, build, lint or runtime verification was performed.

Q01 is accepted at the focused source-regression level per the user's instruction. Its payment correction, proof-selection behavior, regression cases and report were not reopened or modified. Q02 adds independent stock changes to the shared Sales service/test files while retaining the accepted payment sections.

## A Implementation summary

**D02:** Sales stock assessment and Stock Request creation previously used `materials.quantity_on_hand` without checking `quantity_status`. A finite sample could therefore establish availability or shortage. The correction uses a small shared backend `operationalStockQuantity` function: only an explicitly verified, valid nonnegative quantity can participate. NULL, unknown, provisional, missing/invalid provenance and invalid quantities never become operational zero.

Sales selects provenance with its existing BOM/material mapping and returns an additive `quantityStatus` assessment field. Existing availability/status fields and NULL sentinels remain. The frontend Sales availability hook also normalizes raw-material assessments by provenance, so a legacy/malformed response cannot combine a sample count with an “Available” badge. Its original quotation and order-detail interfaces retain their layout, with existing Sample/Unavailable terminology.

New Stock Request snapshots store NULL stock and NULL shortage when the material count is unverified. Verified zero stores zero and the actual requested shortage. Existing historical rows are not rewritten. The request history preserves request-time numeric values but no longer uses an unversioned request-time shortage as current Warehouse status; an explanatory note identifies the missing snapshot provenance.

**S13:** maintenance now considers provenance differences as well as numeric differences, but only for fields explicitly present in an authorized submission. Re-entering a sample's same numeric count/threshold can set that field to verified. An unchanged verified number remains a no-op. The Warehouse form separately tracks actual edits to quantity and threshold; merely opening the form or changing material details does not submit prefetched sample numbers as observations.

Warehouse raw sample values and indicators remain visible/editable. Its stock warning helper and representative inventory helper exclude unverified quantity and threshold inputs independently. A verified zero still establishes Out of Stock without needing a threshold; a positive verified quantity with an unverified threshold cannot establish a low/in-stock threshold classification. That does not prevent Sales from assessing a verified quantity against product requirements independently of reorder policy.

An additional directly related correction aligns material creation's API/audit `thresholdStatus` with the existing SQL insert when an initial threshold is explicitly supplied. Stock still starts NULL/unknown; an explicit threshold does not verify quantity.

## B Changed files

| File | Q02 purpose |
| --- | --- |
| `backend/src/services/stock-provenance.js` | New pure verified-only operational count selector; no database/config import. |
| `backend/src/services/sales-orders.service.js` | Stock-only SQL selects quantity provenance; material assessment gates available/shortage values. Accepted Q01 aggregate unchanged. |
| `backend/src/services/stock-requests.service.js` | Selects quantity provenance and writes safe NULL-or-verified request snapshots. No historical read/write migration or change to Warehouse process semantics. |
| `backend/src/services/inventory.service.js` | Explicit provenance-only observations, independent quantity/threshold comparison, and matching create response/audit threshold status. |
| `backend/src/services/sales-orders.service.test.js` | Updates stock fixture provenance and adds Q02 stock-state/no-write cases. Q01 cases retained unchanged. |
| `backend/src/services/stock-requests.service.test.js` | Updates stock fixture provenance and adds verified/unknown/sample/inconsistent snapshot cases. |
| `backend/src/services/inventory.service.test.js` | Same-value/different-value, independent observation, no-op, zero/NULL, actor/forgery and transactional audit-failure fixtures; creation threshold consistency. |
| `src/app/store/inventoryModel.js` | Pure operational numeric selector, explicit form-observation payload builder, Sales availability normalization and quantity label helper. Raw merge fields remain intact. |
| `src/app/store/materials.tsx` | Quantity/threshold provenance guards for persisted raw-material warnings and representative operational quantities; Demo behavior remains separate. |
| `src/app/components/Inventory.tsx` | Per-field edit tracking; sends only explicit observations; preserves raw sample values/indicators and existing modal; sample suffix in raw details. |
| `src/app/components/useSalesOrders.ts` | Additive optional assessment provenance type and normalization in the existing stock hook. |
| `src/app/components/sales/RealQuotationPreparation.tsx` | Existing stock row uses provenance-aware Sample/Unavailable/Recorded quantity label, including recorded zero. |
| `src/app/components/sales/SalesDocumentSections.tsx` | Existing raw-material description retains a Sample indication; normalized NULL values/statuses drive its original table. |
| `src/app/components/StockRequestsModal.tsx` | Explains absent request-snapshot provenance and prevents API history snapshots from driving current status/shortage fallback; retains request-time columns and Warehouse response display. |
| `src/app/store/inventoryModel.test.mjs` | Pure provenance, raw-value preservation, observation payload and frontend normalization cases. |
| `src/app/components/realInventoryProduction.test.mjs` | Q02 source wiring, request-history presentation and importer-source protection cases; no importer invocation. |
| `src/app/components/sales/realQuotationPreparation.test.mjs` | Q02 hook/quotation/detail presentation wiring. |
| `docs/PHASE_2_Q02_OPERATIONAL_STOCK_PROVENANCE_CORRECTION_REPORT.md` | This implementation, findings, approval and operator command record. |

Pre-existing Q01 modifications, Task 001 reviews and the Phase 2 Task 002 evidence package were preserved. No migration, import source, catalog registry, material identifier, pricing formula, BOM data, permissions or production frontend navigation was changed.

## C Stock provenance behavior

| Material quantity state | Previous operational risk | Implemented operational result | Warehouse data treatment |
| --- | --- | --- | --- |
| NULL/unknown | Numeric fallbacks elsewhere could blur unknown and zero; status was not consulted. | Availability and shortage are NULL/unavailable. New snapshots are NULL/NULL. | Unknown remains unknown and can be explicitly observed later. |
| `provisional_sample`, positive | Could be available or short based on the sample number. | Unavailable, with Sample indication; no operational shortage conclusion. | Original sample value remains visible/editable and provisional until an explicit authorized observation. |
| `provisional_sample`, zero | Could appear to be verified zero shortage. | Unavailable; not known zero. New snapshots are NULL/NULL. | Sample zero remains a sample. |
| `verified`, zero | The number was usable, but quotation quantity text could say unavailable for `zero_stock`. | Known zero; requirement comparison may establish shortage. Snapshot stock is zero. Quotation says Recorded 0. | Explicit zero remains valid; threshold provenance is not changed implicitly. |
| `verified`, positive | Number used without proving status. | May establish availability/shortage using the existing mapped requirement. | Raw count retained; threshold warnings require an independently verified threshold. |
| Missing/invalid status, unknown with a number, verified with NULL, invalid number | Could be interpreted numerically despite contradictory provenance. | Fails closed for operational assessment. Stock Request invalid numeric data still uses the existing error path; otherwise unavailable provenance produces NULL snapshots. | No automatic data repair/promotion. |

Sales BOM selection, material mapping, waste treatment, unit representation and per-product quantity logic are unchanged. D03 aggregation and D04 unit policy remain separate work. Approved costing prices are not replaced by PDF reference prices; quantity provenance does not approve a price. Finished-good provenance has no equivalent column in the inspected source model and is not silently invented in Q02; see G05.

The inventory API continues to return raw values and provenance for maintenance. It is not made into an API that erases samples. Operational consumers must use the status-aware helpers. The Real Sales Stock Request selector intentionally still permits any registered database-backed material, including unknown/sample materials, so Sales can ask Warehouse to observe it; selecting a material is not an availability claim.

## D Same-value observation behavior

The existing API's field presence is the observation boundary. Only an authorized Warehouse/Admin request containing `quantityOnHand` or `threshold` can establish that field's status. Clients cannot supply `quantityStatus`/`thresholdStatus` directly through maintenance; existing allowed-field validation continues to reject them.

For an explicitly supplied field, the backend computes desired status as verified for a valid non-NULL value and unknown for NULL. It updates when the number/null differs **or the field's provenance differs**. The other field is not inferred, copied or verified.

| Submission | Effect |
| --- | --- |
| Sample 10 explicitly re-entered as 10 | Quantity remains numerically 10; quantity status becomes verified; threshold unchanged. |
| Sample threshold 2 explicitly re-entered as 2 | Threshold becomes verified; quantity remains sample if not observed. |
| Already verified 10 re-entered as 10/10.0000 | Numeric equality and verified status produce no material update or audit entry. Existing transaction still closes normally. |
| Explicit 0 | Verified zero, including a sample-zero to verified-zero transition. |
| Explicit NULL or cleared input | NULL/unknown, never zero. An already NULL/unknown field remains a no-op. |
| Omitted field | No observation or provenance change. |
| Name/supplier/category edit only | No auto-verification of prefetched quantity/threshold. |

The form sets independent observation flags only on that input's `onChange`. Prefilling, focus, opening details or saving an unrelated detail does not set them. Clearing and re-entering the original number retains the observation flag even when the final text equals the original. This fixes the frontend omission that would otherwise keep the backend correction unreachable. Explicit same-value verified inputs can reach the server, which correctly treats them as a no-op.

All material value/status assignments and the old/new audit payload remain in the same existing transaction. Failed audit persistence follows rollback and does not commit a partially verified state. Failure preserves the existing form input/error behavior; no success is fabricated. Actual server transaction behavior remains untested here.

## E Stock Request snapshot compatibility

The inspected `stock_request_lines.stock_at_request` and `shortage_at_request` are nullable DECIMAL fields with nonnegative checks. They can safely distinguish a recorded operational quantity (including zero) from unavailable information. Q02 uses them without DDL:

- Verified valid stock: numeric stock and derived shortage.
- Unknown/sample/unusable provenance: NULL stock and NULL shortage.
- Invalid numeric material data: existing `INVENTORY_UNAVAILABLE` validation path; no fabricated snapshot.

These two columns **cannot preserve why a count was unavailable**, nor attest that an existing numeric historical snapshot was verified. No snapshot provenance/version field exists in the inspected source. Q02 therefore does not label all old numbers verified, join them to today's material status as historical proof, or rewrite them to NULL.

Sales/Warehouse history still shows the original request-time columns and latest Warehouse response. A note explains missing request-time verification provenance. In API mode, the current status/shortage columns depend on an explicit Warehouse response; old request snapshots no longer produce a fallback SHORTAGE badge. Demo-only behavior remains separate. Unknown new snapshots display Not recorded rather than zero. Warehouse response observations and the existing confirmed inventory-update action remain intact, including setting quantity verified without touching threshold provenance.

The smallest persistent extension to distinguish unknown versus sample versus verified-at-request is proposed in G01, not applied. New NULL snapshots remain safe even while that approval is pending.

## F Frontend impact

Reviewed the original Inventory raw/finished tabs, update modal, detail pane, sample indicators, material store/adapter, Sales quotation preparation, order-detail stock section, `RealSalesStockRequests.tsx`, `stockRequestInput.mjs`, `stockRequestPresentation.ts`, Warehouse request adapter and shared modal.

Layouts, components, tabs, navigation, filters and request/observation controls remain. Changes are state/payload handling, sample/zero text, provenance-aware warning/availability calculation and one explanatory history note. No verification screen, new status enum, alternative Inventory interface or frontend workaround for server persistence was introduced.

The backend remains authoritative. The frontend additionally refuses unverified raw-material availability from a legacy/stale-shaped API response. `quantityStatus` is additive to stock assessments; existing unavailable status and NULL conventions remain. A server that omits provenance is displayed unavailable rather than trusted by default. Raw sample fields in the inventory adapter remain numeric and editable; operational selectors treat them separately.

## G Database architecture findings

All findings below are source findings. No actual schema, current records or affected counts were inspected. The [source dictionary](PHASE_2_TASK_001_SCHEMA_SOURCE_APPENDIX_2026-11-21.md), [Task 001 review](PHASE_2_TASK_001_DATABASE_ARCHITECTURE_REVIEW_2026-11-21.md), [Phase 2 findings](phase-2-task-002/FINDINGS_AND_RECONCILIATION.md) and [roadmap](phase-2-task-002/CORRECTION_ROADMAP.md) supply the existing baseline; current metadata remains an operator responsibility.

### G01 Snapshot provenance is not persisted

1. **ID/classification:** G01, confirmed source representation gap; exact deployed presence requires evidence.
2. **Affected structure:** `stock_request_lines.stock_at_request`, `shortage_at_request`, material/order request relationships.
3. **Evidence:** nullable numeric snapshots and source FKs exist, but no per-line quantity-provenance field in the inspected definition/current insert.
4. **Problem:** NULL cannot distinguish sample from unknown; a historical number cannot prove verified provenance. Current material status must not be substituted for issue-time provenance.
5. **Proposed target:** retain existing numeric fields and add nullable `quantity_status_at_request` with the existing unknown/provisional_sample/verified vocabulary; NULL explicitly represents legacy provenance not recorded. Optionally approve a snapshot version only if needed by the migration/compatibility design.
6. **Operations:** additive column plus a reviewed compatible CHECK/API mapping for future rows. Preserve legacy NULL status and all historical values; no automatic backfill. Future unverified states retain NULL operational stock/shortage.
7. **Affected workflows:** Sales request creation, shared Sales/Warehouse history, quotation stock-response traceability.
8. **Existing records:** all historical request lines potentially lack provenance; counts and reliable backfill evidence unknown.
9. **Risks/dependencies:** source/deployed reconciliation, legacy-compatible checks and UI rollout. Do not label all old snapshots verified or sample by inference.
10. **Order:** Q02 safe NULL handling first; review schema extension after metadata/records are available.
11. **Task:** separate schema/response extension, not required for Q02's safe unavailable representation.
12. **Approval:** **NOT APPROVED / NOT IMPLEMENTED.** Explicit database approval required.

### G02 Structured movement history does not represent every manual observation

1. **ID/classification:** G02, confirmed source limitation corresponding to D05; no confirmed redundant audit table.
2. **Affected structure:** `materials`, `material_movements.quantity_before/quantity_delta/quantity_after/kind`, `material_changes`, `audit_events`.
3. **Evidence:** maintenance and Stock Request processing update counts/generic audit; they do not append material movements. The movement schema requires known before/delta/after values. Q02 retains existing transactional audit rather than fabricating ledger rows.
4. **Problem:** first-known observation after NULL cannot truthfully use a zero before/delta; a movement-only view cannot be called complete.
5. **Proposed target:** decide the authoritative count history. If the movement table is selected, define a distinct first-observation event with unknown before/delta and known after; keep normal movement arithmetic for existing known-balance kinds.
6. **Operations:** conditional modification of movement kind/nullability/CHECK and source writers, or a separately approved observation relation. Do not implement both parallel histories by assumption. No historical guessed-delta migration/removal.
7. **Affected workflows:** Warehouse/Admin maintenance, confirmed Stock Request updates and inventory history/reconciliation.
8. **Existing records:** existing audit/ledger rows retained. Coverage and repair population unknown.
9. **Risks/dependencies:** idempotency, actor/reason, unit consistency, unknown-first-count semantics and transaction boundaries.
10. **Order:** separate D05 decision after Q02; preserve Q02's audit consistency now.
11. **Task:** separate structured-history task.
12. **Approval:** **NOT APPROVED / NOT IMPLEMENTED.** No ledger DDL or data repair performed.

### G03 Initial threshold response/audit did not match its SQL provenance

1. **ID/classification:** G03, confirmed application mapping defect, corrected within Q02.
2. **Affected structure:** `materials.reorder_threshold/threshold_status`, material creation response and audit JSON fields.
3. **Evidence:** the existing insert marked an explicitly supplied threshold verified; its response/audit builder omitted that status and defaulted to unknown.
4. **Problem:** a successfully recorded threshold could appear unknown, even while database intent was verified; count provenance must remain independently unknown.
5. **Target:** creation response and audit use the same existing threshold status as the insert, without setting quantity verified.
6. **Operations:** source mapping only, implemented; no add/modify/merge/migrate/archive/remove of database objects or historical audit rows.
7. **Affected workflows:** authorized material creation and subsequent Inventory refresh/audit.
8. **Existing records:** none rewritten; historical inaccurate payload population unknown.
9. **Risks/dependencies:** explicit threshold validation, preserving NULL stock and price-approval separation.
10. **Order:** included with Q02 independent-field consistency.
11. **Task:** Q02 application correction.
12. **Approval:** authorized application scope; no database correction approval inferred.

### G04 Units remain a separate operational prerequisite

1. **ID/classification:** G04, confirmed source risk corresponding to D04; deployed affected records unknown.
2. **Affected structure:** `materials.unit_code/source_unit`, source/approved price units and BOM/request unit snapshots.
3. **Evidence:** maintenance/import mapping can fall back to pcs for unsupported units; Sales stock and costing use different unit projections. Q02 deliberately does not alter mapping/selection rules.
4. **Problem:** verified quantity provenance does not prove dimensional compatibility or approve a conversion.
5. **Proposed target:** an approved operational unit/alias mapping with authentic conversion evidence where needed; preserve source labels and issued snapshots.
6. **Operations:** source mapping first; additive mapping metadata or explicit conversion DML only if the approved design requires it. No unit/price/quantity rewrite now.
7. **Affected workflows:** inventory maintenance, Sales BOM availability/costing and stock snapshots.
8. **Existing records:** exact mappings/counts/issued dependencies pending evidence.
9. **Risks/dependencies:** kg/metre/roll conversions, approved costing units, frozen histories and owner decisions.
10. **Order:** separate D04 package before claiming broader dimensional correctness.
11. **Task:** separate from D02/S13.
12. **Approval:** **NOT APPROVED / NOT IMPLEMENTED** for any structural/data conversion.

### G05 Finished-good provenance and deployed constraints remain evidence gaps

1. **ID/classification:** G05, requires additional database evidence; existing R04/D01 concerns remain separate.
2. **Affected structure:** source `finished_goods` zero-default balances/buffer, material provenance CHECKs and source FK relationships from requests/materials/units/users.
3. **Evidence:** original finished-good source lacks material-style quantity provenance. Current material consumers assume the later nullable/status shape, but live definitions were not queried.
4. **Problem:** source declarations do not prove physical counts, actual enforcement or whether a zero was defaulted. Q02 must not invent a finished-good status or execute a provenance migration to make assumptions true.
5. **Proposed target:** reconcile actual definitions/records; if unknown finished-good counts exist, separately approve nullable/provenance representation and all consumers. Retain intended material/request/unit/user FK integrity unless a demonstrated defect justifies change.
6. **Operations:** none now. Any added/modified finished-good columns/checks or restored demonstrably missing FKs need exact before/after review; no blanket zero conversion or record deletion.
7. **Affected workflows:** finished-good availability/inventory and shared request ownership/reference integrity.
8. **Existing records:** population and true historical count evidence unknown; do not assume previous counts current.
9. **Risks/dependencies:** legitimate zeros, private business evidence, deployed metadata and a compliant migration path.
10. **Order:** operator metadata first, separate approved plan if warranted.
11. **Task:** separate R04/schema reconciliation work. D01 remains a global concern before inventory DDL.
12. **Approval:** **NOT APPROVED / NOT IMPLEMENTED.** Migration 007/008 and history remain untouched.

No confirmed redundant/unnecessary inventory table or column was established. Quantity/threshold provenance, current balances, request-time snapshots, explicit Warehouse responses and audit/movement records have distinct responsibilities. Do not remove or merge them based on frontend usage or apparent shape overlap.

## H Approval items

The following are **NOT APPROVED / NOT IMPLEMENTED** database changes:

- G01 snapshot provenance column/check/backfill/API-version design. No historical backfill is currently justified.
- G02 unknown-first-observation movement representation or a dedicated observation relation, plus any history reconciliation.
- G04 unit/conversion mapping metadata or conversion of existing values/snapshots.
- G05 finished-good provenance, zero reclassification, or any FK/constraint restoration based on future deployed evidence.

No change to Migration 007 or 008, historical checksum/history, migration replay, importer execution, catalog reimport, BOM population, costing approval, cleanup or infrastructure is requested by this report. Those are not implied by Q02's application authorization.

## I Regression coverage

**All coverage below is authored and unexecuted by Codex. No pass/fail counts are claimed.**

| Area | Scenarios |
| --- | --- |
| Sales availability | Unknown NULL and inconsistent numeric unknown; sample positive/zero; verified NULL/zero/positive; invalid value/status; missing status; existing unmapped/invalid BOM and finished-good behavior; additive provenance SQL; no writes. |
| New Stock Requests | Verified insufficient/zero/sufficient counts; NULL unknown; sample positive/zero; invalid/missing provenance; verified NULL; NULL-versus-zero parameters; existing numeric validation/quotation reference/actor rules; no inventory update. |
| Maintenance | Changed and same-value sample quantity; same-value sample threshold; both independent; same sample zero; clearing fields; unchanged verified quantity/threshold; unchanged NULL/unknown; detail-only edit; authorization and rejected direct provenance forging. |
| Atomic audit | A staged connection double models value/status changes, old/new audit and commit/rollback. Synthetic audit failure asserts rollback, no commit, unchanged persisted fixture and no audit. This does not certify a live server. |
| Creation | Supplied threshold response/audit agrees with existing verified insert intent while quantity stays unknown. |
| Frontend pure logic | Sample raw values remain numeric/editable; operational helper excludes unverified quantity/threshold independently; explicit input flags omit untouched fields; same-value/zero/blank payloads; sample/unknown/invalid legacy availability normalized unavailable; recorded zero; unmapped priority; no mutation of original response. |
| Source wiring/presentation | Form observation flags are set by field changes, operational warning helpers read independent statuses, request history avoids unversioned current-status fallback, quotation/detail preserve Sample and known-zero distinctions. |
| Import protection | Reads importer source text only to preserve NULL approved costing and provisional sample flags; never imports/invokes the module or rewrites samples. |

Existing accepted Q01 JO regressions already cover no inventory/production writes on issuance. That code was not changed or rerun. Q02 stock checks/snapshots have their own no-write assertions. No duplicate JO test layer, live fixture, browser harness or schema test was added.

## J Database Change Report

**Tables reviewed via source/documentation:** `materials`, `material_categories`, `units`, `stock_requests`, `stock_request_lines`, `stock_responses`, `stock_response_lines`, `audit_events`, `material_movements`, `material_changes`, and the BOM/order/finished-good relationships required by existing availability. No current schema/records were read.

**Schema or record changes performed:** NO. **Database connections/SQL execution:** NONE. **Migrations created/applied/edited:** NONE. **Importer execution or material reimport:** NONE. **Existing quantities, sample statuses, identifiers, approved prices and BOM records changed:** NONE. **Infrastructure/credentials/grants/certificates/Docker/cloud changes:** NONE.

Application source now prepares the authorized future manual value/status/audit updates and safe future request snapshots described above; those paths were not executed against a database. No historical repair or automatic sample promotion was performed.

Migration 007 and its history/checksum remained unaccessed. Migration 008 was not opened, edited or executed; its recorded source shape was read from the existing permitted dictionary. Protected Task 003 artifacts and preserved Task 002 runtime/container/database were not accessed. No tests/build/lint/browser/runtime/database verification, commit, push, deployment, Git reset/restore/clean/stash/branch switch or destructive operation occurred. Existing Q01 work and other uncommitted artifacts were preserved.

## K VS Code terminal commands

Run from the repository root after reviewing the patch. These commands are recommendations for the operator, **not executed by Codex**. Keep the existing fail-closed database import hook; do not substitute a live database or remove it if environment setup fails.

```powershell
node --import ./backend/test/support/mock-database.js --test backend/src/services/inventory.service.test.js backend/src/services/stock-requests.service.test.js
```

```powershell
node --import ./backend/test/support/mock-database.js --test --test-name-pattern='Q02|Sales stock availability' backend/src/services/sales-orders.service.test.js
```

```powershell
node --test src/app/store/inventoryModel.test.mjs
```

```powershell
node --test --test-name-pattern='Q02|Real Inventory|Real Stock Request' src/app/components/realInventoryProduction.test.mjs src/app/components/sales/realQuotationPreparation.test.mjs
```

Name-filtered commands intentionally skip unrelated existing tests, including Q01; report matching executed cases and expected filtered skips separately. No broader suite, production build, browser, migration test or importer command is requested for this first focused check. Retain errors and stop on failure; do not infer successful persistence from mock results. Build/browser/isolated database acceptance can be selected separately if operator review identifies a need.

## L Remaining limitations

The corrections are source-level implementation, not an observed live Warehouse-to-Sales workflow. Actual deployed columns/constraints, genuine authorized observation persistence/read-back, concurrent edits, SQL behavior and visual/interactive acceptance remain pending. Source wiring checks and synthetic staged doubles cannot establish them.

Legacy snapshot provenance is unrecoverable from its two numeric fields alone. Those values remain historical, and new unavailable snapshots safely use NULL. Separate approval is needed to persist the reason for unavailability. Current sample labels and normalized unavailable states are not proof of physical count or an approved BOM/price.

D01 migration safety, D03 shared-demand aggregation, D04 units, D05 complete structured history and R04 finished-good provenance remain separate decisions. Existing sample values and independent unobserved thresholds remain provisional. Stop for review and operator verification; no next correction or database change has begun.
