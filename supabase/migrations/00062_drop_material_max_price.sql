-- Remove the PO price ceiling feature entirely — purchase orders no longer
-- enforce a max purchase price against materials.
ALTER TABLE materials DROP COLUMN IF EXISTS max_price;
