# MySQL 8.4 compatibility test — stopped on confirmed incompatibility

Historical failed attempt. Superseded after the approved fix and isolated-schema reset by [MYSQL84_VALIDATION_FINAL.md](MYSQL84_VALIDATION_FINAL.md); the original failure evidence is preserved.

**Status: BLOCKED. The unchanged SQL does not yet pass MySQL 8.4.** No migration file was modified and no automatic repair was attempted.

| Environment | Actual result |
| --- | --- |
| Server | MySQL Community Server 8.4.13, amd64 |
| Official image | mysql:8.4, pinned as `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902` |
| Docker context | Local desktop-linux / Docker Desktop Linux named pipe |
| Container | enterflow-mysql84-validation — retained and running |
| Dedicated volume | enterflow_mysql84_validation_data — retained |
| Host port | 127.0.0.1:3307 -> container 3306 |
| Application schema | Only enterflow_mysql84_test_db was created |
| Isolation | 2 CPUs / 2 GiB; one named data-volume mount; no host/XAMPP/project mounts |
| Enforcement | Strict mode, ONLY_FULL_GROUP_BY, FK/unique checks and restrict_fk_on_non_standard_key enabled |

## Execution result

All five migration/seed hashes matched the reviewed manifest before and after testing.

| File/check | Outcome |
| --- | --- |
| 001_identity_catalog.sql | Passed; 16 tables; no SQL errors/warnings |
| 002_orders_quotations.sql | Failed at CREATE TABLE document_sequences; earlier 13 CREATEs persisted |
| 003_operations_billing.sql | Not run |
| 004_attachments_audit.sql | Not run |
| 001_reference_data.sql | Not run |
| Full 70-table/562-column/141-FK/123-key/26-CHECK verification | Not completed |
| Integrity cases | Not run |

The retained schema has **29 tables**, all observed as InnoDB/utf8mb4_unicode_ci. Only `001_identity_catalog` is recorded in schema_migrations. Reference seeds are absent (roles count 0). DDL committed before the failure; do not rerun the entire draft blindly into this partial schema.

## Confirmed issue and minimal proposed correction

MySQL error **1064 (42000)** occurs at the document_sequences statement (source lines 224–229), specifically column `last_value` on line 227. MySQL's actual information_schema.KEYWORDS reports LAST_VALUE as reserved; the official manual agrees. MariaDB accepted the unquoted name. [MySQL 8.4 reserved words](https://dev.mysql.com/doc/refman/8.4/en/keywords.html).

Proposed one-line change in migrations/002_orders_quotations.sql, **not applied**:

```diff
-  last_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
+  `last_value` BIGINT UNSIGNED NOT NULL DEFAULT 0,
```

Quoting preserves the column name, type, default and model and is portable to MariaDB/MySQL. Future counter queries must quote the identifier too. Update the draft checker to recognize quoted column identifiers, refresh documentation/review hashes and revalidate both engines after approval. A scan of every draft table/column identifier against the actual MySQL reserved-keyword list found this one collision; it does not prove that later migrations have no other issues.

No enforcement was disabled, no schema redesign was attempted and no other SQL correction is proposed without execution evidence. A clean retest needs an explicitly approved strategy for the partial test schema; nothing will be dropped or recreated automatically. The retained container/volume must remain available for inspection.

## Diagnostics and warnings

- Initial image pull failed because this session could not find Docker's installed credential helper. Only the runner's child-process PATH was adjusted; Windows PATH was unchanged, and no software was installed.
- Windows text-mode stdin introduced a carriage return into the Linux client's password line, causing a readiness timeout. Switching the runner to UTF-8 bytes fixed authentication; the existing container was retained.
- Two pre-migration runner defects were corrected: duplicate metadata-adapter initialization and a safety guard matching a harmless comment mentioning enterflow_db. Neither changed migration contents or disabled executable SQL isolation. The owned schema was confirmed empty before migration execution resumed.
- Server initialization logs contain the image's temporary empty-root-password initialization warning, self-signed CA warning and permissive PID-directory warning. The entrypoint subsequently configured the generated password; authenticated checks succeeded. These startup warnings are separate from the confirmed SQL syntax incompatibility.
- No SQL migration warnings were returned before error 1064. No remaining migrations, seeds, business fixtures or destructive cleanup were executed after it; follow-up diagnostics were read-only.

## Protection and evidence

No SQL connection or data operation targeted XAMPP, enterflow_db or enterflow_test_db. Frontend and reviewed SQL files are unchanged. No cloud resources were created. The generated test password is not stored in project files or reports; Docker retains its test-container configuration for future authorized access.

- [Results, hashes, exact error and partial-state diagnostics](validation_mysql84/mysql84_results.json)
- [Image pull log](validation_mysql84/image_pull.txt)
- [Server log](validation_mysql84/server_stderr.txt)
- Runner: mysql84_validate.py; `--failure-diagnostics` reads the recorded failed instance only. Do not run its creation mode against existing resources.

**Readiness:** MariaDB testing remains passed for the old reviewed draft; MySQL compatibility is blocked by the reserved identifier. Cloud SQL readiness cannot be declared. Await approval before modifying the SQL or planning a clean retest; preserve all current test resources.
