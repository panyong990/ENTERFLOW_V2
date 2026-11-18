# ENTER-FLOW V2 — Phase 1 master progress tracker

Date: November 18, 2026 (Asia/Manila). Branch: integration/dev-phase-merge.

**Phase 1 is not complete. No workflow is declared fully accepted here.**

Latest November 18 update: **dependency remediation review BLOCKED**. Registry latest picomatch 4.0.7 remains within advisory <=4.0.7; primary advisory lists no patched version. Latest Vite 6 is installed 6.4.6; npm's proposed 6.2.7 downgrade is outside root ^6.4.6 and conflicts with pnpm pin. Fresh audit remains exit 1 / **4 high affected entries**, no new advisory observed. Stopped before package/lockfile/install changes under the user's explicit rule. Full suites/build/scanner NOT RUN in this review; earlier passing results remain historical, not post-remediation verification. [Review, exact commands/paths/versions and next decision](docs/stabilization/dependency-review-2026-11-18/REVIEW.md). No force/suppression or security acceptance. Dependency and external-script holds remain open; Phase 1 incomplete.

Previous stabilization execution: focused groups passed (125 security/auth, 214 workflow, 82 frontend); explicit full suites **844 backend / 218 frontend passed**, zero failures/skips/cancellations/todos. Ancillary scanner/proxy/preparation/selected-planner groups **12/2/13/3 passed**. Build passed; fresh bundle-hashed scanner evidence has **0 unexplained findings**. **Security gate NOT PASSED:** npm audit exit 1, four high affected package entries via one picomatch advisory; retained external design-capture script on production-release hold. [Execution report and exact command ledger](docs/stabilization/execution-2026-11-18/EXECUTION_REPORT.md), [security disposition](docs/stabilization/execution-2026-11-18/SECURITY_DISPOSITION.md).

## Dependency remediation review — November 18, 2026

- Status: **Blocked**. Direct devDependency Vite 6.4.6 and transitive fdir 6.5.0 / tinyglobby 0.2.16 / deduplicated picomatch 4.0.4 confirmed from installed tree and lockfile constraints. One root advisory produces four affected entries, not four independent advisories; dev classification is not a safety waiver.
- Current primary advisory and registry versions actually checked. No patched compatible version verified. Updating to available 4.0.7 would not resolve <=4.0.7. Out-of-range downgrade, different major/fork/custom patch/override not applied or claimed safe. No minimal reviewed dependency edit can currently meet the objective.
- Evidence: npm ls/tree and registry metadata exit 0; fresh npm audit --json --ignore-scripts exit 1, four high and zero other severities, no new advisory. No dependency changes and no post-change tests/build/scanner run. Preserve historical execution counts rather than relabeling them as fresh. Diff/preservation evidence retained with the review.
- Files changed: new dependency-review REVIEW.md / review-evidence.json / preservation-check.json; existing execution report/security disposition and this tracker updated. Package.json/package-lock.json, scripts/configuration, tests, baseline and prior evidence preserved. No unrelated feature or investigation.
- Database Change Report: no DB connections/SQL/schema/data/migrations/imports/Docker/browser/cloud/application services; protected Migration 007/checksum/history uninspected and untouched.
- Exact next action: a separately scoped evaluation of an out-of-range compatibility/security alternative, or an actual compatible patched upstream release. Do not silently adopt npm's downgrade or force audit remediation. After a safe candidate and reviewed delta, perform full requested verification and require a genuinely resolved original advisory before acceptance. External capture-script hold and all original Phase 1 requirements remain open.

Previous preparation update: no new feature/metric. User accepted the Operations correction at source/test level only. Reconciled **88 baseline changed files (55 tracked / 33 untracked)**; parsed 65 changed source files and inventoried 102 scoped test files (67 backend / 35 frontend). Original reporting requirements were read from both PDFs and reconciled. [Worktree audit](docs/stabilization/WORKTREE_RECONCILIATION.md), [regression plan](docs/stabilization/REGRESSION_PLAN.md), [reference reconciliation](docs/stabilization/REPORTING_REFERENCE_RECONCILIATION.md). Major suites were not run during preparation; current execution results above now supersede that execution status only.

## Stabilization execution — November 18, 2026

- Controlled order: focused security/auth 125 pass, focused business workflows 214 pass, focused frontend 82 pass; then explicit full backend 67 files / 844 pass and frontend 35 files / 218 pass. Every test group has 0 fail/skip/cancel/todo, exit 0. Focused counts overlap full suites and are not added. No assertion/business-rule failure or test/source modification occurred.
- Ancillary evidence: scanner regressions 12 pass; synthetic auth/proxy 2 pass; inventory preparation 13 pass; three narrowly selected legacy planner cases pass; all exits 0. Inventory freshness 5 files / 71 materials / executionAuthorized=false. Completed MAIN source reconciliation not rerun.
- Build: exit 0, 2714 modules; existing Node deprecation/chunk warnings retained. Fresh docs/stabilization/execution-2026-11-18/production-scan.json contains HTML/input/three-JS SHA-256 fingerprints, 71 catalog and 4 compatibility occurrences, zero unexplained findings. Historical docs/asset-scanner/current-scan.json remains untouched and is not the fresh evidence.
- Dependency/security: npm audit --json --ignore-scripts exit 1, 4 high entries (vite/fdir/tinyglobby/picomatch), 0 other severities. Installed picomatch 4.0.4 is within GHSA-fc5q-39xc-vjpf; all four lockfile entries dev:true. Primary advisory lists no patched version at review. No audit fix/force/downgrade/override/install or exploit test; compatibility/reachability/remediation still requires a scoped review. Dev-only classification does not grant acceptance.
- External capture script: retained unchanged and recorded as **production-release HOLD** pending removal/production exclusion with verification or explicit security approval. No remote script fetch/execution; local JS scanner pass is not HTML/remote-code approval. See SECURITY_DISPOSITION.md. This is an assessment, not a new automatic deployment gate or business-rule change.
- Preservation: prepared manifest/test membership and baseline application/test/package/inventory/historical evidence preserved; permitted documentation changes and build regeneration only. Final comparison/diff evidence is retained with the execution ledger. No existing work discarded.
- Database Change Report: no live DB connections/SQL/migrations/imports/schema/data/Docker/browser/cloud/application-service operations. Pure planner and injected local HTTP doubles only. Protected Migration 007/checksum/history untouched and uninspected. Registration investigation/reproduction not repeated.
- Exact next task: review dependency advisory/remediation options and external-script production disposition before release; no speculative package change or new metric. All nine-role browser/live persistence/cross-role/MAIN/sign-off gates remain open and require separate authorization where applicable. Security failure means stabilization/Phase 1 is not accepted despite functional suite success.

Previous November 18 update: resumed from HEAD `1f4493c38c8903d67bd0f7e3f9707d4afa580246` on the existing branch and fixed the Operations Real Mode bottleneck panel's unsupported issue/empty-result claims. **64 frontend, 13 isolated backend authorization/API and 12 scanner tests passed**, zero failures/skips; build/scanner/diff checks passed. KPI cards already withheld Real Mode values; the earlier displayed-zero assessment was corrected. See [resumption handoff and exact commands](docs/PHASE_1_RESUMPTION_HANDOFF_2026-11-18.md). Reporting remains **In progress**; no role acceptance upgraded.

