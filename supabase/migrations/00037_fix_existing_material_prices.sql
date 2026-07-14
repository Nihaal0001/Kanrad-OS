-- Set cost_per_unit on materials that already existed in the DB
-- with their own SKU format (different from the DP-* materials inserted in 00035).
-- Prices sourced from Deepam BOM Excel files (June 2026).
-- NOTE: Rio IC series prices are unknown — those rows are left at 0 pending data.
-- NOTE: MC-TOTAL ("MC - Master Carton (All)") is a generic catch-all that
--       cannot have a single price; per-product MC costs are in the MC-* materials
--       from migration 00035. MC-TOTAL should be removed from any BOM and deleted.

UPDATE materials
SET cost_per_unit = v.cost
FROM (VALUES
  -- Inner Cartons
  ('IC-FTAWA250',        22.35),
  ('IC-FTAWA280',        24.35),
  ('IC-FTAWA300',        36.35),
  ('IC-FPAN240IB',       24.13),
  ('IC-FPAN260IB',       27.45),
  ('IC-KAD240IB',        36.53),
  ('IC-KAD260',          34.00),
  ('IC-KAD280',          39.36),
  ('IC-CASS215',         28.80),
  ('IC-CASS235',         32.67),
  ('IC-CASS255',         41.30),
  ('IC-3PCSET',          42.32),
  ('IC-ROUNDTAWA',       34.75),
  ('IC-SQTAWA',          36.00),
  ('IC-DEEPAPTY',        20.16),
  ('IC-BPOT9L',          43.50),
  ('IC-FTAWA250IBSPL',   20.70),
  ('IC-FPAN240IBSPL',    27.09),
  ('IC-APTYSPL',         14.90),
  ('IC-FTAWA250NIBSPL',  20.70),
  ('IC-FPAN240NIBSPL',   27.00),

  -- Handles
  ('HNDL-ROYAL-TAWA',   14.75),
  ('HNDL-VENUS-APTY',   10.85),
  ('HNDL-OLD-KADAI',    11.25),  -- same family as Dot Kadai handle
  ('HNDL-SIDE',         10.50),  -- Side Small rate; update if this is Side Big (₹13.90)

  -- Coatings / HTR Paints
  ('HTR-CLEAR-POWDER',  377.69),
  ('HTR-ANTIQUE-SILVER', 243.00),

  -- Knobs
  ('KNOB-MATT-SML',      4.50),

  -- Glass & SS Lids
  ('LID-APTY-SS',        30.00),
  ('LID-DEEP-APTY-SS',   35.00),
  ('LID-CSS215-GLS',     46.50),
  ('LID-CSS235-GLS',     55.00),
  ('LID-CSS255-GLS',     59.00),
  ('LID-FP240-GLS',      55.00),  -- Dia 237mm lid
  ('LID-FP260-GLS',      63.00),  -- Dia 260mm lid
  ('LID-KD260-GLS',      63.00),  -- Dia 260mm lid

  -- PP Covers
  ('PPCOVER-12X14',       1.25),
  ('PPCOVER-14X16',       1.85),

  -- Rivets
  ('RIVET-5X14',          0.5641),
  ('RIVET-5X14-FLAT',     0.5867),
  ('RIVET-5X16',          0.62),  -- not in BOM sheet; estimated similar to 5×14

  -- Screws & Washers
  ('SCREW-1IN-SS-WSHR',   0.45),  -- 1-inch SS washer, same as Steel Washer 5×15
  ('SCREW-PBIN',          0.90),  -- Bakelite/P'BIN screw, same as handle screw rate

  -- Packaging
  ('PLY-2PLY',            1.00)   -- 2-ply sheet (smaller size; update if 285mm used)

) AS v(sku, cost)
WHERE materials.sku = v.sku;

-- ── Items with no price data — need input from user ──────────────────────────
-- CLAMP-SAJJAN    (Sajjan Clamp)          — no rate in BOM files
-- HNDL-STEEL-RING (Steel Ring)            — no rate in BOM files
-- IC-RIO-APTY, IC-RIO-CTAWA250/280,       — Rio series IC prices not in Excel files
-- IC-RIO-FPAN240/260, IC-RIO-FTAWA250/280/300, IC-RIO-KAD240
-- MC-TOTAL        (Master Carton All)     — generic placeholder; should be removed
