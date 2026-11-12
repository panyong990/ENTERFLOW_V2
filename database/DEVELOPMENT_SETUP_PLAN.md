# Phase 5 — permanent local database setup plan

Approved and completed. This document preserves the original execution plan; see [DEVELOPMENT.md](DEVELOPMENT.md) for the installed state, verification results and operating instructions.

**Awaiting approval.** Only read-only environment checks and configuration preparation have been performed. No permanent container/volume, secret file, database or SQL account has been created. No SQL was executed for this phase.

## Verified environment

- Docker Desktop's local `desktop-linux` engine is running (29.9.2, Linux, 12 CPUs, approximately 8 GB VM RAM).
- `enterflow-mysql-dev` and `enterflow-mysql-dev-data` do not exist; port 3308 has no listener. Recheck all three immediately before creating resources; any collision is a stop condition.
- The validation container is running unchanged: `enterflow-mysql84-validation`, port 127.0.0.1:3307, dedicated `enterflow_mysql84_validation_data` volume. It will not be reused, stopped, reset or modified.
- XAMPP still has port 3306. No SQL, data-directory or configuration access to XAMPP is part of this setup.
- All four migration hashes and the seed hash match both STATIC_CHECKS.json and the successful MySQL validation result.
- The exact validated amd64 MySQL 8.4.13 image is already local, pinned by digest below. No latest tag or image upgrade is proposed.

## Resources to create after approval

| Setting | Value |
| --- | --- |
| Container | enterflow-mysql-dev |
| Application database | enterflow_db, only inside the new container |
| Host endpoint | 127.0.0.1:3308 |
| Container port | 3306 |
| Persistent volume | enterflow-mysql-dev-data -> /var/lib/mysql |
| Image | mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902 |
| Limits | 2 CPUs / 2 GiB RAM |
| Restart policy | unless-stopped |
| Files | compose.dev.yaml, .env.dev.example; real secrets only in ignored .env.dev |

Compose uses the existing Docker bridge network and the new named volume, with no XAMPP/project data bind mounts and no public port binding. MySQL's own system schemas are initialized inside that new volume. The image's MYSQL_DATABASE setting creates only the new container's enterflow_db on its first start; it does not reference the same-named XAMPP database.

## Exact execution sequence — after approval only

Commands below run from the existing workspace root. They are a reviewable plan, not instructions already executed. The orchestration must first recheck names/port/image/hashes, lock its target to the new container ID/image/volume/binding and verify the actual server version/UUID before application SQL. No resource reuse or automatic overwrite on conflicts.

1. Generate two distinct random passwords directly into a **new**, Git-ignored database/.env.dev. Do not overwrite an existing secret file or echo secrets. Example creation command (no SQL):

   ```powershell
   @'
   from pathlib import Path
   import secrets
   target = Path('database/.env.dev')
   with target.open('x', encoding='utf-8') as out:
       out.write('MYSQL_ROOT_PASSWORD=' + secrets.token_hex(32) + '\n')
       out.write('DB_HOST=127.0.0.1\nDB_PORT=3308\nDB_NAME=enterflow_db\nDB_USER=enterflow_app\n')
       out.write('DB_PASSWORD=' + secrets.token_hex(32) + '\nDB_POOL_MAX=5\nDB_TIMEZONE=Z\nDB_SOCKET_PATH=\n')
   '@ | python -
   ```

   Keep the actual file private, verify Git ignores it and never display resolved Compose configuration containing secrets. No credentials belong in React/VITE_* variables. Only local generated test/development credentials are involved; no cloud credentials are configured.

2. Validate configuration without printing secrets, then create only the dedicated resources:

   ```powershell
   docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml config --quiet
   docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml up -d --wait
   ```

   `up` creates the new named volume/container and initializes enterflow_db. The health check runs SELECT 1 inside that container only. `pull_policy: never` ensures this uses the exact already-validated local image; if absent, stop rather than substituting another image.

