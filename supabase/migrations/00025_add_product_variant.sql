ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_variant TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_variant TEXT;

-- Backfill orders.product_variant from style_name
UPDATE orders SET product_variant = style_name WHERE product_variant IS NULL;

-- Backfill order_items.product_variant from style_name (via migration 00018)
UPDATE order_items oi SET product_variant = o.style_name
FROM orders o WHERE oi.order_id = o.id AND oi.product_variant IS NULL;
