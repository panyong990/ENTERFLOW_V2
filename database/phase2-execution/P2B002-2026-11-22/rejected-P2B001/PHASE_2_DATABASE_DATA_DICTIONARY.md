# Phase 2 database data dictionary

## Actual Phase 2 dictionary — created 2026-11-22

The current `enterflow_phase2_db` schema has been executed and inspected. Its **complete actual column dictionary** is [after-metadata.json](../database/phase2-execution/2026-11-22-bootstrap/after-metadata.json): `columns` records every table/column, position, MySQL type, nullability, default, extra and generated expression; `keys`, `constraints`, `checks`, `indexes` and `referentialActions` record exact relationships and safeguards. Human-readable definitions for every current attribute and constraint are in [actual SHOW CREATE TABLE output](../database/phase2-execution/2026-11-22-bootstrap/actual-show-create-tables.txt) and the [executed bootstrap](../database/phase2-bootstrap/P2B001_corrected_database_bootstrap.sql). The [manifest](../database/phase2-bootstrap/P2B001_tables.txt) lists all 71 tables. All 71 exact row counts are zero.

Important current differences: quotation costing has mandatory exact line ownership; request-time provenance is mandatory because this is a fresh schema; raw and finished balances/thresholds default NULL/unknown rather than zero; `materials.approved_costing_price` is separate from PDF reference prices (the ambiguous legacy `unit_price` column is not carried over); JO snapshots retain all template fields and no legacy source IDs; invoice PO linkage is mandatory and JO is derived later; delivery references replace shipment carriers; receipt evidence and confirmed transactions are separate. `users` provides both account subtypes and one-company-login uniqueness, with explicit session DDL in the new target. No old migration-ledger or unknown session definition is manufactured into this target.

The [execution report](PHASE_2_DATABASE_MIGRATION_REPORT.md) records actual constraint/index totals, the target UUID, backup rehearsal and unresolved business/writer activation requirements. The source-derived dictionary below is preserved historical comparison evidence and **must not be mistaken for current target metadata**.

## Historical source/candidate dictionary — 2026-11-21

Date: 2026-11-21, Asia/Singapore. **Proposed staged correction, not deployed metadata.** No SQL or runtime verification was executed. Read the [correction report](PHASE_2_DATABASE_ERD_CORRECTION_REPORT.md) and [migration report](PHASE_2_DATABASE_MIGRATION_REPORT.md) for evidence, approvals, data reconciliation and compatibility gates.

Physical equivalents from the revised ERD are retained. The inventory below contains all 71 known source declaration bodies with the documented materials overlay and E01/E02 additions, plus 11 new E03 definitions. Retiring legacy structures are explicitly labelled and remain only for controlled transition/history; they are not an additional permanent business model. Definitions marked RETAIN/REWIRE still show existing carriers until the separately approved contract migration replaces them. They must not be deployed as a parallel active model.

These declarations are a documentation projection, not a bootstrap script: table dependency order, actual deployed drift and pending contract transformations prevent executing this document. Canonical executable candidates are the three explicitly named SQL files. All supplied CREATE candidates use InnoDB, utf8mb4/utf8mb4_unicode_ci; ASCII/binary and other column overrides remain as declared. Omitted FK actions in candidates use MySQL RESTRICT/NO ACTION semantics, never cascading business-history deletion. Live FK actions must still be reconciled.

Generated columns are not introduced. Derived totals/display aliases from the conceptual drawing need not be new stored facts: line totals derive from frozen quantity/price, clients/PO/invoices derive through owner chains, and notification read state belongs to recipients. No new lookup, report table, credentials store, invented prices/BOM or population is introduced.

Each section describes purpose, disposition, every known column type/null/default and exact keys/checks. Column key participation is an aid; composite scopes and CHECK expressions are authoritative in the declaration block. See the ERD FK table for parent/child cardinalities. Existing default zeros do not establish observed stock or approved prices. Source-aware material definitions replace the original defaults/checks rather than classifying records. Text dimensions retain original units/free text; new manufacturing items copy them at issuance from authentic evidence.

## schema_migrations

Original version markers

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `version` | `VARCHAR(100)` | No | `No explicit default` | PK |
| `applied_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  version VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
```

## roles

Nine role identities

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `code` | `VARCHAR(24)` | No | `No explicit default` | PK |
| `label` | `VARCHAR(80)` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
```

## modules

UI module identifiers

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `code` | `VARCHAR(40)` | No | `No explicit default` | PK |
| `label` | `VARCHAR(80)` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  code VARCHAR(40) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
```

## role_modules

Role-to-module junction

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `role_code` | `VARCHAR(24)` | No | `No explicit default` | PK, FK |
| `module_code` | `VARCHAR(40)` | No | `No explicit default` | PK, FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  role_code VARCHAR(24) NOT NULL,
  module_code VARCHAR(40) NOT NULL,
  PRIMARY KEY (role_code, module_code),
  FOREIGN KEY (role_code) REFERENCES roles(code),
  FOREIGN KEY (module_code) REFERENCES modules(code)
```

## payment_terms

Term codes and days after receipt

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `code` | `VARCHAR(24)` | No | `No explicit default` | PK |
| `label` | `VARCHAR(80)` | No | `No explicit default` | — |
| `days_after_receipt` | `SMALLINT UNSIGNED` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  days_after_receipt SMALLINT UNSIGNED NOT NULL
```

## clients

Company identity, contacts, account settings

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `company_name` | `VARCHAR(200)` | No | `No explicit default` | UQ |
| `industry` | `VARCHAR(120)` | Yes | `No explicit default` | — |
| `contact_person` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `email` | `VARCHAR(254)` | Yes | `No explicit default` | — |
| `phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `address_line1` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `address_line2` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `city_province` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `postal_code` | `VARCHAR(20)` | Yes | `No explicit default` | — |
| `payment_term_code` | `VARCHAR(24)` | Yes | `No explicit default` | FK |
| `internal_notes` | `TEXT` | Yes | `No explicit default` | — |
| `active` | `BOOLEAN` | No | `TRUE` | — |
| `joined_on` | `DATE` | Yes | `No explicit default` | — |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `updated_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  industry VARCHAR(120) NULL,
  contact_person VARCHAR(160) NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(40) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city_province VARCHAR(160) NULL,
  postal_code VARCHAR(20) NULL,
  payment_term_code VARCHAR(24) NULL,
  internal_notes TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_on DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_client_company (company_name),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code)
```

## users

Employee/client credentials, role and company link

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `role_code` | `VARCHAR(24)` | No | `No explicit default` | CHECK, FK |
| `client_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | CHECK, FK, UQ |
| `account_type` | `ENUM('employee','client')` | No | `No explicit default` | CHECK |
| `display_name` | `VARCHAR(160)` | No | `No explicit default` | — |
| `email` | `VARCHAR(254)` | No | `No explicit default` | UQ |
| `username` | `VARCHAR(100)` | No | `No explicit default` | UQ |
| `phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `password_hash` | `VARCHAR(255)` | No | `No explicit default` | — |
| `employee_number` | `VARCHAR(80)` | Yes | `No explicit default` | UQ, CHECK |
| `department` | `VARCHAR(120)` | Yes | `No explicit default` | — |
| `job_title` | `VARCHAR(120)` | Yes | `No explicit default` | — |
| `active` | `BOOLEAN` | No | `TRUE` | — |
| `email_alerts` | `BOOLEAN` | No | `TRUE` | — |
| `joined_on` | `DATE` | Yes | `No explicit default` | — |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `updated_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_code VARCHAR(24) NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  account_type ENUM('employee','client') NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL,
  username VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NULL,
  password_hash VARCHAR(255) NOT NULL,
  employee_number VARCHAR(80) NULL,
  department VARCHAR(120) NULL,
  job_title VARCHAR(120) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  joined_on DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_email (email),
  UNIQUE KEY uq_user_username (username),
  UNIQUE KEY uq_employee_number (employee_number),
  CONSTRAINT ck_user_identity CHECK (
    (account_type = 'client' AND role_code = 'client' AND client_id IS NOT NULL AND employee_number IS NULL)
    OR (account_type = 'employee' AND role_code <> 'client' AND client_id IS NULL)
  ),
  FOREIGN KEY (role_code) REFERENCES roles(code),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  UNIQUE KEY uq_erd_user_client (id, client_id)
```

## client_applications

Pending and decided registration applications

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `company_name` | `VARCHAR(200)` | No | `No explicit default` | — |
| `contact_person` | `VARCHAR(160)` | No | `No explicit default` | — |
| `email` | `VARCHAR(254)` | No | `No explicit default` | INDEX |
| `username` | `VARCHAR(100)` | No | `No explicit default` | INDEX |
| `phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `password_hash` | `VARCHAR(255)` | No | `No explicit default` | — |
| `status` | `ENUM('pending','approved','rejected')` | No | `'pending'` | INDEX |
| `submitted_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |
| `decided_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `decided_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `rejection_reason` | `TEXT` | Yes | `No explicit default` | — |
| `approved_client_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL,
  username VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  decided_at DATETIME(3) NULL,
  decided_by BIGINT UNSIGNED NULL,
  rejection_reason TEXT NULL,
  approved_client_id BIGINT UNSIGNED NULL,
  KEY ix_application_review (status, submitted_at),
  KEY ix_application_email (email),
  KEY ix_application_username (username),
  FOREIGN KEY (decided_by) REFERENCES users(id),
  FOREIGN KEY (approved_client_id) REFERENCES clients(id)
```

## filter_types

Product type and template group

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `code` | `VARCHAR(24)` | No | `No explicit default` | PK |
| `label` | `VARCHAR(100)` | No | `No explicit default` | — |
| `template_group` | `VARCHAR(24)` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  template_group VARCHAR(24) NOT NULL
```

## product_specifications

