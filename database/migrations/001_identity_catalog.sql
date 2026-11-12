-- DRAFT. Run only after approval, against the explicitly selected enterflow_db.
-- No CREATE DATABASE, USE, DROP, credentials, or environment-specific paths.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE schema_migrations (
  version VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module visibility mirrors Sidebar.allowedFor; it does not grant API write access.
CREATE TABLE modules (
  code VARCHAR(40) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_modules (
  role_code VARCHAR(24) NOT NULL,
  module_code VARCHAR(40) NOT NULL,
  PRIMARY KEY (role_code, module_code),
  FOREIGN KEY (role_code) REFERENCES roles(code),
  FOREIGN KEY (module_code) REFERENCES modules(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_terms (
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  days_after_receipt SMALLINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clients (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
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
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_applications (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE filter_types (
  code VARCHAR(24) NOT NULL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  template_group VARCHAR(24) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve frontend dimension text until units and tolerances are confirmed.
-- A JO uses its own specification row, so later inquiry edits cannot change it.
CREATE TABLE product_specifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  filter_type_code VARCHAR(24) NOT NULL,
  filter_name VARCHAR(200) NOT NULL,
  od1 VARCHAR(100) NULL, od2 VARCHAR(100) NULL,
  id1 VARCHAR(100) NULL, id2 VARCHAR(100) NULL,
  height VARCHAR(100) NULL, overall_height VARCHAR(100) NULL,
  length VARCHAR(100) NULL, width VARCHAR(100) NULL,
  thickness VARCHAR(100) NULL, depth VARCHAR(100) NULL,
  pocket_count VARCHAR(100) NULL, diameter VARCHAR(100) NULL,
  cloth_cutting_width VARCHAR(100) NULL, cloth_cutting_length VARCHAR(100) NULL,
  spring_plate_center_to_center VARCHAR(100) NULL,
  spring_plate_width VARCHAR(100) NULL, spring_plate_length VARCHAR(100) NULL,
  pad_od VARCHAR(100) NULL, pad_id VARCHAR(100) NULL,
  media VARCHAR(255) NULL, inner_core VARCHAR(255) NULL, outer_core VARCHAR(255) NULL,
  oring VARCHAR(255) NULL, gasket VARCHAR(255) NULL, end_cap VARCHAR(255) NULL,
  oem_part_number VARCHAR(160) NULL, brand VARCHAR(160) NULL,
  filtration_rating VARCHAR(120) NULL, others TEXT NULL, notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_spec_client (id, client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (filter_type_code) REFERENCES filter_types(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_categories (
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE units (
  code VARCHAR(16) NOT NULL PRIMARY KEY,
  label VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE materials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_code VARCHAR(32) NOT NULL,
  unit_code VARCHAR(16) NOT NULL,
  unit_price DECIMAL(15,4) NOT NULL DEFAULT 0,
  quantity_on_hand DECIMAL(15,4) NOT NULL DEFAULT 0,
  reorder_threshold DECIMAL(15,4) NOT NULL DEFAULT 0,
  supplier_name VARCHAR(200) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_material_values CHECK (unit_price >= 0 AND quantity_on_hand >= 0 AND reorder_threshold >= 0),
  KEY ix_material_category (category_code, name),
  FOREIGN KEY (category_code) REFERENCES material_categories(code),
  FOREIGN KEY (unit_code) REFERENCES units(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bom_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  filter_type_code VARCHAR(24) NOT NULL,
  size_label VARCHAR(40) NULL,
  labor_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
  markup_percent DECIMAL(9,4) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  vat_type ENUM('Exclusive','Inclusive','Zero-Rated') NOT NULL,
  vat_rate DECIMAL(7,4) NOT NULL,
  include_labor BOOLEAN NOT NULL, apply_markup BOOLEAN NOT NULL, apply_vat BOOLEAN NOT NULL,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_template_cost CHECK (labor_cost >= 0 AND markup_percent >= 0 AND discount_percent BETWEEN 0 AND 100 AND vat_rate BETWEEN 0 AND 100),
  FOREIGN KEY (filter_type_code) REFERENCES filter_types(code),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bom_template_lines (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE files (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations(version) VALUES ('001_identity_catalog');
