-- Add "Tri Ply Circles" as a material category, selectable in Master
-- Inventory / Inventory item forms.
INSERT INTO material_categories (name)
VALUES ('Tri Ply Circles')
ON CONFLICT (name) DO NOTHING;
