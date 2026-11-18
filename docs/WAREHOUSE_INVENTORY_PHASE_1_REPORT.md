# Phase 1 Warehouse Inventory and Sales costing - 18 November 2026

Status: verified MAIN catalog reconciled; targeted UI/API corrections tested. Catalog and BOM population are prepared but blocked pending approvals/data. No database changes were performed. Warehouse/Sales and Phase 1 are not fully accepted.

## A. Authoritative reference and Warehouse comparison

Read the authoritative 28-page handoff at `C:\Users\Stephanie\Downloads\MSCPROJ - EnterFlow (Mas new pa sa New Link) (4).pdf`, including Warehouse/manual-stock rules, backend costing, unknown/unmapped states, cloud deferrals and acceptance limits. The earlier reports and restoration evidence were inspected before editing.

The integrated MAIN commit recorded in `tests/sales-conversion/RESTORATION-EVIDENCE.md` is available locally: **e59364c1c9bd0257c82319df29e84081740ff694**. Its actual `src/app/App.tsx`, Warehouse `Inventory.tsx`, `materials.tsx` and frontend dependencies were read using Git object reads. An isolated localhost preview loaded those frontend modules into memory and used MAIN's existing Warehouse preview control. No branch switch, source-tree restore or live backend was involved. The reference preview was stopped afterward.

The previously missing `.vite/integrated-main-browser/` folder now contains newly captured Warehouse evidence only; it is not a recovery of all historical nine-role captures:

- `warehouse-main-viewport.png`, `warehouse-main.png`: actual recorded MAIN component, fresh preview state.
- `warehouse-dev-viewport.png`, `warehouse-dev-reference-catalog.png`: current Real Mode component with intercepted authenticated-API responses.
- `reference.json`: source commit, method and scope.

The MAIN and current viewport captures were visually inspected. Matching existing structures include the navy Warehouse sidebar, Inventory header, raw/finished tabs, grouped material category cards, columns, search, pricing/units/threshold presentation and collapse controls. Removed Warehouse's extra blank summary cards because they are absent from its MAIN reference. Restored the visible Add Raw Material control as disabled pending authorized catalog registration. Retained existing search/filter and item-detail interactions.

Intentional/current differences: authenticated-user strip; explicit catalog/data provenance and error/loading notices; Incoming Stock Requests uses the existing authenticated modal; catalog quantities say Not recorded instead of copying MAIN's default stock numbers; standalone material editing/registration remains unavailable because the existing inventory API is read-only. The existing Stock Request workflow supports manual count recording. Full role-wide visual acceptance, all responsive states, live authenticated sessions and standalone inventory-edit restoration are not claimed. MAIN's fresh-preview/local-storage defaults do not prove physical stock counts or user-specific browser edits.

## B. Complete business catalog reconciliation

Artifacts under `docs/inventory-reconciliation/`:

- `integrated-main-catalog.json`: full catalog extracted from the verified MAIN backing source, with exact codes, names, categories, units, unit prices, thresholds and supplied reference fields. Stock defaults are deliberately excluded.
- `catalog-reconciliation.csv`: all 71 rows with MAIN/repository/MySQL presence and quantity-verification flags.
- `database-readonly-snapshot.json`: timestamped live read evidence and current quantity-column metadata.
- `quantity-evidence.template.json`: blank evidence fields for every code; null means unknown, never zero.

| Check | Result |
| --- | --- |
| MAIN backing catalog / repository catalog | 71 / 71 |
| Compared code/name/category/unit/price/threshold conflicts | 0 |
| Duplicate MAIN codes / names | 0 / 0 |
| MySQL material records | 0; all 71 missing |
| Categories | Filter Media 30; End Cap/Frame 10; Inner Core 5; Outer Core 4; Bonding/Adhesive 6; O-Ring 2; Gasket 3; Packaging 11 |

No business catalog values were invented, converted, removed or overwritten. The data are real reference values despite the source variable's `seedMaterials` name. All eight required unit and category lookup codes already exist in MySQL.

Live read-only recheck: MySQL **8.4.13**, configured local `enterflow_db` on loopback port 3308; materials **0**, BOM templates **0**, BOM lines **0**, inquiries/items **1/1**, quotations **0**, Stock Requests **0**, unit/category lookups **8/8**. No customer identity or credentials are included in the reconciliation artifacts.

