-- Update unit to 'kg' for all existing Aluminium Circle materials.
-- These were created before the circle_type field existed, so unit was left as 'pcs'.
UPDATE materials
SET unit = 'kg'
WHERE category_id = (
  SELECT id FROM material_categories WHERE name = 'Aluminum Circle' LIMIT 1
)
AND unit != 'kg';
