# Registration 503 root-cause investigation — November 18, 2026

## 1. Task Overview

Investigated the unresolved POST /api/auth/register HTTP 503 within the existing Phase 1 Client/Admin workflow. **The actual runtime root cause is not established.** No live reproduction, backend startup, database connection or SQL execution was performed. No application fix is justified by the available evidence.

Primary status reference: PHASE_1_MASTER_PROGRESS_TRACKER.md. Reviewed existing registration/onboarding reports, including backend/REGISTRATION_PHASE_2.md, backend/test/REGISTRATION_PHASE_4_REPORT.md, backend/test/REGISTRATION_MYSQL_REPORT.md, and today's cancellation/scanner handoffs. Historical database results were read as reports only; their execution commands were not run. Existing implementation and unrelated work were preserved.

## 2. Root-Cause Findings

### Follow-up: existing runtime artifact search — November 18, 2026

**No genuine runtime registration diagnostic event was found in the available locations searched.** No failure stage, runtime category/code or timestamp can be extracted. This is a bounded search result, not a claim that an external terminal or logging service has no event.

Performed an exact-string, filename-only content search for `http_request_failed`, `auth.register` and the previously reported request ID across repository text files, including hidden/ignored files. Excluded .git, node_modules, database, dist, source maps, PDFs, package-lock, protected 007 paths and migration/checksum-named paths. No programs or diagnostic scripts were executed. A separate filename search found no .log/.jsonl/.out/.err/stdout/stderr artifacts in the repository or the supplied Desktop/MSCPROJ handoff folder within those exclusions. A no-match rg exit 1 denotes absence of matches, not an application failure.

Every content-match file was classified:

| File inspected | Classification/evidence |
|---|---|
| backend/src/services/registration.service.js | Source emitter calls existing helper with auth.register (line 44); not captured output |
| backend/src/controllers/service-failure-log.js | Source operation allowlist (line 22), fixed event literal (line 42), default console.error sink; not captured output |
| backend/src/app.js | Source fixed parser-failure event (line 76); not captured output |
| backend/src/services/registration.service.test.js | Synthetic diagnostic assertions (lines 18–19); supplied request ID is fixture at line 12 |
| backend/src/controllers/registration.controller.test.js | Supplied request ID is fixture at line 20 |
| backend/src/controllers/service-failure-log.test.js | Logger assertions at lines 54 and 201; test evidence only |
| backend/src/middleware/runtime-redaction.http.test.js | Test event literals/assertions at lines 72 and 102; not real registration output |
| PHASE_1_MASTER_PROGRESS_TRACKER.md | Existing diagnostic/status narrative, no captured event |
| This investigation report | Existing diagnostic/status narrative, no captured event |

Also inspected the request-log middleware: its console.info event is http_request_completed with correlation/status/duration, not a saved registration failure. Backend server source uses console logging. backend/diagnostics contained a diagnostic script, not a captured log; it was not run. Existing .vite conversion-result metadata, tasks, browser-test artifacts, .history and deployment files were included in the repository exact-string search and produced no additional matches. Names/content of unrelated artifacts and sensitive data are not reproduced here.

No implementation or application log was modified; no tests, build, backend startup, registration request or database operation was needed for this read-only evidence search. Only this report and the existing tracker were updated to preserve the negative search evidence. Prior verification totals below remain prior-task results, not newly executed tests.

Exact next step: inspect/export the **already existing** backend terminal or managed-log output from the failed request, without restarting or reproducing. Supply only event=http_request_failed, operation=auth.register, requestId, stage, category, code, and timestamp if the capture includes one. The helper itself adds no timestamp, so one must not be invented. No running-terminal/managed-log capture was available through the repository artifacts inspected. If that output was not retained, a separately authorized controlled reproduction is required as detailed in Section 9; it remains prohibited in this follow-up.

### Confirmed facts

- The reported request returned 503 with "Registration service is temporarily unavailable." No captured runtime auth.register event accompanies it.
- The supplied request ID appears as a fixture in registration service/controller tests. Events emitted by those tests with that ID are synthetic and cannot identify the live failure.
- No saved runtime .log/.jsonl diagnostic evidence was found in the repository locations checked (docs, backend, .vite, tasks). This does not establish whether external console logs exist.
- The source already has stage-specific safe registration diagnostics. There is no evidence that the running backend loaded that version. npm run server uses node without watch; source changes alone do not update an existing process.
- Offline inspection of .env.dev and pure configuration/TLS helpers found required settings present, configuration validation passing, the configured CA file present, TLS option construction passing, and origin matching the documented local frontend. No inherited overrides of the checked settings were present in the inspector shell. No setting values were printed. This verifies neither the running backend environment nor a network/TLS handshake.
- Historical missing-origin/session-setting reports describe an earlier environment. In current source those conditions cause startup validation failure or a distinct origin-security response. They do not demonstrate the cause of this generic registration 503.
- Registration uses the shared pool. Source presence of that shared dependency does not prove a connectivity failure.
- Registration creates a pending client_applications record only. It does not create a Client user/company or session. Admin approval later validates and creates the linked clients/users records, changes application state, and writes audit evidence transactionally.
- An unacknowledged commit can have an uncertain persistence outcome. A 503 alone does not prove the pending application was not created. Do not blindly repeat account creation.
- After an acknowledged commit, cleanup errors retain the successful response. Cleanup diagnostics can accompany 201, 409 or 503; their presence alone does not establish the primary failure.

