-- Supplier bills are due 45 days after the day they are entered in the ERP
-- (created_at, in IST), not 45 days after the supplier's invoice date.
-- Enforced in the database so every insert path (manual, imported, PO receiving) gets it.
-- Existing bills are left untouched.

CREATE OR REPLACE FUNCTION set_purchase_invoice_due_date() RETURNS TRIGGER AS $$
BEGIN
  NEW.due_date := ((COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Kolkata')::date + 45);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS purchase_invoice_due_date ON purchase_invoices;
CREATE TRIGGER purchase_invoice_due_date
  BEFORE INSERT ON purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION set_purchase_invoice_due_date();

-- Reminder cron looks up bills by due date
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_due_status
  ON purchase_invoices (due_date) WHERE status IN ('received', 'partially_paid', 'overdue');
