# Client application review — Phase 3 HTTP integration

Implemented the Admin HTTP layer using the completed Phase 2 validation/service
factories. No Phase 2 business logic, RBAC matrix, existing authentication module,
database configuration, schema, migrations, records, frontend, or dependencies
were changed. No commit, push, deployment, OTP, or email notification work.

## Files created or modified

Created:

- `backend/src/controllers/client-applications.controller.js`
- `backend/src/controllers/client-applications.controller.test.js`
- `backend/src/routes/client-applications.routes.js`
- `backend/src/routes/client-applications.http.integration.test.js`
- `backend/src/middleware/client-applications-error.middleware.js`
- `backend/CLIENT_APPLICATIONS_PHASE_3.md`
- `backend/test/CLIENT_APPLICATIONS_PHASE_3_TEST_RESULTS.tap`

Modified:

- `backend/src/app.js`

Earlier uncommitted work remains present. These are the changes attributable to
this phase; the pre-existing dirty working tree was not reset or committed.

## Endpoints and authorization

| Method and path | Permission | Successful response |
| --- | --- | --- |
| GET /api/client-applications | clientApplications:read | 200, public pending applications and nextCursor |
| GET /api/client-applications/:id | clientApplications:read | 200, public application details |
| POST /api/client-applications/:id/approve | clientApplications:approve | 200, applicationId/status/clientId/userId |
| POST /api/client-applications/:id/reject | clientApplications:reject | 200, applicationId/status |

The router uses the existing authentication factory, explicit
`createRoleMiddleware(['admin'])`, and the exact action permission. These are
separate checks: granting a permission to another role cannot bypass the Admin
role gate. All eight other defined roles, including Owner, receive 403. Missing,
malformed, duplicate, unknown, inactive, expired, and failed-activity sessions are
denied before review services are invoked.

POST decisions additionally run the existing same-origin middleware, which
requires exact configured APP_ORIGIN, application/json content type, and
same-origin Fetch Metadata when supplied. GET requests do not require a JSON
body, JSON Content-Type, or Origin header.

Every namespace response has `Cache-Control: no-store`; review responses do not
set or clear authentication cookies. Unknown namespace endpoints return safe
JSON 404 after authentication/role checks. There is no manual company/account
creation or role-assignment endpoint.

## Dependency injection and controller behavior

`createClientApplicationsRouter` accepts `service`, `validateSessionService`,
`updateSessionActivityService`, `permissionChecker`, and `appOrigin`. Defaults
wire the real Phase 2 service to the existing pool and session services.
Creating the router/service does not itself execute SQL.

`createApp` accepts `applicationReviewRoutes` in addition to its existing
authenticationRoutes parameter. Tests inject mocked services/sessions through
the real router and app; production defaults use the actual implementations.

`createClientApplicationsController({ service })` requires the four existing
service methods. It validates HTTP inputs with the Phase 2 validators and calls
the corresponding service exactly once. No conflict, account creation,
transaction, audit, or concurrency logic was duplicated.

The actor is an immutable projection of authenticated `request.auth` containing
userId, roleCode, and accountType. The controller also fails closed on missing or
invalid/non-Admin actor context. It never uses actor IDs supplied through JSON,
query strings, or headers. Session IDs/tokens are not forwarded to review services.
Phase 2's active-Admin database recheck and actor snapshot remain intact.

List queries retain the existing limit/cursor/status validation and precise
BIGINT string IDs. Non-list operations allow no query overrides. Approval accepts
only `{}`; rejection accepts only a validated, trimmed reason. Unknown fields,
actor overrides, company/account overrides, oversized reasons, and invalid IDs
are rejected before a review service call.

Controller success responses use explicit public projections, preserving only
the approved application fields or decision IDs/status. Even extra credential
properties accidentally returned by a mocked service are excluded. List cursors
are validated against the existing cursor contract; malformed/mismatched service
results fail closed. Service error messages, raw error fields, exception objects,
hashes, and tokens are never forwarded. Validation errors generated locally by
the existing validators remain available as safe field messages.

## Response and parser contracts

| HTTP status | Meaning |
| --- | --- |
| 200 | Successful read or committed approval/rejection |
| 400 | Invalid request data, identifier, pagination, JSON, or empty POST JSON payload |
| 401 | Missing/invalid authentication or corresponding service result |
| 403 | Wrong role/permission, current Admin denied, disallowed origin/Fetch Metadata |
| 404 | Missing application or unsupported namespace endpoint |
| 409 | Already decided, company conflict, or identity conflict |
| 413 | JSON exceeds the existing Express default 100 KiB body limit |
| 415 | Invalid/missing POST content type or unsupported encoding/charset |
| 503 | Infrastructure/unexpected failure or unknown commit outcome |

`DECISION_OUTCOME_UNKNOWN` returns 503 with a fixed public code and message:

```json
{
  "success": false,
  "message": "Decision outcome could not be confirmed. Refresh the application before retrying.",
  "code": "DECISION_OUTCOME_UNKNOWN"
}
```

No write retry, follow-up decision call, or Retry-After hint is introduced for an
unknown commit. The Admin must refresh details before another decision attempt.

