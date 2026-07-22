-- Products belong to a customer brand (Deepam, Granza, etc.) — previously
-- only encoded informally in SKU prefixes. Adding a real column so the
-- warehouse view can group finished goods by brand.
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS brand TEXT;

-- SKU-wise warehouse dispatch isn't always tied to one customer order (a
-- single dispatch can draw down stock produced against several orders), so
-- order_id becomes optional; bill_no is required by the app for any new
-- dispatch, recorded here for traceability.
ALTER TABLE warehouse_dispatches ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE warehouse_dispatches ADD COLUMN IF NOT EXISTS bill_no TEXT;
