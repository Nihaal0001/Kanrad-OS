-- ============================================================
-- Deepam product catalogue — materials, prices, and BOMs
-- Sources: Deepam Classic BOM, Special BOM, Item BOM,
--          IC MC With Rate stock sheet (June 2026)
-- Prices: BOM values used; APTY-SPL corrected to ₹14.90/₹78
--         (stock file had incorrect ₹20.16/₹86 copied from DEEP APTY)
-- ============================================================


-- ============================================================
-- 1. Material categories
-- ============================================================

INSERT INTO material_categories (name) VALUES
  ('Handles'),
  ('Coatings'),
  ('IB Plates'),
  ('Inner Cartons'),
  ('Master Cartons')
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- 2. Materials — upsert by SKU (preserves existing stock counts)
-- ============================================================

INSERT INTO materials (sku, name, category_id, unit, cost_per_unit, min_stock_level, is_active)
SELECT v.sku, v.name,
       (SELECT id FROM material_categories WHERE name = v.cat),
       v.unit, v.cost, 0, true
FROM (VALUES

  -- ── Aluminium Circles (cost per kg @ current LME rate) ──────────────
  ('ALU-CIR-263-3',    'Alu Circle 263×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-290-3',    'Alu Circle 290×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-325-3',    'Alu Circle 325×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-272-3',    'Alu Circle 272×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-306-3',    'Alu Circle 306×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-318-3',    'Alu Circle 318×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-340-3',    'Alu Circle 340×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-380-3',    'Alu Circle 380×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-363-3',    'Alu Circle 363×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-390-3',    'Alu Circle 390×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-355-5',    'Alu Circle 355×5mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-242-29',   'Alu Circle 242×2.9mm',    'Aluminium', 'kg', 388.00),
  ('ALU-CIR-485-3',    'Alu Circle 485×3mm',      'Aluminium', 'kg', 388.00),
  ('ALU-CIR-263-26',   'Alu Circle 263×2.6mm',    'Aluminium', 'kg', 388.00),
  ('ALU-CIR-272-26',   'Alu Circle 272×2.6mm',    'Aluminium', 'kg', 388.00),
  ('ALU-CIR-272-24',   'Alu Circle 272×2.4mm',    'Aluminium', 'kg', 380.00),
  ('ALU-CIR-225-26',   'Alu Circle 225×2.6mm',    'Aluminium', 'kg', 388.00),

  -- ── IB Plates ────────────────────────────────────────────────────────
  ('IB-PLT-165',       'IB Plate 165mm',           'IB Plates', 'pcs', 24.50),
  ('IB-PLT-172',       'IB Plate 172mm',           'IB Plates', 'pcs', 25.50),
  ('IB-PLT-126',       'IB Plate 126mm',           'IB Plates', 'pcs', 16.50),
  ('IB-PLT-140',       'IB Plate 140mm',           'IB Plates', 'pcs', 18.00),

  -- ── Coatings — Classic Series (PPG 3-coat, ₹920/kg) ─────────────────
  ('CTG-PRIMER-PPG3',  'Primer Coat PPG3/1',       'Coatings',  'kg', 920.00),
  ('CTG-MID-PPG3',     'Mid Coat PPG3/2',          'Coatings',  'kg', 920.00),
  ('CTG-TOP-PPG3',     'Top Coat PPG3/3',          'Coatings',  'kg', 920.00),

  -- ── Coatings — Special Series (PPG 2-coat) ───────────────────────────
  ('CTG-PRIMER-PPG2',  'Primer Coat PPG 2-Coat',   'Coatings',  'kg', 838.00),
  ('CTG-TOP-PPG2',     'Top Coat PPG 2-Coat',      'Coatings',  'kg', 826.00),

  -- ── HTR Paints ───────────────────────────────────────────────────────
  ('CTG-HTR-RED',      'HTR Paint Tomato Red PPG', 'Coatings',  'kg', 770.00),
  ('CTG-HTR-BLUE',     'HTR Paint Blue GMM',       'Coatings',  'kg', 770.00),
  ('CTG-HTR-MAROON',   'HTR Paint Maroon',         'Coatings',  'kg', 770.00),

  -- ── Powder Coatings ──────────────────────────────────────────────────
  ('CTG-PWD-CLEAR',    'Clear Powder Coating',     'Coatings',  'kg', 377.69),
  ('CTG-PWD-ANTIQUE',  'Antique Silver Powder',    'Coatings',  'kg', 243.00),

  -- ── Rivets (cost per piece) ───────────────────────────────────────────
  ('RVT-5X14',         'Alu Rivet 5×14',           'Knobs & Rivets', 'pcs', 0.5641),
  ('RVT-55X14',        'Alu Rivet 5.5×14',         'Knobs & Rivets', 'pcs', 0.6111),
  ('RVT-5X14-FLAT',    'Alu Rivet 5×14 Flat',      'Knobs & Rivets', 'pcs', 0.5867),

  -- ── Knobs ────────────────────────────────────────────────────────────
  ('KNB-MATT-BIG',     'Matt Knob Big',            'Knobs & Rivets', 'pcs', 6.50),
  ('KNB-MATT-SML',     'Matt Knob Small',          'Knobs & Rivets', 'pcs', 4.50),

  -- ── Steel Washers & Screws ────────────────────────────────────────────
  ('WSR-5X15',         'Steel Washer 5×15',        'Knobs & Rivets', 'pcs', 0.45),
  ('SCW-5X20',         'Handle Screw 5×20',        'Knobs & Rivets', 'pcs', 0.90),

  -- ── Handles ──────────────────────────────────────────────────────────
  -- Using stock file rates (most current)
  ('HDL-ROYAL-TAWA',   'Bake Handle Royal Tawa',   'Handles', 'pcs', 14.75),
  ('HDL-ROYAL-SPAN',   'Bake Handle Royal Saucepan','Handles', 'pcs', 14.50),
  ('HDL-DOT-KADAI',    'Bake Handle Dot Kadai',    'Handles', 'pcs', 11.25),
  ('HDL-SIDE-SML',     'Bake Handle Side Small',   'Handles', 'pcs', 10.50),
  ('HDL-SIDE-BIG',     'Bake Handle Side Big',     'Handles', 'pcs', 13.90),
  ('HDL-BAKE-DOTTED',  'Bakelite Handle Dotted Tawa','Handles','pcs', 14.50),
  ('HDL-VENUS-APTY',   'Bakelite Handle Venus Appachatty','Handles','pcs', 10.85),

  -- ── Glass & SS Lids ──────────────────────────────────────────────────
  ('LID-GLS-188',      'Glass Lid Dia 188 (Cass-215)', 'Lids', 'pcs', 46.50),
  ('LID-GLS-227',      'Glass Lid Dia 227 (Cass-235)', 'Lids', 'pcs', 55.00),
  ('LID-GLS-244',      'Glass Lid Dia 244 (Cass-255)', 'Lids', 'pcs', 59.00),
  ('LID-GLS-237',      'Glass Lid Dia 237 (Kadai-240/3PC)', 'Lids', 'pcs', 55.00),
  ('LID-GLS-260',      'Glass Lid Dia 260 (Kadai-260)', 'Lids', 'pcs', 63.00),
  ('LID-GLS-280',      'Glass Lid Dia 280 (Kadai-280)', 'Lids', 'pcs', 71.50),
  ('LID-SS-APTY',      'SS Lid Appachatty 200mm',  'Lids', 'pcs', 30.00),
  ('LID-SS-DEEP-APTY', 'SS Lid Deep Appachatty',   'Lids', 'pcs', 35.00),

  -- ── PP Plastic Covers (per piece, from stock file rates) ─────────────
  ('CVR-PP-11X12',     'PP Cover 11×12',           'Covers', 'pcs', 0.90),
  ('CVR-PP-12X14',     'PP Cover 12×14',           'Covers', 'pcs', 1.25),
  ('CVR-PP-14X16',     'PP Cover 14×16',           'Covers', 'pcs', 1.85),
  ('CVR-PP-18X20',     'PP Cover 18×20',           'Covers', 'pcs', 2.64),

  -- ── Packaging / Labels ───────────────────────────────────────────────
  ('PKG-STICKER-DP',   'Sticker Deepam',           'Packaging', 'pcs', 0.65),
  ('PKG-WCARD-DP',     'Deepam Warranty Card',     'Packaging', 'pcs', 2.50),
  ('PKG-PLYSHEET-255', '2 Ply Sheet 255×255',      'Packaging', 'pcs', 1.00),
  ('PKG-PLYSHEET-285', '2 Ply Sheet 285×285',      'Packaging', 'pcs', 1.50),

  -- ── Inner Cartons / Colour Boxes (one per product) ────────────────────
  ('IC-CLASSIC-TAWA-250',  'Colour Box Tawa 250 Classic',  'Inner Cartons', 'pcs', 22.35),
  ('IC-CLASSIC-TAWA-280',  'Colour Box Tawa 280 Classic',  'Inner Cartons', 'pcs', 24.35),
  ('IC-CLASSIC-TAWA-300',  'Colour Box Tawa 300 Classic',  'Inner Cartons', 'pcs', 36.35),
  ('IC-CLASSIC-FPAN-240',  'Colour Box FryPan 240 Classic','Inner Cartons', 'pcs', 24.13),
  ('IC-CLASSIC-FPAN-260',  'Colour Box FryPan 260 Classic','Inner Cartons', 'pcs', 27.45),
  ('IC-CLASSIC-KAD-240',   'Colour Box Kadai 240 Classic', 'Inner Cartons', 'pcs', 36.53),
  ('IC-CLASSIC-KAD-260',   'Colour Box Kadai 260 Classic', 'Inner Cartons', 'pcs', 34.00),
  ('IC-CLASSIC-KAD-280',   'Colour Box Kadai 280 Classic', 'Inner Cartons', 'pcs', 39.36),
  ('IC-CLASSIC-CASS-215',  'Colour Box Casserole 215',     'Inner Cartons', 'pcs', 28.80),
  ('IC-CLASSIC-CASS-235',  'Colour Box Casserole 235',     'Inner Cartons', 'pcs', 32.67),
  ('IC-CLASSIC-CASS-255',  'Colour Box Casserole 255',     'Inner Cartons', 'pcs', 41.30),
  ('IC-CLASSIC-3PC',       'Colour Box 3PC Set',           'Inner Cartons', 'pcs', 42.32),
  ('IC-ROUND-TAWA',        'Colour Box Round Tawa',        'Inner Cartons', 'pcs', 34.75),
  ('IC-SQ-TAWA',           'Colour Box Square Tawa',       'Inner Cartons', 'pcs', 36.00),
  ('IC-DEEP-APTY',         'Colour Box Deep Appachatty',   'Inner Cartons', 'pcs', 20.16),
  ('IC-BIRIYANI-9LTR',     'Colour Box Biriyani Pot 9Ltr', 'Inner Cartons', 'pcs', 43.50),
  ('IC-SPL-IB-TAWA-250',   'Colour Box Tawa 250 IB Spl',  'Inner Cartons', 'pcs', 20.70),
  ('IC-SPL-IB-FPAN-240',   'Colour Box FryPan 240 IB Spl','Inner Cartons', 'pcs', 27.09),
  ('IC-SPL-APTY',          'Colour Box Appachatty Spl',    'Inner Cartons', 'pcs', 14.90),
  ('IC-SPL-NIB-TAWA-250',  'Colour Box Tawa 250 NIB Spl', 'Inner Cartons', 'pcs', 20.70),
  ('IC-SPL-NIB-FPAN-240',  'Colour Box FryPan 240 NIB Spl','Inner Cartons','pcs', 27.00),

  -- ── Master Cartons (cost = full carton price) ─────────────────────────
  ('MC-CLASSIC-TAWA-250',  'Master Box Tawa 250 Classic',  'Master Cartons', 'pcs', 69.00),
  ('MC-CLASSIC-TAWA-280',  'Master Box Tawa 280 Classic',  'Master Cartons', 'pcs', 72.00),
  ('MC-CLASSIC-TAWA-300',  'Master Box Tawa 300 Classic',  'Master Cartons', 'pcs', 86.30),
  ('MC-CLASSIC-FPAN-240',  'Master Box FryPan 240 Classic','Master Cartons', 'pcs', 68.00),
  ('MC-CLASSIC-FPAN-260',  'Master Box FryPan 260 Classic','Master Cartons', 'pcs', 81.70),
  ('MC-CLASSIC-KAD-240',   'Master Box Kadai 240 Classic', 'Master Cartons', 'pcs', 68.00),
  ('MC-CLASSIC-KAD-260',   'Master Box Kadai 260 Classic', 'Master Cartons', 'pcs', 78.00),
  ('MC-CLASSIC-KAD-280',   'Master Box Kadai 280 Classic', 'Master Cartons', 'pcs', 86.00),
  ('MC-CLASSIC-CASS-215',  'Master Box Casserole 215',     'Master Cartons', 'pcs', 70.00),
  ('MC-CLASSIC-CASS-235',  'Master Box Casserole 235',     'Master Cartons', 'pcs', 76.00),
  ('MC-CLASSIC-CASS-255',  'Master Box Casserole 255',     'Master Cartons', 'pcs', 85.00),
  ('MC-CLASSIC-3PC',       'Master Box 3PC Set',           'Master Cartons', 'pcs', 69.70),
  ('MC-ROUND-TAWA',        'Master Box Round Tawa',        'Master Cartons', 'pcs', 93.00),
  ('MC-SQ-TAWA',           'Master Box Square Tawa',       'Master Cartons', 'pcs', 93.00),
  ('MC-DEEP-APTY',         'Master Box Deep Appachatty',   'Master Cartons', 'pcs', 86.00),
  ('MC-BIRIYANI-9LTR',     'Master Box Biriyani Pot 9Ltr', 'Master Cartons', 'pcs', 84.00),
  ('MC-SPL-IB-TAWA-250',   'Master Box Tawa 250 IB Spl',  'Master Cartons', 'pcs', 80.00),
  ('MC-SPL-IB-FPAN-240',   'Master Box FryPan 240 IB Spl','Master Cartons', 'pcs', 90.00),
  ('MC-SPL-APTY',          'Master Box Appachatty Spl',    'Master Cartons', 'pcs', 78.00),
  ('MC-SPL-NIB-TAWA-250',  'Master Box Tawa 250 NIB Spl', 'Master Cartons', 'pcs', 80.00),
  ('MC-SPL-NIB-FPAN-240',  'Master Box FryPan 240 NIB Spl','Master Cartons','pcs', 93.00)

) AS v(sku, name, cat, unit, cost)
ON CONFLICT (sku) DO UPDATE SET
  cost_per_unit = EXCLUDED.cost_per_unit,
  name          = EXCLUDED.name,
  category_id   = EXCLUDED.category_id,
  unit          = EXCLUDED.unit,
  is_active     = true;


