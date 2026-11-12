# Team database migrations (Windows / VS Code)

Run commands in a VS Code PowerShell terminal at the repository root. Use Node.js **24 LTS**, npm, Docker Desktop's Linux engine and the existing pinned MySQL **8.4.13** image. DBeaver is for inspecting data; GitHub shares SQL files, never database volumes or passwords.

## What this adds

`npm run db:migrate` executes pending `database/migrations/NNN_description.sql` files in filename order. `npm run db:seed` separately applies pending reference seed files. `_enterflow_migration_history` stores filename, SHA-256, state, method and timestamps. The original `schema_migrations` ledger and all original SQL remain unchanged. There are **70 original tables + 1 runner infrastructure table** after adoption.

Checksums normalize CRLF/CR to LF and remove a leading UTF-8 BOM so Windows checkouts agree. Every other edit, including comments, changes the checksum. Applied files that are changed, removed or inserted earlier in the applied sequence cause an error. One advisory lock per database prevents concurrent runners. Status queries use the lock but do not create or change tables/data.

The runner accepts only MySQL 8.4 at **127.0.0.1:3308** with database `enterflow_db`, or **3309** with an `enterflow_workflow_*` test database. It never creates, drops or resets a database. It rejects schema switches, qualified identifiers, server/account commands, disabling integrity controls, executable comments and unsupported `DELIMITER`/routine SQL. SQL files must use ordinary unqualified local table statements, single-quoted strings and UTF-8. Only the original seed currently owns an explicit transaction; future files must finish any transaction they start. Do not change session parsing/transaction settings inside migrations. New SQL is trusted, reviewed project code, not untrusted input; parser checks are not a security sandbox. Use a migration account scoped to this database.

## Credentials (everyone, once)

```powershell
npm ci
Copy-Item -LiteralPath database/.env.migrations.example -Destination database/.env.migrations -ErrorAction Stop -NoClobber
```

Edit the ignored `database/.env.migrations` privately in VS Code. Set a unique strong `DB_MIGRATION_PASSWORD`; keep the default development host, port and database. Never use `VITE_*` variables. This file is separate from `.env.dev` and the restricted backend account `enterflow_app`. The backend account deliberately cannot run DDL. Environment variables override values loaded from the env file; clear stale `DB_*` variables before switching targets. An alternative private file can be selected with `-- --env-file path`.

Provision a dedicated local migration account **manually**, inside the correct development container (not XAMPP or the validation container):

```powershell
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml exec mysql mysql --protocol=socket --user=root -p enterflow_db
```

At the password prompt, use your local root password from `.env.dev`. At the MySQL prompt, substitute your private migration password below; **do not save this substituted SQL in Git**. This grants schema administration only on your local database, with no global privileges or grant option. If the account already exists, stop and inspect its grants rather than recreating or rotating it automatically.

```sql
SELECT DATABASE(), @@version, @@server_uuid;
CREATE USER 'enterflow_migrator'@'%' IDENTIFIED BY '<your-private-migration-password>';
GRANT ALL PRIVILEGES ON enterflow_db.* TO 'enterflow_migrator'@'%';
SHOW GRANTS FOR 'enterflow_migrator'@'%';
exit
```

`DB_SSL_LOCAL_SELF_SIGNED=true` encrypts local Docker traffic while accepting its generated certificate. For verified certificates set `DB_SSL_CA` to a trusted CA file and remove that exception. This is a local workflow, not a Cloud SQL deployment configuration. Do not share `.env.dev`, `.env.migrations`, dumps or connection exports containing passwords. Prefer quoted dotenv values if a password contains `#`/spaces.

## Existing development database: safe baseline, never replay 001–004

Do **not** run fresh-install commands on an existing installation. Pause application/DBeaver writes and other DDL; the advisory lock only coordinates this runner, not manual edits. Take a backup using the existing protected helper:

```powershell
python database/dev_mysql.py status
python database/dev_mysql.py backup
npm run db:status
npm run db:baseline
npm run db:status
npm run db:migrate
npm run db:seed
```

Baseline first performs read-only comparisons with `baseline.v1.json`, derived from the previously validated MySQL metadata and original reviewed SQL hashes. It checks all 70 tables, all 562 column definitions, all indexes, 141 foreign keys (including column order, parent schema and actions), 123 primary/unique constraints, 26 enforced CHECK expressions, legacy completion markers, engine/collation, and absence of unexpected triggers/routines/events. It requires the exact original schema; unexpected tables or differences stop adoption **before creating history**. It does not require business tables to be empty and does not update business/reference records.

If the legacy seed marker exists, every required reference row and value must match (extra team-created reference rows are allowed). If no seed marker exists, all reference tables must be empty; baseline then records only 001–004 and `db:seed` loads the reference data. Partial/unmarked/altered seeds stop for manual review. Only after verification succeeds does baseline create the history table and transactionally record the verified files/checksums as `baseline`. The original migrations and seeds are **not executed**. Once history exists with applied rows, a second baseline is refused; use status/migrate. Never use baseline to conceal a failed migration or unexplained drift.

