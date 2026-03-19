-- Backfill customers from legacy buyers and attach existing orders to customers.

INSERT INTO customers (
  name,
  company,
  email,
  phone,
  address,
  gstin,
  notes
)
SELECT
  b.name,
  b.company,
  b.email,
  b.phone,
  b.address,
  b.gst_number,
  b.notes
FROM buyers b
WHERE NOT EXISTS (
  SELECT 1
  FROM customers c
  WHERE lower(btrim(c.name)) = lower(btrim(b.name))
    AND lower(btrim(COALESCE(c.company, ''))) = lower(btrim(COALESCE(b.company, '')))
    AND lower(btrim(COALESCE(c.email, ''))) = lower(btrim(COALESCE(b.email, '')))
);

UPDATE orders o
SET customer_id = c.id
FROM buyers b
JOIN customers c
  ON lower(btrim(c.name)) = lower(btrim(b.name))
 AND lower(btrim(COALESCE(c.company, ''))) = lower(btrim(COALESCE(b.company, '')))
 AND lower(btrim(COALESCE(c.email, ''))) = lower(btrim(COALESCE(b.email, '')))
WHERE o.buyer_id = b.id
  AND o.customer_id IS NULL;
