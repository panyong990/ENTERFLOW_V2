# Client registration final verification — Phase 4

Reviewed November 15, 2026, Asia/Manila. No implementation files, shared
configuration, database records/schema, migrations, frontend files, dependency
versions, or cloud resources were changed. No commit, push, or deployment.

**Verdict:** The approved registration implementation passes verification. The
current loaded local environment is **not yet ready for a plain server start**:
three required origin/session settings are missing. With temporary process-only
settings, the real application initializes and its non-writing HTTP checks pass.
Production deployment is not ready and was not attempted.

## Current configuration blocker

A read-only probe loaded the actual `backend/src/config/database.js`, then tried
to import the real application without supplying test configuration. It found:

| Check | Current loaded environment |
| --- | --- |
| APP_ORIGIN configured | No |
| SESSION_IDLE_TIMEOUT_MINUTES valid | No |
| SESSION_ABSOLUTE_TIMEOUT_HOURS valid | No |
| Application initializes | No: Invalid session timeout configuration |

`session.service.js` validates timeout settings when its default service is
created, so the missing values prevent application initialization. After those
are supplied, the absent `APP_ORIGIN` would still make registration/login origin
middleware return 503. Existing mocked tests intentionally provide their own
timeouts/origin; their passing results cannot establish actual startup readiness.

This probe describes the environment loaded by the verification process; a
separate developer shell may supply its own variables. No environment file or
shared setting was edited. The proposed next action is to configure these three
settings with approved origin/timeout values in the intended startup environment.
That action remains unimplemented pending approval; it requires no database
change. Evidence: `PHASE_4_READINESS_RESULTS.json`.

## Functionality assessment

| Required behavior | Current implementation and evidence |
| --- | --- |
| POST /api/auth/register through existing layers | Existing router invokes registration controller and existing service; HTTP regressions pass; prior real MySQL HTTP evidence retained |
| Unauthenticated access | No authentication middleware on register; origin/content-type security still required |
| Approved input validation | Only companyName/contactPerson/email/username/password/optional phone; unknown fields/accessors/non-plain objects rejected; fixed value-free validation errors |
| Field bounds and normalization | Company 200, contact 160, email 254, username 100 Unicode characters; email also bounded to login's code-unit limit and lowercased; metadata trimmed; phone optional/null and at most 40 characters |
| Password storage | Argon2id, memory 19456 KiB, time cost 2, parallelism 1; password 8-1024 JavaScript code units, preserved without trimming |
| Persistence scope | The service contains one INSERT, into client_applications with literal pending status; no INSERT into clients/users/user_sessions |
| No automatic authentication | Registration controller has no session/cookie calls; tests assert no Set-Cookie; it exposes only pending status and a fixed success message |
| Duplicate/cross-field conflicts | Checks both submitted identifiers against both columns in users and pending/approved applications, using MySQL equality/collation; fixed safe 409; rejected identifiers can be reused |
| Concurrent requests | Database-specific connection-scoped GET_LOCK acquired before transaction/identity reads; same-primary registration writers serialize and recheck before INSERT |
| Login/logout/me | Existing cookie/session flows and authorization tests pass; no auth implementation changes in this review |

The real MySQL evidence also verifies pending persistence, no plaintext password,
no registration-created account/session, case/accent-insensitive comparisons,
three kinds of concurrent duplicates, actual lock contention, SQL permission
failure, forced disconnects, and real authentication persistence.

## Tests actually executed in Phase 4

| Run | Actual result |
| --- | --- |
| Explicit unit/HTTP/auth/authorization/password/session/registration/TLS paths below | 236 passed, 0 failed, 0 skipped |
| Existing actual backend read-only MySQL TLS harness | 6 passed, 0 failed |
| Actual application initialization with current loaded settings | Failed because session timeout configuration is missing; APP_ORIGIN also absent |
| Actual application with temporary process-only settings and blocked DB calls | 4 HTTP checks passed; initializes; 0 database calls |
| Existing 51-check isolated MySQL registration run | Evidence reused and checksum-checked; NOT rerun in Phase 4 |

The 236-test command was:

