-- ============================================================================
-- Per-worker gender + overtime rate
--
-- Shift windows differ by gender: male 8am-6pm, female 8am-5pm — time worked
-- outside those windows is overtime. Storing gender + a per-hour OT rate on
-- the profile lets attendance imports and payroll compute overtime pay
-- automatically instead of re-entering it per pay run.
--
-- No existing data is modified. Apply in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS ot_rate NUMERIC(10,2) NOT NULL DEFAULT 0; -- ₹ per overtime hour
