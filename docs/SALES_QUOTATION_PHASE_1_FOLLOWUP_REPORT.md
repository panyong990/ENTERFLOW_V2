# Sales quotation follow-up - 18 November 2026

Role: Sales. Module: inquiry review, quotation drafts/sending/revisions and affected Sales regressions.

Status: code and mocked-browser verification completed for the corrections below. MAIN visual acceptance and authenticated live MySQL persistence remain unverified. Phase 1 is not complete. Warehouse Inventory/Stock Requests and their integration with costing were not begun.

## References actually inspected

The authoritative handoff was found outside the checkout at:

`C:\Users\Stephanie\Downloads\MSCPROJ - EnterFlow (Mas new pa sa New Link) (4).pdf`

Confirmed 28 pages; extracted/read its requirements and rendered quotation requirement pages 6, 12 and 22. Page 12 was visually inspected. Pages 6, 12, 15 and 22 require draft/save/send/revision behavior, backend costing, exactly 20%/50% downpayment, explicit unsupported-control handling, and honest separation of synthetic tests from live persistence.

Missing paths checked:

- `C:\Users\Stephanie\Desktop\Main\ENTER-FLOW\.vite\integrated-main-browser\`
- Consequently, `C:\Users\Stephanie\Desktop\Main\ENTER-FLOW\.vite\integrated-main-browser\sales-actual-quotation-document.png`
- Historical handoff path: `C:\Users\amiaz\Downloads\ENTERFLOW_DEV_INTEGRATION\.vite\integrated-main-browser\`

The MAIN capture directory was not found by a directory search under `C:\Users\Stephanie\Desktop\Main`; the preceding terminal search also covered Downloads, Documents, Desktop and supplied attachments. `tests/sales-conversion/RESTORATION-EVIDENCE.md` exists but its historical comparisons are not new visual acceptance. No MAIN-versus-current comparison is invented.

Existing current screenshots are under `.vite/restored-quotation-{inquiry,cost,terms}.png`. The current terms screenshot was inspected; final captures disable animations to avoid recording intermediate tab-transition colors. These show a synthetic current interface, not an authenticated live session or MAIN reference.

PDF reading/rendering tooling was installed only under ignored `.vite/pdf-tools`; application dependency manifests were not changed.

## Exact nine previous browser failures and root causes

The preserved failure snapshots under `.vite/sales-conversion-results/` and the exact existing test scenarios were inspected before runtime changes. Six failures were stale test contracts; two exposed one missing Sales navigation entry; one exposed a runtime label typo. No failing scenario was skipped or deleted.

| Previous failed scenario | Root cause and resolution |
| --- | --- |
| Inquiry rejection saves revision and refreshes active list | Test looked for `Record status` in the active pipeline. Current archive filtering lives in `All Order Records & Stages` under `Order status`. The test now follows that actual route and checks the rejected record remains available. |
| Rejection submission stays locked | Runtime rendered `Rejecting?` while the assertion expected `Rejecting…`. Corrected the label; retained lock/disabled/no-duplicate assertions. |
| Authenticated Sales pipeline/navigation and exact amounts | `notifications` was already permitted by `allowedFor` and handled by RealSalesWorkspace, but absent from Sidebar navigation. Exposed the existing destination for Real Mode Sales only, still filtered through existing allowed routes. No RBAC definitions changed. |
| Original unsaved quotation/BOM/packaging workflow | Test expected button roles and the superseded unsaved estimator contract, including arbitrary material/packaging edits. Actual preparation uses tabs and the authenticated quotation contract. Reconciled this case with handoff pages 6/12: retains costing, checks disabled material editing, explicit unsupported packaging/freight notices, no fabricated prices and no unexpected submission. |
| PO/JO/invoice/Stock Request dialogs | The case successfully reached the existing authenticated Stock Request modal, then looked for old `NEW STOCK REQUEST` / `CREATE / OPEN REQUEST` controls. Its fixture also omitted `GET /api/stock-requests`. Kept the PO/JO/invoice assertions, supplied the documented synthetic read response, and asserted the current modal rejects incomplete inputs without any write. No Warehouse or Stock Request implementation changed. |
| Mobile draft controls | Test expected `3 · Quotation` as a button; actual accessible role is tab. Corrected role; retained mobile navigation and pipeline checks. This does not establish full mobile/MAIN visual acceptance. |
| Unsaved notification reply | Same missing navigation entry as above. Existing reply-input retention and no-write assertions now execute and pass. |
| Search/status/full-record navigation | Exact accessible-name assertion used `All order records & stages`, while the current label is `All Order Records & Stages`. Corrected case; retained search/filter/register navigation assertions. |
| Empty/error/detail states | Expected old `No items` copy instead of `No inquiries`. Detail errors can appear for several cards; selected the first matching error while retaining the disabled inquiry action assertion. Tests still distinguish successful empty results from failures. |

## Confirmed quotation defects corrected

1. **Malformed quotation INSERT:** the statement had 18 bound placeholders plus `UTC_TIMESTAMP(3)` for 18 columns, but only 17 supplied values. Removed the extra placeholder. Strengthened the service database double to validate parameter counts for every statement. The previous permissive double accepted this invalid statement; earlier passing tests did not establish MySQL persistence.
2. **Repeated draft saves:** removed the blanket `QUOTATION_DRAFT_EXISTS` rejection and frontend block. Each save appends the next immutable revision instead of overwriting a previous document. Draft saving leaves stage transitions and pending revision requests unchanged; sending retains the existing workflow transitions. This implements the requested draft-saving repair within the existing revision schema.
3. **Sent revision supersession:** the previous UPDATE ran after INSERT and could supersede the newly sent quotation itself. It also skipped older sent rows when the newest existing row was a draft. Sending now supersedes earlier sent rows for the same order while explicitly excluding the newly inserted ID. Earlier drafts remain historical drafts.
4. **Stale/replayed frontend submissions:** the frontend supplies `baseQuotationId` (null for an inquiry with no quote). The backend validates it and compares it with the latest quotation while holding the existing order/quotation transaction locks. A mismatch returns a safe `409 QUOTATION_STALE` before writes. The field is optional for compatibility with existing API callers; current UI requests always supply it. Errors preserve modal inputs and do not automatically retry writes.
5. **Legacy superseded latest record:** editable-input restoration can seed a fresh revision from the latest superseded row without changing that historical record. This avoids a false no-history base if all returned rows are superseded.
6. **Revision-request filter:** the frontend recognized only `revision`; persisted requests use `quotation_revision`. The filter now recognizes the backend value and the legacy value. A browser regression uses the actual backend request kind.
7. **Real Mode line-item labels:** new quotation lines now display the inquiry's saved filter name when available, matching the backend-generated description, instead of exposing only internal filter-type codes. They remain read-only.
8. **Canonical validity dates:** an already canonical `YYYY-MM-DD` value is passed unchanged, avoiding a local-time conversion of an ISO date-only string.

Preserved: original React/TypeScript/Vite component hierarchy and SalesPipeline adapters; existing Node/Express/MySQL architecture; authentication/session handling; Sales permissions and client ownership; server-authoritative BOM/material pricing, labor/markup/VAT/discount calculations; exactly 20%/50% downpayment; latest-revision client decision rules; unsupported-add-on protection; per-product draft retention and dirty-cost validation; Engineer Sketch integration and authenticated links. No Warehouse implementation, automatic stock reservation/deduction, procurement, local-storage fallback or cloud integration was added.

## Files changed in this follow-up

- `backend/src/services/sales-orders.service.js`
- `backend/src/validation/sales.validation.js`
- `backend/src/controllers/sales-orders.controller.js`
- `backend/src/services/sales-orders.service.test.js`
- `backend/src/routes/sales.http.integration.test.js`
- `src/app/components/sales/RealQuotationPreparation.tsx`
- `src/app/components/sales/quotationDraft.js` and `quotationDraft.test.mjs`
- `src/app/components/sales/SalesPipeline.tsx`
- `src/app/components/QuotationBuilder.tsx`
- `src/app/components/Sidebar.tsx` (existing Real Sales notification route only)
- `tests/sales-conversion/sales.spec.mjs` and `inquiry-rejection.spec.mjs`
- This report and the historical report's follow-up pointer.

`dist/index.html` and ignored production assets were regenerated by builds. All other existing changes, including Engineer Sketch files, remain preserved. No commit, push, branch switch, merge, reset, restore, clean, stash or history rewrite was performed.

## Verification

Focused Node command:

```powershell
node --test src/app/components/sales/quotationDraft.test.mjs src/app/components/sales/realQuotationPreparation.test.mjs src/app/components/sales/salesInquiryReview.test.mjs src/app/api/salesOrders.test.mjs src/app/api/salesOrderDocuments.test.mjs backend/src/services/sales-orders.service.test.js backend/src/routes/sales.http.integration.test.js backend/src/services/client-portal.service.test.js backend/src/routes/client.http.integration.test.js
```

**97 passed; 0 failed/skipped.** Covers helper/adapters, source assertions, calculation cases, SQL binding counts, repeated draft/save/send sequences, supersession before/after a draft, rollback after child-write failure, stale bases, malformed bases and caller-supplied identity/total rejection, existing client ownership/latest-decision rules, role/permission checks, untrusted origins and safe HTTP 409 responses. Database/service doubles and local HTTP servers only; imports load existing environment configuration but request no live pool connections.

The three new draft/sent service regressions were first run against the old implementation and failed, then passed after correction. An earlier affected full browser run passed 34/34; the two new lifecycle cases separately passed 2/2. Final focused quotation run passed **12/12** using:

```powershell
npx playwright test --config=playwright.sales-conversion.config.mjs --output=.vite/sales-quotation-final-results --grep 'restored quotation|quotation retains|quotation reloads|quotation history failure|quotation safeguards|quotation draft can|quotation stale revision'
```

Final full browser command (includes all nine previously failing scenarios and the new revision-filter case):

```powershell
npx playwright test --config=playwright.sales-conversion.config.mjs --output=.vite/sales-quotation-acceptance-results
```

Final full Sales result: **37 passed; 0 failed/skipped**, including all nine previously failing scenarios, the Engineer Sketch Sales retrieval case, repeated save/reopen/send, stale-revision retention, the backend request-kind filter, empty/error states, notification routing/reply retention and the seven other role workspace regressions.

`npm run build`: **passed**, with the existing large-chunk warning (2,710 modules). No deployment occurred.

`git -c safe.directory=C:/Users/Stephanie/Desktop/Main/ENTER-FLOW diff --check`: **passed**.

`npm run check:production-demo-assets`: **failed** on the same **67 prohibited catalog literals**, with four allowed compatibility literals and three documented out-of-scope location strings. No catalog record or scanner rule was deleted, weakened or changed. This remains a Phase 1 closure limitation requiring reconciliation/disposition, not a new passing production-readiness claim.

Browser tests intercept every API; no backend is started. Synthetic successful save/send/reload responses establish frontend behavior only. The service double models revision status and rollback but does not establish real MySQL constraints, transactions, locking or persistence. No real authenticated browser login/session or live MySQL persistence was tested.

## Architecture and remaining acceptance limits

Firebase Hosting, Cloud Run, Cloud SQL MySQL and future private GCS remain the target architecture. Same-origin API/session communication and the existing storage abstraction remain unchanged. No cloud resources, credentials, deployment or migration were touched; GCS remains deferred and fail-closed. Existing cloud-readiness notes in the prior report remain preparation findings, not deployment validation.

Remaining: integrated MAIN captures/authorized visual comparison; scoped authorized MySQL persistence and real Sales/Client browser testing; complete client-facing document visual acceptance; broader Phase 1 reconciliation including the known asset-scanner finding. Existing client acceptance/rejection behavior is tested with doubles, not a live cross-role workflow. These limits prevent declaring Sales fully accepted or Phase 1 complete.

Next requested implementation priority, after Sales acceptance: Warehouse Inventory and Stock Requests, then integration with Sales costing. This run changed none of those implementations. The existing Sales modal's read/validation regression was reconciled only to investigate the previously failed test.

## Mandatory detailed Database Change Report

**No database changes were performed.** Runtime source corrections are prepared, but were not executed against any live or disposable MySQL database.

1. **Tables reviewed/affected:** source/test review of `orders`, `order_items`, `product_specifications`, `quotations`, `quotation_lines`, `quotation_costing`, `quotation_bom_lines`, `quotation_discounts`, `quotation_references`, `quotation_addons`, `bom_templates`, `bom_template_lines`, `materials`, `order_requests`; existing client decision/PO sources also reference `audit_events` and `purchase_orders`. The corrected application path uses the existing quotation tables and existing order/request transitions. No live table was queried or affected in this run.
2. **Schema modifications proposed:** none. Existing revision/status columns, reference ownership, foreign keys and constraints are retained.
3. **Schema modifications performed:** none.
4. **Data modifications proposed/prepared:** corrected application code appends complete quotation revisions and costing/BOM/discount snapshots; sending supersedes earlier sent quotations, completes existing pending revision requests and advances the order through its existing transition. No standalone data-repair/export/import script or live write is proposed for execution in this run. Future persistence testing requires a scoped approved database and data plan.
5. **Data modifications performed:** none in MySQL. Only in-memory test-double rows and intercepted synthetic browser responses changed during tests. No inventory quantity was reserved, deducted or updated.
6. **Migrations created/applied:** none. No migration runner was invoked.
7. **Changes requiring explicit approval:** any live/disposable database test writes, data repair, schema/migration modification, RBAC/business-rule change, or cloud provisioning/deployment. None of these operations was executed. The user-requested application defect corrections were implemented without connecting to MySQL.
8. **Migration 007 protection:** contents, checksum and migration history were not inspected, modified, executed, reapplied, recreated or overwritten. No protected material was accessed.