```powershell
node --import ./backend/test/support/mock-database.js --test --test-reporter=tap backend/src/controllers/registration.controller.test.js backend/src/middleware/registration-rate-limit.middleware.test.js backend/src/routes/registration.http.integration.test.js backend/src/controllers/auth.controller.test.js backend/src/routes/auth.http.integration.test.js backend/src/middleware/login-rate-limit.middleware.test.js backend/src/middleware/origin.middleware.test.js backend/src/middleware/auth.middleware.test.js backend/src/services/registration.service.test.js backend/src/validation/registration.validation.test.js backend/src/services/auth.service.test.js backend/src/services/session.service.test.js backend/src/services/password.service.test.js backend/src/middleware/role.middleware.test.js backend/src/middleware/permission.middleware.test.js backend/src/middleware/permission.http.integration.test.js backend/src/middleware/auth-permission.http.integration.test.js backend/src/config/permissions.test.js backend/src/config/database-tls.test.js backend/test/database-tls.fixture.test.js
```

Output is retained in `PHASE_4_TEST_RESULTS.tap`. The test-only database guard
prevents live SQL in the mocked auth/registration/authorization tests. TLS fixture
tests exercise the real mysql2 handshake against an ephemeral synthetic protocol
server without a database. They accept a matching trusted SAN and reject a wrong
identity, wrong CA, expired trusted certificate, and malformed trust material;
rejections occur before credential-bearing authentication packets reach the
fixture. Temporary test keys/certificates were cleaned up.

The existing TLS command was:

```powershell
node backend/test/database-tls.mysql.integration.mjs --read-only-existing
```

It checked actual local MySQL 8.4.13 connectivity, strict chain/identity flags,
wrong-identity rejection, wrong-CA rejection, a trusted CA via an alternate path,
explicit matching identity, and pooled reconnects. TLSv1.3 was negotiated with
`TLS_AES_256_GCM_SHA384`. Only SELECT/SHOW statements ran. The existing
`DATABASE_TLS_RESULTS.json` was refreshed by this harness; its temporary public
CA copies were removed.

The additional actual-app smoke probe supplied APP_ORIGIN and both timeout values
only inside its short-lived process, then imported the real application. All pool
query/execute/acquisition methods were blocked with counters. It listened on a
temporary loopback port and confirmed:

- GET /api/auth/me without a cookie: 401 JSON.
- POST /api/auth/register with missing fields: 400 JSON, no authentication cookie.
- POST /api/auth/login with missing credentials: 401 JSON.
- POST /api/auth/logout without a session: 200 JSON.

Zero database calls occurred. The temporary listener was closed. This confirms
startup and safe routing after supplying configuration; it does not claim a new
real-MySQL successful registration in this phase. The process-only timeout/origin
values were test settings, not a permanent policy decision. Evidence:
`PHASE_4_LOCAL_SMOKE_RESULTS.json`.

## Reused isolated MySQL evidence

`REGISTRATION_MYSQL_RESULTS.json` records 51 passing checks and zero failures from
the prior isolated tmpfs MySQL 8.4.13 run. Current migrations/reference seed match
its recorded checksums. Of its recorded implementation files, only
`backend/src/config/database.js` differs, as expected after Phase 3.5 TLS
hardening. Registration validation, controller, route, service, password logic,
origin/rate-limit middleware, and auth/session implementations still match those
recorded hashes. The newer TLS helper is covered by current tests.

The prior report records temporary-container cleanup and preservation of existing
Docker resources. No Docker container/database was recreated for this review.
The historical TLS finding in that JSON is superseded by the inspected Phase 3.5
implementation and the TLS tests rerun now; the historical artifact was not
rewritten. No unexecuted integration result is counted as a newly passing test.

## Security review findings and limitations

No newly confirmed SQL-injection, mass-assignment, password-disclosure, cookie
creation, or authentication-bypass defect was found in the approved registration
path. This conclusion is scoped to the reviewed source and tests, not a claim
that the complete application has no vulnerabilities.

**Verified protections:** strict field allowlist, parameterized SQL values,
Argon2id hashing, fixed confidential response shapes, no registration auth state,
exact configured Origin check, JSON content type, Fetch Metadata rejection,
independent five-attempt/fifteen-minute IP budget, bounded registration limiter
memory with expiry cleanup, transaction rollback, lock release, destruction of
uncertain connections, and strict TLS chain/server identity validation.

**Open configuration issue:** the missing three local startup settings above
block an unconditional local-ready verdict. No changes were made to resolve it.

