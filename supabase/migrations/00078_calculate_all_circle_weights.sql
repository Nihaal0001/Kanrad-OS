-- Every aluminium circle, including IB, gets its weight per piece directly from
-- diameter x diameter x thickness x the aluminium circle factor.
CREATE OR REPLACE FUNCTION set_non_ib_circle_weight() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.circle_type IN ('ib', 'non_ib')
     AND NEW.diameter_mm IS NOT NULL AND NEW.diameter_mm > 0
     AND NEW.thickness_mm IS NOT NULL AND NEW.thickness_mm > 0 THEN
    NEW.weight_kg := round((NEW.diameter_mm * NEW.diameter_mm * NEW.thickness_mm * 0.000002127)::numeric, 4);
  ELSE
    NEW.weight_kg := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fire the existing trigger to backfill both IB and non-IB material weights.
UPDATE materials
SET circle_type = circle_type
WHERE circle_type IN ('ib', 'non_ib');
