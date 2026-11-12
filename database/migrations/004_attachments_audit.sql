-- DRAFT. Apply after 003, only with approval.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

-- Typed links give every business attachment an actual parent foreign key.
-- File ACLs come from that parent; these tables contain no URLs or file bytes.

CREATE TABLE order_files (
  order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('inquiry_sketch','supporting_document') NOT NULL,
  PRIMARY KEY (order_id, file_id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE specification_files (
  specification_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('sketch','product_image') NOT NULL,
  PRIMARY KEY (specification_id, file_id),
  FOREIGN KEY (specification_id) REFERENCES product_specifications(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_files (
  quotation_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document','signed_quotation') NOT NULL,
  PRIMARY KEY (quotation_id, file_id),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_order_files (
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('client_document') NOT NULL,
  PRIMARY KEY (purchase_order_id, file_id),
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_order_files (
  job_order_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('sketch','signed_quotation','generated_document') NOT NULL,
  PRIMARY KEY (job_order_id, file_id),
  FOREIGN KEY (job_order_id) REFERENCES job_orders(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_files (
  payment_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('proof_of_payment','receipt') NOT NULL,
  PRIMARY KEY (payment_id, file_id),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_files (
  invoice_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document') NOT NULL,
  PRIMARY KEY (invoice_id, file_id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE waybill_files (
  waybill_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document') NOT NULL,
  PRIMARY KEY (waybill_id, file_id),
  FOREIGN KEY (waybill_id) REFERENCES waybills(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_receipt_files (
  delivery_receipt_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('generated_document') NOT NULL,
  PRIMARY KEY (delivery_receipt_id, file_id),
  FOREIGN KEY (delivery_receipt_id) REFERENCES delivery_receipts(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE replacement_request_files (
  replacement_request_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('defect_proof') NOT NULL,
  PRIMARY KEY (replacement_request_id, file_id),
  FOREIGN KEY (replacement_request_id) REFERENCES replacement_requests(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Security/account/client changes. Historical subject identifiers deliberately
-- survive archiving; this is an audit trail, never a business attachment link.
CREATE TABLE audit_events (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations(version) VALUES ('004_attachments_audit');