## Stabilization preparation — November 18, 2026

- Status: **In progress**. No reporting metric or production/test implementation changed. Preserved branch/HEAD and all baseline work; no registration/cancellation investigation repeated. Accepted Operations correction remains source/test accepted only, not full role acceptance.
- Full expanded modified/untracked inventory, byte fingerprints, purpose/evidence groups and individual paths: docs/stabilization/worktree-baseline.json and WORKTREE_RECONCILIATION.md. Existing tests/artifacts require a current aggregate refresh; no file silently removed or redundant test deleted.
- Static duplicate audit: 2 repeated literal titles in distinct permission-unit/HTTP layers, 0 matching callback bodies and 0 identical baseline file contents. 545 source regex assertions are not a coverage percentage; rendered/source/API/live evidence is distinguished. Runtime counts cannot be inferred from 834 static test call sites.
- Verified offline: 65/65 changed source files and 102/102 scoped test files parsed; both PDFs' 45/28 physical page order verified and text decoded without unmapped glyphs; Section 24 check-only freshness passed (5 files / 71 materials / executionAuthorized=false). Diff and preservation checks recorded in stabilization handoff. No current full safe-suite/build/browser/database pass claimed.
- Confirmed review items: saved current-scan.json names a removed pre-rebuild bundle, requiring a fresh separately retained scan; committed index.html includes a remote design-capture script that the local JS scanner cannot validate. Existing source/mocked tests do not establish Accounting/Production/Logistics mutation completeness, live locking/persistence, MAIN comparison or cross-role acceptance.
- Original requirements: Owner/Operations original §§5.2–5.3 pp7–8; accounting/reporting §7.13 p17; reporting data/permissions §11.4 p24; Comprehensive §23 p36 and §26 pp39–40 now reviewed. Preserve all four reporting domains, payment/credit/due/overdue behavior where implemented and all role/security/visual/sign-off obligations. No detailed KPI definitions supplied by these sections.
- Database Change Report: no connections, SQL, migrations/schema/data/import changes, Docker or live workflows. Protected Migration 007/checksum/history untouched and uninspected. Inventory artifacts byte-preserved.
- Exact next task: run plan lanes P1–P4 with audited explicit membership and the fail-closed backend hook, retain actual counts/exits/current-build evidence, investigate genuine failures and disposition the external script. Do not add another metric first. Live browser/database/cloud gates require separate target/operation approval; registration remains blocked on evidence or separate explicit authorization. All original requirement rows and nine-role completion gates remain.

Previous November 18 update: registration investigation is **BLOCKED ON RUNTIME EVIDENCE**. The original backend terminal output/managed logs are unavailable, and no genuine runtime event identifies the failure stage or cause. No reproduction is authorized. Focused isolated verification: **424 backend and 81 frontend passed**, no failures/skips; build/scanner/diff checks passed. No application fix or additional logging was justified. See [ten-section investigation handoff and exact commands](docs/REGISTRATION_503_ROOT_CAUSE_INVESTIGATION_2026-11-18.md). Registration and Client/Admin browser/database acceptance remain blocked.

## Phase 1 resumption: Operations reporting reliability — November 18, 2026

- Starting branch/HEAD/status inspected; all pre-existing tracked and untracked work preserved. No completed registration/cancellation investigation repeated. Selected the next source-confirmed safe gap in requirement 16, not a new reporting workflow.
- Implemented: Real Mode skips local bottleneck derivation and displays an accessible unavailable message instead of catalog-placeholder issue rows, incomplete empty-result assertions or issue-detail actions. Demo issue tabs/details remain. KPICard already hides calculated values in Real Mode; corrected the matrix and requirement row rather than rebuilding that protection.
- Evidence: new regression first reproduced the defect (2 tests: 1 pass/1 fail, exit 1); final related rendered/source/role tests 64 pass, isolated backend authorization/API tests 13 pass, scanner regressions 12 pass, no final failures/skips, all exits 0. Build 2714 modules, scanner 0 unexplained findings, diff check exit 0. Exact commands in the linked resumption handoff. Not live browser/database evidence; prior full-suite results below were not rerun.
- Files changed: Dashboard.tsx, its existing admin/render.test.mjs fixture suite, reporting matrix, this tracker, new resumption report, and regenerated dist/index.html/ignored build assets. Other changes belong to prior work and remain preserved.
- Database Change Report: no database connections/SQL/schema/data/migration/import changes, no fabricated quantities/BOMs, no Docker operations. Protected Migration 007 and checksum/history untouched and uninspected. Inventory approval artifacts preserved.
- Reference status: both named original/comprehensive PDFs were located in the supplied Desktop/MSCPROJ folder, outside checkout. Exact reporting definitions were not independently extracted during this narrow fix. Do not assume prior source formulas are approved definitions or claim the documents are absent from the machine.
- Exact next action: reconcile original §§5.2–5.3/7.13 and Comprehensive §§23/26 with the reporting matrix, including Owner/Operations field visibility, formulas, dates, null handling and refresh. Then implement the highest-priority approved metric using a role-authorized source. No general reporting API or role grants inferred. Registration remains blocked; inventory execution/BOM/cloud and all nine-role browser/persistence/sign-off gates remain open.

Prior November 18 update: production scanner remediation and major safe regressions completed. Scanner: **0 unexplained findings**, 71 structurally verified catalog occurrences and four exact compatibility occurrences. Full backend safe suite: **844 passed**; full frontend suite: **216 passed**. See [scanner evidence and nine-section handoff](docs/asset-scanner/HANDOFF_REPORT.md) and [per-finding evidence](docs/asset-scanner/baseline-findings.csv). These full-suite counts are prior-task evidence, not newly rerun totals. Browser/live database acceptance remains unperformed; Section 24 approval artifacts remain unchanged.

## Registration root-cause investigation update — November 18, 2026

- Follow-up runtime-artifact search: **no genuine captured event found**. Exact event/operation/request-ID search included hidden/ignored repository text (excluding dependency/Git/database/dist/protected migration/checksum paths); matches were limited to source emitters, test fixtures and these status documents. No candidate saved log files were found in the repository or supplied Desktop/MSCPROJ handoff folder. No failed stage/category/code/timestamp established. [Inspected-file classification and search limits](docs/REGISTRATION_503_ROOT_CAUSE_INVESTIGATION_2026-11-18.md). The user confirmed the original terminal output and managed logs are unavailable. Do not repeat the search, start the backend, or submit another request; resume only if genuine runtime evidence becomes available or separate authorization is granted. Registration is **BLOCKED ON RUNTIME EVIDENCE**; all existing acceptance requirements remain open as recorded below.

