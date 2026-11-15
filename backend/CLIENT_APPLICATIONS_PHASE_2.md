# Client application review — Phase 2

Implemented Admin permissions, strict validation, and dependency-injected read/
decision services. No controllers, routes, or application mounts were added.
No live business records, schema, migrations, environment settings, dependency
versions, or cloud resources were changed. No commit or push.

## Live schema verification before implementation

The actual configured local database was verified as `enterflow_db` on MySQL
8.4.13 using SELECT identity metadata and SHOW CREATE TABLE only. The connection
was TLS-authorized with driver identity verification enabled. No table rows or
credentials were printed.

| Table | Verified support |
| --- | --- |
| client_applications | Pending/approved/rejected status; decision actor/time/reason; approved-client FK; password_hash; nullable generated pending identity columns and their two unique indexes; utf8mb4_unicode_ci |
| clients | Unique company_name; company/contact/email/phone fields; active default true |
| users | Unique email/username; unique nullable client_id from migration 006; role/client FKs; client-vs-employee identity CHECK; active default true |
| audit_events | Actor FK, action, subject type/identifier, old/new values, reason, ASCII request ID, timestamp |

Existing constraints support this phase without a migration. Admin authorization,
pending-state transitions, and cross-field/cross-table conflict coordination are
service responsibilities; the schema does not independently enforce all of them.

## Files

Created:

- `backend/src/validation/client-applications.validation.js`
- `backend/src/validation/client-applications.validation.test.js`
- `backend/src/services/client-applications.service.js`
- `backend/src/services/client-applications.service.test.js`
- `backend/CLIENT_APPLICATIONS_PHASE_2.md`
- `backend/test/CLIENT_APPLICATIONS_PHASE_2_TEST_RESULTS.tap`

Modified:

- `backend/src/config/permissions.js`
- `backend/src/config/permissions.test.js`

All other existing backend modules, migrations 001-007, and frontend files were
left unchanged by this phase. Earlier uncommitted work remains present.

## Service and validation contract

Import `createClientApplicationsService({ db, lockTimeoutSeconds = 2 })` from the
new service. It does not load credentials or create a pool. Its methods are:

| Method | Arguments |
| --- | --- |
| listPending | `{ actor, query = {} }` |
| getApplication | `{ actor, applicationId }` |
| approve | `{ actor, applicationId, input: {} }` |
| reject | `{ actor, applicationId, input: { reason } }` |

`actor` must come from the trusted authentication layer, never request JSON. It
must contain a canonical string userId, roleCode `admin`, and accountType
`employee`. This service is not a session-token validator. Future HTTP wiring must
first run the existing authentication, Admin-only role and permission middleware,
and origin/content-type checks for mutations. No new endpoint is exposed now.

The service snapshots actor identity before asynchronous work and rechecks the
actual active Admin on its connection using FOR SHARE within a transaction. That
row lock prevents role/deactivation changes from racing the authorized operation.
Missing/non-Admin actor contexts cannot reach the pool. Stale/demoted/inactive
Admin contexts are denied by the database recheck.

Validation accepts only plain own-data objects, including null-prototype objects;
it rejects accessors, symbols, unknown fields, arrays, and inherited objects.
Errors contain fixed field messages without submitted values.

- Identifiers are canonical positive decimal strings up to unsigned BIGINT max
  `18446744073709551615`; numeric inputs are rejected to prevent precision loss.
- Pending-list parameters are only limit, cursor, and optional status `pending`.
  Limit defaults to 25 and is bounded to 1-100.
- Cursors are bounded canonical base64url JSON containing a validated string ID
  and real millisecond timestamp. Ordering is submitted_at DESC, id DESC.
- Approval requires an empty JSON object; no account/company/role overrides.
- Rejection requires only reason, trimmed, nonempty, well-formed Unicode, at most
  1,000 Unicode code points. Emoji are counted as characters rather than UTF-16
  code units. Reasons remain parameter values rather than SQL text.