Client-owned dimensions and product descriptions

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `filter_type_code` | `VARCHAR(24)` | No | `No explicit default` | FK |
| `filter_name` | `VARCHAR(200)` | No | `No explicit default` | — |
| `od1` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `od2` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `id1` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `id2` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `height` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `overall_height` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `length` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `width` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `thickness` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `depth` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `pocket_count` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `diameter` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `cloth_cutting_width` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `cloth_cutting_length` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `spring_plate_center_to_center` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `spring_plate_width` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `spring_plate_length` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `pad_od` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `pad_id` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `media` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `inner_core` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `outer_core` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `oring` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `gasket` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `end_cap` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `oem_part_number` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `brand` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `filtration_rating` | `VARCHAR(120)` | Yes | `No explicit default` | — |
| `others` | `TEXT` | Yes | `No explicit default` | — |
| `notes` | `TEXT` | Yes | `No explicit default` | — |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  filter_type_code VARCHAR(24) NOT NULL,
  filter_name VARCHAR(200) NOT NULL,
  od1 VARCHAR(100) NULL,
  od2 VARCHAR(100) NULL,
  id1 VARCHAR(100) NULL,
  id2 VARCHAR(100) NULL,
  height VARCHAR(100) NULL,
  overall_height VARCHAR(100) NULL,
  length VARCHAR(100) NULL,
  width VARCHAR(100) NULL,
  thickness VARCHAR(100) NULL,
  depth VARCHAR(100) NULL,
  pocket_count VARCHAR(100) NULL,
  diameter VARCHAR(100) NULL,
  cloth_cutting_width VARCHAR(100) NULL,
  cloth_cutting_length VARCHAR(100) NULL,
  spring_plate_center_to_center VARCHAR(100) NULL,
  spring_plate_width VARCHAR(100) NULL,
  spring_plate_length VARCHAR(100) NULL,
  pad_od VARCHAR(100) NULL,
  pad_id VARCHAR(100) NULL,
  media VARCHAR(255) NULL,
  inner_core VARCHAR(255) NULL,
  outer_core VARCHAR(255) NULL,
  oring VARCHAR(255) NULL,
  gasket VARCHAR(255) NULL,
  end_cap VARCHAR(255) NULL,
  oem_part_number VARCHAR(160) NULL,
  brand VARCHAR(160) NULL,
  filtration_rating VARCHAR(120) NULL,
  others TEXT NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_spec_client (id, client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (filter_type_code) REFERENCES filter_types(code)
```

## material_categories

Raw-material classifications

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `code` | `VARCHAR(32)` | No | `No explicit default` | PK |
| `label` | `VARCHAR(80)` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
```

## units

Internal unit codes

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `code` | `VARCHAR(16)` | No | `No explicit default` | PK |
| `label` | `VARCHAR(40)` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  code VARCHAR(16) NOT NULL PRIMARY KEY,
  label VARCHAR(40) NOT NULL
```

## materials

Material identity, price provenance, stock and threshold

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `name` | `VARCHAR(200)` | No | `No explicit default` | INDEX |
| `category_code` | `VARCHAR(32)` | Yes | `No explicit default` | INDEX, FK |
| `unit_code` | `VARCHAR(16)` | No | `No explicit default` | FK, UQ |
| `unit_price` | `DECIMAL(15,4)` | No | `0` | CHECK |
| `quantity_on_hand` | `DECIMAL(15,4)` | Yes | `NULL` | CHECK |
| `reorder_threshold` | `DECIMAL(15,4)` | Yes | `NULL` | CHECK |
| `supplier_name` | `VARCHAR(200)` | Yes | `No explicit default` | — |
| `active` | `BOOLEAN` | No | `TRUE` | — |
| `updated_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `item_code` | `VARCHAR(80)` | Yes | `No explicit default` | UQ |
| `source_unit` | `VARCHAR(32)` | Yes | `No explicit default` | — |
| `reference_unit_price` | `DECIMAL(15,4)` | Yes | `No explicit default` | CHECK |
| `reference_price_text` | `VARCHAR(32)` | Yes | `No explicit default` | — |
| `reference_price_source` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `reference_price_source_sha256` | `CHAR(64)` | Yes | `No explicit default` | UQ |
| `reference_price_page` | `SMALLINT UNSIGNED` | Yes | `No explicit default` | UQ |
| `reference_price_row` | `SMALLINT UNSIGNED` | Yes | `No explicit default` | UQ |
| `reference_price_status` | `ENUM('unreviewed','needs_review','reviewed')` | No | `'unreviewed'` | — |
| `approved_costing_price` | `DECIMAL(15,4)` | Yes | `No explicit default` | CHECK |
| `costing_price_approved_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | CHECK, FK |
| `costing_price_approved_at` | `DATETIME(3)` | Yes | `No explicit default` | CHECK |
| `quantity_status` | `ENUM('unknown','provisional_sample','verified')` | No | `'unknown'` | CHECK |
| `threshold_status` | `ENUM('unknown','provisional_sample','verified')` | No | `'unknown'` | CHECK |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_code VARCHAR(32) NULL,
  unit_code VARCHAR(16) NOT NULL,
  unit_price DECIMAL(15,4) NOT NULL DEFAULT 0,
  quantity_on_hand DECIMAL(15,4) NULL DEFAULT NULL,
  reorder_threshold DECIMAL(15,4) NULL DEFAULT NULL,
  supplier_name VARCHAR(200) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_material_category (category_code, name),
  FOREIGN KEY (category_code) REFERENCES material_categories(code),
  FOREIGN KEY (unit_code) REFERENCES units(code),
  item_code VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  source_unit VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  reference_unit_price DECIMAL(15,4) NULL,
  reference_price_text VARCHAR(32) NULL,
  reference_price_source VARCHAR(255) NULL,
  reference_price_source_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reference_price_page SMALLINT UNSIGNED NULL,
  reference_price_row SMALLINT UNSIGNED NULL,
  reference_price_status ENUM('unreviewed','needs_review','reviewed') NOT NULL DEFAULT 'unreviewed',
  approved_costing_price DECIMAL(15,4) NULL,
  costing_price_approved_by BIGINT UNSIGNED NULL,
  costing_price_approved_at DATETIME(3) NULL,
  quantity_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown',
  threshold_status ENUM('unknown','provisional_sample','verified') NOT NULL DEFAULT 'unknown',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_material_item_code (item_code),
  UNIQUE KEY uq_material_source_row (reference_price_source_sha256,reference_price_page,reference_price_row),
  CONSTRAINT ck_material_values CHECK (
    unit_price >= 0
    AND (reference_unit_price IS NULL OR reference_unit_price >= 0)
    AND (approved_costing_price IS NULL OR approved_costing_price >= 0)
    AND (quantity_on_hand IS NULL OR quantity_on_hand >= 0)
    AND (reorder_threshold IS NULL OR reorder_threshold >= 0)
    AND (
      (approved_costing_price IS NULL AND costing_price_approved_by IS NULL AND costing_price_approved_at IS NULL)
      OR (approved_costing_price IS NOT NULL AND costing_price_approved_by IS NOT NULL AND costing_price_approved_at IS NOT NULL)
    )
  ),
  CONSTRAINT ck_material_stock_provenance CHECK (
    (
      (quantity_on_hand IS NULL AND quantity_status='unknown')
      OR (quantity_on_hand IS NOT NULL AND quantity_status IN ('provisional_sample','verified'))
    )
    AND (
      (reorder_threshold IS NULL AND threshold_status='unknown')
      OR (reorder_threshold IS NOT NULL AND threshold_status IN ('provisional_sample','verified'))
    )
  ),
  CONSTRAINT fk_material_costing_price_approver FOREIGN KEY (costing_price_approved_by) REFERENCES users(id),
  UNIQUE KEY uq_erd_material_unit (id, unit_code)
```

## bom_templates

Reusable recipe and costing defaults

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `name` | `VARCHAR(200)` | No | `No explicit default` | — |
| `filter_type_code` | `VARCHAR(24)` | No | `No explicit default` | FK |
| `size_label` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `labor_cost` | `DECIMAL(15,4)` | No | `0` | CHECK |
| `markup_percent` | `DECIMAL(9,4)` | No | `0` | CHECK |
| `discount_percent` | `DECIMAL(7,4)` | No | `0` | CHECK |
| `vat_type` | `ENUM('Exclusive','Inclusive','Zero-Rated')` | No | `No explicit default` | — |
| `vat_rate` | `DECIMAL(7,4)` | No | `No explicit default` | CHECK |
| `include_labor` | `BOOLEAN` | No | `No explicit default` | — |
| `apply_markup` | `BOOLEAN` | No | `No explicit default` | — |
| `apply_vat` | `BOOLEAN` | No | `No explicit default` | — |
| `notes` | `TEXT` | Yes | `No explicit default` | — |
| `created_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  filter_type_code VARCHAR(24) NOT NULL,
  size_label VARCHAR(40) NULL,
  labor_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
  markup_percent DECIMAL(9,4) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  vat_type ENUM('Exclusive','Inclusive','Zero-Rated') NOT NULL,
  vat_rate DECIMAL(7,4) NOT NULL,
  include_labor BOOLEAN NOT NULL,
  apply_markup BOOLEAN NOT NULL,
  apply_vat BOOLEAN NOT NULL,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_template_cost CHECK (labor_cost >= 0 AND markup_percent >= 0 AND discount_percent BETWEEN 0 AND 100 AND vat_rate BETWEEN 0 AND 100),
  FOREIGN KEY (filter_type_code) REFERENCES filter_types(code),
  FOREIGN KEY (created_by) REFERENCES users(id)
```

## bom_template_lines

Per-template material consumption and waste

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `template_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `line_number` | `SMALLINT UNSIGNED` | No | `No explicit default` | UQ |
| `material_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `quantity_per_filter` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `waste_percent` | `DECIMAL(7,4)` | No | `0` | CHECK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  template_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  quantity_per_filter DECIMAL(15,4) NOT NULL,
  waste_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_template_line (template_id, line_number),
  CONSTRAINT ck_template_qty CHECK (quantity_per_filter > 0 AND waste_percent BETWEEN 0 AND 100),
  FOREIGN KEY (template_id) REFERENCES bom_templates(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
```

## files

Private object metadata and lifecycle

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `original_filename` | `VARCHAR(255)` | No | `No explicit default` | — |
| `mime_type` | `VARCHAR(120)` | No | `No explicit default` | — |
| `size_bytes` | `BIGINT UNSIGNED` | No | `No explicit default` | — |
| `bucket` | `VARCHAR(63)` | No | `No explicit default` | UQ |
| `object_path` | `VARCHAR(700)` | No | `No explicit default` | UQ |
| `object_generation` | `VARCHAR(30)` | Yes | `No explicit default` | — |
| `sha256` | `CHAR(64)` | Yes | `No explicit default` | — |
| `state` | `ENUM('pending','available','failed','deleted')` | No | `'pending'` | INDEX |
| `uploaded_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `uploaded_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |
| `deleted_at` | `DATETIME(3)` | Yes | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  bucket VARCHAR(63) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  object_path VARCHAR(700) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  object_generation VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  state ENUM('pending','available','failed','deleted') NOT NULL DEFAULT 'pending',
  uploaded_by BIGINT UNSIGNED NOT NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  UNIQUE KEY uq_storage_object (bucket, object_path),
  KEY ix_files_cleanup (state, uploaded_at),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
```

## order_stages

Commercial order stage lookup

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `code` | `VARCHAR(32)` | No | `No explicit default` | PK |
| `label` | `VARCHAR(80)` | No | `No explicit default` | — |
| `display_order` | `SMALLINT UNSIGNED` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL
```

## delivery_methods

Delivery/pickup method lookup

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `code` | `VARCHAR(32)` | No | `No explicit default` | PK |
| `label` | `VARCHAR(80)` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
```

## orders

Inquiry identity retained through commercial workflow

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `reference` | `VARCHAR(60)` | No | `No explicit default` | UQ |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, INDEX, FK |
| `contact_person` | `VARCHAR(160)` | No | `No explicit default` | — |
| `stage_code` | `VARCHAR(32)` | No | `No explicit default` | INDEX, FK |
| `payment_term_code` | `VARCHAR(24)` | No | `No explicit default` | FK |
| `delivery_method_code` | `VARCHAR(32)` | Yes | `No explicit default` | FK |
| `submitted_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |
| `created_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `general_notes` | `TEXT` | Yes | `No explicit default` | — |
| `urgent` | `BOOLEAN` | No | `FALSE` | INDEX |
| `requested_delivery_date` | `DATE` | Yes | `No explicit default` | INDEX |
| `reorder_source_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `archive_reason` | `ENUM('rejected','cancelled')` | Yes | `No explicit default` | — |
| `archive_note` | `TEXT` | Yes | `No explicit default` | — |
| `archived_at` | `DATETIME(3)` | Yes | `No explicit default` | INDEX |
| `archived_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `fulfillment_completed_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `updated_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(60) NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  contact_person VARCHAR(160) NOT NULL,
  stage_code VARCHAR(32) NOT NULL,
  payment_term_code VARCHAR(24) NOT NULL,
  delivery_method_code VARCHAR(32) NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NOT NULL,
  general_notes TEXT NULL,
  urgent BOOLEAN NOT NULL DEFAULT FALSE,
  requested_delivery_date DATE NULL,
  reorder_source_id BIGINT UNSIGNED NULL,
  archive_reason ENUM('rejected','cancelled') NULL,
  archive_note TEXT NULL,
  archived_at DATETIME(3) NULL,
  archived_by BIGINT UNSIGNED NULL,
  fulfillment_completed_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_order_reference (reference),
  UNIQUE KEY uq_order_client_pair (id, client_id),
  KEY ix_order_client (client_id, submitted_at),
  KEY ix_order_queue (stage_code, archived_at, urgent, requested_delivery_date),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (stage_code) REFERENCES order_stages(code),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code),
  FOREIGN KEY (delivery_method_code) REFERENCES delivery_methods(code),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (archived_by) REFERENCES users(id),
  FOREIGN KEY (reorder_source_id, client_id) REFERENCES orders(id, client_id)
```

## order_items

Ordered product lines and client-owned specifications

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `line_number` | `SMALLINT UNSIGNED` | No | `No explicit default` | UQ |
| `specification_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `quantity` | `INT UNSIGNED` | No | `No explicit default` | CHECK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  specification_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_order_item_line (order_id, line_number),
  UNIQUE KEY uq_item_order (id, order_id),
  UNIQUE KEY uq_item_client (id, client_id),
  UNIQUE KEY uq_item_order_client (id, order_id, client_id),
  CONSTRAINT ck_order_item_qty CHECK (quantity >= 10),
  FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (specification_id, client_id) REFERENCES product_specifications(id, client_id)
```

## quotation_references

Quote number ownership by one order

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `reference` | `VARCHAR(60)` | No | `No explicit default` | PK, UQ |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  reference VARCHAR(60) NOT NULL PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_quote_reference_owner (reference, order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
```

## quotations

Revision headers and financial/delivery snapshot

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `reference` | `VARCHAR(60)` | No | `No explicit default` | UQ, FK |
| `revision_number` | `SMALLINT UNSIGNED` | No | `No explicit default` | UQ |
| `status` | `ENUM('draft','sent','superseded')` | No | `'draft'` | — |
| `issued_on` | `DATE` | No | `No explicit default` | CHECK |
| `valid_until` | `DATE` | No | `No explicit default` | CHECK |
| `payment_term_code` | `VARCHAR(24)` | No | `No explicit default` | FK |
| `time_of_delivery` | `VARCHAR(255)` | No | `No explicit default` | — |
| `place_of_delivery` | `TEXT` | No | `No explicit default` | — |
| `note` | `TEXT` | Yes | `No explicit default` | — |
| `note_highlighted` | `BOOLEAN` | No | `FALSE` | — |
| `total_amount` | `DECIMAL(15,2)` | No | `No explicit default` | CHECK |
| `downpayment_percent` | `DECIMAL(7,4)` | No | `0` | CHECK |
| `downpayment_amount` | `DECIMAL(15,2)` | No | `0` | CHECK |
| `stock_checked_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `prepared_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `sent_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `sent_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL,
  revision_number SMALLINT UNSIGNED NOT NULL,
  status ENUM('draft','sent','superseded') NOT NULL DEFAULT 'draft',
  issued_on DATE NOT NULL,
  valid_until DATE NOT NULL,
  payment_term_code VARCHAR(24) NOT NULL,
  time_of_delivery VARCHAR(255) NOT NULL,
  place_of_delivery TEXT NOT NULL,
  note TEXT NULL,
  note_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  total_amount DECIMAL(15,2) NOT NULL,
  downpayment_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  downpayment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  stock_checked_at DATETIME(3) NULL,
  prepared_by BIGINT UNSIGNED NOT NULL,
  sent_by BIGINT UNSIGNED NULL,
  sent_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_quote_revision (order_id, revision_number),
  UNIQUE KEY uq_quote_reference_revision (reference, revision_number),
  UNIQUE KEY uq_quote_order (id, order_id),
  CONSTRAINT ck_quote_amounts CHECK (total_amount >= 0 AND downpayment_percent BETWEEN 0 AND 100 AND downpayment_amount BETWEEN 0 AND total_amount),
  CONSTRAINT ck_quote_dates CHECK (valid_until >= issued_on),
  FOREIGN KEY (reference, order_id) REFERENCES quotation_references(reference, order_id),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code),
  FOREIGN KEY (prepared_by) REFERENCES users(id),
  FOREIGN KEY (sent_by) REFERENCES users(id)