- Status: **Blocked** on captured runtime evidence. Existing stage diagnostics cover hashing, connection, database identity, identity locking, transaction/lookups/insertion/commit/rollback and cleanup. Generic 503 does not identify a stage. No saved runtime event was found in the checked repository locations. The previously supplied request ID also appears in synthetic test fixtures and cannot make those test events live evidence.
- Offline configuration inspection passed for the inspector shell, including required settings and TLS option construction/CA presence. No live pool was imported or connection attempted. Running backend configuration/code freshness, TLS handshake, database connectivity/schema and persistence remain unverified. Historical missing-setting reports do not establish the present cause.
- Current-task evidence: 424 backend tests passed, 0 failed/skipped; 81 frontend tests passed, 0 failed/skipped; all exits 0. Backend uses fail-closed pool doubles; frontend checks are rendered/source/API/role tests, not interactive browser acceptance. Build exit 0 (2714 modules), production scanner exit 0 (0 unexplained findings), diff check exit 0. [Exact target lists, commands and boundaries](docs/REGISTRATION_503_ROOT_CAUSE_INVESTIGATION_2026-11-18.md).
- Files changed: this tracker and the new investigation report. No application/test changes: no evidenced defect to correct. Required build regenerated dist output; dist/index.html was already modified before this task. All original requirement rows and existing work are preserved.
- Database Change Report: no database connections, SQL execution, schema/data changes, migrations, imports, fabricated values or Docker operations. Migration 007 and its checksum/history uninspected and untouched. Section 24 approval artifacts unchanged.
- Remaining Client/Admin gates: real pending application creation and retrieval, Admin approval/rejection, approved login/session, ownership isolation and quotation visibility. Registration inserts the pending application; Admin approval creates the linked company/Client user. An uncertain commit must be reconciled before retrying.
- Exact next task: wait for genuine runtime evidence or separate explicit authorization. Do not restart the backend, repeat the registration request, or access a database. If authorized later, define the named environment, operator, correlation fields and uncertain-write reconciliation before any reproduction.


## Production scanner and major regression update — November 18, 2026

The earlier cancellation/Section 24 scanner-failure entries below are historical. This update supersedes that scanner result only; it does not grant inventory execution approval or close Phase 1.

| Evidence group | Current result | Scope |
|---|---|---|
| Full backend safe suite | 844 passed, 0 failed/skipped, exit 0 | All 67 backend/src *.test.js files; pool import replaced with fail-closed double |
| Full frontend safe suite | 216 passed, 0 failed/skipped, exit 0 | All 35 src/app *.test.mjs files; pure/source/compiled-adapter/render checks |
| Scanner regressions | 12 passed, 0 failed/skipped, exit 0 | All 71 valid records, all 67 original findings, all original non-catalog markers and negative/tampered contexts |
| Synthetic auth/proxy/config | 2 passed, 0 failed/skipped, exit 0 | Ephemeral loopback test servers, mocked auth, no live database |
| Inventory preparation | 13 passed, 0 failed/skipped, exit 0 | Existing artifacts freshness-checked, not regenerated |
| Selected legacy planner | 3 passed, 0 failed/skipped, exit 0 | Doubles only; completed MAIN reconciliation case not rerun |
| Production build | Exit 0; 2714 modules | Existing large-chunk/deprecation warnings; no runtime server |
| Production scanner | Exit 0; 0 unexplained | Three JS assets, 71 catalog and four compatibility occurrences verified by context |
| git diff --check | Exit 0 | Whitespace clean; optional LF/CRLF normalization notice is informational |

Initial frontend 215-test run had 212 pass/3 failures. Those assertions explicitly expected cancellation APIs/actions to remain unavailable or history pagination absent. Current implementation and full backend tests establish the existing authenticated workflow; tests were reconciled to its routing, terms, ownership separation, uncertain-outcome and pagination contracts, with a new executable API-adapter regression. No real defect was hidden or production action disabled to force a pass. Focused reruns overlap final suites and are not added to totals. [Exact commands, file membership and initial/final evidence](docs/asset-scanner/HANDOFF_REPORT.md).

Scanner classification evidence: [67 exact baseline rows](docs/asset-scanner/baseline-findings.csv), [JSON with source lines and baseline bundle hashes](docs/asset-scanner/baseline-findings.json), [current scan](docs/asset-scanner/current-scan.json). All 132 old prohibited markers remain. Valid code occurrences require exact source/canonical metadata and emitted catalog structure; standalone/reused IDs, altered values, suspicious fixtures, Unicode escapes and unknown IDs still fail. Four old global compatibility exceptions are narrowed to exact mapping context. Three formerly informational demo-address leaks are excluded by a production DEV guard and now fail if they return. No catalog rows or source business values were deleted or blanket-allowed.

Browser acceptance and live MySQL persistence: **NOT RUN**. MySQL integration scripts, migration/baseline/seed suites/CLI, Docker/browser database harnesses and standalone synthetic MySQL-protocol TLS fixture: **NOT RUN** under current restrictions. No availability claim for the protected environment was made. Scoped safe-suite coverage is not a claim that every repository test or manufacturing/business workflow is accepted.

Next recommended Phase 1 task: approve one controlled registration reproduction with safe diagnostic correlation, resolve the reviewed failure, then register/approve a Client through the existing portals and verify quotation visibility/cancellation persistence under separately authorized writes. Continue pricing-visibility review, inventory schema/import/BOM approvals and all nine-role/cross-role gates. No Phase 2 transition or cloud activation is authorized by these results.

Database change report for this update: no connections, SQL execution, records inspected, schema/data/migration/import/RBAC/credential changes, fabricated quantities/BOMs or Docker operations. Protected Migration 007 and checksum/history uninspected and untouched. Section 24 approval artifacts preserved.

## Authority and evidence rules

- Original 28-page handoff: initial approved requirements, business rules and nine-role restoration scope.
- COMPREHENSIVE DEVELOPMENT HANDOFF (45 pages): November 18 current-status reference, especially §§14–17 and 24–28.
- Current source and uncommitted Git changes establish implementation presence, not approved policy or live operation. Existing teammate changes are preserved.
- Reports under docs/WAREHOUSE_INVENTORY_PHASE_1_REPORT.md, docs/SALES_QUOTATION_PHASE_1_FOLLOWUP_REPORT.md and docs/ENGINEER_SKETCH_INTEGRATION.md retain historical scope and limitations. Today's chat reports are separate execution evidence.
- Allowed statuses: Fully accepted; Functionally verified; Automated tests verified; Implemented — verification pending; In progress; Pending; Blocked; Deferred. A workflow with an isolated-test sub-result may still be blocked overall.
- In-memory service tests, mocked HTTP tests, source assertions, browser interception, real authenticated browser checks, live database persistence and cross-role acceptance are distinct evidence levels. No live database or browser evidence is generated in this task.
- Historical claims of no backend in database/DEVELOPMENT.md are superseded by backend/src; the document itself marks this. Earlier task-specific acceptance in docs/TESTING.md does not close Phase 1. Older Sales-read-only reports are superseded in implementation presence by current transactional source, not by live acceptance.
- Original handoff's nine-role restoration priority remains unfinished. Comprehensive §24 updates the inventory preparation priority; the user's current cancellation priority does not remove inventory or any original gate. §17.3 catalog-first wording is preparation, not permission to import before §24 quantity-policy review/approval.

## Exact test command conventions

For each backend target list below, the exact isolated command is:

```powershell
node --import ./backend/test/support/mock-database.js --test --test-isolation=none <space-separated backend target files>
```

For frontend *.test.mjs targets:

```powershell
node --test --test-isolation=none <space-separated frontend target files>
```

These are explicit target recipes; a target is not claimed freshly run unless included in the execution ledger. HTTP fixtures require the synthetic APP_ORIGIN=http://localhost:5173; set only for the test process and restore afterward. The import hook disables live pool access. Do not run *.mysql.integration.js, application startup, browser DB harnesses, migration discovery or database execution CLI. The later Section 24 update permits only its explicitly reviewed offline material-planner test cases; no general database-directory test discovery. Mixed backend/frontend targets use the backend command with the hook. Scanner/build commands are separate. No migration or protected-file checksum checks are included.

