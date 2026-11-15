# Client registration Phase 3 integration results

Executed November 15, 2026, 10:30 AM Asia/Manila.

Final result: **51 checks passed, zero failed**, with **one confirmed pre-existing
TLS configuration finding**. This is a successful functional integration run,
not an unconditional deployment security approval. No existing implementation
files, frontend files, migrations, or seeds were changed. No commit or push.

## Artifacts and execution

- Harness: `backend/test/registration.mysql.integration.mjs`
- Final machine-readable evidence: `backend/test/REGISTRATION_MYSQL_RESULTS.json`
- Initial failed harness run: `backend/test/REGISTRATION_MYSQL_RESULTS.initial.json`
- This report: `backend/test/REGISTRATION_MYSQL_REPORT.md`

From the repository root, with Node 24 and the existing Docker Desktop engine:

```powershell
$env:DOCKER_EXE = 'C:\Users\Stephanie\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
node backend/test/registration.mysql.integration.mjs --isolated-docker
```

This is an explicit standalone harness, not an automatically discovered test.
It reuses `database/migration-core.mjs` and the established digest-pinned Docker
workflow. It reuses the Phase 2 test import guard to block UNUSED default database
singletons, preventing development credential loading. The actual app, router,
controllers, validator, Argon2id service, registration service, auth service, and
session service are exercised. Their factory dependencies point to an explicitly
created real MySQL pool; registration/auth/session service results are not mocked.
Only the two forced-disconnect cases wrap real connection methods to schedule a
real server-side `KILL CONNECTION` after lock acquisition or acknowledged commit.

## Final test environment

| Property | Verified value |
| --- | --- |
| MySQL | 8.4.13 |
| Pinned image | `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902` |
| Container | `enterflow-registration-p3-d533df1b3d2fd40b` |
| Container ID | `a36cce1d54f8bbd59907de323d7a8765b4c2b186cfc88fee163f39deb1405902` |
| Database | `enterflow_registration_p3_d533df1b3d2fd40b` |
| Endpoint during tests | `127.0.0.1:54699` |
| Server UUID | `90156d47-e09c-11f1-b785-ea9c226a6964` |
| Storage | Dedicated tmpfs at `/var/lib/mysql`; no named volume or bind mount |
| TLS | TLSv1.3, `TLS_AES_256_GCM_SHA384`; trusted per-run CA and pinned peer certificate |
| Runtime SQL role | Temporary schema-scoped SELECT/INSERT/UPDATE/DELETE; REQUIRE SSL; no DDL |

Before initial writes, the harness verifies the local Docker context, owned
container ID/name/label/image, mount isolation, loopback port, MySQL version,
server UUID, CA chain, and server certificate fingerprint/identity. It verifies
database name, server UUID, version, and TLS on each acquired runtime connection.
For resumed TLS sessions where Node omits the certificate, it requires an
authorized resumed session from the same SSL configuration whose original
certificate was already pinned. It never connects to ports 3306-3309 or loads
`database/.env.dev`. Generated credentials/passwords remain in memory and are
excluded from reports and command arguments.

## Coverage and actual results

All 51 checks, including environment and cleanup checks, are listed individually
in the final JSON. The requested integration coverage passed:

| Requirement | Actual result |
| --- | --- |
| Successful POST registration | 201; exactly one application inserted with pending status |
| Password handling | Real Argon2id parameters verified; exact password verified including surrounding spaces; trimmed alternative fails; plaintext absent from stored application rows |
| No automatic account/session creation | Per-registration counts show no changes to clients, users, or user_sessions |
| Pending email/username duplicates | Safe 409; no new row |
| Existing user conflicts | All four existing-field/submitted-field combinations return 409 |
| Application cross-field conflicts | Both email-to-username and username-to-email return 409 |
| Approved application conflicts | Both email and username return 409 |
| Rejected identifier reuse | Existing rejected fixture retained; one new pending row inserted |
| Database collation | Case-insensitive and accent-insensitive email/username conflicts; accent-insensitive cross-field conflict |
| Concurrent duplicates | Independent service instances over simultaneous HTTP requests: exactly one 201 and one 409 for email, username, and cross-field cases |
| Advisory-lock release | Lock free after success, conflict, permission failure, and forced disconnect |
| Advisory-lock timeout | Real held lock produces confidential 503/no write; original holder retains lock; registration succeeds after release |
| Real SQL failure | Restricted SQL account cannot read users; safe 503/no write; lock released |
| Disconnect after acquiring lock | Real server-side disconnect produces 503/no write; server releases lock; next registration succeeds |
| Disconnect after acknowledged commit | HTTP remains 201; exactly one row persists; unsafe connection discarded; next registration succeeds |
| Input security | Missing fields, invalid email/password, arrays, unknown privilege/status/hash fields, and prototype mass assignment rejected with no writes |
| SQL parameter handling | Injection-shaped metadata stored literally; related records remain intact |
| HTTP security | Malformed JSON 400, oversized JSON 413, wrong/missing content type 415, wrong/missing origin 403, cross-site metadata 403, unsupported charset 415; safe JSON/no writes |
| Rate limiting | Five real inserts allowed; sixth 429/Retry-After 900; spoofed forwarding header does not bypass; new attempt succeeds at fifteen minutes |
| Authentication cookie boundary | No registration response creates or changes an auth cookie |
| Authentication regressions | Real email and username login; invalid/inactive/absent accounts rejected; session token stored only as SHA-256 hash; HttpOnly/SameSite cookie; me works; logout revokes persisted session; revoked/no cookie rejected |
| Login limiter independence | Registration exhaustion permits login; login still blocks attempt eleven |
| TLS rejection | Wrong CA rejected by a real connection |

