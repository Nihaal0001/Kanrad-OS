-- Every stock receipt against a PO must now carry the supplier's bill/invoice
-- number, so Payables can show what was billed even before a formal purchase
-- invoice is entered in Finance.
ALTER TABLE purchase_order_receipts ADD COLUMN IF NOT EXISTS bill_no TEXT;
