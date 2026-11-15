# Admin client application review — Phase 4 integration results

Executed November 15, 2026, Asia/Manila. Final real MySQL run:
**51 checks passed, zero failed**. The current focused regression selection also
ran successfully: **417 passed, zero failed, zero skipped**.

No application defect requiring a source fix was found. Only new test
infrastructure, test code, and evidence files were created. All existing backend
JavaScript source/test files and migrations/seeds matched before/after checksums.
No frontend, environment configuration, dependency, implementation, or cloud
resource changes; no commit, push, or deployment.

## Test environment and isolation

| Property | Final run |
| --- | --- |
| MySQL version | 8.4.13 |
| Pinned image | `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902` |
| Run ID | `3cd161072ea5f41d` |
| Container | `enterflow-review-p4-3cd161072ea5f41d` |
| Container ID | `844711b2b3fb87a2ba7b35c7beef323c56ef1c7cf237f4d6bf06dbfbefe01527` |
| Database | `enterflow_review_p4_3cd161072ea5f41d` |
| Temporary endpoint | `127.0.0.1:61864` |
| Server UUID | `ad397820-e0aa-11f1-ba1d-76c9197cec78` |
| Storage | Dedicated tmpfs at `/var/lib/mysql`; no named volume/bind mount |
| TLS | TLSv1.3 / TLS_AES_256_GCM_SHA384 |
| Migration setup | Existing unmodified 001-007 and reference seed through migration-core.mjs |

The reusable helper follows the established registration Docker harness:
local Docker context, installed digest-pinned image, unique name/ownership label,
CPU/memory bounds, random loopback port, strict ownership checks, and tmpfs-only
storage. Existing ports 3306-3309 are excluded from the test endpoint.

Before initial writes, it verifies the container ID/name/label/image, absence of
shared mounts, endpoint, MySQL version, selected database, and server UUID. It
reuses the hardened createDatabaseTlsOptions implementation, always requiring
CA-chain and named server-identity verification, and checks the peer fingerprint
against the certificate obtained from the owned container. Each runtime pool
acquisition verifies the selected database, server UUID/version, TLS authorization,
and strict flags before returning a connection. Native strict TLS session
resumption remains enabled.

The runtime SQL account has schema-scoped SELECT/INSERT/UPDATE and REQUIRE SSL,
with no DDL grants. Separate temporary accounts selectively lack the company,
user, decision-update, or audit-insert privilege for real SQL failure tests. Root
is used only as isolated test control for setup, fixtures, observation, and KILL.
No runtime/development account or grant outside the temporary server was changed.
Passwords remain generated in memory; no credentials/private keys/tokens are
written to reports or printed.

## What actually ran

The exact individually named check list is in
`CLIENT_APPLICATIONS_MYSQL_RESULTS.json`; the executable test is
`client-applications.mysql.integration.mjs`.

All application validation, review/registration services, controllers, routes,
permissions, authentication/session middleware, Argon2id, and MySQL operations
are real. Default unused database singletons are blocked by the existing test
import guard. Real verified pools are injected into all exercised factories.
There are no mocked service results or fabricated SQL results.

Fault scheduling uses thin wrappers around real connections. Native privilege
errors and KILL CONNECTION operations cause actual failures/rollbacks. To model
a lost acknowledgement after a real commit, a wrapper awaits the actual COMMIT,
disconnects that connection, then throws before the service receives success.
This is an acknowledgement fault injected at the service/driver boundary, not a
claim that a TCP packet-drop proxy was deployed.