The schema comparison intentionally fails closed on metadata differences, including changes introduced manually in DBeaver or different engine formatting. Review any mismatch rather than weakening the manifest to accept it. Keep the original manifest immutable alongside 001–004. Baseline is only for adopting the original four-file schema, not arbitrary later versions.

## Fresh groupmate installation (empty local Docker database)

Use this path only on a machine **without** `enterflow-mysql-dev`, `enterflow-mysql-dev-data`, or an existing development database. Inspect before starting; if either resource exists, stop and use the existing-database procedure instead:

```powershell
docker --context desktop-linux ps -a --format '{{.Names}}'
docker --context desktop-linux volume ls --format '{{.Name}}'
Get-NetTCPConnection -LocalPort 3308 -ErrorAction SilentlyContinue
```

Check that port 3308 is free. Copy `database/.env.dev.example` to `.env.dev` with `Copy-Item -NoClobber`, fill a strong unique `MYSQL_ROOT_PASSWORD` privately (and separate future backend password). Keep all credentials local. The Compose environment creates only the empty `enterflow_db`; it does not auto-import SQL or automatically create backend/migration accounts.

```powershell
docker --context desktop-linux pull mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml up -d --wait
```

Follow the credentials/account steps above, then:

```powershell
npm run db:status
npm run db:migrate
npm run db:seed
npm run db:status
```

This runs 001 → 002 → 003 → 004 once and the 126 reference rows once. Repeating migrate/seed is a no-op. Do not run `db:baseline` on an empty database, and never manually import SQL after adopting the runner. DBeaver uses `127.0.0.1:3308`, database `enterflow_db`, and your local account. Configure runtime `enterflow_app` separately with SELECT/INSERT/UPDATE/DELETE only, as described in DEVELOPMENT.md. No backend is implemented here.

## Sharing future changes through GitHub

1. Pull the team's latest branch before designing a change. Create a new uniquely numbered SQL file, for example `database/migrations/005_add_order_search_index.sql`. Never edit, rename or delete applied files or reuse a number. Resolve conflicting new numbers before either branch is applied by others; if already applied, coordinate a forward correction rather than renaming history.
2. Use forward-only, reviewed DDL/data changes. New reference additions belong in a new ordered seed file or an explicit data migration; never edit `seeds/001_reference_data.sql`. Do not add legacy `schema_migrations` markers to new files: runner history is authoritative. A schema migration must not depend on pending optional seed files; migrate runs before seed.
3. Test on a separate isolated database first. Review effects on existing records, locks, nullability, foreign keys and unresolved billing/delivery policies. Document any destructive statement, backup/maintenance needs and recovery plan in the PR. Do not invent business policy.
4. Share the new SQL, Node tooling/lockfile and documentation through a normal reviewed GitHub PR. Never commit secrets or Docker data. Each member backs up locally, pauses conflicting writes, pulls, runs `npm ci` when dependencies change, then `db:status`, `db:migrate`, `db:seed`, `db:status`.

## Failure and recovery

The runner stops on the first SQL error or warning. It records `applying` before execution and `applied` only after completion. A connection/process failure can leave `applying`; a caught SQL failure leaves `failed`. Both block future execution. MySQL DDL implicitly commits, so rollback **cannot undo a partially applied schema migration**. Seed DML in its explicit transaction rolls back on failure, but completion-marker crash windows still require review. The runner never resets, drops or retries automatically, and supplies no generic repair/force command.

Save the filename, statement number and error code; inspect target metadata/history and backup, then obtain a reviewed recovery plan. Restore a changed historical file from Git when its checksum differs; do not rewrite its stored checksum. An interrupted file may have fully committed SQL but no completion record—verify each effect before any narrowly scoped manual history repair. Do not delete history rows and rerun blindly. Keep backups protected; restore is a separate destructive action.

## Verification commands and retained test environment

```powershell
npm run db:test
node database/test-workflow.mjs
```

The integration harness creates a **new** `enterflow-migrations-workflow-test` container on `127.0.0.1:3309` with a dedicated persistent volume. It refuses existing resource names and retains all test data/resources. `node database/test-workflow.mjs --continue` explicitly reuses only that guarded, recorded test container and creates newly named test schemas without resetting previous ones. Never use this flag with a development/validation container. Output evidence: `WORKFLOW_TEST_RESULTS.json`. Test root credentials stay in memory/Docker configuration, never in Git files or command arguments. Docker administrators can inspect container configuration and therefore must be trusted.

The original `dev_mysql.py verify` expects exactly the original 70 tables/seed-only data and may reject the extra infrastructure table or later business records. Use migration status for history, baseline only for initial adoption, and data-aware checks for subsequent changes. Status validates files/history, not arbitrary schema drift after adoption; perform schema validation for every new migration review.

Implementation references: [mysql2 TLS connections](https://sidorares.github.io/node-mysql2/docs/documentation/ssl), [MySQL advisory locks](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html), [MySQL implicit commits](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html).
