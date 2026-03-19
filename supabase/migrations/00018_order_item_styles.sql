-- Move style naming to order line items while keeping order-level style summary for compatibility.

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS style_name TEXT;

UPDATE order_items oi
SET style_name = o.style_name
FROM orders o
WHERE oi.order_id = o.id
  AND (oi.style_name IS NULL OR btrim(oi.style_name) = '');

ALTER TABLE order_items
ALTER COLUMN style_name SET NOT NULL;

CREATE OR REPLACE FUNCTION recalculate_order_quantity()
RETURNS TRIGGER AS $$
DECLARE
  target_order_id UUID;
BEGIN
  target_order_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END;

  UPDATE orders
  SET
    total_quantity = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM order_items
      WHERE order_id = target_order_id
    ),
    style_name = COALESCE((
      SELECT string_agg(style_name, ', ' ORDER BY style_name)
      FROM (
        SELECT DISTINCT btrim(style_name) AS style_name
        FROM order_items
        WHERE order_id = target_order_id
          AND btrim(style_name) <> ''
      ) styles
    ), '')
  WHERE id = target_order_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