| Coverage | Actual result |
| --- | --- |
| Real Admin authentication | HTTP login creates a real persisted session used for review requests |
| Pending list/details | Admin GETs succeed; real cursor pagination works; explicit public fields exclude credentials |
| Approval persistence | Exactly one company and one associated user; fixed client role/account type; correct company/contact/login values |
| Password handling | Existing real Argon2id hash reused byte-for-byte; verifies against the synthetic password |
| Decision metadata | Approved status, approved_client_id, deciding Admin, and timestamp persisted |
| Audit | Exactly one safe decision event; actor, subject, action, IDs, UUID request ID, and reason verified |
| No automatic login | Approval returns no Set-Cookie and creates no session; only existing Admin activity is refreshed by auth middleware |
| Approved-client login | Separate real login succeeds, creates a hashed-token session; me works; logout revokes it; revoked session rejected |
| Rejection | Trimmed reason, rejected status, actor/time and audit saved atomically; no company/user/session created |
| Repeated decisions | Approval/rejection repeats return 409 without duplicate accounts/audits |
| Rejected identifier reuse | Registration HTTP creates a fresh pending application using rejected identifiers |
| Existing company | 409 with no merge, attachment, modification, audit, or partial records |
| Identity conflicts | All four user-column/application-column combinations; pending cross-field conflicts; approved application same-field conflicts |
| Collation | Actual MySQL case/accent-insensitive company and login identity comparisons |
| Each approval write stage | Real SQL privilege failures at clients INSERT, users INSERT, application UPDATE, audit INSERT; complete rollback |
| Rejection write failures | Real decision UPDATE and audit INSERT failures roll back atomically |
| Concurrent decisions | approve/approve, approve/reject, reject/reject: one 200, one 409; exactly one audited decision |
| Registration races | Both registration-first and review-first lock ordering tested for approval and rejection |
| Lock timeout | Real held advisory lock produces safe 503, preserves original holder, then recovers after release |
| Connection cleanup | Real disconnect after lock acquisition leaves no decision or leaked lock |
| Rollback disconnect | Disconnect during rollback of an actual audit permission failure leaves no partial records |
| Unknown commits | Both actions tested before/after real COMMIT; safe 503 DECISION_OUTCOME_UNKNOWN, refresh warning, no retry hint, correct persisted state |
| Acknowledged commit cleanup | Disconnect during lock cleanup preserves successful approval and single audit |
| Unauthenticated requests | All four endpoints return 401 without business changes |
| Non-Admin roles | Owner, Sales, Operations, Production, Warehouse, Logistics, Accounting, Client each receive 403 on all four endpoints |
| Actor integrity | Body/query actor overrides rejected; forged actor headers cannot change decided_by/audit actor |
| Admin role race | Admin demoted after authentication is denied by the actual transactional recheck |
| Session expiry | Real expired persisted Admin session rejected |
| HTTP/request security | Invalid reasons, mass assignment, wrong origin/type, malformed/empty/oversized JSON, invalid IDs/pagination, arbitrary-creation paths safely rejected |
| Final database invariants | No orphan company/client account; no partial decision; exactly one audit per decided application; schema unchanged after migrations |

The concurrency checks use two independent Express app/service instances with
separate real pools in one Node process, sharing only the MySQL primary. They
prove database-connection coordination without a process-local decision lock;
they are not a deployed multi-container Cloud Run test.

Registration-race outcomes were deterministic under observed lock ordering:
approval always excludes a competing registration (409); registration before
rejection sees pending and returns 409; registration after rejection commits
successfully with 201. The rejected original and fresh pending application remain
separate records. No rejection or registration creates a company/login account.

Snapshots include all four business tables before/after failed actions. Existing
Admin-session activity updates are expected authentication behavior; tests
separately check that decision operations do not create sessions. The final
synthetic database contained 14 clients, 30 users, 54 applications, 16 audit
events, and 12 sessions, all removed with the temporary environment. These counts
include direct synthetic role/conflict fixtures and explicit login/session tests;
they are not all attributed to approval. There were 16 decided applications and
exactly one audit for each, with none for pending applications.

## Initial harness issues and final result

The first run recorded 49 passing checks and two setup failures. Both failures
were attempts to seed same-column duplicate pending applications; migration 007
correctly rejects those rows before the approval API can be exercised. The
corrected tests first approve the existing application via the real API, then
test the conflict against a new pending application. Pending cross-field
fixtures remain independently covered.

The first run also revealed a test-loader ordering issue: static imports
initialized the unused local database configuration before the import guard.
All exercised service factories were nevertheless explicitly wired to verified
isolated pools, so no development database SQL was executed. The retained initial
report is annotated to record that local configuration was loaded. The harness
now dynamically imports DB-owning modules after guard initialization and asserts
that the unused default pool is the blocking stub. The final fresh run loaded no
development credentials and reports unusedDefaultPoolBlocked=true.

These were test-harness/fixture corrections only. No existing application code
was modified. Both runs' temporary environments were removed; initial evidence
is retained in `CLIENT_APPLICATIONS_MYSQL_RESULTS.initial.json`. The corrected
complete run passed all 51 checks with zero failures.

## Regression and security assessment

The existing explicit selection was rerun after integration:
**417 passed, 0 failed, 0 skipped**. It includes the full review-service/controller/
HTTP suite, registration, login/logout/me, sessions, password hashing, RBAC,
authorization, origin/rate-limit middleware, and TLS fixtures. Evidence is in
`CLIENT_APPLICATIONS_PHASE_4_REGRESSIONS.tap`. No unrestricted node --test ran.