## Requirement ledger

### 1. Client registration and Admin approval

- Reference: Original §§5.1,5.9,7.1; Comprehensive §§3,9,26.
- Status: **Blocked**.
- Actual source: `backend/src/services/registration.service.js`; `backend/src/services/client-applications.service.js`; `src/app/components/Login.tsx`; `src/app/components/admin/RegistrationRequests.tsx`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/registration.service.test.js backend/src/routes/client-onboarding.http.integration.test.js`.
- Evidence and remaining work: Live registration 503 is unresolved. Existing diagnostics and pending-application/Admin-created association paths are source verified; latest focused 424-backend/81-frontend run passed with isolated doubles/source/render checks. Actual failed stage remains unknown; no runtime safe event available. See the registration investigation update above; no speculative application fix applied.
- Dependencies/blockers: Existing safe event retrieval or separately authorized reproduction; running backend configuration/code and real persistence unverified. No new accounts or sessions authorized by this task.
- Exact next action: Retrieve a previously captured safe event first; if unavailable, approve the named environment and controlled reproduction scope, reconcile uncertain prior application outcome, then review stage/category/code before a targeted remedy.

### 2. Client inquiry workflow

- Reference: Original §§5.9,7.2; Comprehensive §§11,19.1,26.
- Status: **Implemented — verification pending**.
- Actual source: `backend/src/services/client-inquiry.service.js`; `backend/src/services/client-portal.service.js`; `src/app/components/client/ClientPortal.tsx`; `src/app/components/client/inquiryValidation.mjs`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/client-inquiry.service.test.js backend/src/routes/client.http.integration.test.js`.
- Evidence and remaining work: JSON and multipart workflows exist; current ownership, validation and audit tests are isolated.
- Dependencies/blockers: Approved Client account; live persistence and cross-session Sales retrieval.
- Exact next action: After registration approval, verify an authorized inquiry without sketches first.

### 3. Sales inquiry handling

- Reference: Original §§5.4,7.3; Comprehensive §§12,19,26.
- Status: **Implemented — verification pending**.
- Actual source: `backend/src/services/sales-orders.service.js`; `backend/src/services/sales-notifications.service.js`; `src/app/components/sales/SalesPipeline.tsx`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/sales-inquiry-rejection.service.test.js backend/src/routes/sales.http.integration.test.js`.
- Evidence and remaining work: List/detail/rejection and notifications exist. Unavailable responses must remain distinct from empty results.
- Dependencies/blockers: Sales 503 and authenticated cross-role acceptance remain open.
- Exact next action: Correlate safe Sales diagnostics and verify Client inquiry retrieval.

### 4. Quotation draft/save/send/decisions/revisions

- Reference: Original §§5.4,7.5; Comprehensive §§12,19.2,25–26.
- Status: **Implemented — verification pending**.
- Actual source: `backend/src/services/sales-orders.service.js`; `backend/src/services/client-portal.service.js`; `src/app/components/sales/RealQuotationPreparation.tsx`; `src/app/components/sales/quotationDraft.js`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/sales-orders.service.test.js backend/src/services/client-portal.service.test.js`.
- Evidence and remaining work: Preserve immutable revisions, server costing, exact 20%/50% downpayment, discount/VAT, stale-base checks, original component hierarchy. Unknown-outcome retry safeguard selected as next safe gap.
- Dependencies/blockers: Approved BOM/prices, registered Client, real save/send/revision persistence.
- Exact next action: Implement retry safeguard, then separately authorize full Sales→Client quotation verification.

### 5. Cancellation workflow

- Reference: Original §§5.4,5.9,6,11; Comprehensive §§23,26–27; current source baseline.
- Status: **In progress**.
- Actual source: `backend/src/services/client-portal.service.js`; `backend/src/services/sales-orders.service.js`; `backend/src/routes/client.routes.js`; `backend/src/routes/sales.routes.js`; `src/app/components/sales/SalesPipeline.tsx`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/sales-cancellation.service.test.js backend/src/routes/client.http.integration.test.js backend/src/routes/sales.http.integration.test.js`.
- Evidence and remaining work: Existing Client request, Sales decisions, audit and history preserved. This task repairs archived history filtering/pagination and uncertain decision retries. Detailed cancellation acceptance rules are not enumerated in either supplied PDF; preserve current rules and explicitly reconcile policy instead of calling it approved.
- Dependencies/blockers: Live persistence/browser acceptance; business confirmation of existing eligibility policy.
- Exact next action: Review reconciliation below; run scoped regressions, then authorize Client→Sales→Client acceptance.

### 6. Warehouse inventory

- Reference: Original §§5.7,7.10; Comprehensive §14.
- Status: **Implemented — verification pending**.
- Actual source: `backend/src/services/inventory.service.js`; `src/app/components/Inventory.tsx`; `src/app/store/materials.tsx`; `src/app/store/inventoryModel.js`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/inventory.service.test.js`.
- Evidence and remaining work: MAIN catalog and targeted UI correction are historically reported; no fresh physical counts or live catalog verification.
- Dependencies/blockers: Missing catalog/import approval and inventory 503.
- Exact next action: Diagnose inventory failure before live Warehouse acceptance; preserve Not recorded.

### 7. Nullable stock handling

- Reference: Original §7.4; Comprehensive §§15,24.
- Status: **Blocked**.
- Actual source: `src/app/store/inventoryModel.js`; `src/app/store/materials.tsx`; `backend/src/services/sales-orders.service.js`; `database/SCHEMA.md`.
- Test targets / exact command: `node --test --test-isolation=none src/app/store/inventoryModel.test.mjs`.
- Evidence and remaining work: Unknown, verified zero and positive stock must remain distinct. Schema proposal is review-only; no migration creation authorized.
- Dependencies/blockers: Explicit nullable-stock design approval, schema dependency and Cloud SQL review.
- Exact next action: Review the completed Section 24 proposal in docs/inventory-preparation/APPROVAL_PACKET.md (decision A), including exact DDL and null-safe impact review. Schema execution remains separately unapproved.

### 8. 71-material reconciliation/import preparation

- Reference: Original §§7.10,9.6; Comprehensive §§14.2,16,24.
- Status: **Blocked**.
- Actual source: `docs/inventory-reconciliation/integrated-main-catalog.json`; `docs/inventory-reconciliation/catalog-reconciliation.csv`; `database/material-catalog-import.mjs`; `docs/inventory-preparation/nullable-import-proposal.json`; `docs/inventory-preparation/material-import-review.csv`; `scripts/prepare-section24-inventory.mjs`.
- Test targets / exact command: `node --test --test-isolation=none scripts/prepare-section24-inventory.test.mjs` (13 passed); `node --test --test-isolation=none --test-name-pattern="unknown quantities|reconciliation reuses|prepared executor" database/material-catalog-import.test.mjs` (3 passed). These are the later Section 24 offline runs; completed MAIN source reconciliation was not repeated.
- Evidence and remaining work: Completed reconciliation reused unchanged. Exact 71-row nullable candidate, CSV, digests and verified-only blocked plan now prepared and offline-tested. All quantities are NULL/unknown and all actual IDs unassigned. No fresh database absence/reference proof; no import authorization.
- Dependencies/blockers: Quantity policy/evidence, approved target/rows/backup/rollback and execution owner.
- Exact next action: Review exact rows, quantity policy, duplicate/idempotency/transaction/recovery strategy and conditional import decision B in docs/inventory-preparation/APPROVAL_PACKET.md. The earlier cancellation task did not run database-directory tests; this Section 24 task ran only the explicitly reviewed planner cases above, with doubles.

