-- ============================================================================
-- Link purchase orders to the customer orders they're procuring material for
--
-- A material PO can cover several customer orders at once. This adds:
--   - purchase_order_orders: which customer order(s) a PO is being raised for
--   - purchase_order_receipts: per-receipt attribution — when a line item is
--     received, how much of it goes toward which linked order (nullable —
--     not every receipt has to be attributed to one specific order)
--
-- No existing data is modified. Apply in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_order_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (purchase_order_id, order_id)
);

CREATE TABLE IF NOT EXISTS purchase_order_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_orders_po ON purchase_order_orders(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_orders_order ON purchase_order_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_po_receipts_item ON purchase_order_receipts(purchase_order_item_id);
CREATE INDEX IF NOT EXISTS idx_po_receipts_order ON purchase_order_receipts(order_id);

ALTER TABLE purchase_order_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access to purchase_order_orders" ON purchase_order_orders;
CREATE POLICY "Authenticated access to purchase_order_orders" ON purchase_order_orders
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated access to purchase_order_receipts" ON purchase_order_receipts;
CREATE POLICY "Authenticated access to purchase_order_receipts" ON purchase_order_receipts
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
