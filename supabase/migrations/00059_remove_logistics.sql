-- Logistics module removed — warehouse dispatch (with its own bill number) is
-- now the only shipping-out path, and it invoices directly. bill_no moves
-- onto invoices itself instead of being derived via a shipments join, so
-- Receivables no longer depends on the (now unused) shipments table.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_no TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_bill_no ON invoices(bill_no);
