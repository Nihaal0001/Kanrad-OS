-- Fields needed to print purchase orders in the standard Tally voucher
-- layout: reference/dispatch/delivery details that aren't always known at
-- creation time, so they're optional.
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS reference_no TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS other_references TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS dispatched_through TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms_of_delivery TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS mode_of_payment TEXT;
