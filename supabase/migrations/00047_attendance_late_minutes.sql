-- ============================================================================
-- Late-arrival minutes on attendance
--
-- Overtime is now computed automatically from check_in/check_out against a
-- gender-based shift window (male 8am-6pm, female 8am-5pm). Late-arrival
-- minutes are stored here and valued at the worker's OT rate to become a
-- base-pay deduction at payroll time — they do NOT reduce the OT hours
-- themselves, which are always paid in full.
--
-- No existing data is modified. Apply in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0;
