-- Payment terms (credit days) on every customer order and every purchase order.
--   orders.payment_terms           default 30 (prefilled from the customer's terms in the app)
--   purchase_orders.payment_terms  default 45
-- A supplier bill entered against a PO is due on entry date + that PO's payment terms
-- (45 when the bill has no PO). Existing bills keep their due dates.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_terms INTEGER NOT NULL DEFAULT 30
    CHECK (payment_terms >= 0 AND payment_terms <= 365);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS payment_terms INTEGER NOT NULL DEFAULT 45
    CHECK (payment_terms >= 0 AND payment_terms <= 365);

-- Existing orders take their customer's terms
UPDATE orders o
SET payment_terms = c.payment_terms
FROM customers c
WHERE o.customer_id = c.id
  AND c.payment_terms IS NOT NULL
  AND c.payment_terms BETWEEN 0 AND 365;

CREATE OR REPLACE FUNCTION set_purchase_invoice_due_date() RETURNS TRIGGER AS $$
DECLARE
  terms INTEGER;
BEGIN
  IF NEW.purchase_order_id IS NOT NULL THEN
    SELECT payment_terms INTO terms FROM purchase_orders WHERE id = NEW.purchase_order_id;
  END IF;
  NEW.due_date := ((COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Kolkata')::date + COALESCE(terms, 45));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