No new application vulnerability or required implementation fix was identified.
Tests confirmed Admin-only boundaries, server-side actor attribution, strict
allowlists, password/hash confidentiality, parameterized database comparisons,
atomic audit/decision writes, no arbitrary account-creation API, safe parser/
conflict/infrastructure errors, and unknown-commit refresh semantics. Tests did
not print actual credentials, hashes, tokens, SQL error bodies, or private keys.
The TLS regression fixtures cover trusted/matching acceptance and wrong identity,
wrong CA, expired certificate, and malformed trust rejection.

Remaining boundaries: identity coordination requires cooperating writers on one
MySQL primary; unknown commit results require an explicit refresh rather than
automatic retry. Production-wide throttling and deployment configuration work
identified earlier remains separate. This phase does not certify all application
security or production deployment readiness.

## Cleanup and preservation

Both containers were uniquely owned and verified before removal. Removing each
owned container removed its tmpfs database and temporary SQL accounts. No named
volume was created, reset, or deleted. All HTTP listeners and pools were closed.

Before/after snapshots matched every pre-existing container ID, state/start time,
image, port binding, mount, and volume name. A separate final read-only Docker
inventory independently confirmed only the original three containers/volumes:

- enterflow-migrations-workflow-test on 3309.
- enterflow-mysql-dev on 3308 with enterflow-mysql-dev-data.
- enterflow-mysql84-validation on 3307.

All backend/src JavaScript raw hashes and migration/seed raw/normalized checksums
matched before/after. Application table definitions matched after fixtures/tests,
ignoring expected auto-increment counter movement. Syntax checks and
git diff --check passed. Earlier uncommitted work was preserved.

## Files created and reproduction

- `backend/test/support/isolated-mysql.js`
- `backend/test/client-applications.mysql.integration.mjs`
- `backend/test/CLIENT_APPLICATIONS_MYSQL_RESULTS.json`
- `backend/test/CLIENT_APPLICATIONS_MYSQL_RESULTS.initial.json`
- `backend/test/CLIENT_APPLICATIONS_PHASE_4_REGRESSIONS.tap`
- `backend/test/CLIENT_APPLICATIONS_PHASE_4_REPORT.md`

No existing application file was edited. The helper adapts the existing
registration Docker workflow and reuses migration-core, the hardened TLS helper,
and existing service/router factories; no new package dependency was added.

Explicit integration command from the repository root:

```powershell
$env:DOCKER_EXE = 'C:\Users\Stephanie\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
node backend/test/client-applications.mysql.integration.mjs --isolated-docker
```

The 417-test regression command is the explicit Phase 3 selection documented in
`backend/CLIENT_APPLICATIONS_PHASE_3.md`, using the existing mock-database import
guard and individual test paths. That guard blocks live SQL during regressions.

## Cloud compatibility

Runtime code, verified TLS, environment configuration, and dependency versions
are unchanged. No Google Cloud resource, Secret Manager secret/binding, or Cloud
SQL configuration was accessed or provisioned. Local Docker/named-pipe details
exist only in test infrastructure and do not become production defaults.

The native MySQL transaction/advisory-lock protocol worked across independent
app/pool instances on one primary. Actual Cloud Run binding/proxy/instance limits,
deployment-wide rate limits, Cloud SQL networking/CA/identity/client-certificate
mode, Secret Manager/IAM provisioning, and production SQL privileges still need
their own approved deployment validation. No unnecessary cloud dependency was
introduced.

## Complete database change report

| Category | Owned temporary test environments | Actual development/production databases |
| --- | --- | --- |
| Tables affected | Existing migration/history/reference tables; synthetic writes in clients, users, client_applications, audit_events, user_sessions | None |
| Schema changes | Existing migrations 001-007 applied unchanged to fresh temporary databases; no custom schema changes | None |
| Data changes | Reference seed and synthetic applications/companies/users/decisions/audits/sessions; all removed at cleanup | None |
| Migrations created or edited | None | None |
| Migrations applied | Existing 001-007 and reference seed in both temporary runs | None |
| Pending database changes requiring approval | None | None |

Temporary SQL accounts/grants and controlled disconnects affected only the owned
test server. No development business records, schema, migrations, persistent
volumes, or existing containers were changed. Stop after Phase 4; Phase 5 has not
started and requires explicit approval.
