-- ============================================================================
-- Per-worker monthly salary (for automatic monthly payroll generation)
--
-- Stores each worker's fixed monthly salary on their profile. Auto-payroll
-- converts it to a daily rate (monthly ÷ working days, where working days =
-- days in the month minus Sundays) and multiplies by days present from
-- attendance. Overtime stays optional per payroll (hours × rate).
--
-- No existing data is modified. Apply in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0;
