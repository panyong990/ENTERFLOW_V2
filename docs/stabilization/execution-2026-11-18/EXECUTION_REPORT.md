# Phase 1 stabilization execution report — November 18, 2026

## Dependency remediation follow-up — November 18, 2026

Latest review **stopped before dependency changes**: npm registry latest picomatch is 4.0.7, still affected by GHSA-fc5q-39xc-vjpf (<=4.0.7); primary advisory lists no patched version. Latest Vite 6 is already installed 6.4.6. The audit's proposed 6.2.7 downgrade is outside ^6.4.6 and conflicts with the pnpm pin, so compatibility/security sufficiency is unverified. Fresh audit remains **exit 1 / four high affected entries**, no new advisory detected. No package/lockfile edit/install/force/suppression; requested post-change full suites/build/scanner NOT RUN because no safe change was available and the user's stop condition applies. All execution results below remain historical, not post-remediation verification. [Exact review, paths/versions/commands and stop rationale](../dependency-review-2026-11-18/REVIEW.md). Both dependency and external-script security holds remain open.

## 1. Task Overview

Executed the prepared regression plan from the existing shared worktree on `integration/dev-phase-merge`, HEAD `1f4493c38c8903d67bd0f7e3f9707d4afa580246`. Preflight confirmed the recorded 88-file baseline differed only in the three preparation documentation updates and all 102 test files matched the prepared inventory.

**Safe functional regressions passed. Dependency/security acceptance did not pass.** No claim of Phase 1 completion. No browser/live workflow, database, Docker or application service operation.

## 2. Implementation Summary

Ran controlled focused groups first, then explicit full backend/frontend membership, ancillary suites, production build, fresh production scanner, dependency checks and preservation/diff verification. No test or business-rule failure occurred; no source, tests or dependencies were changed to obtain passes.

Created fresh [bundle-correlated production scan](production-scan.json), [exact command/result ledger](execution-results.json), [dependency audit](dependency-audit.json), [security disposition](SECURITY_DISPOSITION.md), and [preservation verification](preservation-check.json). Existing stale scanner JSON and the prepared baseline/test inventory remain intact. Updated the existing tracker/handoff/testing/plan with current evidence rather than overwriting historical reports.

## 3. Functional Changes

None. No new feature/metric, authentication/ownership/business-rule change, dependency installation or source/test edit. Required build regenerated dist; tracked dist/index.html was byte-identical to the entry state. Ignored assets were regenerated normally.

External design-capture script disposition is formally documented: **retain existing worktree source, HOLD production release until scoped removal/production exclusion with tests or explicit security approval**. This is a release assessment, not a new automated gate or acceptance waiver. No remote script was fetched/executed. Functional tests and local-JS scanning do not approve its behavior.

## 4. Verification and Testing

### Actual test results, in execution order

| Group | Pass | Fail | Skip | Cancel | Todo | Exit |
|---|---:|---:|---:|---:|---:|---:|
| focused-security-auth | 125 | 0 | 0 | 0 | 0 | 0 |
| focused-business-workflows | 214 | 0 | 0 | 0 | 0 | 0 |
| focused-frontend-nine-role-surfaces | 82 | 0 | 0 | 0 | 0 | 0 |
| full-safe-backend-67-files | 844 | 0 | 0 | 0 | 0 | 0 |
| full-safe-frontend-35-files | 218 | 0 | 0 | 0 | 0 | 0 |
| scanner-regressions | 12 | 0 | 0 | 0 | 0 | 0 |
| synthetic-auth-proxy | 2 | 0 | 0 | 0 | 0 | 0 |
| inventory-preparation-regressions | 13 | 0 | 0 | 0 | 0 | 0 |
| selected-legacy-planner | 3 | 0 | 0 | 0 | 0 | 0 |

Focused groups overlap full suites and are **not added** to aggregate totals. Full suite membership is exactly **67 backend/src files / 35 src/app files**, selected from the immutable prepared test inventory, not unrestricted discovery. The full current frontend total is observed **218**, not the earlier historical 216.

No failing functional assertion was encountered. No test was skipped, deleted, weakened or rewritten. Pure inventory planner tests used injected doubles; the completed MAIN source reconciliation case was excluded from the targeted selection, not repeated. No live SQL was executed.

### Build, scanner and dependency/security checks