-- ============================================================
-- 3. BOM Headers — 21 Deepam products
-- ============================================================

INSERT INTO bom_headers (product_sku, product_name, category, is_active)
VALUES
  -- Classic Series
  ('DP-CLASSIC-TAWA-250', 'Dosa Tawa 250mm Classic IB',     'Classic', true),
  ('DP-CLASSIC-TAWA-280', 'Dosa Tawa 280mm Classic IB',     'Classic', true),
  ('DP-CLASSIC-TAWA-300', 'Dosa Tawa 300mm Classic IB',     'Classic', true),
  ('DP-CLASSIC-FPAN-240', 'FryPan 240mm Classic IB',        'Classic', true),
  ('DP-CLASSIC-FPAN-260', 'FryPan 260mm Classic IB',        'Classic', true),
  ('DP-CLASSIC-KAD-240',  'Kadai 240mm Classic IB',         'Classic', true),
  ('DP-CLASSIC-KAD-260',  'Kadai 260mm Classic IB',         'Classic', true),
  ('DP-CLASSIC-KAD-280',  'Kadai 280mm Classic IB',         'Classic', true),
  ('DP-CLASSIC-CASS-215', 'Casserole 215mm Classic IB',     'Classic', true),
  ('DP-CLASSIC-CASS-235', 'Casserole 235mm Classic IB',     'Classic', true),
  ('DP-CLASSIC-CASS-255', 'Casserole 255mm Classic IB',     'Classic', true),
  ('DP-CLASSIC-3PC',      '3PC Set Classic IB',             'Classic', true),
  -- Item BOM / Pathri Series
  ('DP-ROUND-TAWA',       'Round Pathri Tawa RT35',         'Classic', true),
  ('DP-SQ-TAWA',          'Square Pathri Tawa SQT35',       'Classic', true),
  ('DP-DEEP-APTY',        'Deep Appachatty 242mm',          'Classic', true),
  ('DP-BIRIYANI-9LTR',    'Biriyani Pot 9 Litre',           'Classic', true),
  -- Special Series
  ('DP-SPL-IB-TAWA-250',  'Dosa Tawa 250mm IB Special',    'Special', true),
  ('DP-SPL-IB-FPAN-240',  'FryPan 240mm IB Special',       'Special', true),
  ('DP-SPL-APTY',         'Appachatty 200mm Special',       'Special', true),
  ('DP-SPL-NIB-TAWA-250', 'Dosa Tawa 250mm Non-IB Special','Special', true),
  ('DP-SPL-NIB-FPAN-240', 'FryPan 240mm Non-IB Special',   'Special', true)
