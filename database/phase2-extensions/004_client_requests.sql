-- Approved Phase 2 Part 1 extension. Execute only through migrate-part1.
-- Compound statements are separated by explicit runner markers.
-- @statement
CREATE TABLE cancellation_request (
  request_id bigint unsigned NOT NULL AUTO_INCREMENT,
  inquiry_id bigint unsigned NOT NULL,
  quotation_id bigint unsigned NULL,
  po_id bigint unsigned NULL,
  requested_by_client_user_id bigint unsigned NOT NULL,
  reason text NOT NULL,
  status enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  submitted_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reviewed_by_user_id bigint unsigned NULL,
  reviewed_at datetime(3) NULL,
  review_note text NULL,
  pending_target_id bigint unsigned GENERATED ALWAYS AS (case when (`status` = _utf8mb4'pending') then `inquiry_id` else NULL end) STORED,
  PRIMARY KEY (request_id),
  UNIQUE KEY uq_cancel_pending (pending_target_id),
  KEY ix_cancel_target (inquiry_id,submitted_at),
  KEY ix_cancel_client_history (requested_by_client_user_id,status,submitted_at,request_id),
  KEY ix_cancel_queue (status,submitted_at,request_id),
  KEY ix_cancel_reviewer (reviewed_by_user_id,reviewed_at),
  KEY ix_cancel_quotation (quotation_id),
  KEY ix_cancel_po (po_id),
  CONSTRAINT fk_cancel_inquiry_id FOREIGN KEY (inquiry_id) REFERENCES inquiry(inquiry_id),
  CONSTRAINT fk_cancel_quotation_id FOREIGN KEY (quotation_id) REFERENCES quotation(quotation_id),
  CONSTRAINT fk_cancel_po_id FOREIGN KEY (po_id) REFERENCES purchase_order(po_id),
  CONSTRAINT fk_cancel_requested_by_client_user_id FOREIGN KEY (requested_by_client_user_id) REFERENCES client_user(client_user_id),
  CONSTRAINT fk_cancel_reviewed_by_user_id FOREIGN KEY (reviewed_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_cancel_reason CHECK (char_length(trim(`reason`)) > 0),
  CONSTRAINT ck_cancel_review CHECK (((`status` = _utf8mb4'pending') and (`reviewed_by_user_id` is null) and (`reviewed_at` is null)) or ((`status` in (_utf8mb4'approved',_utf8mb4'rejected')) and (`reviewed_by_user_id` is not null) and (`reviewed_at` is not null))),
  CONSTRAINT ck_cancel_review_date CHECK ((`reviewed_at` is null) or (`reviewed_at` >= `submitted_at`)),
  CONSTRAINT ck_cancel_rejection CHECK ((`status` <> _utf8mb4'rejected') or ((`review_note` is not null) and (char_length(trim(`review_note`)) > 0))),
  CONSTRAINT ck_cancel_target CHECK ((`quotation_id` is null) or (`po_id` is null))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- @statement
CREATE TABLE quotation_revision_request (
  request_id bigint unsigned NOT NULL AUTO_INCREMENT,
  quotation_id bigint unsigned NOT NULL,
  requested_by_client_user_id bigint unsigned NOT NULL,
  reason text NOT NULL,
  status enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  submitted_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reviewed_by_user_id bigint unsigned NULL,
  reviewed_at datetime(3) NULL,
  review_note text NULL,
  pending_target_id bigint unsigned GENERATED ALWAYS AS (case when (`status` = _utf8mb4'pending') then `quotation_id` else NULL end) STORED,
  PRIMARY KEY (request_id),
  UNIQUE KEY uq_revision_pending (pending_target_id),
  KEY ix_revision_target (quotation_id,submitted_at),
  KEY ix_revision_client_history (requested_by_client_user_id,status,submitted_at,request_id),
  KEY ix_revision_queue (status,submitted_at,request_id),
  KEY ix_revision_reviewer (reviewed_by_user_id,reviewed_at),
  CONSTRAINT fk_revision_quotation_id FOREIGN KEY (quotation_id) REFERENCES quotation(quotation_id),
  CONSTRAINT fk_revision_requested_by_client_user_id FOREIGN KEY (requested_by_client_user_id) REFERENCES client_user(client_user_id),
  CONSTRAINT fk_revision_reviewed_by_user_id FOREIGN KEY (reviewed_by_user_id) REFERENCES user_account(user_id),
  CONSTRAINT ck_revision_reason CHECK (char_length(trim(`reason`)) > 0),
  CONSTRAINT ck_revision_review CHECK (((`status` = _utf8mb4'pending') and (`reviewed_by_user_id` is null) and (`reviewed_at` is null)) or ((`status` in (_utf8mb4'approved',_utf8mb4'rejected')) and (`reviewed_by_user_id` is not null) and (`reviewed_at` is not null))),
  CONSTRAINT ck_revision_review_date CHECK ((`reviewed_at` is null) or (`reviewed_at` >= `submitted_at`)),
  CONSTRAINT ck_revision_rejection CHECK ((`status` <> _utf8mb4'rejected') or ((`review_note` is not null) and (char_length(trim(`review_note`)) > 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- @statement
CREATE TRIGGER cancel_request_bi BEFORE INSERT ON cancellation_request FOR EACH ROW
BEGIN
IF NEW.status<>'pending' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request must start pending'; END IF;
IF (SELECT client_id FROM inquiry WHERE inquiry_id=NEW.inquiry_id)<>(SELECT client_id FROM client_user WHERE client_user_id=NEW.requested_by_client_user_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request submitter must own inquiry'; END IF;
IF NEW.reviewed_by_user_id IS NOT NULL AND COALESCE((SELECT r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=NEW.reviewed_by_user_id AND u.status='active'),'')<>'Sales' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request reviewer must have active Sales role'; END IF;
IF (NEW.status='pending' OR NEW.status='approved') AND (EXISTS(SELECT 1 FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=NEW.inquiry_id) OR EXISTS(SELECT 1 FROM payment_transaction t JOIN sales_invoice v ON v.invoice_id=t.invoice_id JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=NEW.inquiry_id AND t.transaction_type='DOWNPAYMENT' AND t.approval_status='approved')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancellation blocked after JO or confirmed downpayment'; END IF;
IF NEW.quotation_id IS NOT NULL AND NEW.inquiry_id<>(SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancellation quotation must belong to inquiry'; END IF;
IF NEW.po_id IS NOT NULL AND NEW.inquiry_id<>(SELECT q.inquiry_id FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id WHERE p.po_id=NEW.po_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancellation PO must belong to inquiry'; END IF;
END;

-- @statement
CREATE TRIGGER cancel_request_bu BEFORE UPDATE ON cancellation_request FOR EACH ROW
BEGIN
IF OLD.status<>'pending' OR NEW.inquiry_id<>OLD.inquiry_id OR NEW.requested_by_client_user_id<>OLD.requested_by_client_user_id OR NEW.reason<>OLD.reason OR NEW.submitted_at<>OLD.submitted_at OR NOT(NEW.quotation_id<=>OLD.quotation_id) OR NOT(NEW.po_id<=>OLD.po_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request identity and decided history are immutable'; END IF;
IF (SELECT client_id FROM inquiry WHERE inquiry_id=NEW.inquiry_id)<>(SELECT client_id FROM client_user WHERE client_user_id=NEW.requested_by_client_user_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request submitter must own inquiry'; END IF;
IF NEW.reviewed_by_user_id IS NOT NULL AND COALESCE((SELECT r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=NEW.reviewed_by_user_id AND u.status='active'),'')<>'Sales' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request reviewer must have active Sales role'; END IF;
IF (NEW.status='pending' OR NEW.status='approved') AND (EXISTS(SELECT 1 FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=NEW.inquiry_id) OR EXISTS(SELECT 1 FROM payment_transaction t JOIN sales_invoice v ON v.invoice_id=t.invoice_id JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=NEW.inquiry_id AND t.transaction_type='DOWNPAYMENT' AND t.approval_status='approved')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancellation blocked after JO or confirmed downpayment'; END IF;
IF NEW.quotation_id IS NOT NULL AND NEW.inquiry_id<>(SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancellation quotation must belong to inquiry'; END IF;
IF NEW.po_id IS NOT NULL AND NEW.inquiry_id<>(SELECT q.inquiry_id FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id WHERE p.po_id=NEW.po_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancellation PO must belong to inquiry'; END IF;
END;

-- @statement
CREATE TRIGGER revision_request_bi BEFORE INSERT ON quotation_revision_request FOR EACH ROW
BEGIN
IF NEW.status<>'pending' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request must start pending'; END IF;
IF (SELECT client_id FROM inquiry WHERE inquiry_id=(SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id))<>(SELECT client_id FROM client_user WHERE client_user_id=NEW.requested_by_client_user_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request submitter must own inquiry'; END IF;
IF NEW.reviewed_by_user_id IS NOT NULL AND COALESCE((SELECT r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=NEW.reviewed_by_user_id AND u.status='active'),'')<>'Sales' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request reviewer must have active Sales role'; END IF;
IF NEW.status='pending' AND ((SELECT is_current FROM quotation WHERE quotation_id=NEW.quotation_id)<>1 OR (SELECT status FROM quotation WHERE quotation_id=NEW.quotation_id)<>'sent' OR EXISTS(SELECT 1 FROM purchase_order WHERE quotation_id=NEW.quotation_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Revision requires current sent quotation before PO'; END IF;
END;

-- @statement
CREATE TRIGGER revision_request_bu BEFORE UPDATE ON quotation_revision_request FOR EACH ROW
BEGIN
IF OLD.status<>'pending' OR NEW.quotation_id<>OLD.quotation_id OR NEW.requested_by_client_user_id<>OLD.requested_by_client_user_id OR NEW.reason<>OLD.reason OR NEW.submitted_at<>OLD.submitted_at THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request identity and decided history are immutable'; END IF;
IF (SELECT client_id FROM inquiry WHERE inquiry_id=(SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id))<>(SELECT client_id FROM client_user WHERE client_user_id=NEW.requested_by_client_user_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request submitter must own inquiry'; END IF;
IF NEW.reviewed_by_user_id IS NOT NULL AND COALESCE((SELECT r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=NEW.reviewed_by_user_id AND u.status='active'),'')<>'Sales' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request reviewer must have active Sales role'; END IF;
IF NEW.status='pending' AND ((SELECT is_current FROM quotation WHERE quotation_id=NEW.quotation_id)<>1 OR (SELECT status FROM quotation WHERE quotation_id=NEW.quotation_id)<>'sent' OR EXISTS(SELECT 1 FROM purchase_order WHERE quotation_id=NEW.quotation_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Revision requires current sent quotation before PO'; END IF;
END;

-- @statement
CREATE TRIGGER inquiry_request_owner_history BEFORE UPDATE ON inquiry FOR EACH ROW
BEGIN
IF NEW.client_id<>OLD.client_id AND EXISTS(SELECT 1 FROM cancellation_request WHERE inquiry_id=OLD.inquiry_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request inquiry ownership is historical'; END IF;
END;

-- @statement
CREATE TRIGGER quotation_request_history BEFORE UPDATE ON quotation FOR EACH ROW
BEGIN
IF (NEW.inquiry_id<>OLD.inquiry_id OR NEW.revision_no<>OLD.revision_no) AND (EXISTS(SELECT 1 FROM quotation_revision_request WHERE quotation_id=OLD.quotation_id) OR EXISTS(SELECT 1 FROM cancellation_request WHERE quotation_id=OLD.quotation_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Requested quotation revision is historical'; END IF;
END;

-- @statement
CREATE TRIGGER client_user_request_history BEFORE UPDATE ON client_user FOR EACH ROW
BEGIN
IF NEW.client_id<>OLD.client_id AND (EXISTS(SELECT 1 FROM cancellation_request WHERE requested_by_client_user_id=OLD.client_user_id) OR EXISTS(SELECT 1 FROM quotation_revision_request WHERE requested_by_client_user_id=OLD.client_user_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request client ownership is historical'; END IF;
END;
