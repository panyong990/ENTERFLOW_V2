# Local Real account setup

> **Current inventory supersedes this preparation snapshot:** [8 active
> development employees verified](EMPLOYEE_MANAGEMENT_READONLY_DIAGNOSIS.md).
> Do not rerun provisioning/bootstrap to repair a directory fetch failure. The
> setup rationale below retains its historical, pre-provisioning scope.

Prepared 2026-11-16 (Asia/Manila). **Provisioning has NOT been executed.**
This procedure adds a local development account through the existing Real
authentication system. It does not change Demo Mode, login screens, passwords
of existing users, session policies, RBAC, API contracts, or database schemas.

## Why this machine differs

The previous authorized checks established zero local employee accounts, eight
role definitions, and a healthy intended MySQL/TLS target. The groupmates use
their own local MySQL databases. Their provisioning process has not been supplied
or independently verified. Git synchronization does not transfer their records.
The documented original installation intentionally did not seed application users.

The repository has authenticated employee creation under the Real Admin portal.
It requires an existing Admin and deliberately allows only seven non-Admin roles.
That restriction is preserved. The ignored initial-Admin script is absent.
The documented full-backup restore can overwrite data and is not a sanitized
employee-transfer procedure. No approved sanitized transfer tool was found in
the inspected setup procedures. Do not import someone else's database or hashes.

## Prepared files

- `backend/setup/local-admin.mjs`: report-only by default; explicitly selected
  write mode requires a local interactive terminal and hidden password confirmation.
- `backend/setup/local-admin-core.mjs`: narrowly scoped transactional bootstrap,
  reusing the existing Argon2id password service and shared identity-lock name.
- `backend/setup/local-admin-target.mjs`: runtime and Docker identity guards.
- `backend/setup/local-admin.test.mjs`: offline/mocked regression tests.

These files are not imported by the application, HTTP routes, migration runner,
or normal server startup. No dependency or package-script change is needed.

## DATABASE CHANGE REPORT — exact proposed bootstrap

Target: existing local `enterflow-mysql-dev`, `127.0.0.1:3308`, `enterflow_db`,
volume `enterflow-mysql-dev-data`. Container/image/server UUID must match this
machine's `database/development/installation.json`. Production, browser fixtures,
remote Docker endpoints, other databases, volumes and ports are rejected.
Trusted CA, authorized TLS and named certificate verification remain mandatory.

| Table | Proposed change |
| --- | --- |
| `users` | Insert exactly one initial local Admin, only if no employees exist |
| `audit_events` | Insert exactly one `employee.created` bootstrap event in the same transaction |
| `user_sessions` | No writes by bootstrap; normal writes require separate live-verification authorization |
| All other tables | No writes |

Exact user profile:

