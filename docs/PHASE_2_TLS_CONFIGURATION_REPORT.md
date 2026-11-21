# Isolated Phase 2 TLS repair and read-only preflight

2026-11-22, Asia/Singapore. **TLS repair: PASS. Read-only preflight: PASS WITH EXCEPTIONS. No extension execution.**

Target is **127.0.0.1:62286 / enterflow_phase2_db**, container `enterflow-phase2-mysql`, existing volume `enterflow-phase2-data`. Shared and restoration databases were not connected to or modified. The existing application runtime/configuration was unchanged.

## Certificate and handshake evidence

Generated a dedicated RSA-3072 local CA and RSA-3072 server key inside a new directory of the existing isolated volume. No private key was exported to the workspace or printed.

| Certificate property | Actual observation |
| --- | --- |
| Server subject | `CN=localhost` |
| Issuer | `CN=EnterFlow Phase2 Local Development CA` |
| SAN | `IP Address:127.0.0.1, DNS:localhost` |
| Extended key usage | TLS Web Server Authentication (`serverAuth`) |
| Basic constraints | Critical `CA:FALSE` for server; critical `CA:TRUE,pathlen:0` for CA |
| Server validity | 2026-11-21 20:56:44 GMT to 2029-02-23 20:56:44 GMT |
| Leaf SHA-256 fingerprint from live framework connection | `DD:4C:C3:18:88:44:CB:2A:71:04:76:E2:D8:CF:BD:7D:F4:63:E9:E0:91:2A:04:43:95:7B:AD:1B:DA:60:DB:2A` |

OpenSSL chain/purpose verification returned **OK** independently for `-verify_ip 127.0.0.1` and `-verify_hostname localhost`. Live MySQL STARTTLS probes returned **TLSv1.3**, cipher **TLS_AES_256_GCM_SHA384**, and **Verification: OK** for both identities. These probes ended at TLS/EOF without MySQL credentials or SQL. The final external probes used the exact target `127.0.0.1:62286` before the authenticated preflight.

The framework then independently reported `authorized: true`, expected IP `127.0.0.1`, the new issuer/SAN/fingerprint and protocol `TLSv1.3`. Certificate-chain and hostname/IP verification remain enabled; no `rejectUnauthorized: false`, altered expected identity or credential change was used.

## Docker configuration and preserved volume

Original container: `2acac2d1b6069b6ed30a95b69eb582bd68ef9f365bc092f46530306f34a9eb73`. It originally had an **empty configured HostPort**, dynamically resolved to 62286. Its authorized restart loaded the new certificate but Docker reassigned the host port to 65178. Docker's in-place update command cannot replace published bindings.

The user separately approved replacing only this isolated container while retaining its volume and the old container stopped. The replacement copied the original image/configuration/environment in memory, changed only the published binding to fixed 62286, and installed the scoped TLS configuration. Existing environment/credentials were compared for equality without logging them. No container was deleted, and no database volume was created/reset/reseeded.

Final observed state:

- Running `enterflow-phase2-mysql`: `ed47d1d4b52e35585de492d4cd899915f6ff526a0c5f9fd6de7541558939f05a`.
- Configured **and** published binding: `127.0.0.1:62286 -> 3306/tcp`.
- Existing volume still mounted read/write at `/var/lib/mysql`: **enterflow-phase2-data**.
- Original pinned MySQL image preserved.
- Old container retained as `enterflow-phase2-mysql-before-fixed-tls`, observed **Running=false**. It shares the retained volume and must remain stopped while the replacement runs.
- Descriptor updated only to record the replacement container ID (JSON formatting/BOM normalized). Database, endpoint, volume, image and credential path unchanged.

New server configuration `/etc/mysql/conf.d/enterflow-phase2-tls.cnf` points to:

```ini
[mysqld]
ssl-ca=/var/lib/mysql/enterflow-phase2-tls-v1/ca.pem
ssl-cert=/var/lib/mysql/enterflow-phase2-tls-v1/server-cert.pem
ssl-key=/var/lib/mysql/enterflow-phase2-tls-v1/server-key.pem
```

Final verified permissions: TLS directory `root:mysql` mode 750; CA signing key `root:root` mode 600; server key `mysql:mysql` mode 600; public server configuration mode 644. The MySQL image entrypoint normalized data-volume ownership on startup; CA-key ownership was restored afterward. Recheck these permissions after future image-entrypoint restarts. Original auto-generated certificate/key files were preserved.

The existing ignored client CA path was updated with the new public CA. Its previous public certificate was retained as `ca-before-san-tls.pem`. Git confirms the local CA directory and environment file are ignored and not tracked. Private keys exist only in the Docker volume outside the repository; the existing DPAPI credential was not changed.

## Actual read-only preflight

Executed successfully, exit **0**:

```powershell
node database/migrate.mjs preflight --profile phase2 --env-file database/.env.phase2.migrations.local
```

