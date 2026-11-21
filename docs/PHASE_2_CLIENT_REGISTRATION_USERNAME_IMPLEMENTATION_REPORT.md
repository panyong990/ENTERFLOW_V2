# Client registration and email/username login implementation

Date: 2026-11-22, Asia/Singapore. **Backend implementation and focused tests complete; database activation remains pending.** No database connection, SQL extension, migration, account provisioning or target switch was performed.

## Files changed in this task

| File | Change |
| --- | --- |
| `backend/src/validation/registration.validation.js` | Requires username; preserves the existing Unicode length/email/password policy, rejects username controls and unsupported fields. |
| `backend/src/validation/login-identity.js` | Shared email trim/lowercase and username trim/case-preserving normalization. |
| `backend/src/services/registration.service.js` | Checks both identifiers against both account fields and active application fields, stores username in one pending application, retains hashing/transaction/identity-lock/cleanup behavior. |
| `backend/src/services/auth.service.js` | Email OR username lookup with two-row ambiguity detection; exact active status, generic errors/dummy verification, nullable employee username support and stored username response. |
| `backend/src/services/client-applications.service.js` | Adapts existing Admin review to P2B002 plus extensions: safe read aliases, locked active Admin recheck, Client role lookup, transactional client/account/membership/decision/audit writes, rejection without account creation. |
| `backend/src/services/identity-duplicate.js` | Classifies only known constraint names at the actual MySQL error-message suffix. Unrelated duplicates/database failures remain unavailable errors. |
| `backend/src/validation/registration.validation.test.js` | Adds username-control validation to existing field/security cases. |
| `backend/src/services/registration.service.test.js` | Updates SQL contracts and duplicate errors; covers active/rejected identity reservation, cross-field collisions, nullable employee usernames, races, hashing, rollback and cleanup. |
| `backend/src/services/auth.service.test.js` | Updates email bindings and adds username, NULL username, ambiguous-match, exact-status, generic-error and injection binding cases. |
| `backend/src/services/client-applications.service.test.js` | Models actual extension columns, explicit Client-role lookup and separate client_user membership; verifies generated relationships, role failures, audits/correlation, rejection and transaction rollback. |
| `backend/src/services/identity-duplicate.test.js` | Verifies constraint classification, qualification and protection against a key-like string embedded in a duplicate value. |
| This report | Implementation, actual test results, database report and remaining activation gate. |

Pre-existing uncommitted authentication/password/session work and `.pre-phase2.bak` files were preserved. Password-change/session services and their tests were **not edited in this task**. Their pre-existing changes still appear in Git status. Existing routes, controllers, middleware, permissions, database configuration, SQL extensions and P2B002 were retained unchanged. No commit was created.

## Implemented behavior and schema alignment

Registration accepts only companyName/contactPerson/email/username/password/optional phone. Metadata is trimmed, email lowercased, username spelling preserved, and the password passed unchanged to the existing Argon2id hasher. Username policy remains the existing well-formed Unicode, 1–100 character contract, with internal controls rejected; no unapproved ASCII-only or password-composition policy was added. Existing password policy remains 8–1024 JavaScript string code units. Password hashing parameters/verification implementation were not replaced.

The only registration INSERT targets `client_applications(company_name,contact_person,email,username,phone,password_hash,application_status)` with pending status. It does not create client/account/membership/session records. Both submitted identifiers are checked against `user_account.email/username` and `client_applications.active_email/active_username`. Generated active columns in the existing extensions reserve pending/approved applications and release rejected identities without deleting history. MySQL's declared collation supplies case/accent equality; JavaScript does not invent a different collation.

Registration acquires the existing selected-database identity advisory lock before beginning its transaction, then checks and inserts on that same connection. Approval/rejection use the same lock-name function and lock the pending application row. Lock timeouts, uncertain acquisition, failed writes, rollback failures and unsafe pool connections fail closed. Acknowledged commits survive cleanup errors; uncertain approval commits retain `DECISION_OUTCOME_UNKNOWN` rather than automatic retry. Independent per-column unique indexes do not establish cross-table/cross-column uniqueness: the application mutex is required, and every writer to this identity namespace must cooperate. Mock concurrency cases are not live MySQL isolation evidence.

**Admin authorization is established**, not assumed: `backend/src/config/permissions.js` grants Admin `clientApplications.read/approve/reject`; existing routes require Admin plus those permissions and same-origin protection. The controller uses authenticated identity, and the service rechecks the current active Admin account/role and absence of Client membership under a database row lock. No role/permission policy was expanded.

Approval resolves the actual existing `role.role_id` for Client, failing without creating anything if the role is missing/ambiguous/invalid. On one connection and transaction it creates:

1. `client`, including mandatory active status.
2. `user_account`, with the resolved role, selected username, unchanged stored Argon2id hash, active status and `must_change_password=FALSE` because this client selected its own password.
3. `client_user(client_user_id,client_id)`, using that exact account/company pair.
4. The approved application state with reviewer/time and **both** created IDs.
5. An `audit_event` containing safe IDs/status and the validated request correlation ID inside `after_value` JSON. P2B002 has no request_id audit column; no invented column is queried.

Rejection stores rejected status, reviewer/time/note and an audit event in the same transaction; created IDs remain NULL. It selects no password hash and creates no client/account/membership. Application history is retained. Existing HTTP public keys (`id`, `status`, `decidedAt`, `decidedBy`, `approvedClientId`, `rejectionReason`) remain safe aliases over the extension's actual columns. No hashes/tokens are projected in review reads or responses.