### 9. Numeric material ID mapping

- Reference: Original §§7.4–7.5; Comprehensive §§13.4,16.4.
- Status: **Implemented — verification pending**.
- Actual source: `config/material-catalog-ids.json`; `src/app/store/inventoryModel.js`; `database/material-catalog-import.mjs`.
- Test targets / exact command: `node --test --test-isolation=none src/app/store/inventoryModel.test.mjs`.
- Evidence and remaining work: Explicit code→BIGINT-string mapping exists; do not equate catalog codes with database IDs.
- Dependencies/blockers: Current registry remains empty. docs/inventory-preparation/reference-and-id-validation.json contains 71 pending mappings, validated code/reference metadata and bounded BIGINT-string checks. Current target lookup/material reads and committed/reconciled IDs remain unverified.
- Exact next action: Validate/publish mappings only against approved import results.

### 10. BOM population and costing

- Reference: Original §§7.4–7.5; Comprehensive §§13,17.
- Status: **Blocked**.
- Actual source: `backend/src/services/sales-orders.service.js`; `src/app/components/CostEstimationPanel.tsx`; `src/app/components/sales/RealQuotationPreparation.tsx`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/sales-orders.service.test.js`.
- Evidence and remaining work: Materials and BOMs are separate. Missing mappings are unmapped/incomplete, not zero or available.
- Dependencies/blockers: Approved product/size/material/quantity/unit/waste/conversion data; no fabricated BOM.
- Exact next action: Complete the separate manufacturing input checklist in docs/inventory-preparation/BOM_REQUIREMENTS.md and bom-business-data-required.json, then review exact BOM rows separately. Templates/lines are intentionally empty; no quantities, conversions, IDs or costing flags guessed.

### 11. Stock Requests

- Reference: Original §§5.4,5.7,7.10; Comprehensive §§18.5,26.
- Status: **Implemented — verification pending**.
- Actual source: `backend/src/services/stock-requests.service.js`; `backend/src/routes/stock-requests.routes.js`; `src/app/components/RealWarehouseStockRequests.tsx`; `src/app/components/sales/RealSalesStockRequests.tsx`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/stock-requests.service.test.js backend/src/routes/stock-requests.routes.test.js`.
- Evidence and remaining work: Manual Sales creation and Warehouse processing exist; no procurement or automatic stock reservation/deduction.
- Dependencies/blockers: Real materials/mappings and authorized write-path acceptance.
- Exact next action: Verify manual request/process/update with approved inventory fixtures.

### 12. Warehouse-to-Sales integration

- Reference: Original §§6,7.4,7.10; Comprehensive §§14.4,24.6,26.
- Status: **Blocked**.
- Actual source: `src/app/store/materials.tsx`; `backend/src/services/inventory.service.js`; `backend/src/services/sales-orders.service.js`; `src/app/components/sales/RealQuotationPreparation.tsx`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/inventory.service.test.js backend/src/services/sales-orders.service.test.js`.
- Evidence and remaining work: Mock integration and historical browser reports are not current shared live data proof.
- Dependencies/blockers: Inventory service, material import, BOM approval and stock representation.
- Exact next action: Review the completed consumer impact matrix in docs/inventory-preparation/APPROVAL_PACKET.md, then after separate approvals verify units/prices/availability/costing and the manual Stock Request round trip. Offline regression in this Section 24 task: 50 passed; no live verification.

### 13. Accounting and payment verification

- Reference: Original §§5.5,7.7–7.9; Comprehensive §§19.3–19.6,26.
- Status: **Implemented — verification pending**.
- Actual source: `backend/src/services/document-workflows.service.js`; `backend/src/routes/document.routes.js`; `backend/src/services/sales-orders.service.js`; `src/app/api/documentWorkflows.ts`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/document-workflows.service.test.js backend/src/services/sales-orders.service.test.js`.
- Evidence and remaining work: Sales validates PO/issues invoice; Accounting alone verifies/rejects proof with reason. Preserve rejected proof/resubmission/balance; verified downpayment is not full payment.
- Dependencies/blockers: Storage configuration deferred; approved write-path and cross-role evidence.
- Exact next action: Verify document/payment eligibility with doubles; later authorize a full invoice/payment/JO scenario.

### 14. Production workflow

- Reference: Original §§5.6,7.9,7.11; Comprehensive §§19.6–19.7,26.
- Status: **Implemented — verification pending**.
- Actual source: `backend/src/services/production-job-orders.service.js`; `backend/src/routes/production.routes.js`; `src/app/api/productionJobOrders.js`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/production-job-orders.service.test.js backend/src/routes/production.http.integration.test.js`.
- Evidence and remaining work: Preserve eligible JO retrieval, stage monitoring and friendly specification labels. Do not infer employee-assignment requirements or auto-start/deduct stock.
- Dependencies/blockers: Approved JO prerequisites and authenticated role/browser acceptance.
- Exact next action: Verify eligible/ineligible JO read/update paths and specification presentation.

### 15. Logistics and delivery

- Reference: Original §§5.8,7.12; Comprehensive §§19.8,26.
- Status: **Implemented — verification pending**.
- Actual source: `backend/src/services/sales-orders.service.js`; `src/app/api/salesDelivery.js`; `src/app/components/client/ClientPortal.tsx`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/sales-job-delivery.service.test.js`.
- Evidence and remaining work: Preserve delivery statuses, tracking, waybill and delivery verification, role restrictions. Full operational acceptance not established.
- Dependencies/blockers: Approved delivery fixtures and exact endpoint/write coverage reconciliation.
- Exact next action: Compare Logistics MAIN pages and exercise authorized delivery transitions.

### 16. Reporting and analytics