| Exact command/check | Actual result |
|---|---|
| `node scripts/prepare-section24-inventory.mjs --check` | Exit 0; five files fresh, 71 materials, executionAuthorized=false; no regeneration/import |
| `npm.cmd run build` | Exit 0; 2714 modules, existing Node module.register deprecation and >500kB chunk warnings |
| Fresh scan via existing `scanAssets` | Exit 0; three JS assets, 71 catalog / four compatibility occurrences, zero unexplained findings |
| `npm.cmd run check:production-demo-assets` | Exit 0; same three-asset/71/4/zero result |
| `npm.cmd audit --json --ignore-scripts` | **Exit 1; 4 high affected package entries**, all other severity counts 0; security gate not passed |
| `npm.cmd ls vite fdir tinyglobby picomatch --all` | Exit 0; confirmed Vite 6.4.6 → fdir 6.5.0 / tinyglobby 0.2.16 / picomatch 4.0.4 |
| `node --version`, `npm.cmd --version` | Exit 0; v26.13.0 / 11.20.0 |
| `npm.cmd ls @babel/parser esbuild @playwright/test --depth=0` | Exit 0; direct parser 7.29.14 and Playwright 1.56.1 present; no installation |
| `git diff --check` | Exit 0; no whitespace errors, existing LF/CRLF scanner notice only |
| Final baseline/test/bundle comparison | Exit 0; 85 baseline files unchanged; only three preparation/documentation paths differ; 102 tests unchanged; 21 tracker rows intact; fresh HTML/JS hashes match |

Full exact shell text for every invocation, including Node here-string scan/preservation commands, is retained in [execution-results.json](execution-results.json). Commands capture only safe test summaries/failure names; no raw application error, SQL, submitted identity, secret or session value is retained.

### Exact focused commands

### focused-security-auth

```powershell
$taskPreviousOrigin = $env:APP_ORIGIN
try {
$env:APP_ORIGIN = 'http://localhost:5173'
node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap backend/src/config/permissions.test.js backend/src/middleware/auth.middleware.test.js backend/src/middleware/auth-permission.http.integration.test.js backend/src/middleware/origin.middleware.test.js backend/src/controllers/service-failure-log.test.js backend/src/services/auth.service.test.js backend/src/services/session.service.test.js backend/src/services/password.service.test.js 2>&1 | Select-String 'not ok|# tests|# pass|# fail|# skipped|# cancelled|# todo'
$taskTestExit = $LASTEXITCODE
} finally { $env:APP_ORIGIN = $taskPreviousOrigin }
exit $taskTestExit
```

### focused-business-workflows

```powershell
$taskPreviousOrigin = $env:APP_ORIGIN
try {
$env:APP_ORIGIN = 'http://localhost:5173'
node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap backend/src/services/registration.service.test.js backend/src/services/client-applications.service.test.js backend/src/services/client-portal.service.test.js backend/src/services/sales-orders.service.test.js backend/src/services/sales-cancellation.service.test.js backend/src/services/stock-requests.service.test.js backend/src/services/inventory.service.test.js backend/src/services/document-workflows.service.test.js backend/src/services/production-job-orders.service.test.js backend/src/services/sales-job-delivery.service.test.js backend/src/routes/client-onboarding.http.integration.test.js backend/src/routes/client-sales-workflow.http.integration.test.js 2>&1 | Select-String 'not ok|# tests|# pass|# fail|# skipped|# cancelled|# todo'
$taskTestExit = $LASTEXITCODE
} finally { $env:APP_ORIGIN = $taskPreviousOrigin }
exit $taskTestExit
```

### focused-frontend-nine-role-surfaces

```powershell
node --test --test-isolation=none --test-reporter=tap src/app/components/admin/render.test.mjs src/app/components/realInventoryProduction.test.mjs src/app/role-access.test.mjs src/app/components/realAccounting.test.mjs src/app/components/realAnalytics.test.mjs src/app/components/realLogisticsWaybillReceipts.test.mjs src/app/components/realCancellationWorkflow.test.mjs src/app/components/sales/realQuotationPreparation.test.mjs 2>&1 | Select-String 'not ok|# tests|# pass|# fail|# skipped|# cancelled|# todo'
exit $LASTEXITCODE
```

### Exact full-suite commands

### full-safe-backend-67-files

```powershell
$taskPreviousOrigin = $env:APP_ORIGIN
try {
$env:APP_ORIGIN = 'http://localhost:5173'
$taskInventory = Get-Content docs/stabilization/test-inventory.json -Raw | ConvertFrom-Json
$taskBackendFiles = @($taskInventory.inventory | Where-Object { $_.path.StartsWith('backend/src/') } | ForEach-Object { $_.path })
if ($taskBackendFiles.Count -ne 67) { throw 'Reviewed backend membership changed.' }
node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap @taskBackendFiles 2>&1 | Select-String 'not ok|# tests|# pass|# fail|# skipped|# cancelled|# todo'
$taskTestExit = $LASTEXITCODE
} finally { $env:APP_ORIGIN = $taskPreviousOrigin }
exit $taskTestExit
```

### full-safe-frontend-35-files

```powershell
$taskInventory = Get-Content docs/stabilization/test-inventory.json -Raw | ConvertFrom-Json
$taskFrontendFiles = @($taskInventory.inventory | Where-Object { $_.path.StartsWith('src/app/') } | ForEach-Object { $_.path })
if ($taskFrontendFiles.Count -ne 35) { throw 'Reviewed frontend membership changed.' }
node --test --test-isolation=none --test-reporter=tap @taskFrontendFiles 2>&1 | Select-String 'not ok|# tests|# pass|# fail|# skipped|# cancelled|# todo'
exit $LASTEXITCODE
```

