# Local Real login readiness — 2026-11-16

> **Historical pre-provisioning report:** current [Employee Management diagnosis](EMPLOYEE_MANAGEMENT_READONLY_DIAGNOSIS.md)
> verifies **8 active development employees**. Zero-account/provisioning-blocked
> statements below describe the earlier state and must not trigger provisioning.

Status: **BLOCKED ON ACCOUNT PROVISIONING APPROVAL**. No authentication defect
was found and no login/portal/Demo/Real code was changed in this investigation.

## Confirmed cause and environment difference

The configured local `enterflow_db` has zero employee accounts across Admin,
Sales, Operations, Accounting, Production, Warehouse, Logistics and Owner.
All eight corresponding rows exist in the role catalog. Real login cannot
authenticate a user that does not exist. The auth service intentionally uses
dummy password verification and the generic invalid-credentials response for
absent accounts; this is expected security behavior.

The user confirmed that the groupmate uses **their own local MySQL database**.
Its data and provisioning procedure were not accessed or independently checked.
Matching Git branches do not replicate Docker volumes, database users or
application accounts. The historical installation procedure deliberately left
application-account tables empty. No local employee provisioning artifact was
found in the inspected procedures. This establishes the missing local setup;
it does not establish how the groupmate originally created their accounts or
whether local accounts were ever added and later removed.

Fresh verification:

- Branch `dev-phase`; HEAD versus the existing `origin/dev-phase` tracking ref:
  zero commits ahead/behind. No remote fetch or repository write was performed.
- Runtime target: `127.0.0.1:3308`, `enterflow_db`;
  `APP_ORIGIN=http://localhost:5173`; CA present; no file-defined configuration
  keys overridden by the diagnostic process environment.
- Intended container `enterflow-mysql-dev` is running and healthy, labelled
  `development`, with loopback-only port 3308 and volume
  `enterflow-mysql-dev-data` mounted at `/var/lib/mysql`.
- Container ID, image ID and MySQL server UUID match the recorded installation.
  MySQL 8.4.13, expected database, authorized TLS, `rejectUnauthorized=true`
  and `verifyIdentity=true` all verified.
- Backend already running on port 3000: liveness 200 JSON; unauthenticated
  `/api/auth/me` 401 JSON. No frontend initially listened on port 5173.
- A temporary Vite instance served the frontend index (200 HTML), proxied
  liveness (200 JSON), `/me` (401 JSON), and empty-input `/login` (401 JSON).
  None issued a session cookie. The empty input is rejected before account SQL.
  The listening port closed, but diagnostic-process shutdown stalled; only that
  specifically identified temporary process was stopped. The existing backend
  was left running.

## DATABASE CHANGE REPORT — current work

**Zero database writes.** The only database SQL used was read-only:

```sql
SELECT DATABASE() AS databaseName,
       VERSION() AS serverVersion,
       @@server_uuid AS serverUuid;

SELECT role_code, COUNT(*) AS employee_count, SUM(active = 1) AS active_count
FROM users
WHERE account_type = 'employee'
  AND role_code IN ('admin', 'sales', 'operations', 'accounting',
                    'production', 'warehouse', 'logistics', 'owner')
GROUP BY role_code;

SELECT code FROM roles
WHERE code IN ('admin', 'sales', 'operations', 'accounting',
               'production', 'warehouse', 'logistics', 'owner')
ORDER BY code;
```

No other database was accessed. No migrations, seeds, account creation,
credential changes, record alterations, session writes or database-writing
integration tests ran. Migration 007 SQL and migration history were not opened,
searched, hashed, modified or applied. No migration runner was invoked.

## Smallest proposed correction — NOT EXECUTED

Keep the current database, volume, schema, backend configuration, authentication
logic and Demo/Real architecture. Start the frontend with `npm run dev` and use
`http://localhost:5173`; keep the backend running with `npm run server`.
Starting both servers solves availability only: accounts must also exist.

There is an existing authenticated employee-creation procedure:
`POST /api/admin/employees`, implemented by `admin.service.js`, with Admin
authentication, `users/create` and `users/assignRole` permissions, same-origin
checks, validation, Argon2id hashing, a database-scoped identity lock,
transactions, identity conflict checks and audit events. Its validator allows
the seven non-Admin employee roles only. Preserve that restriction.

The ignored path `backend/scripts/provision-initial-admin.local.mjs` appears
in `.gitignore`, but the file is absent. The ignore rule is not evidence that
a reviewed, approved or runnable bootstrap procedure exists locally. There is
no approved bootstrap script available to execute based on this investigation.