- Reference: Original §§5.2–5.3,7.13; Comprehensive §§23,26.
- Status: **In progress**.
- Actual source: `backend/src/config/permissions.js`; `backend/src/routes/admin.routes.js`; `backend/src/routes/sales.routes.js`; `backend/src/routes/inventory.routes.js`; `backend/src/routes/production.routes.js`; `backend/src/services/admin.service.js`; `backend/src/services/sales-dashboard.service.js`; `backend/src/services/inventory.service.js`; `backend/src/services/production-job-orders.service.js`; `src/app/role-access.js`; `src/app/components/Dashboard.tsx`; `src/app/components/AnalyticsFullView.tsx`; `src/app/store/orders.tsx`; `src/app/store/materials.tsx`.
- Requirements matrix: [Owner and Operations Reporting/Analytics Matrix](docs/REPORTING_ANALYTICS_REQUIREMENTS_MATRIX_2026-11-18.md).
- Test targets / exact commands: `node --import ./backend/test/support/mock-database.js --test --test-reporter=tap backend/src/services/sales-dashboard.service.test.js backend/src/routes/sales.http.integration.test.js backend/src/routes/admin.http.integration.test.js backend/src/routes/production.http.integration.test.js backend/src/routes/inventory.http.integration.test.js backend/src/routes/owner-employee-directory.routes.test.js` (**61 passed**); `node --test --test-reporter=tap src/app/role-access.test.mjs src/app/components/realInventoryProduction.test.mjs src/app/components/admin/render.test.mjs` (**62 passed**).
- Evidence and remaining work: Owner Analytics is fail-closed in Real Mode and disables exports, but has no authenticated reporting dataset. Operations has no Analytics route/reporting endpoint. Correction: KPICard already hides calculated Real Mode values; it does not display the previously reported zeros. The bottleneck panel now also withholds unsupported issue/resolution results, with rendered regressions. Inventory/Job Order APIs do not supply the whole reporting scope. Existing Inventory Alerts formula includes unknown stock, but its Real Mode value remains unavailable; formula classification still needs review. No metric is accepted as a handoff-approved KPI.
- Dependencies/blockers: Original reporting passages now independently read and reconciled in docs/stabilization/REPORTING_REFERENCE_RECONCILIATION.md; they preserve reporting scope without defining exact KPI formulas/date/freshness/field visibility. MAIN/business-definition comparison, source coverage and role policy remain unverified. Current major regression refresh pending.
- Exact next action: Execute the controlled stabilization regression plan before another metric. Review current reporting fields/semantics and Owner/Operations visibility against original requirements and MAIN; keep unsupported values unavailable. Source correction accepted at source/test level; entire reporting workflow still In progress.

### 17. Engineer Sketch and asset handling

- Reference: Original §8.4,10.6; Comprehensive §§10–11,22.5.
- Status: **Deferred**.
- Actual source: `backend/src/services/engineer-sketch.service.js`; `backend/src/services/document-workflows.service.js`; `backend/src/storage/document-storage.js`; `docs/ENGINEER_SKETCH_INTEGRATION.md`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/engineer-sketch.service.test.js backend/src/storage/document-storage.test.js`.
- Evidence and remaining work: Code and mock tests exist; private GCS activation and live transfers intentionally deferred. Preserve all-or-nothing/idempotency/ownership and STORAGE_NOT_CONFIGURED; no local fallback.
- Dependencies/blockers: Explicit cloud activation approval, bucket/IAM/credentials and live verification.
- Exact next action: Retain fail-closed behavior; schedule cloud work only under approved scope.

### 18. Production asset scanner

- Reference: Original §§9.6,10.5; Comprehensive §§21,25.
- Status: **Automated tests verified**.
- Actual source: `scripts/check-production-demo-assets.mjs`; `scripts/production-asset-scan.mjs`; `scripts/production-asset-policy.mjs`; `scripts/production-asset-scan.test.mjs`; `src/app/components/QuotationBuilder.tsx`; `docs/asset-scanner/baseline-findings.csv`; `docs/asset-scanner/current-scan.json`.
- Test targets / exact command: `node --test --test-isolation=none scripts/production-asset-scan.test.mjs` (12 passed); `npm.cmd run build` (exit 0); `npm.cmd run check:production-demo-assets -- --write-report` (exit 0, zero unexplained).
- Evidence and remaining work: All 67 original marker findings individually proven authentic catalog records against source and retained reconciled manifest. All 132 original deny markers retained; full-record/constructor/array validation replaces unconditional catalog rejection, not a blanket code exemption. Arbitrary/altered catalog occurrences still fail. Three former out-of-scope demo-address defaults removed from production through a DEV guard and now fail if they leak. Complete per-finding source lines, bundle hash/offset and classification are recorded.
- Dependencies/blockers: Marker scanner gate resolved. Broader business approval of reference pricing visibility/authenticated catalog delivery and all browser/live Phase 1 gates remain separate; scanner success is not confidentiality or final acceptance proof.
- Exact next action: Review the evidence and pricing-visibility policy separately, then authorize controlled registration/API diagnosis and Client/Admin/quotation live acceptance; do not reopen inventory execution without its independent approvals.

### 19. Nine-role acceptance

- Reference: Original §§3–6,11; Comprehensive §§6,23–26.
- Status: **In progress**.
- Actual source: `src/app/App.tsx`; `src/app/components/RealRoleWorkspace.tsx`; `src/app/components/RealEmployeeShell.tsx`; `tests/sales-conversion/RESTORATION-EVIDENCE.md`.
- Test targets / exact command: `node --test --test-isolation=none src/app/components/realClientPortal.test.mjs src/app/components/realInventoryProduction.test.mjs`.
- Evidence and remaining work: Admin, Owner, Operations, Sales, Accounting, Production, Warehouse, Logistics and Client all retain role-specific acceptance gates. No role is fully accepted in this tracker.
- Dependencies/blockers: Complete actual MAIN comparisons, valid sessions, module/dialog/responsive/error-state and functional checks.
- Exact next action: Complete role-by-role evidence ledger; historical screenshots are not a fresh full acceptance.

### 20. Security, audit and end-to-end verification

- Reference: Original §§7.1,9.7,11; Comprehensive §§5,20,26–28.
- Status: **In progress**.
- Actual source: `backend/src/middleware/auth.middleware.js`; `backend/src/middleware/permission.middleware.js`; `backend/src/middleware/origin.middleware.js`; `backend/src/services/audit-request-id.js`; `backend/src/controllers/service-failure-log.js`.
- Test targets / exact command: `node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/middleware/auth.middleware.test.js backend/src/middleware/auth-permission.http.integration.test.js backend/src/services/audit-request-id.test.js`.
- Evidence and remaining work: Isolated security tests verify covered guards, not all workflow acceptance. Preserve sessions, RBAC, ownership, parameter binding, transaction integrity and audit confidentiality.
- Dependencies/blockers: Authorized isolated/live cross-role plan; no permissions bypass or unauthorized writes.
- Exact next action: Run focused regressions and document pending Client→Sales→Accounting→Production→Warehouse→Logistics→Client evidence.

### 21. Final Phase 1 acceptance/sign-off

- Reference: Original §§11–12; Comprehensive §§25–28.
- Status: **Pending**.
- Actual source: `PHASE_1_MASTER_PROGRESS_TRACKER.md`; `docs/TESTING.md`; `database/TEAM_MIGRATIONS.md`.
- Test targets / exact command: `npm run build; git diff --check`.
- Evidence and remaining work: Build/test passes do not close functional, visual, persistence or business acceptance. Phase 2 must not start early.
- Dependencies/blockers: All applicable gates above, remaining defects disposition, full safe suite and explicit final approval.
- Exact next action: Review tracker with owner; close each evidence gap and obtain formal sign-off.

## Cancellation reconciliation and acceptance boundary

Already present: authenticated Client-owned submission, required reason/terms acknowledgment, pending request prevention, Sales-only accept/decline, order/request locks, transaction rollback, audit records, Client history and Sales UI. Current source limits requests to unarchived inquiry/quotation/po orders and blocks verified DOWNPAYMENT; accept archives with archive_reason=cancelled while retaining prior stage, decline leaves stage/archive intact. Request statuses pending/approved/declined and existing historical aliases cancelled/rejected are preserved; Sales inquiry rejection remains a distinct action. No quotation history, payment proof or stock is deleted or rewritten by this task.

Confirmed gaps repaired here: history previously queried only open orders; approved archived records disappeared. Cancellation-specific filtering must occur before count/pagination. Loading/detail failures must not masquerade as no requests. Decision actions require a synchronous lock and an explicit state check after unknown outcomes. Tests cover these changes; database SQL execution, concurrent real MySQL locking, actual browser interactions, full Client→Sales→Client persistence and complete policy acceptance remain unverified.

The supplied PDFs do not enumerate a detailed cancellation-specific acceptance checklist. Existing source, terminology and earlier task context are the implementation baseline, not evidence that every policy detail was formally approved. Any proposed widening of eligibility, refunds, post-production handling or automatic stock effects requires business review. Do not invent it to close this row.

## Nine-role acceptance detail

| Role | Overall status | Required acceptance still open |
|---|---|---|
| Admin | Implemented — verification pending | Registration requests, employee/client management, roles/permissions, MAIN comparison and authorized writes |
| Owner | In progress | Analytics, clients, employee directory, notifications/settings, MAIN comparison and restricted visibility |
| Operations | In progress | Production/logistics/waybill monitoring, MAIN comparison, fail-closed Sales data restrictions |
| Sales | In progress | Complete inquiry/quotation/PO/invoice/JO/cancellation/Stock Request workflows and MAIN comparison |
| Accounting | Implemented — verification pending | Invoice/payment review/rejection/resubmission/balance, MAIN comparison and authorized writes |
| Production | Implemented — verification pending | Eligible JO/stages/specification labels and MAIN comparison |
| Warehouse | Blocked | Quantity decision, authentic catalog, mappings/BOMs, manual count/Stock Requests and MAIN comparison |
| Logistics | Implemented — verification pending | Delivery/waybill/tracking/verification and MAIN comparison |
| Client | Blocked | Registration/approval, inquiry/quotation/PO/proofs/tracking/reorder/sketch behavior and MAIN comparison |

## Resumed cancellation and role regression verification — November 18, 2026

- Backend cancellation services and local HTTP fixtures: `node --import ./backend/test/support/mock-database.js --test --test-reporter=tap backend/src/services/sales-cancellation.service.test.js backend/src/services/client-portal.service.test.js backend/src/services/sales-orders.service.test.js backend/src/services/sales-inquiry-rejection.service.test.js backend/src/routes/client.http.integration.test.js backend/src/routes/sales.http.integration.test.js` — **122 passed, 0 failed, 0 skipped**. `APP_ORIGIN=http://localhost:5173` was set only for this process and removed after the run.
- Frontend cancellation/Client/Sales source and adapter tests: `node --test --test-reporter=tap src/app/components/realCancellationWorkflow.test.mjs src/app/components/sales/cancellationModel.test.mjs src/app/components/realClientPortal.test.mjs src/app/components/sales/salesInquiryReview.test.mjs` — **18 passed, 0 failed, 0 skipped**.
- Admin, Client Applications and authentication local HTTP fixtures: `node --import ./backend/test/support/mock-database.js --test --test-reporter=tap backend/src/routes/admin.http.integration.test.js backend/src/routes/client-applications.http.integration.test.js backend/src/routes/auth.http.integration.test.js` — **99 passed, 0 failed, 0 skipped**. Synthetic `APP_ORIGIN` only; no live application/database.
- Admin, Owner dashboard, Operations, Warehouse, Production, Sales and Client render/source tests: `node --test --test-reporter=tap src/app/components/admin/render.test.mjs src/app/components/realInventoryProduction.test.mjs src/app/components/realSalesOrdersCompletion.test.mjs` — **62 passed, 0 failed, 0 skipped**. This is not browser/role acceptance.
- `npm.cmd run build -- --outDir 'C:\Users\larat\.copilot\session-state\e7eefa2e-6f1d-4541-80b4-4b1ff974e13b\files\phase1-build-check'` — exit 0; 2,714 modules transformed. Build emitted existing chunk-size and `module.register()` deprecation warnings. Temporary output was outside the repository; no application server was started.
- `git diff --check` — exit 0. No asset scanner rerun because this resumed change is unrelated to asset handling.
- These are isolated service doubles/local HTTP fixtures and source/render tests. No browser, live database, persistent workflow, or role sign-off is claimed. No role status above is upgraded.