### Exact ancillary test commands

Each was executed separately, filtering only TAP failure-name/summary lines and preserving LASTEXITCODE, as recorded in the ledger:

```powershell
node --test --test-isolation=none --test-reporter=tap scripts/production-asset-scan.test.mjs
node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap config/api-proxy.test.mjs tests/auth-login.integration.test.mjs
node --test --test-isolation=none --test-reporter=tap scripts/prepare-section24-inventory.test.mjs
node --test --test-isolation=none --test-reporter=tap --test-name-pattern="unknown quantities|reconciliation reuses|prepared executor" database/material-catalog-import.test.mjs
```

### Exact-current-bundle evidence

Fresh main bundle: `dist/assets/index-BBz2fyGp.js`, SHA-256 `a268a28e628e2a2c174564c72bf5f3512bb3744a4def708316535871d4848219`.

The fresh report also fingerprints browser-DCA3Hw1c.js, index-3D1EhZ5u.js, source/output HTML, scanner/policy, catalog and material source. Final verification rehashed each referenced asset/HTML. Historical docs/asset-scanner/current-scan.json remains byte-preserved and is explicitly historical; it is not relabeled as this scan.

### Evidence boundaries

Backend tests use the existing fail-closed live-pool import replacement and injected services/storage/session doubles. Local HTTP and Vite proxy fixtures are synthetic loopback tests, not application services. Frontend tests are existing helper/API/source/render checks, not interactive browser or actual nine-role acceptance. Compilation/proxy/build used approved local subprocess execution. Only public advisory-registry/GitHub security lookup used network; no application/database endpoint was contacted.

MySQL integrations, migration/seed/baseline suites/CLI, standalone synthetic MySQL-protocol TLS fixture, Docker, Playwright/browser, GCS and real accounts/session/business workflows: **NOT RUN**. No unexecuted live test is labeled passed.

## 5. Git Change Summary

New files in `docs/stabilization/execution-2026-11-18/`:
1. EXECUTION_REPORT.md
2. execution-results.json
3. production-scan.json
4. dependency-audit.json
5. SECURITY_DISPOSITION.md
6. preservation-check.json

Existing files updated:
1. PHASE_1_MASTER_PROGRESS_TRACKER.md
2. docs/TESTING.md
3. docs/stabilization/HANDOFF.md
4. docs/stabilization/REGRESSION_PLAN.md

Build regenerated dist/ignored assets; tracked dist/index.html remained byte-identical. No runtime/test/package source file changed. Prepared worktree-baseline.json and test-inventory.json were not edited; their hashes are retained in the ledger/preservation report. All inventory-preparation and prior scanner/cancellation/registration work preserved.

No Git reset/restore/stash/clean/revert/branch switch/commit/push or discarded work.

## 6. Database Change Report

No live database connections or SQL, schema/data changes, migrations/imports/seeds/baselines, fabricated stock/BOM/mapping values, Docker or application-service startup. Protected Migration 007 and its checksum/history remained untouched and uninspected. No browser/cloud/live registration or session/account workflows. Pure planning statements in source were not executed against a database.

## 7. Remaining Issues and Blockers

1. **Dependency security gate failed.** Four affected entries are driven by one root picomatch advisory, not four independent vulnerabilities. All four are dev:true in the lockfile; actual deployed/input reachability remains unverified, not declared safe. [Primary advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) lists affected versions through 4.0.7 and no patched version at review. npm's suggested Vite 6.2.7 downgrade is outside declared ^6.4.6 and unvalidated. No audit fix/force/downgrade/override/install applied.
2. **External script production-release hold.** Current generated HTML still contains the committed third-party capture script. Formal disposition is complete, but removal/approved retention and production security acceptance remain unresolved.
3. Registration still lacks genuine runtime root-cause evidence; no investigation/reproduction repeated.
4. Inventory schema/import/numeric IDs/BOM data, GCS activation, detailed report definitions/visibility and unconnected workflow surfaces remain as recorded in the tracker.
5. Browser/MAIN visual, persistence/concurrency, cross-role and all nine-role final acceptance remain unverified. Functional pass counts do not close these gates or authorize Phase 2.

## 8. Exact Next Steps

1. Review the dependency advisory and a safe upstream/compatibility remediation or documented risk decision; do not blindly downgrade or force audit fixes. No patched version is invented.
2. Decide scoped external-script removal/production exclusion with regression/build/HTML verification, or explicit security-approved retention. No current release approval granted.
3. After reviewed security/source changes, rerun only affected focused/full gates justified by those changes and retain new audit/bundle evidence. Do not keep repeating unchanged full suites.
4. Obtain separate named-environment/operation approval before any browser/live database/registration/cross-role workflow; continue original tracker gates without new metrics or unrelated features.

## 9. Handoff Status

**Safe functional stabilization execution verified; security/release assessment HOLD; Phase 1 incomplete.** All authorized safe groups and final verification completed, no business-rule regression detected by those tests, no tests weakened and all shared work preserved. Security findings are reported rather than concealed or bypassed.