The new namespace has its own Express JSON parser and scoped error handler,
mounted before the legacy global parser. This preserves unrelated auth/parser
behavior. Malformed/oversized/unsupported bodies receive fixed safe JSON errors.
Parser failures can occur before authentication, but never reach a review service
or disclose application data; valid requests still require all authorization
checks.

An initial test exposed Express's conversion of an empty JSON payload into `{}`.
For a strict explicit-object approval contract, that could accidentally permit a
bodyless approval. The namespace parser now rejects zero-byte POST JSON in its
verify hook, including empty chunked bodies. GET parsing does not gain this POST
body requirement. A truly explicit `{}` remains valid for approval.

## Executed tests

Final combined run: **417 passed, zero failed, zero skipped**. This consists of
107 new controller/HTTP cases plus the 310-test Phase 2 and existing regression
selection. TAP evidence: `backend/test/CLIENT_APPLICATIONS_PHASE_3_TEST_RESULTS.tap`.

The new tests exercise the actual app, parser, router, role/permission/auth
middleware, and controller using mocked service/session dependencies. Coverage:

- All four successful Admin actions and credential-free public projections.
- GET behavior without JSON headers/body; bounded pagination and large-ID cursors.
- All non-Admin role denials and independent exact permission checks.
- Missing/malformed/unknown/duplicate cookies and invalid session/activity state.
- Missing IDs, missing applications, unsupported actions, and already-decided,
  company, identity, active-Admin, and infrastructure service failures.
- Strict inputs, actor spoofing through body/query/headers, reason bounds, and
  controller-level service dependency/exception handling.
- Origin/content-type/Fetch Metadata enforcement, malformed/oversized JSON,
  unsupported charset/encoding, explicit empty-body and empty-chunked rejection.
- Unknown-commit code/message with no retry hint and only one service invocation.
- No auth cookie, token, password-hash, SQL-error, or stack exposure.
- Cache-control and namespace scoping, including case-insensitive/trailing-slash
  parser handling.

The existing login/logout/me, registration, sessions, password hashing, RBAC,
permission/role middleware, transactional review-service, validation, and TLS
fixture tests all passed in the same run. In particular, the existing tests for
unrelated authentication parser behavior continued to pass.

Command executed from the repository root:

```powershell
node --import ./backend/test/support/mock-database.js --test --test-reporter=tap backend/src/controllers/client-applications.controller.test.js backend/src/routes/client-applications.http.integration.test.js backend/src/validation/client-applications.validation.test.js backend/src/services/client-applications.service.test.js backend/src/controllers/registration.controller.test.js backend/src/middleware/registration-rate-limit.middleware.test.js backend/src/routes/registration.http.integration.test.js backend/src/controllers/auth.controller.test.js backend/src/routes/auth.http.integration.test.js backend/src/middleware/login-rate-limit.middleware.test.js backend/src/middleware/origin.middleware.test.js backend/src/middleware/auth.middleware.test.js backend/src/services/registration.service.test.js backend/src/validation/registration.validation.test.js backend/src/services/auth.service.test.js backend/src/services/session.service.test.js backend/src/services/password.service.test.js backend/src/middleware/role.middleware.test.js backend/src/middleware/permission.middleware.test.js backend/src/middleware/permission.http.integration.test.js backend/src/middleware/auth-permission.http.integration.test.js backend/src/config/permissions.test.js backend/src/config/database-tls.test.js backend/test/database-tls.fixture.test.js
```

The existing database import guard blocks default live SQL; review HTTP services
are mocks. No development credentials were loaded by this test command and no
business-record writes ran. Temporary HTTP listeners were closed and existing
synthetic TLS test files were cleaned up. Syntax and git diff whitespace checks
passed. No unrestricted node --test or live MySQL write harness was run.

## Security and cloud assessment

Authorization uses the existing database-backed session flow in default wiring,
an explicit Admin role, resource/action permissions, and the unchanged Phase 2
active-Admin transaction check. Manual client creation permissions remain absent.
Safe request/response boundaries preserve password confidentiality and audit
actor integrity. Parameterized SQL, advisory locking, transaction rollback,
audit atomicity, and unknown-commit semantics remain in the unchanged service.

The HTTP layer adds no cloud dependency, local endpoint assumption, credential
file, environment setting, or TLS bypass. It uses the existing environment-
configured pool, verified database TLS, and standard Express/Node APIs. Cloud Run,
Cloud SQL, and Secret Manager deployment prerequisites from earlier reviews
remain separate; no cloud deployment or resource configuration was performed.

Real MySQL persistence, audit contents, and races for these newly mounted review
endpoints are intentionally deferred to separately approved isolated integration
testing. Passing mocked HTTP tests does not establish that future integration
result or production deployment readiness.

## Database change report

- Tables affected or modified: None.
- Schema changes: None.
- Data changes: None.
- Migrations created, edited, or applied: None.
- Pending database changes requiring approval: None.

At runtime the mounted POST endpoints delegate to the previously approved
transactional services. This phase did not invoke them against development data.
Stopped after Phase 3; isolated MySQL integration awaits explicit approval.