| Check | Actual result |
| --- | --- |
| TLS identity | PASS; trusted new CA, IP SAN matches, TLSv1.3 |
| Selected database/version | PASS; `enterflow_phase2_db`, MySQL **8.4.13** |
| Server UUID | `0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8`, unchanged from the previously verified original database |
| Server hostname/internal port | `2acac2d1b606` / `3306`; original hostname preserved during container replacement |
| Account | `root@%`; authenticated using the unchanged descriptor-bound DPAPI credential |
| P2B002 and installed extension structure | PASS; stage 0, **40 tables**, **39 triggers**; pinned columns/constraints/indexes/relationships match |
| `user_sessions` | PASS; absent, 001 pending |
| Isolated extension history | PASS; absent, no applied extensions and no adoption/reconciliation needed |
| `client_applications` | PASS; absent, 002 pending; no populated application table requires backfill |
| Migration grants | PASS; no required grants missing; inspected only, not changed |
| Locking prerequisites | PASS; Performance Schema=1, InnoDB table locks=1, MDL instrument=YES, own thread visible |
| Actual 003 lock acquisition | UNVERIFIED by design; preflight acquired no locks. Activation must verify its WRITE locks and emptiness before each ALTER |
| Excluded targets | PASS; shared/restoration schemas were not selected or queried |

Overall result returned by the command: **PASS WITH EXCEPTIONS**, `activationAuthorized: false`. The sole exception is deliberately untested lock acquisition. No observed object requires adoption. All three extensions remain pending, in order **001_auth_sessions.sql -> 002_client_registration.sql -> 003_username_support.sql**; none was executed.

The authenticated session issued **16 read-only statements: 15 SELECT and one SHOW GRANTS**. They covered identity; ten Information Schema metadata projections (tables, columns, key columns, constraints, indexes, CHECKs, FK actions, triggers, routines and events); cross-schema FK count; current-user grants; lock-related server variables; MDL instrumentation; and current-thread visibility. No table contents/history checksum query was needed because extension objects/history were absent. No advisory/table lock, session SET, transaction command, DDL or DML was issued.

## Exact changed files

Workspace created:

- `database/phase2-tls/configure-isolated-tls.sh` — guarded one-time certificate generation/install; refuses existing key directory.
- `database/phase2-tls/enterflow-phase2-tls.cnf` — isolated TLS configuration.
- `database/phase2-tls/fix-isolated-port.mjs` — separately approved, guarded replacement; original Docker environment stays in memory; no SQL/deletion/retry.
- `database/phase2-tls/verify-isolated-tls.ps1` — external STARTTLS-only IP/hostname probes; no authentication.
- `backend/certs/local/phase2/ca-before-san-tls.pem` — ignored preservation copy of the previous public CA.
- `docs/PHASE_2_TLS_CONFIGURATION_REPORT.md` — this completion/Database Change Report.

Workspace modified:

- `backend/certs/local/phase2/ca.pem` — ignored public CA now trusts the dedicated CA.
- `database/phase2-target.local.json` — replacement container ID; existing descriptor values preserved.

The migration client environment file and framework/application/SQL files were not edited in this task. Existing user changes, historical reports, protected Migration 007/008, Task 003 artifacts and database records were not modified.

Container/volume files created:

- `/var/lib/mysql/enterflow-phase2-tls-v1/ca-key.pem`, `ca.pem`, `ca.srl`, `server-key.pem`, `server.csr`, `server.ext`, `server-cert.pem`.
- `/etc/mysql/conf.d/enterflow-phase2-tls.cnf` installed in the original and replacement isolated containers.
- `/tmp/enterflow-phase2-tls-setup.sh` and `/tmp/enterflow-phase2-tls.cnf` in the retained original container; no cleanup performed.

The initial setup attempt stopped at a missing `hostname` executable before certificate-directory/config creation; the guard was corrected to Docker's HOSTNAME variable before successful installation. The external PowerShell probe initially hit execution-policy restrictions and ran successfully with an explicitly approved process-only override; no persistent execution policy was changed. No offline/application test suite was rerun.

## Database Change Report and stop point

**Docker/TLS changes:** new local CA/server certificates/keys and scoped server/client TLS trust; isolated restart; separately approved isolated container replacement to fix dynamic port binding; old container retained stopped; descriptor container ID updated. Existing image/environment/credentials and database volume preserved. No other database container was restarted, inspected for secrets, connected to or modified.

**Database operations:** unauthenticated STARTTLS probes, then **one authenticated framework preflight connection with 15 SELECT and one SHOW GRANTS**. **Zero SQL writes, DDL, DML, migrations, extensions, seeds, grants, execution locks, resets, restores or test records.** Schema/data changes performed: **none**. Normal MySQL startup/shutdown occurred during the scoped Docker work; no database files/records were manually edited. No backup or cleanup operation occurred. No application runtime change, deployment or Git commit.

TLS and read-only prerequisites are satisfied. Actual activation locks remain to be verified by the activation path. Stop here before extension execution; this report does not authorize activation.