**Deployment abuse controls:** registration counters live in process memory,
reset on restart, and are not shared across instances. Origin checks help browser
request boundaries; arbitrary API clients can supply an Origin header, so that
check is not an authentication or bot-control mechanism. JSON parsing runs
before the route limiter, so malformed/oversized requests are rejected but do not
consume its budget. Shared/edge throttling and request/concurrency limits remain
production work.

**Concurrency boundary:** MySQL advisory locking protects cooperating writers on
one primary server. Migration 007 enforces pending email and pending username
uniqueness separately; it does not enforce cross-field/cross-table uniqueness.
Future account/review writers must use the same identity lock protocol. The
database-wide registration lock deliberately trades throughput for consistent
collation-aware identity decisions. Current integration evidence covers that
protocol, not arbitrary external writers or a multi-writer database topology.

**Existing auth error-handling limits:** registration parser errors are safe JSON.
Existing unrelated login/logout parser failures retain Express's default HTML
error behavior, explicitly covered by regressions; development-mode output can
include diagnostic stacks. The auth middleware also logs raw exception messages
to the server console. Production NODE_ENV and sanitized logging/error handling
need review before public exposure. No raw exception is returned by the
registration controller/service.

**Identity disclosure tradeoff:** 409 intentionally reveals that some submitted
identity conflicts, while avoiding disclosure of which field/account/application
matched. Email ownership verification and application decisions remain explicitly
outside this approved feature.

## Cloud-readiness assessment

| Area | Status |
| --- | --- |
| Express/Cloud Run | Express is compatible, but server.js binds 127.0.0.1. Cloud Run requires listening on 0.0.0.0 at PORT; current entry point is a deployment blocker |
| Cloud SQL | MySQL-compatible SQL and a strict direct-TCP TLS transport are present. Actual Cloud SQL connectivity, CA hierarchy, expected identity, network/IAM, client-certificate requirements, and connection budgeting are not deployed/tested |
| Secret Manager | Environment-variable credentials and mounted environment-specific CA paths can be supplied by deployment-managed secrets. No Secret Manager bindings, service identity, or access policy was provisioned/verified |
| Production environment | Required DB settings fail closed; complete externally supplied DB settings can work without a local dotenv file. Set APP_ORIGIN, session timeouts, NODE_ENV=production, and the correct cloud CA/server identity. Secure session cookies specifically depend on NODE_ENV=production |
| Trusted proxy | Express trust proxy remains disabled, preventing arbitrary forwarding headers from choosing the IP on direct local requests. Behind a proxy, clients may share a counter; configure the actual trusted chain before enabling proxy-derived IPs |
| Deployment-wide rate limiting | Not implemented; local memory counters do not coordinate across Cloud Run instances |
| TLS | Chain and matching-identity checks pass locally; wrong CA/identity/expiry rejected. Production never automatically uses the Docker CN, but its actual Cloud SQL identity/CA mode still needs validation |

Official references checked for this assessment:

- [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract)
- [Express trusted-proxy configuration](https://expressjs.com/en/guide/behind-proxies/)
- [Cloud Run Secret Manager integration](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- [Cloud SQL TLS/certificate configuration](https://docs.cloud.google.com/sql/docs/mysql/configure-ssl-instance)

Production needs a separately approved deployment/configuration pass. No cloud
resource was changed, no configuration was silently loosened, and no dependency
or infrastructure service was introduced.

## Artifacts and database change report

Created only verification artifacts in Phase 4:

- `backend/test/PHASE_4_TEST_RESULTS.tap`
- `backend/test/PHASE_4_READINESS_RESULTS.json`
- `backend/test/PHASE_4_LOCAL_SMOKE_RESULTS.json`
- `backend/test/REGISTRATION_PHASE_4_REPORT.md`

The existing TLS runner refreshed `backend/test/DATABASE_TLS_RESULTS.json`.
`git diff --check` passed. Earlier uncommitted work was preserved.

- Tables affected or modified: None.
- Schema changes: None.
- Data changes: None, including development business records and reference data.
- Migrations created, edited, or applied: None.
- Pending database changes requiring approval: None.
- Temporary SQL-writing test databases: None created or used in this phase.
- Database access: Read-only TLS/connectivity metadata checks only.

Registration code verification is complete. Local startup configuration and
production readiness remain separate outstanding work. Stopped after reporting;
no next backend feature, approval/rejection flow, or OTP/email flow was started.
