-- Add optional thickness column to order_items for circle weight calculation.
-- Nullable — only populated for circle products; non-circle items leave it NULL.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS thickness_mm NUMERIC(6,2) DEFAULT NULL;