## Execution ledger — this task

Initial cancellation/regression run: 101 tests, 99 passed, 2 failed, 0 skipped, exit 1. Both failures were stale assertions in pre-existing changes: revision-request query selection accidentally matched a new order projection subquery; a rejection UI source test expected removed placeholder text. Corrected target selection and current explicit unavailable-action expectation; no functional assertion was bypassed. Rerun: 101 passed, 0 failed/skipped, exit 0.

Exact focused command (with synthetic APP_ORIGIN set/restored):

```powershell
node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap backend/src/services/sales-cancellation.service.test.js backend/src/services/sales-orders.service.test.js backend/src/services/client-portal.service.test.js backend/src/routes/sales.http.integration.test.js backend/src/routes/client.http.integration.test.js src/app/components/sales/cancellationModel.test.mjs src/app/components/sales/salesInquiryReview.test.mjs
```

Further verification and next-gap results are recorded below. Prior 96 focused registration/diagnostic and 153 registration/Admin regressions in today's chat are earlier runs, not fresh results of this task. Handoff 929/930 suites and 78/7/38/1 Warehouse/Sales results remain historical and must not be added to current totals.

## Next safe gap implemented

After creating this tracker, selected quotation draft/save/send unknown-outcome handling (requirement 4). Live registration is blocked by authorization and unresolved failure; material/BOM execution is blocked by approvals/business data. RealQuotationPreparation now retains edits, blocks repeated save/send after uncertain results and offers a read-only saved-history check. A newer revision requires explicit close/reopen/review; an unchanged read is not proof an in-flight request failed. No automatic retry or quotation business-rule change.

Additional cancellation gap: Client quotation decisions, revision requests and PO submission previously omitted archive checks. Under their existing owned-order lock they now reject archived/cancelled/rejected orders using QUOTATION_NOT_ELIGIBLE before quotation lookups or writes. History remains readable. A 12-case service regression checks no mutations.

## Final execution ledger