### Trace and evidence limits

| Boundary | Source behavior verified | Runtime conclusion |
|---|---|---|
| Frontend and validation | Existing Real Mode form sends same-origin POST /api/auth/register; validation failures use 400 | Submitted values and actual server validation outcome unavailable |
| Password hashing | Existing Argon2id path retained; isolated real-hash test passes locally | Failed process hashing outcome unknown |
| Connection acquisition | Existing connection_acquire diagnostic | No captured event; connectivity cause unproven |
| Database identity/configuration | database_identity stage; offline config checks pass in inspector shell | Running process settings, selected database and schema unknown |
| Identity lock | identity_lock_acquire and identity_lock_result stages with bounded wait | No actual lock result captured |
| Transaction and lookups | transaction_begin, user_identity_lookup, application_identity_lookup | No actual transaction/lookup result captured |
| Pending application insertion | application_insert and application_insert_result; duplicate conflict preserved | Constraints/schema compatibility and persisted outcome unknown |
| Commit/rollback | transaction_commit and transaction_rollback diagnostics | Neither failed commit nor rollback established |
| Cleanup | identity_lock_release/result, connection_release/destroy | No actual cleanup event captured; response semantics preserved |
| Controller/parser fallback | Unexpected service outcome/exception or registration parser error can also yield generic 503 | Response text alone does not uniquely locate the stage |

Application logic, configuration, connectivity, constraints/schema, transaction/locking and cleanup causes therefore remain **unproven alternatives**, not findings. No additional logging was added: the missing item is runtime evidence from the existing infrastructure.

Existing logger safeguards: operation/stage/category/code/status allowlists, validated server request ID, and fixed event fields. Raw exceptions, SQL, submitted identities/passwords, tokens, session/cookie/header values, and environment values are not diagnostic payload fields. Source and isolated tests establish these safeguards; they do not attest to external logging infrastructure.

## 3. Implementation Summary

No production code or tests changed because no demonstrable application defect was established. Created this report and updated the existing master tracker in place. The required build regenerated production output; dist/index.html was already modified before this task. Existing source, tests, inventory approval artifacts and tracker requirements were preserved.

Reviewed primary chain:
- src/app/components/Login.tsx
- backend/src/routes/auth.routes.js
- backend/src/validation/registration.validation.js
- backend/src/controllers/registration.controller.js
- backend/src/services/registration.service.js
- backend/src/controllers/service-failure-log.js
- backend/src/services/password.service.js
- backend/src/services/client-applications.service.js
- backend/src/services/auth.service.js and session.service.js
- Existing runtime/database configuration helpers, request logging and app/server lifecycle.

## 4. Functional and Security Changes

None. Validation, Argon2id, identity locking, transaction boundaries, duplicate handling, response contracts, pending approval, RBAC, ownership, secure sessions and audit behavior remain as implemented. No manual account creation, approval bypass or new registration workflow was introduced.

## 5. Verification and Testing

All execution below is local/offline or uses isolated doubles. HTTP integration names refer to local application fixtures with the pool replaced by a fail-closed double, not live MySQL. Counts are final rerun results; repeated runs are not summed.

Backend command (424 passed, 0 failed, 0 skipped; exit 0):

```powershell
$taskPreviousOrigin = $env:APP_ORIGIN
try {
  $env:APP_ORIGIN = 'http://localhost:5173'
  node --import ./backend/test/support/mock-database.js --test --test-isolation=none --test-reporter=tap backend/src/services/registration.service.test.js backend/src/controllers/registration.controller.test.js backend/src/controllers/service-failure-log.test.js backend/src/validation/registration.validation.test.js backend/src/middleware/registration-rate-limit.middleware.test.js backend/src/routes/registration.http.integration.test.js backend/src/routes/client-onboarding.http.integration.test.js backend/src/services/client-applications.service.test.js backend/src/controllers/client-applications.controller.test.js backend/src/routes/client-applications.http.integration.test.js backend/src/services/auth.service.test.js backend/src/controllers/auth.controller.test.js backend/src/routes/auth.http.integration.test.js backend/src/services/session.service.test.js backend/src/services/password.service.test.js backend/src/middleware/auth.middleware.test.js backend/src/middleware/auth-permission.http.integration.test.js backend/src/services/client-portal.service.test.js backend/src/routes/client.http.integration.test.js 2>&1 | Select-String 'not ok|# tests|# pass|# fail|# skipped|error:'
  $taskTestExit = $LASTEXITCODE
} finally {
  $env:APP_ORIGIN = $taskPreviousOrigin
}
exit $taskTestExit
```

