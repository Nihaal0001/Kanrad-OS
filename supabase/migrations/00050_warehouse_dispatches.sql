-- ============================================================================
-- Partial warehouse-to-order dispatch
--
-- Warehouse's old "Exit" flow was all-or-nothing per warehouse_items row and
-- lived on the Warehouse page. It's moved to Logistics: pick an order, pick
-- how much of that order's warehouse stock to dispatch. warehouse_dispatches
-- is an audit ledger of each partial dispatch; warehouse_items.quantity is
-- decremented accordingly (status flips to 'dispatched' once it hits zero).
--
-- No existing data is modified. Apply in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouse_dispatches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  quantity          NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  dispatched_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_dispatches_item ON warehouse_dispatches(warehouse_item_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_dispatches_order ON warehouse_dispatches(order_id);

ALTER TABLE warehouse_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access to warehouse_dispatches" ON warehouse_dispatches;
CREATE POLICY "Authenticated access to warehouse_dispatches" ON warehouse_dispatches
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
