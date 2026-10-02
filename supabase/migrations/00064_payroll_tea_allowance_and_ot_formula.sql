-- Tea allowance: fixed ₹ amount per employee, snapshotted onto each payroll
-- run (same pattern as daily_wage snapshotting monthly_salary) so a later
-- change to an employee's allowance doesn't rewrite past payslips.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tea_allowance NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS tea_allowance NUMERIC(10,2) NOT NULL DEFAULT 0;

-- total_wage must fold in tea_allowance; generated columns can't be altered
-- in place, so drop and recreate with the extended expression.
ALTER TABLE payroll DROP COLUMN total_wage;
ALTER TABLE payroll ADD COLUMN total_wage NUMERIC(12,2) GENERATED ALWAYS AS (
  ROUND(daily_wage * days_present + overtime_rate * overtime_hours - deductions + bonus + tea_allowance, 2)
) STORED;

-- OT pay is now always computed as base hourly rate (monthly salary ÷
-- working days ÷ shift hours) × 1.5 × OT hours — see src/lib/attendance-ot.ts
-- — rather than a manually-set per-worker rate, so the manual rate is unused.
ALTER TABLE profiles DROP COLUMN IF EXISTS ot_rate;