Covers registration service/controller/diagnostics/validation/rate limiting, mocked registration HTTP, onboarding, Admin approval/rejection, pending/rejected authentication restrictions, sessions/passwords, RBAC/permissions and Client ownership/isolation.

Frontend command (81 passed, 0 failed, 0 skipped; exit 0):

```powershell
node --test --test-isolation=none --test-reporter=tap src/app/components/admin/render.test.mjs src/app/api/client.test.mjs src/app/components/realClientPortal.test.mjs src/app/role-access.test.mjs 2>&1 | Select-String 'not ok|# tests|# pass|# fail|# skipped|error:'
exit $LASTEXITCODE
```

Frontend evidence consists of existing rendered/source/API contract and role-access checks. It is not an interactive registration submission or cross-role browser acceptance.

| Command/check | Actual result |
|---|---|
| npm.cmd run build | Exit 0; 2714 modules transformed; existing large-chunk and Node deprecation warnings |
| npm.cmd run check:production-demo-assets | Exit 0; 3 assets, 71 catalog occurrences, 4 compatibility occurrences, 0 unexplained findings |
| git diff --check | Exit 0; no whitespace errors; existing scanner file LF/CRLF normalization warning |
| Pure offline runtime/config/TLS helper inspection | Exit 0; validation/options pass, CA exists, no connection attempted |
| Real browser/database registration, persistence, Admin decision and quotation visibility | NOT RUN; prohibited/unavailable under current scope |

The earlier full-safe-suite results retained in the tracker are historical evidence from the prior scanner task; they were not rerun or relabeled as current full-suite results.

## 6. Git Change Summary

Starting branch: integration/dev-phase-merge. Reviewed branch, status and diffs before changes. The working tree already contained extensive tracked and untracked registration, cancellation, inventory and scanner work.

Files authored/updated by this investigation:
- docs/REGISTRATION_503_ROOT_CAUSE_INVESTIGATION_2026-11-18.md (new)
- PHASE_1_MASTER_PROGRESS_TRACKER.md (existing file updated)

Build output was regenerated under dist; dist/index.html was already dirty at entry and is not a newly authored registration fix. No existing tracked modifications or untracked files were discarded. No branch switch, reset, restore, clean, stash, commit, merge or push occurred.

## 7. Database Change Report

**No database changes or connections.** No live SQL, schema/table/column/constraint/relationship changes, records read or written, migrations, seeds, imports, fabricated stock/BOM values, credential resets or Docker operations. No application server startup. Protected Migration 007 and its checksum/history were not inspected or modified. Existing Section 24 approval artifacts remain unchanged. Reading configuration source/files and constructing TLS options offline did not instantiate the live pool.

## 8. Remaining Issues and Blockers

- Actual failed stage/category/code and running backend version/configuration remain unknown.
- Existing safe logs may be ephemeral console output; no captured runtime event was available for correlation.
- Local isolated test success cannot establish live database availability, schema compatibility or registration persistence.
- Client/Admin acceptance remains blocked: real pending application submission, Admin retrieval and approval/rejection, approved Client login/session, ownership isolation and quotation visibility need separately authorized browser/database verification.
- No claim of Phase 1 acceptance or successful real registration is made.

## 9. Exact Next Steps

1. Obtain an **already captured** safe backend event for the failed request, with event=http_request_failed and operation=auth.register, containing only event, operation, requestId, stage, category, code and statusCode. Confirm it came from the real backend, not a fixture. Correlate primary and cleanup events; do not include raw errors, SQL, secrets or submitted details.
2. If no event exists, first obtain explicit authorization for a named target environment and controlled backend startup/restart and one registration reproduction. Startup itself performs database checks; registration performs reads, advisory locking and a potential pending-application write. These actions are outside this task's authorization. Confirm the running process contains current diagnostics before reproducing.
3. The authorized operator must account for uncertain prior commit outcome before retrying; review whether the pending application already exists through approved workflow. No ad hoc SQL/account creation is authorized here.
4. Review stage/category/code, then propose the smallest evidenced application fix or specific environment/database remedy. A stage/code alone may require further approved evidence; do not infer a schema alteration from a generic code.
5. After the reviewed remedy and separate write authorization, use the existing Client Portal and Admin Portal to verify pending retrieval, approval/rejection, login and quotation visibility. Record browser and persistence evidence separately from mocked tests.

No authorization is requested for speculative database changes. No database remedy is proposed without evidence.

## 10. Handoff Status

**Blocked on runtime evidence; safe investigation and relevant isolated verification complete.** Root cause remains unresolved, no speculative fix applied. The next task is to retrieve an existing safe event, or approve precisely scoped reproduction in the designated environment. Original Phase 1 requirements and all existing work remain intact.

