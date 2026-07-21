-- Separate the PO price ceiling from cost_per_unit.
-- cost_per_unit tracks the current/last-known costing price (updated on PO
-- creation and on receipt); max_price is an admin-set ceiling that purchase
-- orders may never exceed, and is never touched by PO creation.
ALTER TABLE materials ADD COLUMN IF NOT EXISTS max_price NUMERIC(10,2);

-- Best-effort backfill so the ceiling keeps working immediately: seed it
-- from whatever cost_per_unit currently holds. Admins can correct any
-- individual value afterwards in Master Inventory.
UPDATE materials SET max_price = cost_per_unit WHERE max_price IS NULL AND cost_per_unit > 0;
