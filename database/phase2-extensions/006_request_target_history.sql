-- Approved Part 1 historical PO ownership guard. No existing data changes.
-- @statement
CREATE TRIGGER purchase_order_request_history BEFORE UPDATE ON purchase_order FOR EACH ROW
BEGIN
IF NEW.quotation_id<>OLD.quotation_id AND EXISTS(SELECT 1 FROM cancellation_request WHERE po_id=OLD.po_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Requested PO quotation is historical'; END IF;
END;
