-- Approved Phase 2 Part 1 extension. Execute only through migrate-part1.
-- Compound statements are separated by explicit runner markers.
-- @statement
CREATE TRIGGER client_user_client_id_history_p2 BEFORE UPDATE ON client_user FOR EACH ROW
BEGIN
IF NOT(NEW.client_id<=>OLD.client_id) AND (EXISTS(SELECT 1 FROM proof_of_payment WHERE client_user_id=OLD.client_user_id) OR EXISTS(SELECT 1 FROM inquiry WHERE submitted_by_client_user_id=OLD.client_user_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END;

-- @statement
CREATE TRIGGER sales_invoice_po_id_history_p2 BEFORE UPDATE ON sales_invoice FOR EACH ROW
BEGIN
IF NOT(NEW.po_id<=>OLD.po_id) AND (EXISTS(SELECT 1 FROM proof_of_payment WHERE invoice_id=OLD.invoice_id) OR EXISTS(SELECT 1 FROM payment_transaction WHERE invoice_id=OLD.invoice_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot reassign historical ownership'; END IF;
END;

-- @statement
RENAME TABLE client_receipt TO proof_of_payment, client_receipt_file TO proof_of_payment_file;

-- @statement
DROP TRIGGER client_user_client_id_history;

-- @statement
DROP TRIGGER sales_invoice_po_id_history;