```

## quotation_lines

Client-facing line description, quantity and selling price

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `quotation_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK, UQ |
| `order_item_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK, UQ |
| `line_number` | `SMALLINT UNSIGNED` | No | `No explicit default` | UQ |
| `description` | `VARCHAR(255)` | No | `No explicit default` | — |
| `sub_description` | `TEXT` | Yes | `No explicit default` | — |
| `quantity` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `unit_label` | `VARCHAR(40)` | No | `No explicit default` | — |
| `unit_price` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  sub_description TEXT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  unit_label VARCHAR(40) NOT NULL,
  unit_price DECIMAL(15,4) NOT NULL,
  UNIQUE KEY uq_quote_line (quotation_id, line_number),
  CONSTRAINT ck_quote_line_values CHECK (quantity > 0 AND unit_price >= 0),
  FOREIGN KEY (quotation_id, order_id) REFERENCES quotations(id, order_id),
  FOREIGN KEY (order_item_id, order_id) REFERENCES order_items(id, order_id),
  UNIQUE KEY uq_erd_quote_line_owner
    (id, quotation_id, order_id, order_item_id)
```

## quotation_costing

Internal per-product labor/markup/VAT inputs

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `quotation_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `order_item_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `labor_cost` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `markup_percent` | `DECIMAL(9,4)` | No | `No explicit default` | CHECK |
| `discount_percent` | `DECIMAL(7,4)` | No | `0` | CHECK |
| `vat_type` | `ENUM('Exclusive','Inclusive','Zero-Rated')` | No | `No explicit default` | — |
| `vat_rate` | `DECIMAL(7,4)` | No | `No explicit default` | CHECK |
| `include_labor` | `BOOLEAN` | No | `No explicit default` | — |
| `apply_markup` | `BOOLEAN` | No | `No explicit default` | — |
| `apply_vat` | `BOOLEAN` | No | `No explicit default` | — |
| `calculated_unit_price` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `quotation_line_id` | `BIGINT UNSIGNED` | Yes | `NULL` | UQ, FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  labor_cost DECIMAL(15,4) NOT NULL,
  markup_percent DECIMAL(9,4) NOT NULL,
  discount_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  vat_type ENUM('Exclusive','Inclusive','Zero-Rated') NOT NULL,
  vat_rate DECIMAL(7,4) NOT NULL,
  include_labor BOOLEAN NOT NULL,
  apply_markup BOOLEAN NOT NULL,
  apply_vat BOOLEAN NOT NULL,
  calculated_unit_price DECIMAL(15,4) NOT NULL,
  UNIQUE KEY uq_costing_item (quotation_id, order_item_id),
  UNIQUE KEY uq_costing_source (id, order_item_id, order_id),
  CONSTRAINT ck_costing_values CHECK (labor_cost >= 0 AND markup_percent >= 0 AND discount_percent BETWEEN 0 AND 100 AND vat_rate BETWEEN 0 AND 100 AND calculated_unit_price >= 0),
  FOREIGN KEY (quotation_id, order_id) REFERENCES quotations(id, order_id),
  FOREIGN KEY (order_item_id, order_id) REFERENCES order_items(id, order_id),
  quotation_line_id BIGINT UNSIGNED NULL DEFAULT NULL,
  UNIQUE KEY uq_erd_costing_line (quotation_line_id),
  CONSTRAINT fk_erd_costing_line
    FOREIGN KEY (quotation_line_id, quotation_id, order_id, order_item_id)
    REFERENCES quotation_lines(id, quotation_id, order_id, order_item_id)
```

## quotation_bom_lines

Material name/unit/price/consumption at quote time

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `costing_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `line_number` | `SMALLINT UNSIGNED` | No | `No explicit default` | UQ |
| `material_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `material_name_snapshot` | `VARCHAR(200)` | No | `No explicit default` | — |
| `unit_snapshot` | `VARCHAR(40)` | No | `No explicit default` | — |
| `unit_price_snapshot` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `quantity_per_filter` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `waste_percent` | `DECIMAL(7,4)` | No | `0` | CHECK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  costing_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  material_name_snapshot VARCHAR(200) NOT NULL,
  unit_snapshot VARCHAR(40) NOT NULL,
  unit_price_snapshot DECIMAL(15,4) NOT NULL,
  quantity_per_filter DECIMAL(15,4) NOT NULL,
  waste_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_costing_bom_line (costing_id, line_number),
  CONSTRAINT ck_quote_bom_values CHECK (unit_price_snapshot >= 0 AND quantity_per_filter > 0 AND waste_percent BETWEEN 0 AND 100),
  FOREIGN KEY (costing_id) REFERENCES quotation_costing(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
```

## quotation_discounts

Ordered quote discount entries

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `quotation_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `line_number` | `SMALLINT UNSIGNED` | No | `No explicit default` | PK |
| `label` | `VARCHAR(160)` | No | `No explicit default` | — |
| `percent` | `DECIMAL(7,4)` | No | `No explicit default` | CHECK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  quotation_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  label VARCHAR(160) NOT NULL,
  percent DECIMAL(7,4) NOT NULL,
  PRIMARY KEY (quotation_id, line_number),
  CONSTRAINT ck_quote_discount CHECK (percent BETWEEN 0 AND 100),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id)
```

## quotation_addons

Packaging/shipping entries

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `quotation_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `kind` | `ENUM('packaging','shipping')` | No | `No explicit default` | UQ |
| `material_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `label` | `VARCHAR(200)` | No | `No explicit default` | — |
| `quantity` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `unit_price` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `include_in_unit_price` | `BOOLEAN` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('packaging','shipping') NOT NULL,
  material_id BIGINT UNSIGNED NULL,
  label VARCHAR(200) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  unit_price DECIMAL(15,4) NOT NULL,
  include_in_unit_price BOOLEAN NOT NULL,
  UNIQUE KEY uq_quote_addon (quotation_id, kind),
  CONSTRAINT ck_addon_values CHECK (quantity > 0 AND unit_price >= 0),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
