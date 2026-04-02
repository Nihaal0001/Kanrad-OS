-- Consolidate material categories per user request:
--   Glass Lid + Lid + Steel Lid  →  Lids
--   Aluminum Circle / Alu Circles  →  Aluminium
--   Rivet + Knob + Knobs  →  Knobs & Rivets
--   Cover + Poly Cover  →  Covers

-- Step 1: Ensure target categories exist
INSERT INTO material_categories (name)
VALUES ('Lids'), ('Aluminium'), ('Knobs & Rivets'), ('Covers')
ON CONFLICT (name) DO NOTHING;

-- Step 2: Re-point materials from old categories to consolidated ones

-- Lids (Glass Lid, Steel Lid, Lid, any lid variant)
UPDATE materials
SET category_id = (SELECT id FROM material_categories WHERE name = 'Lids')
WHERE category_id IN (
  SELECT id FROM material_categories
  WHERE lower(name) LIKE '%lid%'
    AND name != 'Lids'
);

-- Aluminium (Aluminum Circle, Alu Circles, Aluminium Circle, etc.)
UPDATE materials
SET category_id = (SELECT id FROM material_categories WHERE name = 'Aluminium')
WHERE category_id IN (
  SELECT id FROM material_categories
  WHERE (lower(name) LIKE '%alum%' OR lower(name) LIKE '%alu %')
    AND name != 'Aluminium'
);

-- Knobs & Rivets (Rivet, Rivets, Knob, Knobs)
UPDATE materials
SET category_id = (SELECT id FROM material_categories WHERE name = 'Knobs & Rivets')
WHERE category_id IN (
  SELECT id FROM material_categories
  WHERE lower(name) IN ('rivet', 'rivets', 'knob', 'knobs')
    OR lower(name) LIKE '%rivet%'
    OR lower(name) LIKE '%knob%'
);

-- Covers (Cover, Poly Cover, Covers, Poly Covers)
UPDATE materials
SET category_id = (SELECT id FROM material_categories WHERE name = 'Covers')
WHERE category_id IN (
  SELECT id FROM material_categories
  WHERE lower(name) LIKE '%cover%'
    AND name != 'Covers'
);

-- Step 3: Delete old categories that are now empty
DELETE FROM material_categories
WHERE name NOT IN ('Lids', 'Aluminium', 'Knobs & Rivets', 'Covers')
  AND (
    lower(name) LIKE '%lid%'
    OR lower(name) LIKE '%alum%'
    OR lower(name) LIKE '%alu %'
    OR lower(name) IN ('rivet', 'rivets', 'knob', 'knobs')
    OR lower(name) LIKE '%rivet%'
    OR lower(name) LIKE '%knob%'
    OR lower(name) LIKE '%cover%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM materials WHERE category_id = material_categories.id
  );