| Field | Value |
| --- | --- |
| `role_code` / `account_type` | `admin` / `employee` |
| `username` | `admin` (reserved by the existing initial-Admin safeguards) |
| `email` | `ef-local-admin@example.invalid` (synthetic, not a real person's address) |
| `display_name` | `Local Development Admin` |
| `employee_number` | `EF-LOCAL-ADMIN` |
| `department` / `job_title` | `Development` / `Local Administrator` |
| `client_id` / `active` | `NULL` / `TRUE` |
| `joined_on` | UTC date at execution |
| `password_hash` | Existing Argon2id service output from a newly entered private password |
| Other columns | Existing database defaults |

Exact parameterized writes (values bound in memory, never logged):

```sql
INSERT INTO users
  (role_code,account_type,client_id,display_name,email,username,password_hash,
   employee_number,department,job_title,active,joined_on)
VALUES ('admin','employee',NULL,?,?,?,?,?,?,?,TRUE,UTC_DATE());

INSERT INTO audit_events
  (actor_id,action,subject_type,subject_identifier,old_value,new_value,
   reason,request_id,occurred_at)
VALUES (?,'employee.created','user',?,NULL,?,
        'Approved local initial Admin bootstrap',?,UTC_TIMESTAMP(3));
```

User values are the fixed fields above and a private Argon2id hash. Audit actor
and subject both reference the newly inserted user ID; old value is NULL;
new value is only `roleCode`, `accountType`, `active` and the bootstrap source;
request ID is a fresh UUID. No password, hash, personal profile or token enters
the audit payload.

Before writes, the tool checks database/version/UUID, transactional engines for
both affected tables, the existing Admin role, absence of employees, and identity
conflicts. It takes the existing database-scoped identity advisory lock with
zero wait, checks both email/username columns, employee number, and pending or
approved client applications using MySQL's collation semantics. Existing unique
constraints remain in force. Both inserts commit together or roll back together.
Errors are sanitized. A lost commit acknowledgement reports
`COMMIT_OUTCOME_UNKNOWN_DO_NOT_RETRY`: inspect the target read-only with separate
authorization before deciding any further action. Auto-increment counters may
advance even after rollback; no failed-write path is represented as unchanged
counter state. There is no automatic retry, update, delete, upsert or password reset.

Rerunning against existing employees safely stops with `EMPLOYEES_ALREADY_EXIST`.
It does not add duplicate accounts or repair/reset existing ones. If accounts
appear between approval and execution, stop and reassess authorization.

No migrations, schema/grant changes, migration-history writes, account exports,
database restores, Docker starts/resets or volume replacements are included.
Migration 007 is not read, hashed, imported or required by this tool.

## Repeatable steps for each authorized groupmate

1. Use their own approved local installation and private runtime configuration.
   Required existing setup: the documented Docker development target, initialized
   approved schema/role definitions, restricted application credentials, matching
   installation identity record and trusted CA. Do not copy another machine's
   `.env`, installation record, passwords or data. A differently installed MySQL
   environment requires its own reviewed setup; do not bypass these guards.
   Node 24+ and repository dependencies must already be installed.
2. Review this change report, confirm backup/recovery arrangements, and obtain
   explicit approval for this exact local account and the two inserts. Existing
   backup commands are separately reviewed operations; this tool runs none.
3. The following is safe to run now; it does not load `.env`, call Docker, open
   MySQL or create accounts:

   ```powershell
   node backend/setup/local-admin.mjs --report
   ```

4. **Only after explicit write approval**, run from the repository root in an
   interactive local terminal, not through a credential-bearing chat or command:

   ```powershell
   node backend/setup/local-admin.mjs --apply --approved-target=enterflow_db
   ```

   Enter and confirm a new, strong, local-only password (12–1024 characters).
   The prompt does not echo input. No password argument, environment variable,
   output file, Demo credential, stored shared password or plaintext chat value
   is accepted as a credential source. Plaintext is needed briefly in process
   memory for hashing; JavaScript cannot guarantee memory zeroization.
   `--apply` is an operator safeguard, not a substitute for prior approval.
5. Start the existing servers from separate repository-root terminals:

   ```powershell
   npm run server
   ```

   Wait for successful API startup. If port 3000 already has the intended
   running backend, use it; do not start a second process or kill an unrelated one.

   ```powershell
   npm run dev
   ```

   Open `http://localhost:5173`, matching the configured `APP_ORIGIN`. The
   current Vite proxy targets `127.0.0.1:3000`. `npm run dev` starts only the
   frontend. Do not switch browser origins or weaken origin/TLS checks to retry.
6. **After explicit authorization for live session writes**, use the existing
   Real username/password login with username `admin` and the password entered
   locally. Refresh to verify session restoration; sign out to verify revocation.
   Login inserts `user_sessions`; authenticated activity and logout update it.
   A successful result must be observed before claiming Real login is fixed.
7. If all eight roles are needed, separately approve seven synthetic employee
   profiles and create one Sales, Operations, Accounting, Production, Warehouse,
   Logistics and Owner account using existing Real Admin Employee Management.
   This adds seven `users` rows and seven `audit_events` rows through the existing
   validated, permission-checked API. Give each a distinct strong private password
   and unique email/username/employee number. Ordinary Admin usage also updates
   sessions. Do not expand the bootstrap or relax the non-Admin role validator.

This establishes new authorized local development identities; it does not claim
to restore the groupmates' exact accounts, passwords or business data. If an
exact legitimate identity transfer is required instead, obtain an authorized
sanitized transfer proposal before executing any import.

## Actual safe verification

This preparation made **zero database connections or queries** and **zero
database writes**. No write-mode CLI invocation or interactive password entry
was executed. Current backend liveness returned 200 JSON; frontend port 5173
was stopped. Startup commands were verified against `package.json`, server
binding/runtime code and Vite configuration; proxy behavior is covered by tests
and the preceding authorized local HTTP investigation.

Fresh results: **177 passed, 0 failed, 0 skipped**, exit 0:

Repeat the new setup tests without MySQL using
`node --test backend/setup/local-admin.test.mjs` from the repository root.

- 21 new bootstrap/target/offline-report tests using in-memory connections only.
- 139 existing focused auth/session/password/RBAC/origin/runtime/TLS and Admin
  service/validation tests, with the live database import blocked.
- 17 existing frontend API client and Vite/auth-router tests, with mock services
  and the live database import blocked.

The initial test run found an incorrect readline import in the new CLI; it was
corrected before the passing runs. Offline report mode also ran successfully.
The interactive prompt and actual MySQL writes remain unverified pending
approval. No browser automation or production build was needed for these setup-only
files. Existing uncommitted changes were preserved; no commits, pushes, merges,
deployments or other project tasks were performed.

**Remaining action:** approve this one-Admin bootstrap report and, separately or
in the same explicit scope, real login/restoration/logout session writes. Then
run the interactive command locally. Seven additional accounts remain optional
and require their own approved profiles and write scope.