```

## purchase_orders

Accepted quotation, client reference and staff clearance

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `accepted_quotation_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK, UQ |
| `reference` | `VARCHAR(60)` | No | `No explicit default` | UQ |
| `client_reference` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `uploaded_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `uploaded_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `received_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `received_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `cleared_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `cleared_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  accepted_quotation_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL,
  client_reference VARCHAR(160) NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  uploaded_by BIGINT UNSIGNED NOT NULL,
  received_at DATETIME(3) NULL,
  received_by BIGINT UNSIGNED NULL,
  cleared_at DATETIME(3) NULL,
  cleared_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_po_order (order_id),
  UNIQUE KEY uq_po_reference (reference),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (accepted_quotation_id, order_id) REFERENCES quotations(id, order_id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (received_by) REFERENCES users(id),
  FOREIGN KEY (cleared_by) REFERENCES users(id),
  UNIQUE KEY uq_erd_po_quote (id, order_id, accepted_quotation_id)
```

## order_requests

Revision, cancellation and urgent request history

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `kind` | `ENUM('cancellation','quotation_revision','urgent_upgrade')` | No | `No explicit default` | INDEX |
| `reason` | `TEXT` | No | `No explicit default` | — |
| `response` | `TEXT` | Yes | `No explicit default` | — |
| `requested_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `requested_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |
| `status` | `ENUM('pending','approved','declined','completed')` | No | `'pending'` | INDEX |
| `decided_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `decided_at` | `DATETIME(3)` | Yes | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('cancellation','quotation_revision','urgent_upgrade') NOT NULL,
  reason TEXT NOT NULL,
  response TEXT NULL,
  requested_by BIGINT UNSIGNED NOT NULL,
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  status ENUM('pending','approved','declined','completed') NOT NULL DEFAULT 'pending',
  decided_by BIGINT UNSIGNED NULL,
  decided_at DATETIME(3) NULL,
  KEY ix_order_request_queue (status, kind, requested_at),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (decided_by) REFERENCES users(id)
```

## document_sequences

Counter per document type/year

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `document_type` | `VARCHAR(16)` | No | `No explicit default` | PK |
| `document_year` | `SMALLINT UNSIGNED` | No | `No explicit default` | PK |
| ``last_value`` | `BIGINT UNSIGNED` | No | `0` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  document_type VARCHAR(16) NOT NULL,
  document_year SMALLINT UNSIGNED NOT NULL,
  `last_value` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (document_type, document_year)
```

## production_stages

Stage positions 0–8

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `position` | `SMALLINT UNSIGNED` | No | `No explicit default` | PK, CHECK |
| `label` | `VARCHAR(120)` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  position SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  CONSTRAINT ck_production_position CHECK (position BETWEEN 0 AND 8)
```

## replacement_requests

Defect/replacement request lifecycle

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `reason` | `TEXT` | No | `No explicit default` | — |
| `defect_description` | `TEXT` | No | `No explicit default` | — |
| `quantity` | `INT UNSIGNED` | No | `No explicit default` | CHECK |
| `status` | `ENUM('pending','processing','resolved')` | No | `'pending'` | — |
| `requested_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `requested_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `resolved_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `resolved_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  defect_description TEXT NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  status ENUM('pending','processing','resolved') NOT NULL DEFAULT 'pending',
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  requested_by BIGINT UNSIGNED NOT NULL,
  resolved_at DATETIME(3) NULL,
  resolved_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_replacement_order_pair (id, order_id),
  CONSTRAINT ck_replacement_qty CHECK (quantity > 0),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
```

## job_orders

Product-specific manufacturing children

LEGACY PRODUCT ROWS; map to target items, not active target JO headers.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `reference` | `VARCHAR(60)` | No | `No explicit default` | UQ |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `order_item_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `specification_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `replacement_request_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `costing_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `quantity` | `INT UNSIGNED` | No | `No explicit default` | CHECK |
| `production_due_date` | `DATE` | No | `No explicit default` | INDEX |
| `current_stage_cursor` | `SMALLINT UNSIGNED` | No | `0` | CHECK |
| `status` | `ENUM('jo','in_production','quality_inspection','ready_for_dispatch','cancelled')` | No | `'jo'` | INDEX |
| `paused` | `BOOLEAN` | No | `FALSE` | INDEX |
| `pause_reason` | `TEXT` | Yes | `No explicit default` | — |
| `materials_deducted_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `completed_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `created_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(60) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  specification_id BIGINT UNSIGNED NOT NULL,
  replacement_request_id BIGINT UNSIGNED NULL,
  costing_id BIGINT UNSIGNED NULL,
  quantity INT UNSIGNED NOT NULL,
  production_due_date DATE NOT NULL,
  current_stage_cursor SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('jo','in_production','quality_inspection','ready_for_dispatch','cancelled') NOT NULL DEFAULT 'jo',
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  pause_reason TEXT NULL,
  materials_deducted_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_jo_reference (reference),
  UNIQUE KEY uq_job_order_pair (id, order_id),
  UNIQUE KEY uq_job_client_pair (id, client_id),
  KEY ix_jo_queue (status, paused, production_due_date),
  CONSTRAINT ck_jo_values CHECK (quantity > 0 AND current_stage_cursor BETWEEN 0 AND 9),
  FOREIGN KEY (order_item_id, order_id, client_id) REFERENCES order_items(id, order_id, client_id),
  FOREIGN KEY (specification_id, client_id) REFERENCES product_specifications(id, client_id),
  FOREIGN KEY (replacement_request_id, order_id) REFERENCES replacement_requests(id, order_id),
  FOREIGN KEY (costing_id, order_item_id, order_id) REFERENCES quotation_costing(id, order_item_id, order_id),
  FOREIGN KEY (created_by) REFERENCES users(id)
```

## job_bom_lines

Frozen manufacturing recipe

RETAIN with later approved JO-item/stage or delivery FK cutover; current carrier shown below.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `job_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `line_number` | `SMALLINT UNSIGNED` | No | `No explicit default` | UQ |
| `material_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `material_name_snapshot` | `VARCHAR(200)` | No | `No explicit default` | — |
| `unit_snapshot` | `VARCHAR(40)` | No | `No explicit default` | — |
| `unit_price_snapshot` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `quantity_per_filter` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `waste_percent` | `DECIMAL(7,4)` | No | `0` | CHECK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  material_name_snapshot VARCHAR(200) NOT NULL,
  unit_snapshot VARCHAR(40) NOT NULL,
  unit_price_snapshot DECIMAL(15,4) NOT NULL,
  quantity_per_filter DECIMAL(15,4) NOT NULL,
  waste_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_job_bom_line (job_order_id, line_number),
  CONSTRAINT ck_job_bom_values CHECK (unit_price_snapshot >= 0 AND quantity_per_filter > 0 AND waste_percent BETWEEN 0 AND 100),
  FOREIGN KEY (job_order_id) REFERENCES job_orders(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
```

## production_events

Stage, pause/revert and completion events

RETAIN with later approved JO-item/stage or delivery FK cutover; current carrier shown below.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `job_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | INDEX, FK |
| `stage_position` | `SMALLINT UNSIGNED` | Yes | `No explicit default` | FK |
| `action` | `ENUM('done','reverted','paused','resumed','completed','cancelled')` | No | `No explicit default` | — |
| `reason` | `TEXT` | Yes | `No explicit default` | — |
| `performed_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `occurred_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  stage_position SMALLINT UNSIGNED NULL,
  action ENUM('done','reverted','paused','resumed','completed','cancelled') NOT NULL,
  reason TEXT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_production_history (job_order_id, occurred_at),
  FOREIGN KEY (job_order_id) REFERENCES job_orders(id),
  FOREIGN KEY (stage_position) REFERENCES production_stages(position),
  FOREIGN KEY (performed_by) REFERENCES users(id)
```

## material_movements

Quantity ledger with per-operation idempotency

LEGACY RAW MOVEMENT HISTORY; incomplete, not a trustworthy opening balance source.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `material_id` | `BIGINT UNSIGNED` | No | `No explicit default` | INDEX, FK |
| `job_order_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `kind` | `ENUM('opening','adjustment','receipt','jo_deduction','jo_restoration')` | No | `No explicit default` | — |
| `quantity_delta` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `quantity_before` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `quantity_after` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `reason` | `TEXT` | No | `No explicit default` | — |
| `reference_text` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `idempotency_key` | `VARCHAR(120)` | No | `No explicit default` | UQ |
| `performed_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `occurred_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  material_id BIGINT UNSIGNED NOT NULL,
  job_order_id BIGINT UNSIGNED NULL,
  kind ENUM('opening','adjustment','receipt','jo_deduction','jo_restoration') NOT NULL,
  quantity_delta DECIMAL(15,4) NOT NULL,
  quantity_before DECIMAL(15,4) NOT NULL,
  quantity_after DECIMAL(15,4) NOT NULL,
  reason TEXT NOT NULL,
  reference_text VARCHAR(160) NULL,
  idempotency_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_material_operation (idempotency_key),
  KEY ix_material_history (material_id, occurred_at),
  CONSTRAINT ck_material_movement CHECK (quantity_before >= 0 AND quantity_after >= 0 AND quantity_after = quantity_before + quantity_delta),
  FOREIGN KEY (material_id) REFERENCES materials(id),
  FOREIGN KEY (job_order_id) REFERENCES job_orders(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
```

## material_changes

Structured catalog field history

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `material_id` | `BIGINT UNSIGNED` | No | `No explicit default` | INDEX, FK |
| `field_name` | `VARCHAR(80)` | No | `No explicit default` | — |
| `old_value` | `TEXT` | Yes | `No explicit default` | — |
| `new_value` | `TEXT` | Yes | `No explicit default` | — |
| `reason` | `TEXT` | No | `No explicit default` | — |
| `performed_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `occurred_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  material_id BIGINT UNSIGNED NOT NULL,
  field_name VARCHAR(80) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  reason TEXT NOT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_material_change_history (material_id, occurred_at),
  FOREIGN KEY (material_id) REFERENCES materials(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
```

## finished_goods

Client-owned finished item and balance

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, INDEX, FK |
| `item_code` | `VARCHAR(80)` | No | `No explicit default` | UQ |
| `enterfil_part_number` | `VARCHAR(160)` | No | `No explicit default` | INDEX |
| `specification_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `quantity_on_hand` | `INT UNSIGNED` | No | `0` | — |
| `buffer_minimum` | `INT UNSIGNED` | No | `0` | — |
| `demand` | `ENUM('HIGH DEMAND','MONITOR','STABLE')` | No | `'STABLE'` | — |
| `updated_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `updated_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  item_code VARCHAR(80) NOT NULL,
  enterfil_part_number VARCHAR(160) NOT NULL,
  specification_id BIGINT UNSIGNED NOT NULL,
  quantity_on_hand INT UNSIGNED NOT NULL DEFAULT 0,
  buffer_minimum INT UNSIGNED NOT NULL DEFAULT 0,
  demand ENUM('HIGH DEMAND','MONITOR','STABLE') NOT NULL DEFAULT 'STABLE',
  updated_by BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_finished_item_code (item_code),
  UNIQUE KEY uq_finished_client_pair (id, client_id),
  KEY ix_finished_client_part (client_id, enterfil_part_number),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (specification_id, client_id) REFERENCES product_specifications(id, client_id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
```

## finished_good_movements

Finished item count history linked to client/JO

LEGACY FG HISTORY; preserve independently until reconciled target activation.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `finished_good_id` | `BIGINT UNSIGNED` | No | `No explicit default` | INDEX, FK |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `job_order_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `quantity_before` | `INT UNSIGNED` | No | `No explicit default` | — |
| `quantity_after` | `INT UNSIGNED` | No | `No explicit default` | — |
| `reason` | `TEXT` | No | `No explicit default` | — |
| `performed_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `occurred_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  finished_good_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  job_order_id BIGINT UNSIGNED NULL,
  quantity_before INT UNSIGNED NOT NULL,
  quantity_after INT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_finished_history (finished_good_id, occurred_at),
  FOREIGN KEY (finished_good_id, client_id) REFERENCES finished_goods(id, client_id),
  FOREIGN KEY (job_order_id, client_id) REFERENCES job_orders(id, client_id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
```

## finished_good_order_items

Explicit historical finished-item/order-item association

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `finished_good_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `order_item_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  finished_good_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (finished_good_id, order_item_id),
  FOREIGN KEY (finished_good_id, client_id) REFERENCES finished_goods(id, client_id),
  FOREIGN KEY (order_item_id, client_id) REFERENCES order_items(id, client_id)
```

## stock_requests

Sales-to-Warehouse request header

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `reference` | `VARCHAR(60)` | No | `No explicit default` | UQ |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `client_reference` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `status` | `ENUM('pending','responded','update_requested','updated')` | No | `'pending'` | INDEX |
| `requested_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |
| `update_requested_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `update_reason` | `TEXT` | Yes | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(60) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_reference VARCHAR(160) NULL,
  status ENUM('pending','responded','update_requested','updated') NOT NULL DEFAULT 'pending',
  requested_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  update_requested_at DATETIME(3) NULL,
  update_reason TEXT NULL,
  UNIQUE KEY uq_stock_request_reference (reference),
  UNIQUE KEY uq_stock_request_order (id, order_id),
  KEY ix_stock_request_queue (status, created_at),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (requested_by) REFERENCES users(id)
```

## stock_request_lines

Required material and request-time balance snapshot

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `stock_request_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `material_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `material_name_snapshot` | `VARCHAR(200)` | No | `No explicit default` | — |
| `unit_snapshot` | `VARCHAR(40)` | No | `No explicit default` | — |
| `required_quantity` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `stock_at_request` | `DECIMAL(15,4)` | Yes | `No explicit default` | CHECK |
| `shortage_at_request` | `DECIMAL(15,4)` | Yes | `No explicit default` | CHECK |
| `quantity_status_at_request` | `ENUM('unknown','provisional_sample','verified')` | Yes | `NULL` | CHECK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stock_request_id BIGINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  material_name_snapshot VARCHAR(200) NOT NULL,
  unit_snapshot VARCHAR(40) NOT NULL,
  required_quantity DECIMAL(15,4) NOT NULL,
  stock_at_request DECIMAL(15,4) NULL,
  shortage_at_request DECIMAL(15,4) NULL,
  UNIQUE KEY uq_request_material (stock_request_id, material_id),
  UNIQUE KEY uq_request_line_pair (id, stock_request_id),
  CONSTRAINT ck_stock_request_values CHECK (required_quantity > 0 AND (stock_at_request IS NULL OR stock_at_request >= 0) AND (shortage_at_request IS NULL OR shortage_at_request >= 0)),
  FOREIGN KEY (stock_request_id) REFERENCES stock_requests(id),
  FOREIGN KEY (material_id) REFERENCES materials(id),
  quantity_status_at_request
    ENUM('unknown','provisional_sample','verified') NULL DEFAULT NULL,
  CONSTRAINT ck_request_provenance CHECK (
    quantity_status_at_request IS NULL
    OR (quantity_status_at_request = 'verified'
        AND stock_at_request IS NOT NULL AND shortage_at_request IS NOT NULL
        AND shortage_at_request = GREATEST(required_quantity - stock_at_request, 0))
    OR (quantity_status_at_request IN ('unknown','provisional_sample')
        AND stock_at_request IS NULL AND shortage_at_request IS NULL)
  )
```

## stock_responses

Warehouse reply history

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `stock_request_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, INDEX, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `kind` | `ENUM('initial','updated')` | No | `No explicit default` | — |
| `responded_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `responded_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stock_request_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('initial','updated') NOT NULL,
  responded_by BIGINT UNSIGNED NOT NULL,
  responded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_response_request_pair (id, stock_request_id),
  UNIQUE KEY uq_response_order_pair (id, order_id),
  KEY ix_stock_responses (stock_request_id, responded_at),
  FOREIGN KEY (stock_request_id, order_id) REFERENCES stock_requests(id, order_id),
  FOREIGN KEY (responded_by) REFERENCES users(id)
```

## stock_response_lines

Observed stock/shortage per request line

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `stock_response_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `stock_request_line_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `stock_request_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `current_quantity` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `shortage_quantity` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `status` | `ENUM('sufficient','shortage')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  stock_response_id BIGINT UNSIGNED NOT NULL,
  stock_request_line_id BIGINT UNSIGNED NOT NULL,
  stock_request_id BIGINT UNSIGNED NOT NULL,
  current_quantity DECIMAL(15,4) NOT NULL,
  shortage_quantity DECIMAL(15,4) NOT NULL,
  status ENUM('sufficient','shortage') NOT NULL,
  PRIMARY KEY (stock_response_id, stock_request_line_id),
  CONSTRAINT ck_stock_response_values CHECK (current_quantity >= 0 AND shortage_quantity >= 0),
  FOREIGN KEY (stock_response_id, stock_request_id) REFERENCES stock_responses(id, stock_request_id),
  FOREIGN KEY (stock_request_line_id, stock_request_id) REFERENCES stock_request_lines(id, stock_request_id)
```

## quotation_stock_responses

Quote revision tied to precise Warehouse response

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `quotation_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `stock_response_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  quotation_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  stock_response_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (quotation_id, order_id) REFERENCES quotations(id, order_id),
  FOREIGN KEY (stock_response_id, order_id) REFERENCES stock_responses(id, order_id)
```

## shipments

One delivery/pickup record per JO

RETIRE after full delivery/item transfer, child FK cutover and approval.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `job_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `delivery_method_code` | `VARCHAR(32)` | No | `No explicit default` | FK |
| `status` | `ENUM('pending','in_transit','delivered','picked_up')` | No | `'pending'` | INDEX |
| `tracking_reference` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `tracking_link` | `VARCHAR(2048)` | Yes | `No explicit default` | — |
| `recipient_name` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `recipient_phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `recipient_email` | `VARCHAR(254)` | Yes | `No explicit default` | — |
| `delivery_address` | `TEXT` | Yes | `No explicit default` | — |
| `driver_name` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `driver_phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `vehicle_plate` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `pickup_person` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `pickup_phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `pickup_email` | `VARCHAR(254)` | Yes | `No explicit default` | — |
| `pickup_vehicle_plate` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `pickup_id_required` | `BOOLEAN` | Yes | `No explicit default` | — |
| `office_contact` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `estimated_delivery_date` | `DATE` | Yes | `No explicit default` | INDEX |
| `expected_pickup_date` | `DATE` | Yes | `No explicit default` | — |
| `dispatched_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `delivered_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `fulfillment_completed_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `updated_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `updated_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  delivery_method_code VARCHAR(32) NOT NULL,
  status ENUM('pending','in_transit','delivered','picked_up') NOT NULL DEFAULT 'pending',
  tracking_reference VARCHAR(160) NULL,
  tracking_link VARCHAR(2048) NULL,
  recipient_name VARCHAR(160) NULL,
  recipient_phone VARCHAR(40) NULL,
  recipient_email VARCHAR(254) NULL,
  delivery_address TEXT NULL,
  driver_name VARCHAR(160) NULL,
  driver_phone VARCHAR(40) NULL,
  vehicle_plate VARCHAR(40) NULL,
  pickup_person VARCHAR(160) NULL,
  pickup_phone VARCHAR(40) NULL,
  pickup_email VARCHAR(254) NULL,
  pickup_vehicle_plate VARCHAR(40) NULL,
  pickup_id_required BOOLEAN NULL,
  office_contact VARCHAR(160) NULL,
  estimated_delivery_date DATE NULL,
  expected_pickup_date DATE NULL,
  dispatched_at DATETIME(3) NULL,
  delivered_at DATETIME(3) NULL,
  fulfillment_completed_at DATETIME(3) NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_shipment_job (job_order_id),
  UNIQUE KEY uq_shipment_order (id, order_id),
  KEY ix_shipment_queue (status, estimated_delivery_date),
  FOREIGN KEY (job_order_id, order_id) REFERENCES job_orders(id, order_id),
  FOREIGN KEY (delivery_method_code) REFERENCES delivery_methods(code),
  FOREIGN KEY (updated_by) REFERENCES users(id)
```

## waybills

Printed waybill and QR identifier

RETAIN with later approved JO-item/stage or delivery FK cutover; current carrier shown below.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `shipment_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `reference` | `VARCHAR(80)` | No | `No explicit default` | UQ |
| `qr_identifier` | `VARCHAR(120)` | No | `No explicit default` | UQ |
| `printed_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `printed_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(80) NOT NULL,
  qr_identifier VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  printed_at DATETIME(3) NULL,
  printed_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_waybill_shipment (shipment_id),
  UNIQUE KEY uq_waybill_reference (reference),
  UNIQUE KEY uq_waybill_qr (qr_identifier),
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  FOREIGN KEY (printed_by) REFERENCES users(id)
```

## shipment_events

Shipment status/history events

REWIRE/RENAME as delivery event history; preserve IDs and all events.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `shipment_id` | `BIGINT UNSIGNED` | No | `No explicit default` | INDEX, FK |
| `status` | `VARCHAR(80)` | No | `No explicit default` | — |
| `note` | `TEXT` | Yes | `No explicit default` | — |
| `performed_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `occurred_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(80) NOT NULL,
  note TEXT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_shipment_events (shipment_id, occurred_at),
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
```

## delivery_receipts

Generated DR and send/handoff events

RETAIN with later approved JO-item/stage or delivery FK cutover; current carrier shown below.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `shipment_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `reference` | `VARCHAR(60)` | No | `No explicit default` | UQ |
| `generated_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `generated_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `sent_to_logistics_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `sent_to_logistics_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `sent_to_client_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `sent_to_client_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL,
  generated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  generated_by BIGINT UNSIGNED NOT NULL,
  sent_to_logistics_at DATETIME(3) NULL,
  sent_to_logistics_by BIGINT UNSIGNED NULL,
  sent_to_client_at DATETIME(3) NULL,
  sent_to_client_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_dr_shipment (shipment_id),
  UNIQUE KEY uq_dr_reference (reference),
  UNIQUE KEY uq_dr_order_pair (id, order_id),
  FOREIGN KEY (shipment_id, order_id) REFERENCES shipments(id, order_id),
  FOREIGN KEY (generated_by) REFERENCES users(id),
  FOREIGN KEY (sent_to_logistics_by) REFERENCES users(id),
  FOREIGN KEY (sent_to_client_by) REFERENCES users(id)
```

## signed_delivery_receipts

Staged/discarded/accepted uploaded copy

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `delivery_receipt_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, INDEX, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `submitted_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `uploaded_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `received_at` | `DATETIME(3)` | Yes | `No explicit default` | CHECK, INDEX |
| `accepted_slot` | `SMALLINT UNSIGNED` | Yes | `No explicit default` | CHECK, UQ |
| `discarded_at` | `DATETIME(3)` | Yes | `No explicit default` | CHECK, INDEX |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_receipt_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  submitted_by BIGINT UNSIGNED NOT NULL,
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  received_at DATETIME(3) NULL,
  accepted_slot SMALLINT UNSIGNED NULL,
  discarded_at DATETIME(3) NULL,
  CONSTRAINT ck_signed_dr_state CHECK (
    (received_at IS NULL AND accepted_slot IS NULL)
    OR (received_at IS NOT NULL AND discarded_at IS NULL
        AND accepted_slot IS NOT NULL AND accepted_slot = 1)
  ),
  UNIQUE KEY uq_one_accepted_signed_dr (delivery_receipt_id, accepted_slot),
  UNIQUE KEY uq_signed_receipt_order_state (id, order_id, accepted_slot),
  UNIQUE KEY uq_signed_dr_file (file_id),
  KEY ix_signed_dr_state (delivery_receipt_id, received_at, discarded_at),
  FOREIGN KEY (delivery_receipt_id, order_id) REFERENCES delivery_receipts(id, order_id),
  FOREIGN KEY (file_id) REFERENCES files(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id)
```

## invoices

One invoice per order, financial terms and billing dates

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `reference` | `VARCHAR(60)` | No | `No explicit default` | UQ |
| `issued_on` | `DATE` | No | `No explicit default` | — |
| `amount` | `DECIMAL(15,2)` | No | `No explicit default` | CHECK |
| `payment_term_code` | `VARCHAR(24)` | No | `No explicit default` | FK |
| `required_downpayment` | `DECIMAL(15,2)` | No | `0` | CHECK |
| `payment_cycle_started_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `due_on` | `DATE` | Yes | `No explicit default` | INDEX |
| `created_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `sent_at` | `DATETIME(3)` | Yes | `No explicit default` | INDEX |
| `sent_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(60) NOT NULL,
  issued_on DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_term_code VARCHAR(24) NOT NULL,
  required_downpayment DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_cycle_started_at DATETIME(3) NULL,
  due_on DATE NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  sent_at DATETIME(3) NULL,
  sent_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_invoice_order (order_id),
  UNIQUE KEY uq_invoice_reference (reference),
  UNIQUE KEY uq_invoice_order_pair (id, order_id),
  KEY ix_invoice_due (due_on, sent_at),
  CONSTRAINT ck_invoice_amount CHECK (amount >= 0 AND required_downpayment BETWEEN 0 AND amount),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (payment_term_code) REFERENCES payment_terms(code),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (sent_by) REFERENCES users(id)
```

## invoice_delivery_receipts

Same-order accepted evidence for billing cycle

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `invoice_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `signed_delivery_receipt_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `accepted_slot` | `SMALLINT UNSIGNED` | No | `1` | CHECK, FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  invoice_id BIGINT UNSIGNED NOT NULL,
  signed_delivery_receipt_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  accepted_slot SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (invoice_id, signed_delivery_receipt_id),
  CONSTRAINT ck_invoice_receipt_accepted CHECK (accepted_slot = 1),
  FOREIGN KEY (invoice_id, order_id) REFERENCES invoices(id, order_id),
  FOREIGN KEY (signed_delivery_receipt_id, order_id, accepted_slot)
    REFERENCES signed_delivery_receipts(id, order_id, accepted_slot)
```

## payments

Single submission/verification ledger

LEGACY SUBMISSION/MONEY EVIDENCE; split only through approved identity mapping.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | INDEX, FK |
| `invoice_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `payment_type` | `ENUM('DOWNPAYMENT','BALANCE_PAYMENT','FULL_PAYMENT')` | No | `No explicit default` | — |
| `submitted_amount` | `DECIMAL(15,2)` | No | `No explicit default` | CHECK |
| `verified_amount` | `DECIMAL(15,2)` | Yes | `No explicit default` | CHECK |
| `method` | `VARCHAR(80)` | Yes | `No explicit default` | — |
| `reference_number` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `paid_on` | `DATE` | No | `No explicit default` | — |
| `note` | `TEXT` | Yes | `No explicit default` | — |
| `verification_status` | `ENUM('pending','verified','rejected')` | No | `'pending'` | INDEX, CHECK |
| `submitted_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `submitted_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |
| `reviewed_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | CHECK, FK |
| `reviewed_at` | `DATETIME(3)` | Yes | `No explicit default` | CHECK |
| `idempotency_key` | `VARCHAR(120)` | No | `No explicit default` | UQ |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NULL,
  payment_type ENUM('DOWNPAYMENT','BALANCE_PAYMENT','FULL_PAYMENT') NOT NULL,
  submitted_amount DECIMAL(15,2) NOT NULL,
  verified_amount DECIMAL(15,2) NULL,
  method VARCHAR(80) NULL,
  reference_number VARCHAR(160) NULL,
  paid_on DATE NOT NULL,
  note TEXT NULL,
  verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  submitted_by BIGINT UNSIGNED NOT NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME(3) NULL,
  idempotency_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  UNIQUE KEY uq_payment_operation (idempotency_key),
  KEY ix_payment_review (verification_status, submitted_at),
  KEY ix_payment_order (order_id, verification_status),
  CONSTRAINT ck_payment_amount CHECK (submitted_amount > 0 AND (verified_amount IS NULL OR verified_amount > 0)),
  CONSTRAINT ck_payment_review CHECK (
    (verification_status = 'pending' AND verified_amount IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (verification_status = 'verified' AND verified_amount IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (verification_status = 'rejected' AND verified_amount IS NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (invoice_id, order_id) REFERENCES invoices(id, order_id),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
```

## payment_instructions

Instructions actually sent for an order

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `method` | `VARCHAR(80)` | No | `No explicit default` | — |
| `account_name` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `account_number` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `bank_name` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `note` | `TEXT` | Yes | `No explicit default` | — |
| `sent_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `sent_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  method VARCHAR(80) NOT NULL,
  account_name VARCHAR(160) NULL,
  account_number VARCHAR(100) NULL,
  bank_name VARCHAR(160) NULL,
  note TEXT NULL,
  sent_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  sent_by BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (sent_by) REFERENCES users(id)
```

## company_settings

Singleton company, default driver/bank/letterhead

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `SMALLINT UNSIGNED` | No | `No explicit default` | PK, CHECK |
| `company_name` | `VARCHAR(200)` | No | `No explicit default` | — |
| `address_line1` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `address_line2` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `city_province` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `postal_code` | `VARCHAR(20)` | Yes | `No explicit default` | — |
| `main_phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `secondary_phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `email` | `VARCHAR(254)` | Yes | `No explicit default` | — |
| `office_hours` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `default_vehicle_plate` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `default_driver` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `default_driver_contact` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `document_footer` | `TEXT` | Yes | `No explicit default` | — |
| `bank_name` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `bank_account_name` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `bank_account_number` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `updated_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `updated_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city_province VARCHAR(160) NULL,
  postal_code VARCHAR(20) NULL,
  main_phone VARCHAR(40) NULL,
  secondary_phone VARCHAR(40) NULL,
  email VARCHAR(254) NULL,
  office_hours VARCHAR(160) NULL,
  default_vehicle_plate VARCHAR(40) NULL,
  default_driver VARCHAR(160) NULL,
  default_driver_contact VARCHAR(40) NULL,
  document_footer TEXT NULL,
  bank_name VARCHAR(160) NULL,
  bank_account_name VARCHAR(160) NULL,
  bank_account_number VARCHAR(100) NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_company_singleton CHECK (id = 1),
  FOREIGN KEY (updated_by) REFERENCES users(id)
```

## company_payment_methods

Multiple configurable payment methods

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `company_settings_id` | `SMALLINT UNSIGNED` | No | `No explicit default` | FK |
| `label` | `VARCHAR(120)` | No | `No explicit default` | — |
| `type` | `ENUM('bank_transfer','gcash','cash','check','other')` | No | `No explicit default` | — |
| `details` | `TEXT` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_settings_id SMALLINT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  type ENUM('bank_transfer','gcash','cash','check','other') NOT NULL,
  details TEXT NOT NULL,
  FOREIGN KEY (company_settings_id) REFERENCES company_settings(id)
```

## notifications

Message content and optional order/client scope

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `department` | `ENUM('sales','production','logistics','payments','system')` | No | `No explicit default` | — |
| `title` | `VARCHAR(200)` | No | `No explicit default` | — |
| `body` | `TEXT` | No | `No explicit default` | — |
| `module_code` | `VARCHAR(40)` | Yes | `No explicit default` | FK |
| `order_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | CHECK, FK |
| `client_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | CHECK, FK |
| `reply_to_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `created_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  department ENUM('sales','production','logistics','payments','system') NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  module_code VARCHAR(40) NULL,
  order_id BIGINT UNSIGNED NULL,
  client_id BIGINT UNSIGNED NULL,
  reply_to_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (module_code) REFERENCES modules(code),
  CONSTRAINT ck_notification_order_scope CHECK (order_id IS NULL OR client_id IS NOT NULL),
  FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (reply_to_id) REFERENCES notifications(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
```

## notification_roles

Intended role audience

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `notification_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `role_code` | `VARCHAR(24)` | No | `No explicit default` | PK, FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  notification_id BIGINT UNSIGNED NOT NULL,
  role_code VARCHAR(24) NOT NULL,
  PRIMARY KEY (notification_id, role_code),
  FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (role_code) REFERENCES roles(code)
```

## notification_recipients

Per-user delivered/read/dismissed state

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `notification_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `user_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, INDEX, FK |
| `read_at` | `DATETIME(3)` | Yes | `No explicit default` | INDEX |
| `dismissed_at` | `DATETIME(3)` | Yes | `No explicit default` | INDEX |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME(3) NULL,
  dismissed_at DATETIME(3) NULL,
  PRIMARY KEY (notification_id, user_id),
  KEY ix_user_notifications (user_id, dismissed_at, read_at),
  FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
```

## order_files

Inquiry/supporting document association

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `purpose` | `ENUM('inquiry_sketch','supporting_document')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('inquiry_sketch','supporting_document') NOT NULL,
  PRIMARY KEY (order_id, file_id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## specification_files

Product sketch/image association

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `specification_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `purpose` | `ENUM('sketch','product_image')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  specification_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('sketch','product_image') NOT NULL,
  PRIMARY KEY (specification_id, file_id),
  FOREIGN KEY (specification_id) REFERENCES product_specifications(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## quotation_files

Generated/signed quotation association

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `quotation_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `purpose` | `ENUM('generated_document','signed_quotation')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  quotation_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document','signed_quotation') NOT NULL,
  PRIMARY KEY (quotation_id, file_id),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## purchase_order_files

Client PO document association

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `purchase_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `purpose` | `ENUM('client_document')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('client_document') NOT NULL,
  PRIMARY KEY (purchase_order_id, file_id),
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## job_order_files

JO sketch/signed quote/generated document association

RETAIN with later approved JO-item/stage or delivery FK cutover; current carrier shown below.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `job_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `purpose` | `ENUM('sketch','signed_quotation','generated_document')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  job_order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('sketch','signed_quotation','generated_document') NOT NULL,
  PRIMARY KEY (job_order_id, file_id),
  FOREIGN KEY (job_order_id) REFERENCES job_orders(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## payment_files

Proof and receipt association

LEGACY FILE PURPOSE EVIDENCE; proof/official-receipt mapping must complete first.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `payment_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `purpose` | `ENUM('proof_of_payment','receipt')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  payment_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('proof_of_payment','receipt') NOT NULL,
  PRIMARY KEY (payment_id, file_id),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## invoice_files

Issued invoice file association

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `invoice_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `purpose` | `ENUM('generated_document')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  invoice_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document') NOT NULL,
  PRIMARY KEY (invoice_id, file_id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## waybill_files

Generated waybill association

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `waybill_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `purpose` | `ENUM('generated_document')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  waybill_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document') NOT NULL,
  PRIMARY KEY (waybill_id, file_id),
  FOREIGN KEY (waybill_id) REFERENCES waybills(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## delivery_receipt_files

Generated DR file association

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `delivery_receipt_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `purpose` | `ENUM('generated_document')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  delivery_receipt_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document') NOT NULL,
  PRIMARY KEY (delivery_receipt_id, file_id),
  FOREIGN KEY (delivery_receipt_id) REFERENCES delivery_receipts(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## replacement_request_files

Defect proof association

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `replacement_request_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `purpose` | `ENUM('defect_proof')` | No | `No explicit default` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  replacement_request_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('defect_proof') NOT NULL,
  PRIMARY KEY (replacement_request_id, file_id),
  FOREIGN KEY (replacement_request_id) REFERENCES replacement_requests(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## audit_events

Security, changes and currently some domain decisions

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `actor_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | INDEX, FK |
| `action` | `VARCHAR(100)` | No | `No explicit default` | — |
| `subject_type` | `VARCHAR(60)` | No | `No explicit default` | INDEX |
| `subject_identifier` | `VARCHAR(100)` | No | `No explicit default` | INDEX |
| `field_name` | `VARCHAR(80)` | Yes | `No explicit default` | — |
| `old_value` | `TEXT` | Yes | `No explicit default` | — |
| `new_value` | `TEXT` | Yes | `No explicit default` | — |
| `reason` | `TEXT` | Yes | `No explicit default` | — |
| `request_id` | `VARCHAR(120)` | Yes | `No explicit default` | — |
| `occurred_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  subject_type VARCHAR(60) NOT NULL,
  subject_identifier VARCHAR(100) NOT NULL,
  field_name VARCHAR(80) NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  reason TEXT NULL,
  request_id VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_audit_subject (subject_type, subject_identifier, occurred_at),
  KEY ix_audit_actor (actor_id, occurred_at),
  FOREIGN KEY (actor_id) REFERENCES users(id)
```

## material_import_review

Source-row ambiguity and resolution queue

RETAIN; additive E01/E02 overlay included where applicable.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `source_document` | `VARCHAR(255)` | No | `No explicit default` | — |
| `source_sha256` | `CHAR(64)` | No | `No explicit default` | UQ |
| `source_page` | `SMALLINT UNSIGNED` | No | `No explicit default` | UQ, INDEX |
| `source_row` | `SMALLINT UNSIGNED` | No | `No explicit default` | UQ, INDEX |
| `source_item_code` | `VARCHAR(80)` | Yes | `No explicit default` | — |
| `source_description` | `VARCHAR(200)` | Yes | `No explicit default` | — |
| `source_unit` | `VARCHAR(32)` | Yes | `No explicit default` | — |
| `source_reference_price` | `DECIMAL(15,4)` | Yes | `No explicit default` | — |
| `source_reference_price_text` | `VARCHAR(32)` | Yes | `No explicit default` | — |
| `review_reasons` | `JSON` | No | `No explicit default` | — |
| `review_status` | `ENUM('needs_review','resolved','excluded')` | No | `'needs_review'` | INDEX |
| `resolved_material_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `resolution_note` | `TEXT` | Yes | `No explicit default` | — |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `updated_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_document VARCHAR(255) NOT NULL,
  source_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_page SMALLINT UNSIGNED NOT NULL,
  source_row SMALLINT UNSIGNED NOT NULL,
  source_item_code VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  source_description VARCHAR(200) NULL,
  source_unit VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  source_reference_price DECIMAL(15,4) NULL,
  source_reference_price_text VARCHAR(32) NULL,
  review_reasons JSON NOT NULL,
  review_status ENUM('needs_review','resolved','excluded') NOT NULL DEFAULT 'needs_review',
  resolved_material_id BIGINT UNSIGNED NULL,
  resolution_note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_material_import_source_row (source_sha256, source_page, source_row),
  KEY ix_material_import_review_status (review_status, source_page, source_row),
  FOREIGN KEY (resolved_material_id) REFERENCES materials(id)
```

## job_order

Intended one-PO manufacturing header with accepted quotation ownership.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `reference` | `VARCHAR(60)` | No | `No explicit default` | UQ |
| `purchase_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `accepted_quotation_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `jo_date` | `DATE` | No | `No explicit default` | — |
| `due_date` | `DATE` | No | `No explicit default` | INDEX |
| `status` | `ENUM('jo','in_production','quality_inspection','ready_for_dispatch','cancelled')` | No | `'jo'` | INDEX, CHECK |
| `paused` | `BOOLEAN` | No | `FALSE` | INDEX, CHECK |
| `pause_reason` | `TEXT` | Yes | `No explicit default` | CHECK |
| `prepared_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `approved_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `cancellation_reason` | `TEXT` | Yes | `No explicit default` | CHECK |
| `completed_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `archived_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(60) NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  accepted_quotation_id BIGINT UNSIGNED NOT NULL,
  jo_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('jo','in_production','quality_inspection','ready_for_dispatch','cancelled') NOT NULL DEFAULT 'jo',
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  pause_reason TEXT NULL,
  prepared_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  cancellation_reason TEXT NULL,
  completed_at DATETIME(3) NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_erd_jo_reference (reference),
  UNIQUE KEY uq_erd_jo_po (purchase_order_id),
  UNIQUE KEY uq_erd_jo_order (id, order_id),
  UNIQUE KEY uq_erd_jo_client (id, client_id),
  UNIQUE KEY uq_erd_jo_source (id, accepted_quotation_id, order_id, client_id),
  KEY ix_erd_jo_queue (status, paused, due_date),
  CONSTRAINT fk_erd_jo_po FOREIGN KEY (purchase_order_id, order_id, accepted_quotation_id)
    REFERENCES purchase_orders(id, order_id, accepted_quotation_id),
  CONSTRAINT fk_erd_jo_order FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (prepared_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT ck_erd_jo_pause CHECK (paused = 0 OR (pause_reason IS NOT NULL AND CHAR_LENGTH(TRIM(pause_reason)) > 0)),
  CONSTRAINT ck_erd_jo_cancel CHECK (status <> 'cancelled' OR (cancellation_reason IS NOT NULL AND CHAR_LENGTH(TRIM(cancellation_reason)) > 0))
```

## job_order_item

Manufacturing item and immutable complete template specification snapshot, exact accepted quote line.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `job_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `quotation_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `quotation_line_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `order_item_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `line_number` | `SMALLINT UNSIGNED` | No | `No explicit default` | UQ, CHECK |
| `legacy_job_order_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | UQ |
| `item_code` | `VARCHAR(80)` | Yes | `No explicit default` | — |
| `enterfil_part_number` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `item_name` | `VARCHAR(200)` | No | `No explicit default` | — |
| `quantity` | `INT UNSIGNED` | No | `No explicit default` | CHECK |
| `filter_type_code` | `VARCHAR(24)` | No | `No explicit default` | FK |
| `od1` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `od2` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `id1` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `id2` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `height` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `overall_height` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `length` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `width` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `thickness` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `depth` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `pocket_count` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `diameter` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `cloth_cutting_width` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `cloth_cutting_length` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `spring_plate_center_to_center` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `spring_plate_width` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `spring_plate_length` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `pad_od` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `pad_id` | `VARCHAR(100)` | Yes | `No explicit default` | — |
| `media` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `inner_core` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `outer_core` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `oring` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `gasket` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `end_cap` | `VARCHAR(255)` | Yes | `No explicit default` | — |
| `oem_part_number` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `brand` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `filtration_rating` | `VARCHAR(120)` | Yes | `No explicit default` | — |
| `others` | `TEXT` | Yes | `No explicit default` | — |
| `notes` | `TEXT` | Yes | `No explicit default` | — |
| `final_sketch_file_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  quotation_id BIGINT UNSIGNED NOT NULL,
  quotation_line_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  line_number SMALLINT UNSIGNED NOT NULL,
  legacy_job_order_id BIGINT UNSIGNED NULL,
  item_code VARCHAR(80) NULL,
  enterfil_part_number VARCHAR(160) NULL,
  item_name VARCHAR(200) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  filter_type_code VARCHAR(24) NOT NULL,
  od1 VARCHAR(100) NULL,
  od2 VARCHAR(100) NULL,
  id1 VARCHAR(100) NULL,
  id2 VARCHAR(100) NULL,
  height VARCHAR(100) NULL,
  overall_height VARCHAR(100) NULL,
  length VARCHAR(100) NULL,
  width VARCHAR(100) NULL,
  thickness VARCHAR(100) NULL,
  depth VARCHAR(100) NULL,
  pocket_count VARCHAR(100) NULL,
  diameter VARCHAR(100) NULL,
  cloth_cutting_width VARCHAR(100) NULL,
  cloth_cutting_length VARCHAR(100) NULL,
  spring_plate_center_to_center VARCHAR(100) NULL,
  spring_plate_width VARCHAR(100) NULL,
  spring_plate_length VARCHAR(100) NULL,
  pad_od VARCHAR(100) NULL,
  pad_id VARCHAR(100) NULL,
  media VARCHAR(255) NULL,
  inner_core VARCHAR(255) NULL,
  outer_core VARCHAR(255) NULL,
  oring VARCHAR(255) NULL,
  gasket VARCHAR(255) NULL,
  end_cap VARCHAR(255) NULL,
  oem_part_number VARCHAR(160) NULL,
  brand VARCHAR(160) NULL,
  filtration_rating VARCHAR(120) NULL,
  others TEXT NULL,
  notes TEXT NULL,
  final_sketch_file_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_erd_jo_item_line (job_order_id, line_number),
  UNIQUE KEY uq_erd_jo_item_pair (id, job_order_id),
  UNIQUE KEY uq_erd_legacy_jo_item (legacy_job_order_id),
  FOREIGN KEY (job_order_id, quotation_id, order_id, client_id)
    REFERENCES job_order(id, accepted_quotation_id, order_id, client_id),
  FOREIGN KEY (quotation_line_id, quotation_id, order_id, order_item_id)
    REFERENCES quotation_lines(id, quotation_id, order_id, order_item_id),
  FOREIGN KEY (order_item_id, order_id, client_id) REFERENCES order_items(id, order_id, client_id),
  FOREIGN KEY (filter_type_code) REFERENCES filter_types(code),
  FOREIGN KEY (final_sketch_file_id) REFERENCES files(id),
  CONSTRAINT ck_erd_jo_item CHECK (quantity > 0 AND line_number > 0)
```

## job_order_stage

Sole target per-header stage state; existing production events remain audit evidence.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `job_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `stage_position` | `SMALLINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `status` | `ENUM('pending','in_progress','completed')` | No | `'pending'` | CHECK |
| `started_at` | `DATETIME(3)` | Yes | `No explicit default` | CHECK |
| `completed_at` | `DATETIME(3)` | Yes | `No explicit default` | CHECK |
| `marked_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK, CHECK |
| `remarks` | `TEXT` | Yes | `No explicit default` | — |
| `reverted_count` | `INT UNSIGNED` | No | `0` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  stage_position SMALLINT UNSIGNED NOT NULL,
  status ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  marked_by BIGINT UNSIGNED NULL,
  remarks TEXT NULL,
  reverted_count INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_erd_jo_stage (job_order_id, stage_position),
  UNIQUE KEY uq_erd_stage_owner (id, job_order_id),
  FOREIGN KEY (job_order_id) REFERENCES job_order(id),
  FOREIGN KEY (stage_position) REFERENCES production_stages(position),
  FOREIGN KEY (marked_by) REFERENCES users(id),
  CONSTRAINT ck_erd_stage_state CHECK (
    (status = 'pending' AND started_at IS NULL AND completed_at IS NULL)
    OR (status = 'in_progress' AND started_at IS NOT NULL AND completed_at IS NULL AND marked_by IS NOT NULL)
    OR (status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
        AND completed_at >= started_at AND marked_by IS NOT NULL))
```

## material_shortage_report

Typed shortage against raw material, JO and optional same-JO stage.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `job_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `job_order_stage_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `material_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `quantity_needed` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `description` | `TEXT` | No | `No explicit default` | — |
| `status` | `ENUM('pending','resolved')` | No | `'pending'` | INDEX, CHECK |
| `reported_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `reported_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX, CHECK |
| `resolved_at` | `DATETIME(3)` | Yes | `No explicit default` | CHECK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  job_order_stage_id BIGINT UNSIGNED NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  quantity_needed DECIMAL(15,4) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('pending','resolved') NOT NULL DEFAULT 'pending',
  reported_by BIGINT UNSIGNED NOT NULL,
  reported_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  KEY ix_erd_shortage_queue (status, reported_at),
  FOREIGN KEY (job_order_id) REFERENCES job_order(id),
  FOREIGN KEY (job_order_stage_id, job_order_id) REFERENCES job_order_stage(id, job_order_id),
  FOREIGN KEY (material_id) REFERENCES materials(id),
  FOREIGN KEY (reported_by) REFERENCES users(id),
  CONSTRAINT ck_erd_shortage CHECK (quantity_needed > 0 AND
    ((status = 'pending' AND resolved_at IS NULL) OR
     (status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at >= reported_at)))
```

## production_plan

Documented repeat-item forecast and/or JO plan, without procurement or automatic production.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `plan_code` | `VARCHAR(60)` | No | `No explicit default` | UQ |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `finished_good_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK, CHECK |
| `job_order_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK, CHECK |
| `source` | `VARCHAR(80)` | No | `No explicit default` | — |
| `planned_quantity` | `INT UNSIGNED` | No | `No explicit default` | CHECK |
| `week_start_date` | `DATE` | No | `No explicit default` | CHECK |
| `week_end_date` | `DATE` | No | `No explicit default` | CHECK |
| `created_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plan_code VARCHAR(60) NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  finished_good_id BIGINT UNSIGNED NULL,
  job_order_id BIGINT UNSIGNED NULL,
  source VARCHAR(80) NOT NULL,
  planned_quantity INT UNSIGNED NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_erd_plan_code (plan_code),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (finished_good_id, client_id) REFERENCES finished_goods(id, client_id),
  FOREIGN KEY (job_order_id, client_id) REFERENCES job_order(id, client_id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT ck_erd_plan CHECK (planned_quantity > 0 AND week_end_date >= week_start_date
    AND (finished_good_id IS NOT NULL OR job_order_id IS NOT NULL))
```

## client_receipt

Manual-review proof submission, separate from confirmed money.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `invoice_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `submitted_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `amount_declared` | `DECIMAL(15,2)` | No | `No explicit default` | CHECK |
| `method_snapshot` | `VARCHAR(120)` | Yes | `No explicit default` | — |
| `reference_number` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `paid_on` | `DATE` | No | `No explicit default` | — |
| `payment_type` | `ENUM('DOWNPAYMENT','BALANCE_PAYMENT','FULL_PAYMENT')` | No | `No explicit default` | — |
| `note` | `TEXT` | Yes | `No explicit default` | — |
| `review_status` | `ENUM('pending','verified','rejected')` | No | `'pending'` | INDEX, CHECK |
| `reviewed_by` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK, CHECK |
| `reviewed_at` | `DATETIME(3)` | Yes | `No explicit default` | CHECK |
| `review_note` | `TEXT` | Yes | `No explicit default` | — |
| `submitted_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |
| `idempotency_key` | `VARCHAR(120)` | No | `No explicit default` | UQ |
| `legacy_payment_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | UQ |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  submitted_by BIGINT UNSIGNED NOT NULL,
  amount_declared DECIMAL(15,2) NOT NULL,
  method_snapshot VARCHAR(120) NULL,
  reference_number VARCHAR(160) NULL,
  paid_on DATE NOT NULL,
  payment_type ENUM('DOWNPAYMENT','BALANCE_PAYMENT','FULL_PAYMENT') NOT NULL,
  note TEXT NULL,
  review_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME(3) NULL,
  review_note TEXT NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  idempotency_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_payment_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_erd_receipt_operation (idempotency_key),
  UNIQUE KEY uq_erd_receipt_owner (id, invoice_id, order_id, client_id),
  UNIQUE KEY uq_erd_receipt_legacy (legacy_payment_id),
  KEY ix_erd_receipt_review (review_status, submitted_at),
  FOREIGN KEY (invoice_id, order_id) REFERENCES invoices(id, order_id),
  FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (submitted_by, client_id) REFERENCES users(id, client_id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  CONSTRAINT ck_erd_receipt_amount CHECK (amount_declared > 0),
  CONSTRAINT ck_erd_receipt_review CHECK (
    (review_status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (review_status IN ('verified','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
```

## client_receipt_file

Many uploaded evidence files per receipt; existing private files reused.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `client_receipt_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |
| `file_id` | `BIGINT UNSIGNED` | No | `No explicit default` | PK, FK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  client_receipt_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (client_receipt_id, file_id),
  FOREIGN KEY (client_receipt_id) REFERENCES client_receipt(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
```

## payment_transaction

One confirmed monetary event; stable replay identity independent of attachments.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `invoice_id` | `BIGINT UNSIGNED` | No | `No explicit default` | INDEX, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `client_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `client_receipt_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK |
| `payment_type` | `ENUM('DOWNPAYMENT','BALANCE_PAYMENT','FULL_PAYMENT')` | No | `No explicit default` | — |
| `amount` | `DECIMAL(15,2)` | No | `No explicit default` | CHECK |
| `method_snapshot` | `VARCHAR(120)` | Yes | `No explicit default` | — |
| `reference_number` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `paid_on` | `DATE` | No | `No explicit default` | INDEX |
| `recorded_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `approved_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `approved_at` | `DATETIME(3)` | No | `No explicit default` | — |
| `notes` | `TEXT` | Yes | `No explicit default` | — |
| `created_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |
| `idempotency_key` | `VARCHAR(120)` | No | `No explicit default` | UQ |
| `legacy_payment_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | UQ |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  client_receipt_id BIGINT UNSIGNED NULL,
  payment_type ENUM('DOWNPAYMENT','BALANCE_PAYMENT','FULL_PAYMENT') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  method_snapshot VARCHAR(120) NULL,
  reference_number VARCHAR(160) NULL,
  paid_on DATE NOT NULL,
  recorded_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NOT NULL,
  approved_at DATETIME(3) NOT NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  idempotency_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_payment_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_erd_transaction_operation (idempotency_key),
  UNIQUE KEY uq_erd_transaction_legacy (legacy_payment_id),
  KEY ix_erd_transaction_invoice (invoice_id, paid_on),
  FOREIGN KEY (invoice_id, order_id) REFERENCES invoices(id, order_id),
  FOREIGN KEY (order_id, client_id) REFERENCES orders(id, client_id),
  FOREIGN KEY (client_receipt_id, invoice_id, order_id, client_id)
    REFERENCES client_receipt(id, invoice_id, order_id, client_id),
  FOREIGN KEY (recorded_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT ck_erd_transaction_amount CHECK (amount > 0)
```

## stock_movement

Single intended typed raw/finished ledger; unknown-before observations remain nonarithmetic.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, INDEX |
| `item_type` | `ENUM('raw_material','finished_good')` | No | `No explicit default` | CHECK |
| `material_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | INDEX, FK, CHECK |
| `finished_good_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | INDEX, FK, CHECK |
| `unit_code` | `VARCHAR(16)` | Yes | `No explicit default` | FK, CHECK |
| `client_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK, CHECK |
| `job_order_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | FK, CHECK |
| `kind` | `ENUM('observation','opening','adjustment','correction','receipt','handover','jo_deduction','jo_restoration')` | No | `No explicit default` | — |
| `quantity_status_before` | `ENUM('unknown','provisional_sample','verified')` | No | `No explicit default` | CHECK |
| `quantity_before` | `DECIMAL(15,4)` | Yes | `No explicit default` | CHECK |
| `quantity_after` | `DECIMAL(15,4)` | No | `No explicit default` | CHECK |
| `quantity_delta` | `DECIMAL(15,4)` | Yes | `No explicit default` | CHECK |
| `reason` | `TEXT` | No | `No explicit default` | CHECK |
| `reference_text` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `supplier_name_snapshot` | `VARCHAR(200)` | Yes | `No explicit default` | — |
| `notes` | `TEXT` | Yes | `No explicit default` | — |
| `performed_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `occurred_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | INDEX |
| `idempotency_key` | `VARCHAR(120)` | No | `No explicit default` | UQ |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_type ENUM('raw_material','finished_good') NOT NULL,
  material_id BIGINT UNSIGNED NULL,
  finished_good_id BIGINT UNSIGNED NULL,
  unit_code VARCHAR(16) NULL,
  client_id BIGINT UNSIGNED NULL,
  job_order_id BIGINT UNSIGNED NULL,
  kind ENUM('observation','opening','adjustment','correction','receipt','handover','jo_deduction','jo_restoration') NOT NULL,
  quantity_status_before ENUM('unknown','provisional_sample','verified') NOT NULL,
  quantity_before DECIMAL(15,4) NULL,
  quantity_after DECIMAL(15,4) NOT NULL,
  quantity_delta DECIMAL(15,4) NULL,
  reason TEXT NOT NULL,
  reference_text VARCHAR(160) NULL,
  supplier_name_snapshot VARCHAR(200) NULL,
  notes TEXT NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  idempotency_key VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  UNIQUE KEY uq_erd_stock_operation (idempotency_key),
  KEY ix_erd_raw_history (material_id, occurred_at, id),
  KEY ix_erd_finished_history (finished_good_id, occurred_at, id),
  FOREIGN KEY (material_id, unit_code) REFERENCES materials(id, unit_code),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (finished_good_id, client_id) REFERENCES finished_goods(id, client_id),
  FOREIGN KEY (job_order_id, client_id) REFERENCES job_order(id, client_id),
  FOREIGN KEY (performed_by) REFERENCES users(id),
  CONSTRAINT ck_erd_stock_item CHECK (
    (item_type = 'raw_material' AND material_id IS NOT NULL AND unit_code IS NOT NULL AND finished_good_id IS NULL)
    OR (item_type = 'finished_good' AND material_id IS NULL AND unit_code IS NULL AND finished_good_id IS NOT NULL AND client_id IS NOT NULL)),
  CONSTRAINT ck_erd_stock_owner CHECK (job_order_id IS NULL OR client_id IS NOT NULL),
  CONSTRAINT ck_erd_stock_numbers CHECK (quantity_after >= 0 AND
    ((quantity_status_before = 'verified' AND quantity_before IS NOT NULL AND quantity_before >= 0
      AND quantity_delta IS NOT NULL AND quantity_after = quantity_before + quantity_delta)
     OR (quantity_status_before IN ('unknown','provisional_sample')
       AND quantity_before IS NULL AND quantity_delta IS NULL AND kind IN ('observation','opening','correction')))),
  CONSTRAINT ck_erd_stock_reason CHECK (CHAR_LENGTH(TRIM(reason)) > 0),
  CONSTRAINT ck_erd_finished_integral CHECK (item_type <> 'finished_good' OR
    (quantity_after = FLOOR(quantity_after) AND (quantity_before IS NULL OR quantity_before = FLOOR(quantity_before))))
```

## delivery

Intended dispatch/delivery aggregate deriving PO/client/invoice through JO; source facts preserved.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK, UQ |
| `job_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `legacy_shipment_id` | `BIGINT UNSIGNED` | Yes | `No explicit default` | UQ |
| `delivery_method_code` | `VARCHAR(32)` | No | `No explicit default` | FK |
| `status` | `ENUM('pending','in_transit','delivered','picked_up')` | No | `'pending'` | INDEX |
| `tracking_reference` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `tracking_link` | `VARCHAR(2048)` | Yes | `No explicit default` | — |
| `recipient_name` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `recipient_phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `recipient_email` | `VARCHAR(254)` | Yes | `No explicit default` | — |
| `delivery_address` | `TEXT` | Yes | `No explicit default` | — |
| `driver_name` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `driver_phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `vehicle_plate` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `pickup_person` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `pickup_phone` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `pickup_email` | `VARCHAR(254)` | Yes | `No explicit default` | — |
| `pickup_vehicle_plate` | `VARCHAR(40)` | Yes | `No explicit default` | — |
| `pickup_id_required` | `BOOLEAN` | Yes | `No explicit default` | — |
| `office_contact` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `estimated_delivery_date` | `DATE` | Yes | `No explicit default` | INDEX |
| `expected_pickup_date` | `DATE` | Yes | `No explicit default` | — |
| `dispatched_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `delivered_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `fulfillment_completed_at` | `DATETIME(3)` | Yes | `No explicit default` | — |
| `received_by` | `VARCHAR(160)` | Yes | `No explicit default` | — |
| `notes` | `TEXT` | Yes | `No explicit default` | — |
| `updated_by` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `created_at` | `DATETIME(3)` | Yes | `NULL` | — |
| `updated_at` | `DATETIME(3)` | No | `CURRENT_TIMESTAMP(3)` | — |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_order_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  legacy_shipment_id BIGINT UNSIGNED NULL,
  delivery_method_code VARCHAR(32) NOT NULL,
  status ENUM('pending','in_transit','delivered','picked_up') NOT NULL DEFAULT 'pending',
  tracking_reference VARCHAR(160) NULL,
  tracking_link VARCHAR(2048) NULL,
  recipient_name VARCHAR(160) NULL,
  recipient_phone VARCHAR(40) NULL,
  recipient_email VARCHAR(254) NULL,
  delivery_address TEXT NULL,
  driver_name VARCHAR(160) NULL,
  driver_phone VARCHAR(40) NULL,
  vehicle_plate VARCHAR(40) NULL,
  pickup_person VARCHAR(160) NULL,
  pickup_phone VARCHAR(40) NULL,
  pickup_email VARCHAR(254) NULL,
  pickup_vehicle_plate VARCHAR(40) NULL,
  pickup_id_required BOOLEAN NULL,
  office_contact VARCHAR(160) NULL,
  estimated_delivery_date DATE NULL,
  expected_pickup_date DATE NULL,
  dispatched_at DATETIME(3) NULL,
  delivered_at DATETIME(3) NULL,
  fulfillment_completed_at DATETIME(3) NULL,
  received_by VARCHAR(160) NULL,
  notes TEXT NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NULL DEFAULT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_erd_delivery_legacy (legacy_shipment_id),
  UNIQUE KEY uq_erd_delivery_order (id, order_id),
  UNIQUE KEY uq_erd_delivery_job (id, job_order_id),
  KEY ix_erd_delivery_queue (status, estimated_delivery_date),
  FOREIGN KEY (job_order_id, order_id) REFERENCES job_order(id, order_id),
  FOREIGN KEY (delivery_method_code) REFERENCES delivery_methods(code),
  FOREIGN KEY (updated_by) REFERENCES users(id)
```

## delivery_item

Positive delivered item allocation with same-JO ownership.

NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.

| Column | Type | Nullable | Default / generation | Key participation |
| --- | --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | No | `AUTO_INCREMENT` | PK |
| `delivery_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `job_order_id` | `BIGINT UNSIGNED` | No | `No explicit default` | FK |
| `job_order_item_id` | `BIGINT UNSIGNED` | No | `No explicit default` | UQ, FK |
| `quantity` | `INT UNSIGNED` | No | `No explicit default` | CHECK |

Exact declarations, collation, keys, CHECK expressions and indexes:

```sql
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL,
  job_order_id BIGINT UNSIGNED NOT NULL,
  job_order_item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_erd_delivery_item (delivery_id, job_order_item_id),
  FOREIGN KEY (delivery_id, job_order_id) REFERENCES delivery(id, job_order_id),
  FOREIGN KEY (job_order_item_id, job_order_id) REFERENCES job_order_item(id, job_order_id),
  CONSTRAINT ck_erd_delivery_quantity CHECK (quantity > 0)
```

## Known objects whose complete current DDL is unavailable

`user_sessions` is retained. Current service SQL requires `id`, `user_id`, `token_hash`, `expires_at`, `last_activity_at`, `revoked_at`; complete types/defaults/key actions and any additional columns remain an explicit metadata gap. User relationship, unique token digest lookup, revocation/expiry filtering are required. Do not invent session DDL or retrieve token values.

`_enterflow_migration_history` is retained infrastructure. Previously recorded implementation contract: `file VARCHAR(255) ASCII binary PK`, `checksum CHAR(64) ASCII NOT NULL`, `state ENUM('applying','applied','failed') NOT NULL`, `method ENUM('execute','baseline') NOT NULL`, `started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`, nullable `applied_at DATETIME(3)` and `error_code VARCHAR(80)`. This is only a structure description, not a protected row/checksum read. No history query is authorized. `schema_migrations` is distinct and retained unchanged.

Later `users(client_id)` uniqueness is required by approved one-company-login policy but not established by the original source body. E02's `(id,client_id)` UQ is an ownership key and **does not** enforce one login per company. Confirm actual unique client key before any corrective DDL; do not infer it from E02.

Full deployed completeness remains blocked until authorized metadata is supplied; this document does not fill unknown schemas with guesses.
