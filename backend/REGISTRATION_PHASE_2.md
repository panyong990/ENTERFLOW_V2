# Client registration HTTP API (Phase 2)

`POST /api/auth/register` accepts the Phase 1 registration JSON fields. It is
available without authentication. The existing origin middleware requires the
configured `APP_ORIGIN`, `Content-Type: application/json`, and same-origin Fetch
Metadata when supplied. The existing registration service owns all validation,
identity checks, hashing, and application persistence. No login, session creation,
session cookie, approval workflow, or verification workflow is added.

Response shapes follow the existing `success`, `message`, and `data` conventions:

| HTTP status | Meaning |
| --- | --- |
| 201 | Application submitted; `data: { status: 'pending' }` |
| 400 | Service validation failure (`errors`), or invalid JSON body |
| 403 | Missing/disallowed origin or cross-origin Fetch Metadata |
| 409 | Generic identity conflict; no identifier or existing account disclosed |
| 413 | JSON body exceeds the existing Express default 100 KiB limit |
| 415 | Missing/invalid content type or unsupported body encoding/charset |
| 429 | Registration attempt budget/capacity exceeded; `Retry-After` in seconds |
| 503 | Missing origin configuration or unavailable/unexpected service failure |

Controller responses explicitly select public fields. Validation errors come
from the existing validator's safe, value-free error contract. Other service
messages and exceptions are never forwarded. Registration parser failures are
converted to safe JSON in `createApp`; unrelated endpoint parser behavior is
preserved. JSON parsing occurs before router middleware, so malformed/oversized
requests do not consume the registration attempt budget. Origin/content-type
rejections also precede that budget. All requests reaching the registration
service count, including validation failures, conflicts, and unavailable results.

## Abuse controls and deployment

Each registration limiter instance permits five attempts per Express `request.ip`
in a fixed fifteen-minute window starting at the first accepted attempt. Denied
attempts do not extend the window. The clock is injectable. Counts saturate at
five. Maps hold at most 10,000 IPs, with request-driven expired-entry sweeps every
minute and additional reclamation at capacity. At capacity new IPs receive 429
until a slot expires; existing counters are retained. No timer, external service,
cloud dependency, or login limiter change is introduced.

This local in-memory limiter is **not sufficient as a deployment-wide rate limiter
across multiple Cloud Run instances**. Counters reset on process restart and are
independent across workers/instances. Production needs a shared or edge abuse
control before broad exposure. The app currently leaves Express proxy trust
disabled; arbitrary `X-Forwarded-For` values cannot choose the counter key. Behind
a proxy, traffic may share a counter. Deployment must establish the actual trusted
proxy chain before configuring client IP handling; do not blindly trust all
forwarded headers.

The additions use standard Express/Node APIs and reuse the existing MySQL pool,
without changes to verified TLS, SQL, credentials, environment configuration, or
local Docker MySQL. They do not add filesystem credential requirements. Existing
deployment prerequisites remain: the server currently binds loopback, the database
module requires the local `.env.dev` file and CA file, and its TLS server identity
is specific to the existing local MySQL certificate. Cloud Run binding,
Secret Manager provisioning, and Cloud SQL connection/TLS configuration must be
reviewed separately before deployment. This phase does not deploy or alter those
settings, weaken TLS verification, or introduce a cloud service.

## Focused verification

Run from the repository root on Node 24. The test-only import hook substitutes
the eagerly imported database singleton with methods that throw if used. It also
sets test session timeouts. All service operations in HTTP tests are mocks; no
credentials, certificate reads, live database connections, or business writes are
needed. Do not preload this helper in production.

```powershell
node --import ./backend/test/support/mock-database.js --test backend/src/controllers/registration.controller.test.js backend/src/middleware/registration-rate-limit.middleware.test.js backend/src/routes/registration.http.integration.test.js backend/src/controllers/auth.controller.test.js backend/src/routes/auth.http.integration.test.js backend/src/middleware/login-rate-limit.middleware.test.js backend/src/middleware/origin.middleware.test.js backend/src/middleware/auth.middleware.test.js backend/src/services/registration.service.test.js backend/src/validation/registration.validation.test.js
```

The HTTP tests exercise the real `createApp` parser and router, registration
response codes, safe JSON errors, cookie absence, origin/content-type enforcement,
limiting before the service, forwarded-header spoofing resistance, and login,
logout, and `/me` behavior. Existing auth controller, HTTP, middleware, and Phase 1
mocked registration tests are included in the explicit command. Existing unrelated
parser error regression cases intentionally exercise Express's default HTML
error behavior, which may log fixture stack traces during testing.

Verification on November 15, 2026: the explicit command above passed all 127
tests, with zero failures, cancellations, or skipped tests. `git diff --check`
also passed. The first HTTP run exposed an incorrect test expectation that JSON
`null` would reach validation; Express's existing strict parser rejects it first.
The test now asserts that existing behavior. Initial direct auth regression runs
could not initialize without restricted local configuration/session timeouts;
the final isolated command removes that dependency without production changes.

## Database change report

- Tables modified by this implementation/testing: None.
- Schema changes: None.
- Data changes performed during implementation/testing: None.
- Migrations created or applied: None.
- Pending database changes requiring approval: None.

At runtime, successful registration invokes the already-approved Phase 1 service,
which inserts one pending `client_applications` record and checks identities in
`users` and `client_applications`. Phase 2 introduces no new SQL or persistence
behavior. No live database-writing tests, commits, or pushes are part of this phase.