ON CONFLICT (product_sku, version) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  category     = EXCLUDED.category,
  is_active    = true;


-- ============================================================
-- 4. BOM Items — clean rebuild per product
--    qty_required for MC = 1/pcs_per_carton (e.g. 0.1 = 10pcs/MC)
-- ============================================================

-- Remove existing items for all Deepam BOMs before reinserting
DELETE FROM bom_items
WHERE bom_id IN (
  SELECT id FROM bom_headers
  WHERE product_sku LIKE 'DP-%'
);

-- Helper: insert bom items by looking up both bom and material by SKU
-- We use a single INSERT ... SELECT across all products and items

INSERT INTO bom_items (bom_id, material_id, qty_required, unit, wastage_pct)
SELECT
  b.id AS bom_id,
  m.id AS material_id,
  v.qty,
  v.unit,
  COALESCE(v.wastage, 0)
FROM (VALUES

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: Dosa Tawa 250mm
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-TAWA-250', 'ALU-CIR-263-3',       0.441,  'kg',   0),
  ('DP-CLASSIC-TAWA-250', 'IB-PLT-165',          1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-250', 'CTG-PRIMER-PPG3',     0.005,  'kg',   0),
  ('DP-CLASSIC-TAWA-250', 'CTG-MID-PPG3',        0.005,  'kg',   0),
  ('DP-CLASSIC-TAWA-250', 'CTG-TOP-PPG3',        0.004,  'kg',   0),
  ('DP-CLASSIC-TAWA-250', 'RVT-55X14',           2,      'pcs',  0),
  ('DP-CLASSIC-TAWA-250', 'CVR-PP-11X12',        1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-250', 'HDL-ROYAL-TAWA',      1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-250', 'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-250', 'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-250', 'IC-CLASSIC-TAWA-250', 1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-250', 'MC-CLASSIC-TAWA-250', 0.1,    'pcs',  0),  -- 10 pcs/MC

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: Dosa Tawa 280mm
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-TAWA-280', 'ALU-CIR-290-3',       0.536,  'kg',   0),
  ('DP-CLASSIC-TAWA-280', 'IB-PLT-172',          1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-280', 'CTG-PRIMER-PPG3',     0.0055, 'kg',   0),
  ('DP-CLASSIC-TAWA-280', 'CTG-MID-PPG3',        0.00625,'kg',   0),
  ('DP-CLASSIC-TAWA-280', 'CTG-TOP-PPG3',        0.0044, 'kg',   0),
  ('DP-CLASSIC-TAWA-280', 'RVT-55X14',           2,      'pcs',  0),
  ('DP-CLASSIC-TAWA-280', 'CVR-PP-12X14',        1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-280', 'HDL-ROYAL-TAWA',      1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-280', 'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-280', 'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-280', 'IC-CLASSIC-TAWA-280', 1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-280', 'MC-CLASSIC-TAWA-280', 0.1,    'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: Dosa Tawa 300mm
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-TAWA-300', 'ALU-CIR-325-3',       0.673,  'kg',   0),
  ('DP-CLASSIC-TAWA-300', 'IB-PLT-172',          1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-300', 'CTG-PRIMER-PPG3',     0.0076, 'kg',   0),
  ('DP-CLASSIC-TAWA-300', 'CTG-MID-PPG3',        0.007,  'kg',   0),
  ('DP-CLASSIC-TAWA-300', 'CTG-TOP-PPG3',        0.0058, 'kg',   0),
  ('DP-CLASSIC-TAWA-300', 'RVT-55X14',           2,      'pcs',  0),
  ('DP-CLASSIC-TAWA-300', 'CVR-PP-14X16',        1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-300', 'HDL-ROYAL-TAWA',      1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-300', 'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-300', 'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-300', 'IC-CLASSIC-TAWA-300', 1,      'pcs',  0),
  ('DP-CLASSIC-TAWA-300', 'MC-CLASSIC-TAWA-300', 0.1,    'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: FryPan 240mm
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-FPAN-240', 'ALU-CIR-272-3',       0.472,  'kg',   0),
  ('DP-CLASSIC-FPAN-240', 'IB-PLT-126',          1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-240', 'CTG-PRIMER-PPG3',     0.005,  'kg',   0),
  ('DP-CLASSIC-FPAN-240', 'CTG-MID-PPG3',        0.005,  'kg',   0),
  ('DP-CLASSIC-FPAN-240', 'CTG-TOP-PPG3',        0.004,  'kg',   0),
  ('DP-CLASSIC-FPAN-240', 'RVT-55X14',           2,      'pcs',  0),
  ('DP-CLASSIC-FPAN-240', 'CVR-PP-11X12',        1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-240', 'HDL-ROYAL-TAWA',      1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-240', 'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-240', 'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-240', 'IC-CLASSIC-FPAN-240', 1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-240', 'MC-CLASSIC-FPAN-240', 0.1,    'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: FryPan 260mm
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-FPAN-260', 'ALU-CIR-306-3',       0.597,  'kg',   0),
  ('DP-CLASSIC-FPAN-260', 'IB-PLT-140',          1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-260', 'CTG-PRIMER-PPG3',     0.0068, 'kg',   0),
  ('DP-CLASSIC-FPAN-260', 'CTG-MID-PPG3',        0.007,  'kg',   0),
  ('DP-CLASSIC-FPAN-260', 'CTG-TOP-PPG3',        0.0046, 'kg',   0),
  ('DP-CLASSIC-FPAN-260', 'RVT-55X14',           2,      'pcs',  0),
  ('DP-CLASSIC-FPAN-260', 'CVR-PP-12X14',        1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-260', 'HDL-ROYAL-SPAN',      1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-260', 'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-260', 'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-260', 'IC-CLASSIC-FPAN-260', 1,      'pcs',  0),
  ('DP-CLASSIC-FPAN-260', 'MC-CLASSIC-FPAN-260', 0.1,    'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: Kadai 240mm
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-KAD-240',  'ALU-CIR-318-3',       0.645,  'kg',   0),
  ('DP-CLASSIC-KAD-240',  'IB-PLT-140',          1,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'CTG-PRIMER-PPG3',     0.0058, 'kg',   0),
  ('DP-CLASSIC-KAD-240',  'CTG-MID-PPG3',        0.007,  'kg',   0),
  ('DP-CLASSIC-KAD-240',  'CTG-TOP-PPG3',        0.0042, 'kg',   0),
  ('DP-CLASSIC-KAD-240',  'RVT-5X14',            4,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'CVR-PP-12X14',        1,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'CVR-PP-11X12',        1,      'pcs',  0),  -- lid cover
  ('DP-CLASSIC-KAD-240',  'HDL-DOT-KADAI',       2,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'LID-GLS-237',         1,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'KNB-MATT-BIG',        1,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'WSR-5X15',            1,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'PKG-PLYSHEET-255',    1,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'IC-CLASSIC-KAD-240',  1,      'pcs',  0),
  ('DP-CLASSIC-KAD-240',  'MC-CLASSIC-KAD-240',  0.1,    'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: Kadai 260mm
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-KAD-260',  'ALU-CIR-340-3',       0.737,  'kg',   0),
  ('DP-CLASSIC-KAD-260',  'IB-PLT-126',          1,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'CTG-PRIMER-PPG3',     0.0058, 'kg',   0),
  ('DP-CLASSIC-KAD-260',  'CTG-MID-PPG3',        0.007,  'kg',   0),
  ('DP-CLASSIC-KAD-260',  'CTG-TOP-PPG3',        0.0042, 'kg',   0),
  ('DP-CLASSIC-KAD-260',  'RVT-5X14',            4,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'CVR-PP-14X16',        1,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'CVR-PP-12X14',        1,      'pcs',  0),  -- lid cover
  ('DP-CLASSIC-KAD-260',  'HDL-DOT-KADAI',       2,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'LID-GLS-260',         1,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'KNB-MATT-BIG',        1,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'WSR-5X15',            1,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'PKG-PLYSHEET-255',    1,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'IC-CLASSIC-KAD-260',  1,      'pcs',  0),
  ('DP-CLASSIC-KAD-260',  'MC-CLASSIC-KAD-260',  0.1,    'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: Kadai 280mm (8 pcs per master carton)
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-KAD-280',  'ALU-CIR-380-3',       0.9214, 'kg',   0),
  ('DP-CLASSIC-KAD-280',  'IB-PLT-140',          1,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'CTG-PRIMER-PPG3',     0.0058, 'kg',   0),
  ('DP-CLASSIC-KAD-280',  'CTG-MID-PPG3',        0.007,  'kg',   0),
  ('DP-CLASSIC-KAD-280',  'CTG-TOP-PPG3',        0.0042, 'kg',   0),
  ('DP-CLASSIC-KAD-280',  'RVT-5X14',            4,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'CVR-PP-14X16',        1,      'pcs',  0),  -- lid cover
  ('DP-CLASSIC-KAD-280',  'CVR-PP-18X20',        1,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'HDL-DOT-KADAI',       2,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'LID-GLS-280',         1,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'KNB-MATT-BIG',        1,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'WSR-5X15',            1,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'PKG-PLYSHEET-285',    1,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'IC-CLASSIC-KAD-280',  1,      'pcs',  0),
  ('DP-CLASSIC-KAD-280',  'MC-CLASSIC-KAD-280',  0.125,  'pcs',  0),  -- 8 pcs/MC

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: Casserole 215mm
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-CASS-215', 'ALU-CIR-318-3',       0.6453, 'kg',   0),
  ('DP-CLASSIC-CASS-215', 'IB-PLT-126',          1,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'CTG-PRIMER-PPG3',     0.0058, 'kg',   0),
  ('DP-CLASSIC-CASS-215', 'CTG-MID-PPG3',        0.007,  'kg',   0),
  ('DP-CLASSIC-CASS-215', 'CTG-TOP-PPG3',        0.0042, 'kg',   0),
  ('DP-CLASSIC-CASS-215', 'RVT-5X14',            4,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'CVR-PP-12X14',        1,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'CVR-PP-11X12',        1,      'pcs',  0),  -- lid cover
  ('DP-CLASSIC-CASS-215', 'HDL-SIDE-SML',        2,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'LID-GLS-188',         1,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'KNB-MATT-BIG',        1,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'WSR-5X15',            1,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'PKG-PLYSHEET-255',    1,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'IC-CLASSIC-CASS-215', 1,      'pcs',  0),
  ('DP-CLASSIC-CASS-215', 'MC-CLASSIC-CASS-215', 0.1,    'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: Casserole 235mm
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-CASS-235', 'ALU-CIR-363-3',       0.84,   'kg',   0),
  ('DP-CLASSIC-CASS-235', 'IB-PLT-172',          1,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'CTG-PRIMER-PPG3',     0.0058, 'kg',   0),
  ('DP-CLASSIC-CASS-235', 'CTG-MID-PPG3',        0.007,  'kg',   0),
  ('DP-CLASSIC-CASS-235', 'CTG-TOP-PPG3',        0.0042, 'kg',   0),
  ('DP-CLASSIC-CASS-235', 'RVT-5X14',            4,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'CVR-PP-14X16',        1,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'CVR-PP-11X12',        1,      'pcs',  0),  -- lid cover
  ('DP-CLASSIC-CASS-235', 'HDL-SIDE-SML',        2,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'LID-GLS-227',         1,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'KNB-MATT-BIG',        1,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'WSR-5X15',            1,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'PKG-PLYSHEET-255',    1,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'IC-CLASSIC-CASS-235', 1,      'pcs',  0),
  ('DP-CLASSIC-CASS-235', 'MC-CLASSIC-CASS-235', 0.1,    'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: Casserole 255mm
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-CASS-255', 'ALU-CIR-390-3',       0.97,   'kg',   0),
  ('DP-CLASSIC-CASS-255', 'IB-PLT-172',          1,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'CTG-PRIMER-PPG3',     0.0058, 'kg',   0),
  ('DP-CLASSIC-CASS-255', 'CTG-MID-PPG3',        0.007,  'kg',   0),
  ('DP-CLASSIC-CASS-255', 'CTG-TOP-PPG3',        0.0042, 'kg',   0),
  ('DP-CLASSIC-CASS-255', 'RVT-5X14',            4,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'CVR-PP-14X16',        1,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'CVR-PP-12X14',        1,      'pcs',  0),  -- lid cover
  ('DP-CLASSIC-CASS-255', 'HDL-SIDE-BIG',        2,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'LID-GLS-244',         1,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'KNB-MATT-BIG',        1,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'WSR-5X15',            1,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'PKG-STICKER-DP',      1,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'PKG-PLYSHEET-255',    1,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'IC-CLASSIC-CASS-255', 1,      'pcs',  0),
  ('DP-CLASSIC-CASS-255', 'MC-CLASSIC-CASS-255', 0.1,    'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- CLASSIC: 3PC Set (Tawa 250 + FryPan 280 + Casserole 215)
  --          6 pcs per master carton
  -- ────────────────────────────────────────────────────────────
  ('DP-CLASSIC-3PC', 'ALU-CIR-263-3',       0.4414, 'kg',   0),  -- Tawa 250 circle
  ('DP-CLASSIC-3PC', 'ALU-CIR-290-3',       0.5366, 'kg',   0),  -- FryPan 280 circle
  ('DP-CLASSIC-3PC', 'ALU-CIR-318-3',       0.6453, 'kg',   0),  -- Casserole circle
  ('DP-CLASSIC-3PC', 'IB-PLT-165',          1,      'pcs',  0),  -- Tawa IB plate
  ('DP-CLASSIC-3PC', 'IB-PLT-140',          2,      'pcs',  0),  -- FryPan + Cass IB plates
  ('DP-CLASSIC-3PC', 'CTG-PRIMER-PPG3',     0.0058, 'kg',   0),
  ('DP-CLASSIC-3PC', 'CTG-MID-PPG3',        0.007,  'kg',   0),
  ('DP-CLASSIC-3PC', 'CTG-TOP-PPG3',        0.0042, 'kg',   0),
  ('DP-CLASSIC-3PC', 'CTG-HTR-MAROON',      0.0189, 'kg',   0),
  ('DP-CLASSIC-3PC', 'RVT-55X14',           4,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'RVT-5X14',            4,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'HDL-ROYAL-TAWA',      1,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'HDL-ROYAL-SPAN',      1,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'HDL-SIDE-SML',        2,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'SCW-5X20',            2,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'CVR-PP-12X14',        1,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'CVR-PP-11X12',        2,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'LID-GLS-237',         1,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'KNB-MATT-BIG',        1,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'WSR-5X15',            1,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'PKG-STICKER-DP',      3,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'PKG-WCARD-DP',        1,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'IC-CLASSIC-3PC',      1,      'pcs',  0),
  ('DP-CLASSIC-3PC', 'MC-CLASSIC-3PC',      0.1667, 'pcs',  0),  -- 6 pcs/MC

  -- ────────────────────────────────────────────────────────────
  -- ITEM BOM: Round Pathri Tawa (RT35, 355×5mm, 10pcs/MC)
  -- ────────────────────────────────────────────────────────────
  ('DP-ROUND-TAWA', 'ALU-CIR-355-5',        1.3485, 'kg',   0),
  ('DP-ROUND-TAWA', 'CTG-PRIMER-PPG3',      0.0495, 'kg',   0),  -- NS coating
  ('DP-ROUND-TAWA', 'CTG-HTR-RED',          0.0278, 'kg',   0),
  ('DP-ROUND-TAWA', 'HDL-ROYAL-TAWA',       1,      'pcs',  0),
  ('DP-ROUND-TAWA', 'RVT-55X14',            2,      'pcs',  0),
  ('DP-ROUND-TAWA', 'CVR-PP-11X12',         1,      'pcs',  0),
  ('DP-ROUND-TAWA', 'PKG-STICKER-DP',       1,      'pcs',  0),
  ('DP-ROUND-TAWA', 'PKG-WCARD-DP',         1,      'pcs',  0),
  ('DP-ROUND-TAWA', 'IC-ROUND-TAWA',        1,      'pcs',  0),
  ('DP-ROUND-TAWA', 'MC-ROUND-TAWA',        0.1,    'pcs',  0),  -- 10pcs/MC

  -- ────────────────────────────────────────────────────────────
  -- ITEM BOM: Square Pathri Tawa (SQT35, 355×5mm, 10pcs/MC)
  -- ────────────────────────────────────────────────────────────
  ('DP-SQ-TAWA', 'ALU-CIR-355-5',           1.3485, 'kg',   0),
  ('DP-SQ-TAWA', 'CTG-PRIMER-PPG3',         0.0514, 'kg',   0),
  ('DP-SQ-TAWA', 'CTG-HTR-RED',             0.0298, 'kg',   0),
  ('DP-SQ-TAWA', 'HDL-ROYAL-TAWA',          1,      'pcs',  0),
  ('DP-SQ-TAWA', 'RVT-55X14',               2,      'pcs',  0),
  ('DP-SQ-TAWA', 'CVR-PP-11X12',            1,      'pcs',  0),
  ('DP-SQ-TAWA', 'PKG-STICKER-DP',          1,      'pcs',  0),
  ('DP-SQ-TAWA', 'PKG-WCARD-DP',            1,      'pcs',  0),
  ('DP-SQ-TAWA', 'IC-SQ-TAWA',              1,      'pcs',  0),
  ('DP-SQ-TAWA', 'MC-SQ-TAWA',              0.1,    'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- ITEM BOM: Deep Appachatty (APTY 22, 242×2.9mm, 20pcs/MC)
  -- ────────────────────────────────────────────────────────────
  ('DP-DEEP-APTY', 'ALU-CIR-242-29',        0.3634, 'kg',   0),
  ('DP-DEEP-APTY', 'CTG-PRIMER-PPG3',       0.0281, 'kg',   0),
  ('DP-DEEP-APTY', 'CTG-HTR-RED',           0.0159, 'kg',   0),
  ('DP-DEEP-APTY', 'HDL-VENUS-APTY',        1,      'pcs',  0),
  ('DP-DEEP-APTY', 'RVT-5X14',              2,      'pcs',  0),
  ('DP-DEEP-APTY', 'CVR-PP-11X12',          1,      'pcs',  0),
  ('DP-DEEP-APTY', 'LID-SS-DEEP-APTY',      1,      'pcs',  0),
  ('DP-DEEP-APTY', 'KNB-MATT-SML',          1,      'pcs',  0),
  ('DP-DEEP-APTY', 'PKG-STICKER-DP',        1,      'pcs',  0),
  ('DP-DEEP-APTY', 'PKG-WCARD-DP',          1,      'pcs',  0),
  ('DP-DEEP-APTY', 'IC-DEEP-APTY',          1,      'pcs',  0),
  ('DP-DEEP-APTY', 'MC-DEEP-APTY',          0.05,   'pcs',  0),  -- 20pcs/MC

  -- ────────────────────────────────────────────────────────────
  -- ITEM BOM: Biriyani Pot 9 Litre (485×3mm, 6pcs/MC)
  -- ────────────────────────────────────────────────────────────
  ('DP-BIRIYANI-9LTR', 'ALU-CIR-485-3',     1.5101, 'kg',   0),
  ('DP-BIRIYANI-9LTR', 'CTG-PRIMER-PPG3',   0.0436, 'kg',   0),
  ('DP-BIRIYANI-9LTR', 'CTG-HTR-RED',       0.0229, 'kg',   0),
  ('DP-BIRIYANI-9LTR', 'HDL-ROYAL-TAWA',    1,      'pcs',  0),
  ('DP-BIRIYANI-9LTR', 'RVT-55X14',         2,      'pcs',  0),
  ('DP-BIRIYANI-9LTR', 'CVR-PP-11X12',      1,      'pcs',  0),
  ('DP-BIRIYANI-9LTR', 'LID-GLS-237',       1,      'pcs',  0),
  ('DP-BIRIYANI-9LTR', 'KNB-MATT-BIG',      1,      'pcs',  0),
  ('DP-BIRIYANI-9LTR', 'PKG-STICKER-DP',    1,      'pcs',  0),
  ('DP-BIRIYANI-9LTR', 'PKG-WCARD-DP',      1,      'pcs',  0),
  ('DP-BIRIYANI-9LTR', 'IC-BIRIYANI-9LTR',  1,      'pcs',  0),
  ('DP-BIRIYANI-9LTR', 'MC-BIRIYANI-9LTR',  0.1667, 'pcs',  0),  -- 6pcs/MC

  -- ────────────────────────────────────────────────────────────
  -- SPECIAL IB: Dosa Tawa 250mm IB Special (2.6mm, 20pcs/MC)
  -- ────────────────────────────────────────────────────────────
  ('DP-SPL-IB-TAWA-250', 'ALU-CIR-263-26',          0.3531, 'kg',   0),
  ('DP-SPL-IB-TAWA-250', 'IB-PLT-165',              1,      'pcs',  0),
  ('DP-SPL-IB-TAWA-250', 'CTG-PRIMER-PPG2',         0.005,  'kg',   0),
  ('DP-SPL-IB-TAWA-250', 'CTG-TOP-PPG2',            0.004,  'kg',   0),
  ('DP-SPL-IB-TAWA-250', 'CTG-HTR-RED',             0.007,  'kg',   0),
  ('DP-SPL-IB-TAWA-250', 'RVT-55X14',               2,      'pcs',  0),
  ('DP-SPL-IB-TAWA-250', 'CVR-PP-11X12',            1,      'pcs',  0),
  ('DP-SPL-IB-TAWA-250', 'HDL-BAKE-DOTTED',         1,      'pcs',  0),
  ('DP-SPL-IB-TAWA-250', 'PKG-STICKER-DP',          1,      'pcs',  0),
  ('DP-SPL-IB-TAWA-250', 'PKG-WCARD-DP',            1,      'pcs',  0),
  ('DP-SPL-IB-TAWA-250', 'IC-SPL-IB-TAWA-250',      1,      'pcs',  0),
  ('DP-SPL-IB-TAWA-250', 'MC-SPL-IB-TAWA-250',      0.05,   'pcs',  0),  -- 20pcs/MC

  -- ────────────────────────────────────────────────────────────
  -- SPECIAL IB: FryPan 240mm IB Special (2.6mm, 20pcs/MC)
  -- ────────────────────────────────────────────────────────────
  ('DP-SPL-IB-FPAN-240', 'ALU-CIR-272-26',          0.3777, 'kg',   0),
  ('DP-SPL-IB-FPAN-240', 'IB-PLT-126',              1,      'pcs',  0),
  ('DP-SPL-IB-FPAN-240', 'CTG-PRIMER-PPG2',         0.005,  'kg',   0),
  ('DP-SPL-IB-FPAN-240', 'CTG-TOP-PPG2',            0.004,  'kg',   0),
  ('DP-SPL-IB-FPAN-240', 'CTG-HTR-RED',             0.0075, 'kg',   0),
  ('DP-SPL-IB-FPAN-240', 'RVT-55X14',               2,      'pcs',  0),
  ('DP-SPL-IB-FPAN-240', 'CVR-PP-11X12',            1,      'pcs',  0),
  ('DP-SPL-IB-FPAN-240', 'HDL-BAKE-DOTTED',         1,      'pcs',  0),
  ('DP-SPL-IB-FPAN-240', 'PKG-STICKER-DP',          1,      'pcs',  0),
  ('DP-SPL-IB-FPAN-240', 'PKG-WCARD-DP',            1,      'pcs',  0),
  ('DP-SPL-IB-FPAN-240', 'IC-SPL-IB-FPAN-240',      1,      'pcs',  0),
  ('DP-SPL-IB-FPAN-240', 'MC-SPL-IB-FPAN-240',      0.05,   'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- SPECIAL: Appachatty 200mm Special (IC ₹14.90, MC ₹78, 20pcs/MC)
  -- ────────────────────────────────────────────────────────────
  ('DP-SPL-APTY', 'ALU-CIR-225-26',                 0.2800, 'kg',   0),
  ('DP-SPL-APTY', 'CTG-PRIMER-PPG2',                0.0058, 'kg',   0),
  ('DP-SPL-APTY', 'CTG-TOP-PPG2',                   0.0042, 'kg',   0),
  ('DP-SPL-APTY', 'CTG-HTR-RED',                    0.007,  'kg',   0),
  ('DP-SPL-APTY', 'RVT-5X14',                       4,      'pcs',  0),
  ('DP-SPL-APTY', 'CVR-PP-11X12',                   1,      'pcs',  0),
  ('DP-SPL-APTY', 'HDL-VENUS-APTY',                 2,      'pcs',  0),
  ('DP-SPL-APTY', 'LID-SS-APTY',                    1,      'pcs',  0),
  ('DP-SPL-APTY', 'KNB-MATT-SML',                   1,      'pcs',  0),
  ('DP-SPL-APTY', 'PKG-STICKER-DP',                 1,      'pcs',  0),
  ('DP-SPL-APTY', 'PKG-WCARD-DP',                   1,      'pcs',  0),
  ('DP-SPL-APTY', 'IC-SPL-APTY',                    1,      'pcs',  0),
  ('DP-SPL-APTY', 'MC-SPL-APTY',                    0.05,   'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- SPECIAL NIB: Dosa Tawa 250mm Non-IB Special (2.4mm, 20pcs/MC)
  -- ────────────────────────────────────────────────────────────
  ('DP-SPL-NIB-TAWA-250', 'ALU-CIR-263-26',         0.3531, 'kg',   0),
  ('DP-SPL-NIB-TAWA-250', 'CTG-PRIMER-PPG2',        0.005,  'kg',   0),
  ('DP-SPL-NIB-TAWA-250', 'CTG-TOP-PPG2',           0.004,  'kg',   0),
  ('DP-SPL-NIB-TAWA-250', 'CTG-HTR-BLUE',           0.007,  'kg',   0),
  ('DP-SPL-NIB-TAWA-250', 'RVT-55X14',              2,      'pcs',  0),
  ('DP-SPL-NIB-TAWA-250', 'CVR-PP-11X12',           1,      'pcs',  0),
  ('DP-SPL-NIB-TAWA-250', 'HDL-BAKE-DOTTED',        1,      'pcs',  0),
  ('DP-SPL-NIB-TAWA-250', 'PKG-STICKER-DP',         1,      'pcs',  0),
  ('DP-SPL-NIB-TAWA-250', 'PKG-WCARD-DP',           1,      'pcs',  0),
  ('DP-SPL-NIB-TAWA-250', 'IC-SPL-NIB-TAWA-250',    1,      'pcs',  0),
  ('DP-SPL-NIB-TAWA-250', 'MC-SPL-NIB-TAWA-250',    0.05,   'pcs',  0),

  -- ────────────────────────────────────────────────────────────
  -- SPECIAL NIB: FryPan 240mm Non-IB Special (2.4mm @₹380, 20pcs/MC)
  -- ────────────────────────────────────────────────────────────
  ('DP-SPL-NIB-FPAN-240', 'ALU-CIR-272-24',         0.3777, 'kg',   0),
  ('DP-SPL-NIB-FPAN-240', 'CTG-PRIMER-PPG2',        0.005,  'kg',   0),
  ('DP-SPL-NIB-FPAN-240', 'CTG-TOP-PPG2',           0.004,  'kg',   0),
  ('DP-SPL-NIB-FPAN-240', 'CTG-HTR-BLUE',           0.0075, 'kg',   0),
  ('DP-SPL-NIB-FPAN-240', 'RVT-55X14',              2,      'pcs',  0),
  ('DP-SPL-NIB-FPAN-240', 'CVR-PP-11X12',           1,      'pcs',  0),
  ('DP-SPL-NIB-FPAN-240', 'HDL-BAKE-DOTTED',        1,      'pcs',  0),
  ('DP-SPL-NIB-FPAN-240', 'PKG-STICKER-DP',         1,      'pcs',  0),
  ('DP-SPL-NIB-FPAN-240', 'PKG-WCARD-DP',           1,      'pcs',  0),
  ('DP-SPL-NIB-FPAN-240', 'IC-SPL-NIB-FPAN-240',    1,      'pcs',  0),
  ('DP-SPL-NIB-FPAN-240', 'MC-SPL-NIB-FPAN-240',    0.05,   'pcs',  0)

) AS v(bom_sku, mat_sku, qty, unit, wastage)
JOIN bom_headers b  ON b.product_sku = v.bom_sku
JOIN materials   m  ON m.sku         = v.mat_sku;