3. Confirm container ID, pinned image, loopback binding, exclusive data mount, MySQL 8.4.13, server UUID, strict mode and selected enterflow_db. Require it to be empty before imports. Do not run this phase's SQL through the XAMPP client or the old validation harness. Then apply the unchanged files in order, stopping on the first error:

   ```powershell
   $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
   $migrationFiles = @(
     'database/migrations/001_identity_catalog.sql',
     'database/migrations/002_orders_quotations.sql',
     'database/migrations/003_operations_billing.sql',
     'database/migrations/004_attachments_audit.sql',
     'database/seeds/001_reference_data.sql'
   )
   foreach ($migrationFile in $migrationFiles) {
     Get-Content -LiteralPath $migrationFile -Raw -Encoding UTF8 |
       docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml exec -T mysql sh -c 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --protocol=socket --user=root --database=enterflow_db --batch --default-character-set=utf8mb4 --show-warnings'
     if ($LASTEXITCODE -ne 0) { throw "Stopped at $migrationFile; inspect partial state before recovery." }
   }
   ```

   No --force, DROP/DELETE/TRUNCATE, automatic reset or arbitrary business fixtures. DDL commits persist; an error is reported before any recovery. Runtime identity guards and process-stdin handling may be implemented in a small database-management helper rather than relying on manual shell context; the same target, files, order and error-stop behavior apply.

4. Provision `enterflow_app` inside this container using DB_PASSWORD from the ignored configuration, with only SELECT/INSERT/UPDATE/DELETE on enterflow_db.*. Initial installation/future DDL uses the separate root administrative identity inside the container. Root remains local to the container; do not enable root@% or grant backend DDL/global privileges. The reviewed SQL account operations are:

   ```sql
   CREATE USER 'enterflow_app'@'%' IDENTIFIED BY '<generated DB_PASSWORD supplied through stdin>';
   GRANT SELECT, INSERT, UPDATE, DELETE ON enterflow_db.* TO 'enterflow_app'@'%';
   ```

   The placeholder is never executed literally. Resolve the generated value in memory and send SQL through stdin, without putting credentials in arguments, logs or SQL files. This is a MySQL connection account, not a seeded Enter-Flow application user. No application login/password record is invented.

5. Verify all 70 tables/562 columns/141 FKs/123 primary-unique keys/26 enforced CHECKs and all reference values (126 rows plus 5 ledger markers). Reuse the proven read-only comparison, adapted to this container and schema. Confirm the other 59 tables are empty and verify the app account can authenticate on host port 3308 with the intended privileges. Do not repeat the 81 business-fixture tests: image and SQL are unchanged.

6. Restart only the new development container, then confirm the same volume/server UUID, schema, ledger and seed values survived. This establishes persistence without inserting production-like data. The validation container and XAMPP remain untouched.

## Management and future backend documentation

After installation, record verified status/UUID/volume/SQL hashes, and finish a concise operations guide covering these commands:

```powershell
# Start / stop / restart ONLY the development service; named volume is retained.
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml start --wait
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml stop
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml restart

# Administrative shell in the new container; -p prompts rather than exposing a password.
docker --context desktop-linux compose --env-file database/.env.dev -f database/compose.dev.yaml exec mysql mysql --protocol=socket --user=root -p enterflow_db
```

Never use down -v, docker volume rm/prune or a global Docker cleanup. GUI connection settings: 127.0.0.1, port 3308, enterflow_db, enterflow_app, generated DB_PASSWORD; use a MySQL 8.4-compatible driver. Root admin stays inside the container.

The operations guide will include target-only logical backups with mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF and binary-safe output (avoid Windows PowerShell's UTF-16 redirection), private/Git-ignored backup storage, guarded restore into the explicit development target, and ordered future migrations checked against the ledger. Restore is potentially overwriting and must not run as an unattended setup test. Creating/verifying a backup can be read-only; no restore or destructive recovery is included in initial installation.

Future Express configuration uses server-only DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_POOL_MAX and UTC handling. Use a small pool, decimal-safe money handling and string BIGINT IDs. Later Cloud Run selects a Cloud SQL connector/private-network/socket connection through the connection configuration layer and runtime secrets; business logic/schema remain unchanged. No backend implementation or cloud resource creation now. Uploaded file bytes remain in private Google Cloud Storage; MySQL holds metadata/references only.

**Approval boundary:** creating the real secret file, starting the permanent container/volume, initializing MySQL, importing SQL, creating the restricted connection account and restart/persistence verification wait for explicit approval. Only this dedicated Docker development environment is in scope; existing XAMPP and validation databases/volumes are protected.