## C. Proposed MySQL integration - NOT EXECUTED

`config/material-catalog-ids.json` is an explicit catalog-code to numeric database-ID registry. It currently contains **no mappings** because no materials exist. BIGINT IDs remain decimal strings. No catalog code is coerced into a primary key and no name-only frontend match is attempted. Runtime mapping verifies the mapped row's reference values and fails visibly on conflicts; unmapped catalog references remain separate from persisted records.

`database/material-catalog-import.mjs` provides:

- A pure deterministic plan builder and a prepared, separately approval-gated transaction executor.
- A CLI supporting **only `--plan`**, with no MySQL connection or execution mode.
- Lookup/code/name/decimal validation, duplicate/conflict rejection, exact-match reuse without overwriting quantities, parameterized inserts, transaction rollback on pre-commit failure, returned code-to-ID mapping, and a digest binding execution to reviewed operations.
- No migration runner, schema modification, deletion, update of existing catalog values, BOM generation or automatic import.

Executed safely: `node database/material-catalog-import.mjs --plan`. It reports **ready=false, 71 blocked records** because verified stock evidence is missing. The executor was exercised only with an in-memory failing connection in tests.

The exact proposed insert shape for an approved new material is:

```sql
INSERT INTO materials
  (name, category_code, unit_code, unit_price, quantity_on_hand, reorder_threshold, supplier_name)
VALUES (?, ?, ?, ?, ?, ?, ?);
```

The code/name/unit/price/threshold parameters come from the reconciled manifest. Quantity must come from reviewed physical-count evidence; absent supplier information remains null. No executable 71-row write plan is approved or ready while quantities remain unknown.

Future execution procedure: approve the target, selected rows, field values, quantity evidence and plan digest; prevent concurrent catalog maintenance during execution; re-read/lock existing material rows; revalidate target unit/category lookups; reject ambiguous names or any conflict; insert only missing approved rows; capture numeric IDs as strings; validate counts/values/relationships; commit; separately review and publish the returned mapping registry. Re-running reconciliation reuses identical rows rather than inserting duplicates; any changed plan requires fresh approval. Existing schema has no unique catalog-code column, so the external registry and controlled maintenance window are limitations, not a database uniqueness guarantee. No connection credentials are embedded.

If a COMMIT acknowledgement is lost, stop and reconcile using fresh reads; do not assume a subsequent rollback undid a commit or blindly retry. Post-commit data removal/repair needs a separately approved rollback plan. Test-double rollback does not certify live MySQL locking or commit behavior.

### Unknown-stock decision requiring approval

Current `materials.quantity_on_hand` is `DECIMAL(15,4) NOT NULL DEFAULT 0.0000`. It cannot faithfully store unknown stock. Omitting the quantity would invent a recorded zero.

Two safe paths:

1. Keep schema unchanged and import only an explicitly approved subset with verified physical quantities, including explicit verified zero. Keep all other materials as catalog references without database mappings.
2. Separately review/approve the smallest structural option: allow `materials.quantity_on_hand` to be nullable with a null default, retain non-negative checks/foreign keys, and audit every consumer before execution. Illustrative proposal only:

```sql
ALTER TABLE materials MODIFY quantity_on_hand DECIMAL(15,4) NULL DEFAULT NULL;
```

This statement was **not executed**, and no migration was created. Do not relabel historical verified zeros as unknown. Unknown-stock imports would still require an updated, separately reviewed plan; the prepared current-schema importer intentionally requires count evidence.

## D. Sales costing and BOMs

Safe corrections:

- Removed Real Mode's heuristic/static BOM autofill from Cost Estimation. Its disabled material column now explains that an approved server BOM is required, rather than displaying assumed consumption quantities.
- Unknown/invalid stock no longer falls through to ON STOCK. Raw and finished-good quantities retain unknown/zero/positive distinctions; item details no longer print NaN.
- Authenticated inventory payloads are validated. Malformed responses and API failures show an error/retry state instead of silently leaving data that appear authenticated. Catalog references keep known business metadata, with unknown stock.
- Existing Sales quotation history now reads `quotation_bom_lines` through order-scoped costing joins. Reopened quotations can show exact historical material name/unit/price/quantity/waste snapshots with a clear revision/historical label. No client-side material prices become authoritative current quotation totals.
- Sales Stock Requests select only database-backed materials, using numeric IDs as strings. Unregistered catalog references cannot be submitted as material IDs.