Reads use explicit SQL projections AND a public output allowlist. They include
the submitted company/contact/login identifiers and decision metadata needed by
authorized Admins, never password hashes, raw credentials, or session data. Lists
return `{ applications, nextCursor }`; detail returns one public application.
No SELECT * is used. Read transactions do not acquire the identity advisory lock.

## Decision behavior

Both actions acquire the EXACT existing registrationIdentityLockName(databaseName)
lock before beginning a transaction. Default timeout is two seconds; injected
values must be integers from zero to ten. The same connection then:

1. Starts a transaction and rechecks/locks the active employee Admin.
2. Selects the target application FOR UPDATE and requires pending status.
3. For approval, checks company uniqueness, both submitted identities against
   both users columns, and other pending/approved applications. The target
   application is explicitly excluded. MySQL performs collation comparisons;
   JavaScript does not emulate database equality in production.
4. For approval, inserts one company and one linked user with literal `client`
   role/account type and the existing hash unchanged. A bounded Argon2id PHC-shape
   sanity check fails closed on malformed stored credentials; it does not prove
   password correctness or rehash anything. New IDs are read with
   CAST(LAST_INSERT_ID() AS CHAR), avoiding unsafe insertId number conversion.
5. Updates pending status, deciding Admin, UTC timestamp, reason and company link.
6. Inserts one decision audit event on that connection, then commits.

Existing company conflicts never merge or attach accounts. DB unique-key errors
at company/user insert also produce safe conflicts and roll back prior writes.
The existing unique users.client_id constraint remains the final one-account
guard. The public service has no arbitrary account-creation method.

Rejection performs no company/user INSERT, does not select the password hash,
stores the trimmed reason, sets rejected status and decision metadata, and writes
its audit event atomically. It creates no client, user, session, cookie, or email.

Audit events use actions `client_application.approved` / `.rejected`, the deciding
Admin ID, application subject identifier, a pending-to-decided transition, safe
new company/user IDs for approval, rejection reason where applicable, an internally
generated UUID request ID, and UTC time. No full application/request serialization,
credential field, or caller-supplied audit actor is used. Audit failure rolls back
the uncommitted company, user, and application changes.

Transactions on failure are rolled back. Owned advisory locks are released;
uncertain lock/transaction sessions are destroyed instead of pooled. Release or
cleanup failure after acknowledged commit preserves success. A thrown COMMIT
returns `DECISION_OUTCOME_UNKNOWN`, whether the server actually committed or not;
the service never retries writes automatically. The caller must refresh details
before another decision. A completed decision encountered again returns
`APPLICATION_ALREADY_DECIDED` without a second audit or account.

## Result codes

Success uses `{ success: true, data, message? }`. Approval data includes string
applicationId/clientId/userId and approved status; rejection includes applicationId
and rejected status. Safe failure codes are:

| Code | Meaning |
| --- | --- |
| AUTHENTICATION_REQUIRED | No trusted actor supplied |
| FORBIDDEN | Non-Admin context or failed current active-Admin recheck |
| VALIDATION_ERROR | Invalid request; safe field errors included |
| NOT_FOUND | Target application absent |
| APPLICATION_ALREADY_DECIDED | Status no longer pending |
| COMPANY_CONFLICT | Existing/competing company requires Admin review |
| IDENTITY_CONFLICT | Existing account or reserved application identity |
| SERVICE_UNAVAILABLE | Temporary SQL/lock/infrastructure or integrity failure |
| DECISION_OUTCOME_UNKNOWN | Commit acknowledgement uncertain; refresh before retry |

No raw driver error, SQL text, password hash, or exception stack is returned or
logged by the new service. HTTP status mapping is deferred to the next phase.

## RBAC

The sole matrix addition is Admin:

```js
clientApplications: ['read', 'approve', 'reject']
```

Every other role has none of these actions, including Owner. Admin still lacks
clientAccounts:create and clients:create. Existing employee-account permissions,
role assignment permissions, and all other roles/resources/actions are unchanged.
Approval authority is bounded to a pending application and fixed client role.

## Tests and verification

