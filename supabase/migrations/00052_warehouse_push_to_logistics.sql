-- ============================================================================
-- Push warehouse stock to Logistics as a distinct step before shipping
--
-- Warehouse gets a "Push to Logistics" action instead of shipping directly.
-- Logistics' ship queue only shows items that have been pushed; the actual
-- bill no., customer name/contact, and transporter are filled in there.
--
-- No existing data is modified. Apply in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS pushed_to_logistics BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ;

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS customer_contact TEXT,
  ADD COLUMN IF NOT EXISTS master_cartons NUMERIC(12,3);
