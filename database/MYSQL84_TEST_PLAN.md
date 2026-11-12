# MySQL 8.4 compatibility test plan — awaiting approval

**This is a proposal. No Docker service/container was started, image pulled, software installed, SQL executed, migration modified or cloud resource created for this request.** Existing XAMPP and its databases remain unchanged.

## Read-only findings

- Docker CLI, Docker Desktop and standalone MySQL 8.4 were not detected in PATH, standard installation locations, running services/processes or the available Windows uninstall inventory. This does not exhaustively rule out a custom, another-user or WSL-only installation; no compatible running environment is verified yet.
- XAMPP mysqld remains running from `C:/xampp/mysql/bin/mysqld.exe`; earlier executed validation established MariaDB 10.4.32. The XAMPP binary is not a substitute for actual MySQL 8.4.
- Port 3306 is occupied by XAMPP. Port 3307 had no listener at inspection; recheck before starting anything.
- All four migrations and the reference seed still match the reviewed SHA-256 hashes in STATIC_CHECKS.json.
- The completed MariaDB run passed 70 tables, 562 columns, 141 FKs, 123 primary/unique constraints, 26 CHECKs, 126 reference rows and five ledger markers. These counts are comparison targets, not evidence of MySQL acceptance.

## Approval scope and prerequisite

Approval is required before installation/startup, image downloads, container/volume creation or SQL execution. Since Docker was not detected, confirm whether approval includes installing Docker Desktop. Check the Windows/WSL2/virtualization prerequisites before installing; report any required OS changes or restart rather than initiating them unexpectedly. An installation or image download may additionally require native system/network permission. Do not alter XAMPP configuration, service, port, installation or data directory.

If an existing Docker installation is supplied or discovered, inspect its context and daemon before use. Require a local Linux-container engine; do not use a remote, shared or production Docker context. Do not change unrelated containers/networks/volumes.