Safest proposal:

1. Obtain and review the groupmate's nonsecret bootstrap procedure if available.
   Do not import their database, copy their credentials or run their script
   without review and explicit target/operation approval.
2. Otherwise prepare a narrowly scoped, reviewed, one-time local bootstrap tool
   for **one** Admin. It must pin the recorded container/image/volume/endpoint,
   database and UUID, retain verified TLS, use the existing password service,
   take the existing registration/admin identity lock, and use one transaction.
   It must refuse an existing Admin or conflicting identity, never overwrite,
   reset or upsert accounts, and roll back both user and audit inserts on error.
   Preserve the reserved username `admin`, which existing code uses to protect
   the initial Admin. Validate the approved synthetic profile fields and create
   a secret-free bootstrap audit event attributed to the newly inserted Admin.
   The tool and exact parameterized writes require review before execution.
3. After approved bootstrap and authorized login, use the existing Real Admin
   Employee Management flow to create one account for each other employee role.
   This preserves the established validation, permissions and audit behavior.

Expected provisioning records, subject to an approved synthetic identity list:

| Role | New users | account_type | active |
| --- | ---: | --- | --- |
| admin | 1 | employee | true |
| sales | 1 | employee | true |
| operations | 1 | employee | true |
| accounting | 1 | employee | true |
| production | 1 | employee | true |
| warehouse | 1 | employee | true |
| logistics | 1 | employee | true |
| owner | 1 | employee | true |

Each would have `client_id=NULL`, a unique synthetic email, username and employee
number where supplied, required profile fields, and an Argon2id password hash.
Approve those nonsecret identity fields before provisioning. For the smallest
single-account login proof, approve only the initial Admin first; the remaining
seven accounts can be a later explicit scope.

### Proposed database effects and duplicate prevention

- `users`: at most eight new rows, or one if only Admin bootstrap is approved.
- `audit_events`: one bootstrap event and one existing `employee.created` event
  per additional employee; expected eight total for the full eight-role plan.
- `user_sessions`: normal login inserts, authenticated activity updates and
  logout revocation updates during authorized Admin use and live verification.
  The direct bootstrap itself must not create sessions.
- `roles`, `role_modules`, `client_applications` and existing identities are
  checked where needed but not changed. No client/company, business, schema,
  migration-history, grant, Docker-volume or MySQL-account changes are proposed.
- Recheck immediately before execution. Under the shared identity lock, check
  both email/username columns for cross-field conflicts and pending/approved
  client applications using the existing conflict semantics. Check employee
  numbers and existing Admins as well. Retain database uniqueness constraints;
  conflicts abort rather than updating, skipping silently or duplicating data.
- A rerun must detect the existing account and stop. A partially completed
  multi-account workflow requires recount/review and explicit approval of the
  remaining identities, never replaying all inserts blindly.

### Credentials and approvals

Use separate strong local-only passwords. Collect bootstrap credentials through
a hidden local prompt, retain plaintext only in process memory, and hash through
the existing Argon2id service. Supply later initial passwords through the
existing Admin flow. Never use frontend Demo passwords, put secrets in source,
command arguments, logs or reports, or copy the groupmate's credential records.
Do not add credentials to Git or frontend environment variables.

Required before execution: explicit approval for the reviewed bootstrap tool,
the exact local target, synthetic account profiles, intended account count and
`users`/`audit_events` inserts. Confirm an appropriate backup/recovery plan without
resetting the database. Separately include permission for normal session writes
during real login, Admin creation, restoration and logout. Migration 007 remains
on hold; this plan does not require it or any migration. No provisioning approval
is inferred from approval of read-only investigation.

## Tests and files

Fresh tests exited 0: **156 passed, 0 failed, 0 skipped**.

- 139 focused backend auth/session/password/origin/rate-limit/RBAC/runtime/TLS,
  Admin-service and Admin-validation tests, using
  `--import ./backend/test/support/mock-database.js`.
- 17 frontend client and Vite/auth-router integration tests, also with the live
  database import blocked. Mocked sessions existed only in test memory.
- Actual HTTP checks are recorded above. No credential-bearing real login,
  production build, browser automation or database-writing suite was run in
  this continuation.

Only this readiness report was added in this continuation. The pre-existing
debugging edits to README, Vite, API client/tests, proxy helper and earlier report
were preserved. No teammate code, authentication logic, interface or Demo/Real
architecture was modified. No commit, push, merge or deployment was performed.

**Real login remains unverified and unavailable for the missing local accounts.**
