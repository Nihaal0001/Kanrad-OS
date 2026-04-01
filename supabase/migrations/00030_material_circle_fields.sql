-- Add aluminium circle specific fields to materials.
-- These are nullable — only populated for circle products.
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS diameter_mm  NUMERIC(8,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS thickness_mm NUMERIC(6,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS circle_type  TEXT          DEFAULT NULL
    CHECK (circle_type IN ('ib', 'non_ib'));