Preserved existing labor/markup/discount/VAT calculations, append-only draft/revision corrections, sending, client acceptance/rejection constraints and mandatory 20%/50% downpayment. Availability checks and quotation/JO creation still do not reserve or deduct inventory. No BOM override/edit contract was introduced.

No approved BOM exists in MySQL, including for the AIRFIL inquiry. Before population, Enter-Fil must provide/approve: product type and size/dimension applicability; exact material codes; quantity per product in each pricing unit; waste percentage and treatment; any measured unit conversions; template selection/version ownership. Existing code selects height bands (Small below 200 mm, Medium 200-399 mm, Large from 400 mm), but code alone is not approval to manufacture/populate templates from those bands.

The reference pocket-bag helper calculates media in metres while selected catalog media are priced in kg. Do not invent a conversion or divide prices using a roll-length/weight guess. Real Mode no longer uses that helper as a BOM. Also reconcile whether stock checks should include waste: current pricing includes waste, while availability checks use base per-filter consumption. Neither manufacturing rule was changed or populated during this task.

## E. Stock Requests and manual quantities

Preserved the authenticated array response contract and error-versus-empty handling. Corrections to the existing workflow:

- Warehouse observation fields start blank instead of copying requested quantities.
- Blank/null/invalid values are rejected; explicit recorded zero is accepted.
- Manual inventory updates require confirmation, preserve inputs after failure and use a submission lock.
- Backend processing requires every request line exactly once, validates shortages against required/observed quantities, restricts updates to the requested materials, and requires inventory values to match observations. Malformed boolean/blank quantities are rejected.
- A review response does not update inventory. A confirmed manual update sets the supplied observed quantities only; it does not add requested quantities, purchase materials or reserve/deduct stock.
- Existing audit events now retain the explicit manual inventory values. No live audit records were written.
- Sales and Warehouse collection reads include the latest response, preserving original request snapshots. Sales displays the latest recorded quantity/shortage separately from shortage at request. Inventory refreshes after a confirmed update.

Existing backend Sales-create / Sales-and-Warehouse-read / Warehouse-process permissions and origin protections remain intact. No RBAC definition changed. General catalog editing and standalone manual stock editing outside Stock Requests remain read-only because no matching authenticated endpoint currently exists; that interface contract is remaining work, not simulated success.

## F. Cloud and scanner disposition

React/TypeScript/Vite, existing Express routes/services, Docker MySQL and relational constraints remain. Firebase Hosting same-origin API routing, Cloud Run environment configuration/PORT/binding/session/pool behavior, and private deferred GCS architecture are preserved. No deployment, migration, cloud credentials or GCS resources were configured; `STORAGE_NOT_CONFIGURED` and Engineer Sketch integration remain unchanged.

The import planner is connection-injected and uses MySQL-compatible transactions/parameterized SQL; a Cloud SQL target must be independently reconciled and its own mapping approved. Plan pool/scaling limits, secrets, backups, integrity checks and rollback separately before cloud migration. No local database host is hardcoded into the import executor.

`check:production-demo-assets` still reports **67 catalog identifiers**. They are the 71 verified MAIN material identifiers minus the scanner's four explicit compatibility entries. They are authentic business records, not evidence of fake data. The scanner was not disabled or broadly exempted, and no catalog data was deleted.

A policy decision is still needed: frontend static assets can expose embedded catalog pricing before authentication. Recommended direction is to preserve the reconciled manifest as controlled import/reference data and eventually serve operational catalog/prices through the existing authenticated inventory API after approved population. Do not simply whitelist every business value in public bundles without deciding that visibility policy. The scanner remains a Phase 1 closure limitation.

## G. Verification

Focused Node command:

