-- Admin-entered physical weight for a stock movement. This is deliberately
-- independent of the piece quantity: actual kg and pieces are allowed to differ
-- from the material's calculated weight per piece.
ALTER TABLE stock_transactions
  ADD COLUMN IF NOT EXISTS quantity_kg NUMERIC(12,3) DEFAULT NULL;
