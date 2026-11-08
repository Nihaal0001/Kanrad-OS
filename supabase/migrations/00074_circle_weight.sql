-- Weight per piece (kg) for aluminium circles.
--   Non-IB circles: calculated automatically = diameter x diameter x thickness x 0.000002127
--   IB circles:     entered on the purchase order (weight + price), then stored on the material.

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,4) DEFAULT NULL;

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,4) DEFAULT NULL;

CREATE OR REPLACE FUNCTION set_non_ib_circle_weight() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.circle_type = 'non_ib'
     AND NEW.diameter_mm IS NOT NULL AND NEW.diameter_mm > 0
     AND NEW.thickness_mm IS NOT NULL AND NEW.thickness_mm > 0 THEN
    NEW.weight_kg := round((NEW.diameter_mm * NEW.diameter_mm * NEW.thickness_mm * 0.000002127)::numeric, 4);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS materials_non_ib_circle_weight ON materials;
CREATE TRIGGER materials_non_ib_circle_weight
  BEFORE INSERT OR UPDATE OF diameter_mm, thickness_mm, circle_type ON materials
  FOR EACH ROW EXECUTE FUNCTION set_non_ib_circle_weight();

-- Backfill existing non-IB circles (fires the trigger)
UPDATE materials SET circle_type = circle_type WHERE circle_type = 'non_ib';
