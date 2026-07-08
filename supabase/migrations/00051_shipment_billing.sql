-- ============================================================================
-- Ship warehouse stock with a bill, auto-create the receivable
--
-- Shipping (formerly a bare "Create Shipment" form) now happens by picking
-- an order's ready-to-ship warehouse stock, a quantity, and a bill number.
-- The shipment records what warehouse stock it came from and what invoice
-- (the receivable) it generated.
--
-- No existing data is modified. Apply in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS warehouse_item_id UUID REFERENCES warehouse_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS bill_no TEXT,
  ADD COLUMN IF NOT EXISTS value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_invoice_id ON shipments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_shipments_warehouse_item_id ON shipments(warehouse_item_id);