Official prerequisite reference: [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/). Official server deployment reference: [MySQL 8.4 Docker deployment](https://dev.mysql.com/doc/refman/8.4/en/linux-installation-docker.html).

## Proposed isolated resources

| Resource | Proposed value / behavior |
| --- | --- |
| Engine | Actual MySQL Community Server 8.4.x from the Docker Official Image `mysql:8.4` |
| Image identity | After approval, pull, record and pin the resolved repository digest; record actual server/client version and architecture. Do not invent a digest or substitute MariaDB/latest |
| Container | `enterflow-mysql84-validation` |
| Dedicated data volume | `enterflow_mysql84_validation_data`; no XAMPP or project directories mounted as MySQL data |
| Host binding | `127.0.0.1:3307` -> container port 3306; no public/network-wide binding |
| Application test database | `enterflow_mysql84_test_db`, inside the new MySQL server only |
| Credentials | Generated test-only password, kept out of Git, shell arguments and reports; supplied through process environment/stdin as needed. No XAMPP credentials reused or accounts/grants modified |
| Resource limits | Proposed container limit: 2 CPUs and 2 GiB RAM; confirm host capacity before launch |
| Lifecycle | Dedicated validation instance/data only; retain after testing. No automatic container/volume/database deletion or --rm |

If the proposed container name or volume already exists, stop and report; do not attach old data, overwrite, remove, rename or automatically select another resource. If port 3307 is occupied, stop and propose another binding. Check that the application test schema is absent before creating it; use CREATE DATABASE without IF NOT EXISTS so an unexpected existing schema causes failure. MySQL initialization necessarily creates its own system schemas inside the new dedicated volume; existing servers/databases are not targeted.

Use the MySQL client inside the verified container for migrations/tests. This keeps the execution route independent of XAMPP's client/port. Before any DDL, assert the exact container/image identity, MySQL 8.4 server version, server UUID and selected test database. Never fall back to localhost:3306 on Windows. No application SQL will target enterflow_db or either XAMPP schema.

## Test sequence after approval

1. **Prepare the local runtime.** Resolve the Docker prerequisite above; inspect local context/daemon, ports, available memory/disk and resource-name collisions. No remote engine or existing volume reuse.
2. **Pin and start MySQL 8.4.** Pull the official image after approval, record its digest, create the dedicated volume/container and wait for readiness with bounded checks. Capture startup logs and server settings. No project dependency installation or frontend build is needed.
3. **Establish a strict baseline.** Verify InnoDB, strict SQL mode, UTC session, FK/unique enforcement and CHECK enforcement metadata. Keep MySQL's standard referenced-key restrictions enabled; do not relax settings to force a pass. Migrations' explicit utf8mb4_unicode_ci declarations must work despite a different server default collation.
4. **Verify hashes and create only the new test schema.** Compare every reviewed fingerprint immediately before use. Confirm application-schema absence and explicitly select enterflow_mysql84_test_db. Stop on a hash mismatch or unexpected existing object.
5. **Apply the unchanged files, in order:**

   | Order | File | Expected new tables |
   | --- | --- | --- |
   | 1 | migrations/001_identity_catalog.sql | 16 |
   | 2 | migrations/002_orders_quotations.sql | 14 |
   | 3 | migrations/003_operations_billing.sql | 29 |
   | 4 | migrations/004_attachments_audit.sql | 11 |
   | 5 | seeds/001_reference_data.sql | 0 |

   One file per controlled batch operation; capture full errors/warnings and completion markers. No --force for migrations/seeds. Stop at the first migration/seed error. Preserve partial state for review; do not automatically alter the SQL, rerun, drop/recreate or import over it.

6. **Compare all actual definitions with the drafts.** Verify the exact 70-table set, all 562 columns, nullability/defaults/precision/enum labels/charset/collation, declared indexes, all 123 PK/unique definitions and all 141 FKs with their ordered columns/parent schemas/actions. Verify all 26 named CHECK expressions and ENFORCED state. Compare every seed value: 126 reference rows plus five migration markers; all other 59 tables should be empty. Additional implicit indexes may differ between engines: verify their purpose rather than requiring MariaDB's physical index count/names.
7. **Run rollback-based tests.** Port the 81 MariaDB cases to the new MySQL-only runner. Exercise all 26 named CHECKs, critical same-order/client links, NULL-bypass protection, one accepted signed copy per DR, multiple staged/discarded copies, invoice evidence restricted to accepted same-order receipts, quote-reference ownership/revisions, idempotency, restrictive parent operations, valid links, UTF-8 and exact decimal round trips. Expected error codes/messages will be MySQL-specific. Use savepoints and final ROLLBACK, then compare all seed values/row counts and run orphan checks. A test-only --force mode may collect explicitly expected failures; any unclassified error fails validation. Test AUTO_INCREMENT gaps may persist even after rollback; document them and never reseed to hide them.
8. **Re-verify and report.** Recompare final metadata and seeds, confirm no test rows remain and reviewed SQL hashes are unchanged. Record passed/failed/untested checks, version/digest, diagnostic output and any host/runtime issues. Preserve the dedicated container/volume/test schema; report their final state. Main-database migration and teardown remain separately unauthorized.

## Adapt the harness, not the production SQL

The current `phase3_validate.py` is deliberately hardcoded to XAMPP/enterflow_test_db and **must not be run unchanged for this phase**. Prepare a separate MySQL-only runner under database/ that verifies the isolated container identity and schema on every execution path. Reuse the reviewed comparison logic and fixture intentions, with these diagnostic changes:

- MySQL does not use MariaDB's check_constraint_checks session variable. Inspect MySQL CHECK enforcement using its information_schema metadata instead.
- MySQL CHECK_CONSTRAINTS metadata must be joined to TABLE_CONSTRAINTS where needed to identify the table and ENFORCED state; do not assume MariaDB's metadata columns.
- Normalize equivalent integer display widths, BOOLEAN, default expressions/default-generated flags and restrictive NO ACTION/RESTRICT representations while preserving real type, NULL, precision, enum or action differences.
- Expect MySQL's CHECK violation code (typically 3819) rather than requiring MariaDB 4025. Confirm constraint identity and actual rejection; do not turn a different earlier constraint rejection into a false targeted pass.
- Account for server-created FK/index names. Keep referenced keys explicitly unique and leave MySQL 8.4's restrict_fk_on_non_standard_key enabled. [MySQL 8.4 FK restrictions](https://dev.mysql.com/doc/refman/8.4/en/ansi-diff-foreign-keys.html).
- Nullable acceptance-slot UNIQUE/CHECK/FK behavior, cross-order ownership constraints and all draft session SET statements must be exercised on the actual server. MariaDB results do not settle them.

These are known test-runner differences, not established migration incompatibilities. **No production SQL correction is proposed before actual MySQL execution.**

## Failure/correction policy

For any migration/seed failure, report file, failing statement, server version/settings, exact error and partial completion state first. Propose the smallest portable SQL correction with its effect on integrity and the existing MariaDB model; do not edit migration files automatically or disable enforcement. A reported correction requires approval before changing the reviewed SQL and planning revalidation on both engines. Harness parsing/metadata differences must be distinguished from schema defects and documented transparently.

## Success criteria and remaining boundaries

Success means unchanged reviewed migrations/seeds execute on actual MySQL 8.4, complete schema/seed comparisons pass, the targeted rollback tests pass, and no existing server/database/frontend was modified. Report engine differences even when semantically equivalent.

No Node/Express implementation, GCS operations, Google Cloud resources, production installation, unrelated Docker changes or cleanup is included. No billing, allocation, delivery cardinality, receipt timing or replacement policy will be invented. A single-connection test does not establish concurrent application correctness. Passing local MySQL improves engine compatibility evidence but does not validate Cloud SQL-specific networking, IAM, flags, backups or deployment behavior.

**Awaiting approval of the test plan and clarification whether Docker installation is included. No containers or SQL have been run for this request.**
