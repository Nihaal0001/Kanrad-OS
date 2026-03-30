-- ============================================================
-- Migration 00022 — Kanrad Houseware client schema
-- Run this in Supabase SQL Editor AFTER migrations 00001–00021
-- ============================================================

-- ─── 1. Rename order number prefix (JC → KH) ────────────────
-- Drop existing trigger and function, recreate with KH prefix

DROP TRIGGER IF EXISTS trg_order_number ON orders;
DROP TRIGGER IF EXISTS set_order_number ON orders;
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today     TEXT := TO_CHAR(NOW(), 'YYMMDD');
  seq       INT;
  new_num   TEXT;
BEGIN
  SELECT COUNT(*) + 1
    INTO seq
    FROM orders
   WHERE order_number LIKE 'KH-ORD-' || today || '-%';
  new_num := 'KH-ORD-' || today || '-' || LPAD(seq::TEXT, 3, '0');
  NEW.order_number := new_num;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_order_number();

-- ─── 2. Rename invoice number prefix ────────────────────────
DROP TRIGGER IF EXISTS trg_invoice_number ON invoices;
DROP TRIGGER IF EXISTS set_invoice_number ON invoices;
DROP FUNCTION IF EXISTS generate_invoice_number() CASCADE;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today   TEXT := TO_CHAR(NOW(), 'YYMMDD');
  seq     INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 4) AS INT)), 0) + 1
    INTO seq
    FROM invoices
   WHERE invoice_number LIKE 'KH-INV-' || today || '-%';
  NEW.invoice_number := 'KH-INV-' || today || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();

-- ─── 3. Rename purchase order prefix ────────────────────────
DROP TRIGGER IF EXISTS trg_po_number ON purchase_orders;
DROP TRIGGER IF EXISTS set_po_number ON purchase_orders;
DROP FUNCTION IF EXISTS generate_po_number() CASCADE;

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today   TEXT := TO_CHAR(NOW(), 'YYMMDD');
  seq     INT;
BEGIN
  SELECT COUNT(*) + 1
    INTO seq
    FROM purchase_orders
   WHERE po_number LIKE 'KH-PO-' || today || '-%';
  NEW.po_number := 'KH-PO-' || today || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL OR NEW.po_number = '')
  EXECUTE FUNCTION generate_po_number();

-- ─── 4. Add material_type to materials ───────────────────────
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS material_type TEXT NOT NULL DEFAULT 'raw'
    CHECK (material_type IN ('raw', 'consumable', 'packaging'));

-- ─── 5. Update production_stages for Kanrad houseware ────────
-- Add slug and color columns, replace garment stages with houseware stages
ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS slug TEXT;

-- Clear all existing stages (cascades to production_tracking)
TRUNCATE production_stages RESTART IDENTITY CASCADE;

INSERT INTO production_stages (name, description, sequence, color, slug) VALUES
  ('Raw Material Receipt', 'Receive and allocate raw materials to batch',          1, '#6366f1', 'raw_material_receipt'),
  ('Cutting / Pressing',   'Sheet metal or material cutting and pressing',         2, '#f59e0b', 'cutting_pressing'),
  ('Forming / Shaping',    'Deep drawing, forming, or injection moulding',        3, '#f97316', 'forming_shaping'),
  ('Assembly / Welding',   'Component assembly, spot/arc welding, riveting',      4, '#ef4444', 'assembly_welding'),
  ('Surface Treatment',    'Polishing, powder coating, anodising, plating',       5, '#8b5cf6', 'surface_treatment'),
  ('Quality Check',        'Final QC inspection — pass/fail gate before packing', 6, '#10b981', 'quality_check'),
  ('Packing',              'Retail/export packing, labelling, carton sealing',    7, '#3b82f6', 'packing')
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description,
      sequence = EXCLUDED.sequence,
      color = EXCLUDED.color,
      slug = EXCLUDED.slug;

-- ─── 6. Add batch_qty / output_qty to production_tracking ────
ALTER TABLE production_tracking
  ADD COLUMN IF NOT EXISTS batch_qty    INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_qty   INT DEFAULT 0;

-- ─── 7. BOM (Bill of Materials) tables ───────────────────────
CREATE TABLE IF NOT EXISTS bom_headers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_sku  TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category     TEXT,
  version      INT  NOT NULL DEFAULT 1,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  notes        TEXT,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_sku, version)
);

CREATE TABLE IF NOT EXISTS bom_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id        UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  material_id   UUID NOT NULL REFERENCES materials(id),
  qty_required  NUMERIC(12,4) NOT NULL,
  unit          TEXT NOT NULL DEFAULT 'kg',
  wastage_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add bom_id to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS bom_id UUID REFERENCES bom_headers(id);

-- ─── 8. Finished goods tables ────────────────────────────────
CREATE TABLE IF NOT EXISTS finished_goods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_sku     TEXT NOT NULL UNIQUE,
  product_name    TEXT NOT NULL,
  category        TEXT,
  qty_on_hand     NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit            TEXT NOT NULL DEFAULT 'pcs',
  reorder_level   NUMERIC(12,3) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finished_goods_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_sku  TEXT NOT NULL,
  txn_type     TEXT NOT NULL CHECK (txn_type IN ('in', 'out', 'adjust')),
  qty          NUMERIC(12,3) NOT NULL,
  ref_type     TEXT,  -- 'production_batch' | 'dispatch' | 'adjustment'
  ref_id       UUID,
  notes        TEXT,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 9. RLS policies ─────────────────────────────────────────
ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE finished_goods ENABLE ROW LEVEL SECURITY;
ALTER TABLE finished_goods_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_bom_headers"   ON bom_headers   FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_bom_items"     ON bom_items     FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_finished_goods" ON finished_goods FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_fg_txns"       ON finished_goods_transactions FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- ─── 10. Updated_at triggers ─────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_bom_headers_updated_at
  BEFORE UPDATE ON bom_headers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_finished_goods_updated_at
  BEFORE UPDATE ON finished_goods
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