Final executed combined run: **310 passed, 0 failed, 0 skipped**. This includes
new validation/service/RBAC cases and all 236 previously selected unit, HTTP,
auth/authorization, registration, password/session, and TLS checks. TAP evidence
is in `backend/test/CLIENT_APPLICATIONS_PHASE_2_TEST_RESULTS.tap`.

The new cases cover safe read projections/cursors, full BIGINT precision, reason
length/Unicode, accessors and mass assignment, all role denials, database Admin
revalidation, actor snapshotting, precise hash reuse (including a real Argon2id
hash over a mocked DB), fixed client account fields, audit content, duplicate
company and all cross-field identity directions, SQL-shaped bound strings,
missing/already-decided state, write counts/warnings, failures at transaction
stages, audit rollback, lock timeout/acquisition/release errors, rollback failure,
unknown commit acknowledgement, and healthy reconciliation after unknown commit.

Mocked concurrent tests cover approve/approve, reject/reject, approve/reject,
reject/approve across independent service instances, and two different
applications competing for one company. They yield one audited decision or one
company/account creation as appropriate. These are NOT a replacement for future
real MySQL integration/isolation/collation verification of this new service.

An initial test assertion reused a deliberately broken connection environment
for reconciliation after a lost commit acknowledgement. It was corrected to use
a healthy service sharing the committed state. Final combined tests all pass.

Executed command (repository root):

```powershell
node --import ./backend/test/support/mock-database.js --test --test-reporter=tap backend/src/validation/client-applications.validation.test.js backend/src/services/client-applications.service.test.js backend/src/controllers/registration.controller.test.js backend/src/middleware/registration-rate-limit.middleware.test.js backend/src/routes/registration.http.integration.test.js backend/src/controllers/auth.controller.test.js backend/src/routes/auth.http.integration.test.js backend/src/middleware/login-rate-limit.middleware.test.js backend/src/middleware/origin.middleware.test.js backend/src/middleware/auth.middleware.test.js backend/src/services/registration.service.test.js backend/src/validation/registration.validation.test.js backend/src/services/auth.service.test.js backend/src/services/session.service.test.js backend/src/services/password.service.test.js backend/src/middleware/role.middleware.test.js backend/src/middleware/permission.middleware.test.js backend/src/middleware/permission.http.integration.test.js backend/src/middleware/auth-permission.http.integration.test.js backend/src/config/permissions.test.js backend/src/config/database-tls.test.js backend/test/database-tls.fixture.test.js
```

The existing import guard blocks default live database calls. New service tests
also inject only transactional in-memory test doubles. No actual approval,
rejection, audit INSERT, account/company INSERT, or other SQL write was executed.
Synthetic TLS fixture keys/certificates were removed by the existing TLS tests.
Syntax and git diff whitespace checks passed.

## Cloud compatibility and boundaries

The new factory uses the injected existing pool, standard Node APIs, and MySQL
8.4 transactions, row locks, advisory locks, and unique constraints. It introduces
no credential files, environment defaults, local endpoints/certificates,
dependencies, cloud services, or infrastructure changes. Existing verified TLS
and environment/Secret Manager-compatible configuration remain unchanged.

Identity coordination works across cooperating application instances on one
MySQL primary, rather than relying on local memory. All future identity writers
must use this same protocol. No multi-writer topology, Cloud Run/Cloud SQL
deployment, new SQL grants, or live review-service persistence has been validated
in this phase. Existing deployment readiness work remains separate.

## Database change report

- Tables affected or modified during this phase: None; live schema metadata read
  only for client_applications, clients, users, and audit_events.
- Schema changes: None.
- Data changes: None.
- Migrations created, edited, or applied: None.
- Pending database changes requiring approval: None.

When explicitly called in a later authorized environment, approval is designed
to INSERT clients/users/audit_events and UPDATE client_applications; rejection
is designed to UPDATE client_applications and INSERT audit_events. These describe
implemented future behavior, not operations executed against development data.
No HTTP integration was implemented. Stop after Phase 2 pending approval for the
HTTP API phase and separately authorized real-database write tests.
