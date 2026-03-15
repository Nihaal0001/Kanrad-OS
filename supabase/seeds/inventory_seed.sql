-- ============================================================
-- JUST CLOTHING — Basic Inventory Seed
-- Run in Supabase SQL Editor
-- ============================================================

INSERT INTO materials (name, sku, category_id, unit, cost_per_unit, current_stock, min_stock_level, is_active)
SELECT v.name, v.sku, c.id, v.unit, v.cost_per_unit, v.current_stock, v.min_stock_level, true
FROM (VALUES
  -- ── Fabric ──────────────────────────────────────────────────
  ('Cotton Poplin',       'FAB-CPOP-001', 'Fabric',      'meters', 85.00,   450, 100),
  ('Cotton Jersey',       'FAB-CJER-001', 'Fabric',      'meters', 110.00,  320,  80),
  ('Denim',               'FAB-DNM-001',  'Fabric',      'meters', 145.00,  200,  60),
  ('Polyester Lining',    'FAB-PLN-001',  'Fabric',      'meters', 55.00,   180,  50),
  ('Rayon Viscose',       'FAB-RVS-001',  'Fabric',      'meters', 95.00,   250,  60),
  ('Interlock Knit',      'FAB-ILK-001',  'Fabric',      'meters', 120.00,  150,  50),
  -- ── Trims ───────────────────────────────────────────────────
  ('Metal Button 15mm',   'TRM-BTN-M15',  'Trims',       'pcs',    2.50,  3000, 500),
  ('Plastic Button 12mm', 'TRM-BTN-P12',  'Trims',       'pcs',    0.80,  5000, 800),
  ('Zipper 8 inch',       'TRM-ZIP-008',  'Trims',       'pcs',    12.00,  800, 150),
  ('Zipper 6 inch',       'TRM-ZIP-006',  'Trims',       'pcs',    10.00,  600, 100),
  ('Elastic 1 inch',      'TRM-ELS-100',  'Trims',       'meters',  8.00,  400,  80),
  ('Snap Button 18mm',    'TRM-SNP-018',  'Trims',       'pcs',     4.00, 2000, 400),
  ('Hook & Eye Set',      'TRM-HKE-001',  'Trims',       'pcs',     3.00, 1500, 300),
  -- ── Thread ──────────────────────────────────────────────────
  ('Polyester Thread',    'THR-POL-001',  'Thread',      'spools', 45.00,  120,  20),
  ('Cotton Thread',       'THR-COT-001',  'Thread',      'spools', 60.00,   80,  15),
  ('Overlock Thread',     'THR-OVL-001',  'Thread',      'cones',  55.00,   60,  15),
  ('Embroidery Thread',   'THR-EMB-001',  'Thread',      'spools', 35.00,   40,  10),
  -- ── Labels ──────────────────────────────────────────────────
  ('Care Label',          'LBL-CAR-001',  'Labels',      'pcs',     1.20, 8000, 1000),
  ('Brand Woven Label',   'LBL-BRD-001',  'Labels',      'pcs',     3.50, 6000, 1000),
  ('Size Label',          'LBL-SZE-001',  'Labels',      'pcs',     0.80, 5000,  800),
  -- ── Packaging ───────────────────────────────────────────────
  ('Poly Bag 12x16',      'PKG-PLY-001',  'Packaging',   'pcs',     1.50, 4000,  500),
  ('Cardboard Box Small', 'PKG-BOX-SML',  'Packaging',   'pcs',    18.00,  300,   50),
  ('Cardboard Box Large', 'PKG-BOX-LRG',  'Packaging',   'pcs',    28.00,  150,   30),
  ('Hang Tag',            'PKG-TAG-HNG',  'Packaging',   'pcs',     4.50, 5000,  800),
  ('Tissue Paper',        'PKG-TIS-001',  'Packaging',   'pcs',     0.50, 2000,  300)
) AS v(name, sku, cat_name, unit, cost_per_unit, current_stock, min_stock_level)
JOIN material_categories c ON c.name = v.cat_name
ON CONFLICT (sku) DO NOTHING;
