-- ============================================================================
-- Auto-push produced quantity into warehouse stock
--
-- Previously warehouse_items was populated entirely by hand. Now every daily
-- production log (even a partial one, not just when the order finishes)
-- upserts a warehouse_items row for that order, keeping quantity in sync
-- with total produced-to-date. order_id is what the upsert keys on; NULL for
-- manually-created warehouse items (unique constraints ignore NULLs, so
-- those can coexist freely).
--
-- No existing data is modified. Apply in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_items_order_id_key'
  ) THEN
    ALTER TABLE warehouse_items ADD CONSTRAINT warehouse_items_order_id_key UNIQUE (order_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_warehouse_items_order_id ON warehouse_items(order_id);