Exact final backend command (synthetic APP_ORIGIN=http://localhost:5173 set only for tests and restored):
```powershell
node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap backend/src/middleware/auth-permission.http.integration.test.js backend/src/middleware/auth.middleware.test.js backend/src/routes/client-onboarding.http.integration.test.js backend/src/routes/client.http.integration.test.js backend/src/routes/production.http.integration.test.js backend/src/routes/sales.http.integration.test.js backend/src/routes/stock-requests.routes.test.js backend/src/services/audit-request-id.test.js backend/src/services/client-inquiry.service.test.js backend/src/services/client-portal.service.test.js backend/src/services/document-workflows.service.test.js backend/src/services/engineer-sketch.service.test.js backend/src/services/inventory.service.test.js backend/src/services/production-job-orders.service.test.js backend/src/services/registration.service.test.js backend/src/services/sales-cancellation.service.test.js backend/src/services/sales-dashboard.service.test.js backend/src/services/sales-inquiry-rejection.service.test.js backend/src/services/sales-job-delivery.service.test.js backend/src/services/sales-orders.service.test.js backend/src/services/stock-requests.service.test.js backend/src/storage/document-storage.test.js backend/src/routes/client-sales-workflow.http.integration.test.js
```
**256 passed, 0 failed, 0 skipped; exit 0.** Service doubles and local HTTP fixtures, including mocked onboarding and Client→Sales workflow. Not live database, browser, cross-device or actual-account acceptance. Initial broader run: 253 passed/1 failed (254 tests) because the onboarding fake did not support the existing cancellation-history SELECT. Added an exact bounded fixture branch with assertions. Intermediate 255/255 overlaps final 256 and is not added.

Exact frontend command:
```powershell
node --test --test-isolation=none --test-reporter=tap src/app/api/salesOrders.test.mjs src/app/components/realClientPortal.test.mjs src/app/components/realInventoryProduction.test.mjs src/app/components/sales/cancellationModel.test.mjs src/app/components/sales/pipelineModel.test.mjs src/app/components/sales/quotationDraft.test.mjs src/app/components/sales/realQuotationPreparation.test.mjs src/app/components/sales/salesInquiryReview.test.mjs src/app/store/inventoryModel.test.mjs
```
**45 passed, 0 failed, 0 skipped; exit 0.** Helper/API-adapter/source-assertion tests, not interactive browser verification. Initial sandbox run: 39 passed/6 failed due to spawn EPERM in existing adapter compilation subprocesses. Approved execution outside sandbox passed unchanged. Earlier focused quotation/model 17/17 overlaps these results.

- `npm.cmd run build`: initial exit 1 (sandbox spawn EPERM); approved retry exit 0, 2714 modules transformed. Large-chunk and module.register deprecation warnings remain. No backend/MySQL started. Regenerated tracked dist/index.html and ignored assets were preserved.
- `npm.cmd run check:production-demo-assets`: exit 1; current bundle flags 67 authentic catalog literals. Scanner/catalog unchanged; resolve authenticated data exposure or obtain formal disposition. Build success does not close this gate.
- `git diff --check`: exit 0.
- Individual-row commands are exact repeatable subsets; fresh evidence comes from the groups above, not separate executions of every row. Database-directory test in row 8 was NOT run.
- Prior Task 02/registration counts and historical handoff test counts remain separate. No browser or live persistence verification in this task.

## Exact next review sequence

1. Review existing cancellation eligibility/status policy and incremental repairs. Neither PDF enumerates a full cancellation-specific approved checklist; do not infer policy approval from mocked tests.
2. Keep registration **BLOCKED ON RUNTIME EVIDENCE** until genuine runtime logs or separate explicit authorization is available. Do not repeat the exhausted log search or reproduce under current restrictions.
3. After separately authorized correction, register a pending Client, approve through Admin, then verify quotation visibility and Client→Sales→Client cancellation history/persistence.
4. Separately review nullable-stock policy, 71-row import plan and approved BOM data. Import alone cannot close costing.
5. Prioritize Owner/Operations reporting scope and role visibility reconciliation, then close each of the nine-role, visual, cross-role, scanner and sign-off gates. Phase 2/cloud work remains deferred.


## Database change report

No database connections, executed SQL, schema/data changes, migrations created/executed, seeds, baselines, material imports, fabricated quantities/BOMs, RBAC changes, Docker operations or credential changes. SQL source for the existing Sales list receives a bounded optional cancellation filter; it is tested with doubles only. Protected Migration 007 and its checksum/history remain uninspected and untouched. Any future execution requires separate target/operator/operation approval.

## Section 24 inventory preparation update — November 18, 2026

This dated update follows cancellation acceptance work; it does not replace that history or either handoff. Deliverable index: [approval packet](docs/inventory-preparation/APPROVAL_PACKET.md), [exact 71-row JSON](docs/inventory-preparation/nullable-import-proposal.json), [review CSV](docs/inventory-preparation/material-import-review.csv), [reference/ID validation](docs/inventory-preparation/reference-and-id-validation.json), [current-schema blocked plan](docs/inventory-preparation/verified-only-current-schema-plan.json), [separate BOM requirements](docs/inventory-preparation/BOM_REQUIREMENTS.md), [BOM input manifest](docs/inventory-preparation/bom-business-data-required.json).

Status split: proposal/artifact preparation **Automated tests verified**; schema decision, import, numeric-ID publication, BOM population and live cross-role acceptance remain **Blocked** pending separate approval/data. No workflow is promoted to Fully accepted. Exact current target absence/lookup codes are not known; the stored zero-count snapshot is historical. All 71 proposed unknown quantities are SQL NULL, all database IDs remain null/unassigned. Six required unit codes and eight category codes pass repository-only validation. No verified physical quantity, supplier, code, price, threshold, BOM relationship or numeric mapping was invented.

Existing catalog reconciliation, authoritative catalog, quantity-evidence template and live mapping registry are unchanged. No MAIN extraction/comparison was repeated. The exact catalog candidate assumes an empty target only to show all 71 insert candidates; future permitted fresh material/reference reads may require reuse/conflict handling and a new digest/approval. JavaScript duplicate checks do not certify MySQL collation or concurrent-writer uniqueness. The existing executor cannot run the nullable-policy digest; its default verified-only behavior still blocks all unknown quantities.

### Exact offline commands and results

```powershell
node scripts/prepare-section24-inventory.mjs --write
node scripts/prepare-section24-inventory.mjs --check
node --test --test-isolation=none scripts/prepare-section24-inventory.test.mjs
node --test --test-isolation=none --test-name-pattern="unknown quantities|reconciliation reuses|prepared executor" database/material-catalog-import.test.mjs
node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/inventory.service.test.js backend/src/services/stock-requests.service.test.js backend/src/services/sales-orders.service.test.js src/app/store/inventoryModel.test.mjs
git diff --check
```

Generator/check: five files, 71 rows, executionAuthorized=false, exit 0. New preparation suite: **13 passed, 0 failed/skipped, exit 0**. Selected existing planner cases: **3 passed, 0 failed/skipped, exit 0** (the completed source-reconciliation case was excluded, not rerun). Consumer regression: **50 passed, 0 failed/skipped, exit 0**. These use pure planning or injected in-memory doubles; no MySQL connection, schema execution, browser or live persistence. Counts are separate from all earlier task/handoff runs. No production build needed for this artifact/planner-only change.

### Proposed database scope and approvals

Only materials is proposed for DDL and conditional catalog INSERTs: quantity_on_hand DECIMAL(15,4) NULL DEFAULT NULL, existing non-negative CHECK retained, existing quantities unchanged. The approval packet gives the exact statement and all 71 INSERT parameter arrays. Lookup tables have validation requirements only. bom_templates/bom_template_lines have missing-data requirements only; no exact BOM DML or row values are proposed. Stock Requests, quotations, snapshots, finished goods, RBAC, accounts, sessions and audit data remain unchanged. Default/constraint/index behavior, target/TLS, maintenance exclusion, backup/restore, exact final digest, operator and post-commit recovery all require review before execution.

DDL rollback is not DML rollback. Never force NULL to zero to reverse the schema; lost COMMIT acknowledgment requires reconciliation, not automatic retries. Mapping publication must use actual committed/reconciled string IDs and is a separate filesystem operation. No global uniqueness or automatic recovery guarantee is claimed.

Database change report: database connections/SQL execution/records inspected/schema or data changes/migrations created or executed/imports/BOM or stock fabrication/Docker/RBAC/credential changes: **none**. Protected Migration 007 and its checksum/history remain uninspected and untouched. Future operations require separate exact approval.


