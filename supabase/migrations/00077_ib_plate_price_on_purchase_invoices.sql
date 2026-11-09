-- Preserve the IB plate price copied from the linked purchase order on supplier invoice lines.
ALTER TABLE purchase_invoice_items
  ADD COLUMN IF NOT EXISTS is_ib_circle BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ib_plate_price NUMERIC(10,2) DEFAULT NULL;

ALTER TABLE purchase_invoice_items
  DROP CONSTRAINT IF EXISTS purchase_invoice_items_ib_plate_price_check;

ALTER TABLE purchase_invoice_items
  ADD CONSTRAINT purchase_invoice_items_ib_plate_price_check
  CHECK (ib_plate_price IS NULL OR ib_plate_price >= 0);
