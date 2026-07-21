-- Purchase orders now capture the applicable tax rate at creation time, so it
-- can flow into the purchase invoice auto-created when stock is received
-- against them (instead of always defaulting to 0%).
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