```powershell
node --test src/app/store/inventoryModel.test.mjs database/material-catalog-import.test.mjs src/app/components/realInventoryProduction.test.mjs src/app/api/stockRequests.test.mjs backend/src/services/inventory.service.test.js backend/src/services/stock-requests.service.test.js backend/src/controllers/stock-requests.controller.test.js backend/src/routes/stock-requests.routes.test.js backend/src/routes/inventory.http.integration.test.js backend/src/services/sales-orders.service.test.js backend/src/routes/sales.http.integration.test.js src/app/components/sales/quotationDraft.test.mjs src/app/components/sales/realQuotationPreparation.test.mjs
```

**78 passed; 0 failed/skipped.** Includes catalog reconciliation, unknown/zero/available stock, invalid API records/IDs/mappings, approval and import rollback with doubles, inventory/Stock Request HTTP authorization and origins, no-write reads, manual update validation, audit values, shared latest responses, saved material snapshots, costing/downpayment and existing quotation regressions.

Browser commands:

```powershell
npx playwright test --config=playwright.warehouse.config.mjs
npx playwright test --config=playwright.sales-conversion.config.mjs --output=.vite/warehouse-sales-regression-results
npx playwright test --config=playwright.sales-conversion.config.mjs --output=.vite/warehouse-cross-role-results --grep 'Sales and Warehouse share'
```

Final results: **Warehouse 7/7 passed; Sales regression 38/38 passed; new shared Sales-Warehouse-Sales case 1/1 passed.** The Sales full run preceded the additional shared-state case and final recorded-material selector; that affected new path was then tested in the focused case. All browser APIs are intercepted. The shared case uses two synthetic role pages and shared mock responses, not live cross-role persistence. It covers database IDs, explicit zero confirmation and latest-response retrieval.

An initial new Warehouse test failed because it queried a clickable row as `role=row` while the existing component explicitly uses `role=button`. The locator was corrected without changing application semantics; the complete final Warehouse run passes. No failed case was skipped or deleted.

`npm run build`: passed (2,712 modules), with the existing large-chunk warning. `git diff --check`: passed. Scanner: failed as described above. No catalog/scanner suppression or data removal was used to obtain passing tests.

Live database evidence consists of SELECT queries inside `START TRANSACTION READ ONLY`, followed by ROLLBACK. Actual imports, stock writes, authenticated live browser sessions, live transaction/locking verification, real quotation persistence and full end-to-end acceptance were not performed. No backend runtime was started for browser tests. No commits, pushes, branch changes or destructive Git operations occurred.

## H. Mandatory Database Change Report

**No database changes were performed.**

1. **Tables reviewed/affected:** live counts/metadata for `materials`, `units`, `material_categories`, `bom_templates`, `bom_template_lines`, `orders`, `order_items`, `quotations`, `stock_requests`, and the quantity column's `information_schema.columns` entry. Source/test review additionally covers `product_specifications`, `finished_goods`, `quotation_costing`, `quotation_bom_lines`, `stock_request_lines`, `stock_responses`, `stock_response_lines`, `audit_events`. No live table was affected.
2. **Proposed schema changes:** optional separately approved nullable `materials.quantity_on_hand` / null-default proposal above; no new table, business-code column or changed primary key is required by the prepared existing-schema mapping plan.
3. **Performed schema changes:** none.
4. **Proposed data changes:** reviewed catalog inserts using exact MAIN values plus verified quantities; code-to-ID registry publication after confirmed/reconciled insertion. BOM population is not prepared as executable data because manufacturing specifications are missing. Current-schema offline plan blocks all 71 unknown quantities. No data operation is authorized for execution.
5. **Performed data changes:** none in MySQL, including imports, stock quantities, requests, audit events, user sessions and migration history. Only source/artifact files and in-memory test doubles/synthetic API responses changed.
6. **Migrations created/applied:** none; no migration runner invoked.
7. **Explicit approval required:** selected import rows/target/physical-count evidence/digest and maintenance window; any nullable-stock schema implementation; any BOM dataset; live persistence test writes; pricing visibility/scanner policy; any cloud provisioning/deployment. No such operation occurred.
8. **Migration 007 protection:** no contents, checksum or migration history was accessed, inspected, modified, executed, reapplied, recreated or overwritten.

Before the next write-capable step, approve an unknown-stock approach (verified-count subset without schema changes, or a separately reviewed nullable-stock change). No catalog/BOM import should be approved blindly while this input remains unresolved. Phase 1 remains incomplete.
