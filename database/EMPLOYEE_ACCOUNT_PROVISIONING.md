# Local employee account provisioning

Status: prepared for review; **no provisioning has been run**. This is a local
development-only procedure. It does not create public registration, bypass
login, change Real Mode/Demo Mode, or synchronize database records through
GitHub.

## Verified local account inventory

On 2026-11-16, a read-only query against the configured local MySQL 8.4.13
development database (`127.0.0.1:3308`, `enterflow_db`) found eight active
employee accounts. Each requested role was present and assigned once:

| Approved username | Role code |
| --- | --- |
| `Admin` | `admin` |
| `sales` | `sales` |
| `operations` | `operations` |
| `accountant` | `accounting` |
| `production` | `production` |
| `warehouse` | `warehouse` |
| `logistics` | `logistics` |
| `owner` | `owner` |

This inventory reports no password or hash values. No existing account was
changed. Other team members' databases were not inspected.

## Existing foundations and provisioning design

- Employee authentication reads `users` and verifies passwords through the
  existing Argon2id implementation in `backend/src/services/password.service.js`.
- The existing employee-management service creates employees, checks identity
  conflicts, uses the database identity advisory lock, writes audit events,
  and runs writes transactionally.
- The database uses `users.role_code` as a foreign key to `roles.code`, with
  unique username and email indexes. `audit_events.actor_id` is nullable and
  references `users.id`; `user_sessions.user_id` also references `users.id`.
- This setup is a separate, explicitly invoked local CLI, not an HTTP endpoint.
  It inserts accounts only; it does not reset passwords, activate/deactivate
  accounts, alter role definitions, change sessions, or update existing rows.
- The fixed profiles use the eight usernames and role codes above, generic
  development display names, and reserved `@enterflow.test` email addresses.
  These addresses are not for mail delivery. Staff can later change local
  profile details through the existing Admin Portal. No individual names,
  personal email addresses, employee numbers, or credentials are committed.
- Each operator enters eight separate initial passwords in the local terminal.
  Input is not echoed; passwords are hashed with the existing Argon2id service.
  Passwords and hashes are never printed or included in the audit payload.
- One database transaction inserts all eight users and eight
  `employee.provisioned` audit events. The audit rows have a null `actor_id`
  because this is an offline local bootstrap; the operator-supplied name and
  request ID are recorded as the audit reason/correlation. The Admin activity
  feed includes this action.
- Preview is the default. Apply requires a local target, compatible schema,
  all required roles, no conflicting username/email in `users` or pending/
  approved client applications, an identity advisory lock, and two explicit
  confirmation phrases. A conflict blocks the full batch. No existing row is
  updated. A repeat run therefore stops on conflicts before password hashing.

Independently provisioned databases will assign different numeric user IDs and
different salted password hashes. Matching usernames and role codes do not
mean that the accounts share passwords. Do not attempt to export the current
passwords or hashes. If identical credentials are ever required, obtain
separate owner/security approval for a private secret-manager or in-person
handoff; never place them in GitHub, chat, source code, or a database dump.

## Migration 007 and `db:status`

Migration 007 remains on strict hold. This procedure never reads migration SQL
or migration history and never invokes `db:status`, `db:migrate`, `db:seed`, or
`db:baseline`.

The reported `Applied file missing/modified` error is consistent with the
runner finding an applied-history entry whose file is excluded from active
discovery. This is a separate unresolved migration-history/runner compatibility
issue, not an employee-account setup issue. Do not edit the history, suppress
the integrity error, run a migration/seed, or inspect Migration 007 to work
around it. A separately authorized maintainer review must determine the safe
resolution without bypassing integrity checks.

The employee provisioner can operate without migrations or seeds **only if**
the local database already has the required `users`, `roles`,
`client_applications`, and `audit_events` schema and all eight role rows. Its
read-only preview checks the local target and required schema. It fails closed
if those prerequisites are absent. A successful preview does not resolve or
approve the `db:status` error.

## Files to obtain from the reviewed GitHub branch

The reviewed change set must contain:

- `package.json` with the `db:provision-employees` script.
- `database/provision-employees.mjs` and
  `database/employee-provisioning-core.mjs`.
- `database/employee-provisioning-core.test.mjs`.
- The focused audit-feed inclusion for `employee.provisioned` in
  `backend/src/services/admin.service.js` and its test.
- This guide: `database/EMPLOYEE_ACCOUNT_PROVISIONING.md`.

The procedure reuses the already-required `mysql2`, `argon2`, database TLS,
runtime configuration, and account schema. It adds no dependencies or schema
migrations.

