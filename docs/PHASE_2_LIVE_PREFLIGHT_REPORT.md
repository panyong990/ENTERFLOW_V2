# Phase 2 connection configuration and live preflight

2026-11-22, Asia/Singapore. Target: **127.0.0.1:62286 / enterflow_phase2_db**, container **enterflow-phase2-mysql**. Result: **FAIL at TLS identity; no authenticated SQL session and no SQL executed.**

## Configuration resolved

Created ignored `database/.env.phase2.migrations.local` with:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=62286
DB_NAME=enterflow_phase2_db
DB_MIGRATION_USER=root
DB_MIGRATION_PASSWORD_DPAPI_FILE='C:\Users\amiaz\AppData\Local\EnterFlow\Phase2\mysql-root.dpapi'
DB_SSL_CA=backend/certs/local/phase2/ca.pem
DB_TLS_SERVER_NAME=127.0.0.1
```

The existing descriptor points to this isolated root credential. The credential directory contains `mysql-root.dpapi`; it was successfully decrypted by its Windows user during the elevated framework invocation. This establishes that the local credential source is usable, not that MySQL accepted the password: TLS rejected the peer before credential dispatch. No unrelated DPAPI file or shared credential was decoded. No password was printed, saved in an environment file, passed on a command line, or copied to a new credential store.

The credential loader accepts plaintext OR descriptor-bound DPAPI, never both. DPAPI loading validates the exact target, container, descriptor credential path and root account first, then uses PowerShell SecureString conversion and an anonymous child-process pipe. Its BSTR is cleared. The existing descriptor has a UTF-8 BOM; parsing now accepts it without changing that file. No credential was generated or changed.

Copied only the isolated container's public `/var/lib/mysql/ca.pem` to ignored `backend/certs/local/phase2/ca.pem` (1112 bytes). Both the local environment file and CA path are confirmed ignored by Git. Shared application configuration and credentials were not reused or changed.

## Actual observations

| Check | Result | Evidence |
| --- | --- | --- |
| Isolated container identity | PASS | Running `/enterflow-phase2-mysql`, ID `2acac2d1b6069b6ed30a95b69eb582bd68ef9f365bc092f46530306f34a9eb73`; expected pinned image and `enterflow-phase2-data` volume. |
| Published endpoint | PASS | Docker reports `127.0.0.1:62286` mapped to container `3306/tcp`. |
| Local configuration/credential source | PASS | Dedicated configuration and matching public CA exist; descriptor-bound DPAPI loading succeeded. |
| TLS server identity | FAIL | Framework returned underlying `ERR_TLS_CERT_ALTNAME_INVALID`, expected identity `127.0.0.1`. mysql2's outer code was `HANDSHAKE_SSL_ERROR`; diagnostic now retains the original non-secret TLS classification. |
| Actual selected database, server UUID/version/account | UNVERIFIED | TLS rejected the peer before authentication or SQL. The configured target and certificate subject do not prove these live database values. |
| P2B002 tables/constraints/indexes/triggers | UNVERIFIED | No live metadata query ran. No old audit was treated as fresh evidence. |
| `user_sessions` structure and matching history | UNVERIFIED | No contents/metadata read; no adoption or replay. |
| `client_applications` existence/row count | UNVERIFIED | No query ran. |
| Migration-account grants | UNVERIFIED | No grant query or grant change ran. |
| Lock instrumentation and capability | UNVERIFIED | No capability queries or execution locks ran. Actual lock acquisition is deliberately outside read-only preflight. |
| Excluded databases unchanged by this task | PASS | No connection/query to shared port 3308 or restoration database; no application switch. This is an action record, not a fresh audit of external changes. |

Read-only public certificate inspection in the isolated container observed:

- Subject: `CN=MySQL_Server_8.4.13_Auto_Generated_Server_Certificate`.
- Issuer: `CN=MySQL_Server_8.4.13_Auto_Generated_CA_Certificate`.
- Certificate has **no extensions**, including no Subject Alternative Name.
- Validity: 2026-11-21 17:14:47 GMT through 2036-11-18 17:14:47 GMT.

The missing identity is a server-certificate defect for this endpoint. A client configuration file cannot make this certificate valid for `127.0.0.1` without changing the intended identity or weakening verification. Neither workaround was used.

## Dedicated command and results

Implemented:

```powershell
node database/migrate.mjs preflight --profile phase2 --env-file database/.env.phase2.migrations.local
```

This route verifies TLS, queries server identity, reads pinned P2B002/extension metadata and isolated history safely, counts applications, inspects current-account grants and reads lock capability metadata. It has a SELECT/SHOW-only query boundary. It does not call status/migrate, acquire an advisory/table lock, SET session values, create history, discover legacy migrations/seeds, execute DDL/DML or adopt objects. History object metadata is checked before rows, and unknown names are rejected before checksum retrieval.

Four actual command attempts occurred: (1) descriptor BOM parse failure, corrected in the loader; (2) sandbox credential-access failure; (3) authorized elevated run reached TLS and returned masked `HANDSHAKE_SSL_ERROR`; (4) authorized elevated run with corrected diagnostic returned `ERR_TLS_CERT_ALTNAME_INVALID`. All exited 1. The first two stopped locally; the last two made TCP/MySQL-protocol TLS handshake attempts to port 62286, failed before credential dispatch and executed zero SQL statements. No status/migrate command ran.

Only two narrowly scoped offline tests were added, covering newly uncovered issues: the real driver's masking of the TLS error code, and the new command's prohibition on locks/mutations. Exact command:

```powershell
node --test --test-reporter=spec --test-name-pattern="preflight TLS diagnostic|dedicated preflight uses only" database/migration-phase2-blockers.test.mjs
```

Result: **2 passed, 0 failed/cancelled/skipped/todo**, exit 0, reported duration 123.3289 ms. No completed application/framework suite was rerun. This synthetic evidence does not replace the blocked live checks.

## Required next operations

1. Issue or supply and install a valid server certificate for this isolated MySQL instance, signed by the trusted CA, with **IP SAN `127.0.0.1`**. Including **DNS SAN `enterflow-phase2-mysql`** permits that explicit certificate identity too. The server must load the matching certificate/key through its supported TLS reload or a controlled isolated-container restart. No certificate/private-key replacement, reload, restart or server configuration change occurred here. Client verification remains enabled. This is the one concrete connection blocker; no new password is currently known to be needed.
2. Rerun the exact read-only preflight command. Review actual schema/history, grant and concurrency-prerequisite results. Resolve untracked existing objects separately; particularly, installed 001 without matching history must not be replayed or automatically adopted.
3. If those checks pass, present actual effects for activation: create isolated extension history if absent; execute exact `001_auth_sessions.sql` → `002_client_registration.sql` → `003_username_support.sql`, recording checksums/applying markers and verifying each result. The normal activation profile also uses session settings, an advisory lock and verified WRITE locks/empty counts for each 003 ALTER. These operations remain **unexecuted** and subject to presenting the fresh results and exact operations first. No activation-ready claim is made now.
4. Keep the current application runtime unchanged; prepare any separate Phase 2 runtime only after the database gates are satisfied.

## Files and Database Change Report

Modified: `database/migrate.mjs`, `database/migration-phase2-tls.mjs`, `database/migration-phase2-blockers.test.mjs`.

Created: `database/migration-phase2-credentials.mjs`, `database/migration-phase2-preflight.mjs`, ignored `database/.env.phase2.migrations.local`, ignored `backend/certs/local/phase2/ca.pem`, and this report. Existing descriptor, SQL, migration core, review snapshots, application work and protected artifacts remain unchanged. No commit.

Database operations: **two failed pre-authentication TLS connection attempts to the isolated endpoint; zero authenticated database connections; zero SQL queries, writes, migrations, extensions, seeds, advisory/table locks or cleanup.** Schema/data changes: **none**. Database server/TLS configuration changes: **none**. Local configuration changes: **created dedicated ignored environment file and copied its public CA**. Existing credential was decrypted in memory only. Docker operations were inspection, public-certificate metadata reads and copying the public CA out; no Docker resource changes. No backups/restores/test records, shared/restoration database access, Migration 007/008 access, application switch or deployment occurred.
