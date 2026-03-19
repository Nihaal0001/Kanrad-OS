-- Retire legacy buyer schema after customer migration is fully adopted.

ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;

DROP INDEX IF EXISTS idx_orders_buyer_id;

ALTER TABLE orders
DROP COLUMN IF EXISTS buyer_id;

ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_buyer_id_fkey;

ALTER TABLE invoices
DROP COLUMN IF EXISTS buyer_id,
DROP COLUMN IF EXISTS buyer_name,
DROP COLUMN IF EXISTS buyer_address,
DROP COLUMN IF EXISTS buyer_gst;

ALTER TABLE credit_notes
DROP COLUMN IF EXISTS buyer_name,
DROP COLUMN IF EXISTS buyer_gst;

DROP TRIGGER IF EXISTS update_buyers_updated_at ON buyers;

DROP TABLE IF EXISTS buyers;