## Update and start the project (Windows PowerShell / VS Code)

From the repository root, first preserve local edits. If `git status --short`
shows work in progress, stop and coordinate with its owner; do not reset,
clean, or overwrite it. Once the reviewed change is available on the agreed
branch:

```powershell
git switch dev-phase
git pull --ff-only origin dev-phase
```

Use the group's approved dependency restore only if dependencies are missing
or the lockfile changed. Do not copy another developer's `.env.dev`; each
developer uses their own ignored local configuration.

Start only the dedicated local development MySQL service (see
`database/DEVELOPMENT.md` for the established container and secret setup):

```powershell
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml start --wait
```

In separate VS Code terminals, start the API and frontend:

```powershell
npm run server
```

```powershell
npm run dev -- --host 127.0.0.1
```

The API uses the local database settings from `database/.env.dev` and the
existing TLS-verified pool. Do not print or share that file.

## Read-only preview and target verification

Run the provisioner with no arguments. This is a read-only preview: it verifies
the configured and connected database target is `127.0.0.1:3308 /
enterflow_db` on MySQL 8.4, checks the required schema and roles, and reports
conflicting usernames without exposing existing account data.

```powershell
npm run db:provision-employees
```

For an explicit preview flag:

```powershell
npm run db:provision-employees -- --preview
```

Expected outcomes:

- On a clean local schema with all required roles: “Preview: all eight
  usernames/emails are available.” **No rows are written.**
- If any expected username/email is already present: the preview reports the
  affected planned username(s) and blocks the complete batch. It never repairs
  or changes those accounts.
- If target, schema, version, or roles are wrong/missing: it stops without
  writes.

On the developer machine used to prepare this procedure, the preview found
conflicts for all eight approved usernames, as expected because those accounts
already exist there. It did not ask for passwords and made no writes.

The preview is not a substitute for reviewing the environment and approving
the later apply. Do not use a remote, production, test, or teammate's shared
database.

## Apply only after review and explicit authorization

This task prepared the command but did **not** execute it. A responsible local
developer must authorize apply after reviewing the diff, test results, local
target, and preview. Then run:

```powershell
npm run db:provision-employees -- --apply
```

The command prompts for the operator name, requires typing both
`PROVISION 8 LOCAL EMPLOYEES` and `enterflow_db`, then prompts twice for each
account's password. Password keystrokes are not echoed. Use a distinct,
strong password of at least eight characters for each account (matching the
existing employee-creation validation) and store it only in the developer's
approved private password manager. The script does not accept passwords as
command-line arguments, environment variables, or files.

If any prompt is cancelled, passwords do not match, an identity conflict
appears, the lock cannot be acquired, an audit write fails, or a database
operation has an uncertain outcome, stop. The batch is transactional; do not
rerun after an uncertain commit until an authorized read-only review confirms
the local state. A subsequent preview will report existing accounts and will
not overwrite them.

## Verify login and handle conflicts

After a successful approved apply:

1. Start the API and frontend as described above.
2. Sign in through the existing real employee login with one provisioned
   username and the password entered for that username.
3. Confirm the expected role-specific workspace and permissions. Do not use
   Demo Mode to claim a real database login succeeded.
4. Do not place the password in tickets, terminal command arguments, screenshots,
   or source code.

If any username or email conflicts with an existing user or pending/approved
client application, the entire setup stops before inserting users. Preserve
the conflicting record and ask the account/data owner to determine the
approved resolution. Do not rename, deactivate, delete, reset, or overwrite it
as part of this setup.

GitHub distributes application files, not a local MySQL server's rows. Each
developer has a separate database, numeric IDs, transaction history, and
password hashes. Therefore, sharing this reviewed CLI makes the same local
username/role configuration repeatable; GitHub does not automatically copy
employee accounts between databases.

## Tests and review gate

Run the isolated tests; they use mock connections, temporary in-memory test
state, and the real Argon2id hash/verify functions. They do not connect to a
database or modify employee records:

```powershell
node --test database/employee-provisioning-core.test.mjs
node --test backend/src/services/admin.service.test.js
git diff --check
```

The tests cover all eight role mappings, profile and password validation,
Argon2id integration, duplicate/conflict refusal, existing-account protection,
transaction rollback, audit entries, local target/schema guards, lock
contention, repeat execution, and uncertain commit handling.

Before any GitHub commit or push, require project-owner/security review of the
code and this guide, confirmation that no credentials, hashes, tokens,
`.env` files, or live database exports are staged, and explicit authorization
for the Git operation. No commit, push, migration, seed, or provisioning was
performed while preparing this procedure.