Login binds separately normalized email and username to `ua.email = ? OR ua.username = ? LIMIT 2`. Exactly one active row is required. Unknown, inactive, incorrect-password and ambiguous matches have the same invalid-credentials response; unknown/inactive/ambiguous matches use dummy password verification. Existing employees with NULL username can continue using email once the approved nullable column exists. The existing session creator/token hashing/expiry/revocation flow is unchanged. SQL errors remain service errors rather than being disguised as bad credentials.

Known email/username/company unique constraints are mapped to conflict only at the relevant insert stage. Primary-key collisions, unexpected constraints and unrelated database failures are not silently swallowed as identity conflicts. Values remain bound parameters, including injection-shaped input; no input is interpolated into SQL.

## Tests actually executed

All commands ran from the repository root with the existing fail-closed database import hook. It replaces the eager database singleton before evaluation; any accidental live access throws. Tests use explicit synthetic connection doubles and loopback HTTP servers, not database fixtures. Real Argon2id hashing/verification is exercised by focused cases; actual MySQL SQL execution, persistence and lock behavior are not claimed.

Final result: **324 passed, 0 failed, 0 skipped, 0 cancelled** across the affected validation, services, controllers and HTTP routes. No remaining test failures were observed. No frontend/browser/Playwright/build/lint/full application suite, importer, migration test or state-changing MySQL integration file was run.

Final Node command (PowerShell captured output and surfaced the exit code):

```powershell
node --import ./backend/test/support/mock-database.js --test --test-reporter=spec backend/src/validation/registration.validation.test.js backend/src/validation/client-applications.validation.test.js backend/src/services/registration.service.test.js backend/src/services/auth.service.test.js backend/src/services/client-applications.service.test.js backend/src/services/identity-duplicate.test.js backend/src/controllers/registration.controller.test.js backend/src/controllers/client-applications.controller.test.js backend/src/controllers/auth.controller.test.js backend/src/routes/registration.http.integration.test.js backend/src/routes/client-applications.http.integration.test.js backend/src/routes/auth.http.integration.test.js
```

Earlier focused development commands also executed:

```powershell
node --import ./backend/test/support/mock-database.js --test --test-reporter=dot backend/src/validation/registration.validation.test.js backend/src/services/registration.service.test.js backend/src/services/auth.service.test.js backend/src/services/client-applications.service.test.js
```

That first run reported **4 failures**, caused by stale multiline SQL/active-column lookup expectations and request-ID audit-payload expectations. The dot reporter did not emit numerical pass/skip summaries. Those assertions were corrected to the actual schema and preserved correlation contract; no database repair occurred.

```powershell
node --import ./backend/test/support/mock-database.js --test --test-reporter=spec backend/src/validation/registration.validation.test.js backend/src/services/registration.service.test.js backend/src/services/auth.service.test.js backend/src/services/client-applications.service.test.js
```

Result: **154 passed, 0 failed, 0 skipped**.

```powershell
node --import ./backend/test/support/mock-database.js --test --test-reporter=spec backend/src/validation/registration.validation.test.js backend/src/services/registration.service.test.js backend/src/services/auth.service.test.js backend/src/services/client-applications.service.test.js backend/src/services/identity-duplicate.test.js
```

Result after added targeted cases: **165 passed, 0 failed, 0 skipped**. The final 324-case command additionally includes the nullable-username registration case and affected HTTP/controller checks. Counts from repeated runs must not be added together as distinct coverage.

## Database Change Report

- **Source structures reviewed:** P2B002 `role`, `user_account`, `client`, `client_user`, `audit_event`; additive `user_sessions`, `client_applications`, account/application username and active-identity columns in existing extensions 001/002/003; the existing physical ERD/dictionary/audit context. No completed database audit was rerun.
- **Schema changes authored/performed:** none. Existing SQL extension definitions and bootstrap remain unchanged.
- **Migrations/extensions executed:** zero. No migration framework/status/history command was invoked or bypassed.
- **Database connections/queries/writes:** zero in this task. SQL strings exercised against test doubles are not actual database execution.
- **Temporary database records:** none. Test state was in memory only; loopback test servers are closed by test cleanup. Database cleanup was unnecessary and not attempted.
- **Existing accounts and fixtures:** not read, reset, seeded, modified or deleted. Database target/environment configuration and protected backups were untouched.
- **Protected items:** Migration 007/008 and protected history, Task 002, shared databases, Q01/Q02 and P2B002 were untouched. No commits, credentials, Docker operations or application target switches.

## Remaining work and deployment gate

The brief explicitly states that 002_client_registration.sql and 003_username_support.sql are unapplied. They were **not executed** here. This code requires both reviewed extensions (and the existing session extension for runtime auth); do not activate it against a schema missing their table/columns. Any extension application remains a separate explicit operator approval/action. No alternative username extension was run.

After schema activation is separately approved, genuine authenticated API-to-MySQL persistence/read-back and concurrent registration/approval acceptance remain unverified. The runtime must have the actual Client role and authorized Admin account; the service looks them up and never fabricates them. Their live existence was not inspected here. All account-creation/identity-edit writers must use the shared identity protocol for a global cross-field guarantee. There is no newly invented approval-role decision: existing Admin authorization was retained.

Registration, dual-identifier login and transactional approval/rejection are implemented and covered at the focused test level. This is not a claim of live deployment or completed database activation. No next task was started.