Final temporary synthetic counts were 33 applications, zero clients, six users,
and two sessions. Users were direct conflict/login fixtures; sessions were created
only by the explicit authentication regression tests and were revoked. Registration
did not create these users or sessions. Rejected/approved rows were direct synthetic
fixtures; no approval/rejection endpoint or workflow was implemented.

The initial run recorded 24 passing checks and 27 failures because the harness
assumed every TLS connection exposes `getPeerCertificate().raw`. Node omits it on
some resumed sessions, causing the test-only connection guard to reject valid
connections before application work. That temporary environment was cleaned up
and its evidence retained. Only the new harness was corrected; the final complete
run used another fresh container and passed all 51 checks.

## Confirmed finding and proposed fix

**TLS-IDENTITY-CONFIG (pre-existing):** `backend/src/config/database.js` sets
`ssl.servername` but not `ssl.verifyIdentity`. Inspection of the installed mysql2
3.24.6 implementation (`lib/base/connection.js`, `startTLS`) shows it derives TLS
servername from `host` and gates hostname verification on `verifyIdentity`.
It does not use `ssl.servername`. A real TLS connection to the temporary server
with a deliberately incorrect `ssl.servername` succeeds. A wrong CA is rejected,
so chain verification is working; the configured hostname override does not
establish server-name verification.

Proposed fix, pending separate implementation approval: configure supported
hostname verification (`verifyIdentity: true`) with a host matching the
certificate and controlled endpoint resolution, or implement explicit peer
identity checking. Preserve trusted-CA verification. Simply keeping the current
ignored property or setting `verifyIdentity` while using an IP with this
CN-only local certificate will not supply a complete solution. Local Docker and
Cloud SQL certificate/connection modes need separate configuration validation.
No existing implementation file was modified to address this finding.

Functional registration security checks passed: allowlists, parameterized SQL,
Argon2id hashing, safe conflict/infrastructure errors, abuse controls, and session
boundaries. The harness adds per-run certificate pinning around its real pool;
this does not fix or certify the production singleton's TLS configuration.

## Cleanup and preservation

The harness verified ownership again before removing only its newly created
temporary container. Its tmpfs database and temporary MySQL accounts disappeared
with that container. No persistent volume was created or removed. The initial
run's temporary container was also removed.

Before/after snapshots matched for every pre-existing container ID, state, start
timestamp, image, published port, mount, and volume name. A separate final
read-only Docker inventory independently confirmed only the original resources:

- `enterflow-migrations-workflow-test` on 3309 and its existing volume.
- `enterflow-mysql-dev` on 3308 and `enterflow-mysql-dev-data`.
- `enterflow-mysql84-validation` on 3307 and its existing volume.

All migration/seed checksums and all inspected backend implementation raw SHA-256
checksums matched before/after. `node --check` and `git diff --check` passed.
Existing uncommitted work was preserved.

## Cloud compatibility and limits

Only local test artifacts were added, using existing Node/mysql2/Express/Argon2
and Docker infrastructure. No cloud resources, dependencies, secrets, or
production environment settings were added or changed. These tests establish
local MySQL 8.4.13 behavior; they do not validate Cloud Run, Cloud SQL, or Secret
Manager deployment. The existing TLS finding requires resolution before claiming
verified production server identity. The documented per-process in-memory rate
limiter also remains insufficient for deployment-wide enforcement across Cloud
Run instances. Phase 3 makes no deployment/configuration changes.

## Database change report

| Category | Temporary test environments | Actual development database |
| --- | --- | --- |
| Tables affected | Existing tables created by migrations 001-007; migration history; reference tables seeded; synthetic writes to client_applications, users, user_sessions | None |
| Schema changes | Existing migrations 001-007 applied unchanged to fresh temporary schemas; no custom schema changes | None |
| Data changes | Reference seed and synthetic fixtures/registrations/auth sessions; all removed with their owned containers | None |
| Migrations created/edited | None | None |
| Migrations applied | 001-007 plus existing reference seed, in both fresh temporary runs | None |
| Pending database changes requiring approval | None | None |

Temporary server accounts and grants existed only inside the owned containers
and were removed with them. `enterflow_db`, existing business records, persistent
volumes, and existing validation databases were never SQL targets. Stopped after
Phase 3; Phase 4 is not started.
