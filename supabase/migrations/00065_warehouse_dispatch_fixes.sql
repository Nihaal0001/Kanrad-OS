-- ============================================================================
-- Fixes a real double-dispatch bug: dispatchWarehouseSku reads warehouse_items
-- then writes it back across several non-transactional calls with no lock,
-- so a double-click, a slow network triggering a retry, or two tabs
-- submitting the same dispatch moments apart can each process the full
-- quantity — "dispatch 50, 100 goes out". warehouse_dispatch_requests makes
-- each dispatch submission idempotent: the client generates one request id
-- per submission, and the very first thing the action does is try to insert
-- it here. A duplicate submission hits the primary key and is turned into a
-- no-op before it ever touches stock.
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouse_dispatch_requests (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE warehouse_dispatch_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access to warehouse_dispatch_requests" ON warehouse_dispatch_requests;
CREATE POLICY "Authenticated access to warehouse_dispatch_requests" ON warehouse_dispatch_requests
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Brand and item name are now snapshotted directly onto every dispatch row
-- (not just derived later via a join to warehouse_items/bom_headers), so the
-- Dispatched list stays accurate even if a product's brand changes later,
-- and so both are always present on every dispatch record.
ALTER TABLE warehouse_dispatches ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE warehouse_dispatches ADD COLUMN IF NOT EXISTS item_name TEXT;

UPDATE warehouse_dispatches wd
SET item_name = wi.item_name
FROM warehouse_items wi
WHERE wd.warehouse_item_id = wi.id AND wd.item_name IS NULL;

UPDATE warehouse_dispatches wd
SET brand = COALESCE(bh.brand, 'Unbranded')
FROM warehouse_items wi
LEFT JOIN bom_headers bh ON bh.product_sku = wi.sku
WHERE wd.warehouse_item_id = wi.id AND wd.brand IS NULL;

UPDATE warehouse_dispatches SET item_name = 'Unknown' WHERE item_name IS NULL;
UPDATE warehouse_dispatches SET brand = 'Unbranded' WHERE brand IS NULL;

ALTER TABLE warehouse_dispatches ALTER COLUMN item_name SET NOT NULL;
ALTER TABLE warehouse_dispatches ALTER COLUMN brand SET NOT NULL;

-- Invoice number (bill_no) was already required by the app form; enforce it
-- in the database too now that it's one of the compulsory dispatch fields.
UPDATE warehouse_dispatches SET bill_no = 'LEGACY' WHERE bill_no IS NULL;
ALTER TABLE warehouse_dispatches ALTER COLUMN bill_no SET NOT NULL;
