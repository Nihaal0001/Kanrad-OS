-- ============================================================================
-- Early-departure minutes on attendance
--
-- Mirrors late_minutes (00047): checking out before the gender-based shift
-- window ends (male 6pm, female 5pm) is stored here and valued at the
-- worker's OT rate to become a base-pay deduction at payroll time, same as
-- lateness. Previously early leave had zero effect — a worker who left hours
-- early was paid a full day with no deduction and no OT.
--
-- No existing data is modified. Apply in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS early_minutes INTEGER NOT NULL DEFAULT 0;
