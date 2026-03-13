-- ============================================================
-- Migration 00002: Inventory Tables
-- material_categories, materials, stock_transactions,
-- purchase_orders, purchase_order_items
-- ============================================================

-- ==================== MATERIAL CATEGORIES ====================
CREATE TABLE IF NOT EXISTS material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default categories
INSERT INTO material_categories (name, description) VALUES
  ('Fabric', 'All types of fabric — cotton, polyester, blends, etc.'),
  ('Trims', 'Buttons, zippers, buckles, hooks, snaps'),
  ('Accessories', 'Tags, hangers, polybags, tissue paper'),
  ('Thread', 'Sewing thread, embroidery thread, overlocking thread'),
  ('Labels', 'Main labels, size labels, care labels, price tags'),
  ('Packaging', 'Boxes, cartons, poly bags, tape, packing material')
ON CONFLICT (name) DO NOTHING;

-- ==================== MATERIALS ====================
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES material_categories(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'meters', -- meters, kg, pieces, rolls, cones, etc.
  current_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_stock_level NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier_name TEXT,
  supplier_contact TEXT,
  location TEXT, -- warehouse/rack location
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_sku ON materials(sku);
CREATE INDEX IF NOT EXISTS idx_materials_low_stock ON materials(current_stock, min_stock_level);

-- ==================== STOCK TRANSACTIONS (Append-only ledger) ====================
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase_in', 'production_out', 'adjustment', 'return')),
  quantity NUMERIC(12,2) NOT NULL, -- positive for in, negative for out
  reference_type TEXT, -- 'purchase_order', 'order', 'manual'
  reference_id UUID, -- FK to purchase_orders or orders
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_txn_material ON stock_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_txn_type ON stock_transactions(type);
CREATE INDEX IF NOT EXISTS idx_stock_txn_created ON stock_transactions(created_at);

-- ==================== PURCHASE ORDERS ====================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'received', 'cancelled')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

-- ==================== PURCHASE ORDER ITEMS ====================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity_ordered NUMERIC(12,2) NOT NULL,
  quantity_received NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_material ON purchase_order_items(material_id);

-- ==================== TRIGGERS ====================

-- Auto-update updated_at for materials
CREATE OR REPLACE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at for material_categories
CREATE OR REPLACE TRIGGER update_material_categories_updated_at
  BEFORE UPDATE ON material_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at for purchase_orders
CREATE OR REPLACE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-update materials.current_stock on stock transaction insert
CREATE OR REPLACE FUNCTION on_stock_transaction_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE materials
  SET current_stock = current_stock + NEW.quantity
  WHERE id = NEW.material_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER stock_transaction_update_stock
  AFTER INSERT ON stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION on_stock_transaction_insert();

-- Auto-generate PO number: JC-PO-YYMMDD-NNN
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part TEXT;
  seq_num INT;
  new_po_number TEXT;
BEGIN
  date_part := to_char(now(), 'YYMMDD');
  SELECT COUNT(*) + 1 INTO seq_num
  FROM purchase_orders
  WHERE po_number LIKE 'JC-PO-' || date_part || '-%';
  new_po_number := 'JC-PO-' || date_part || '-' || LPAD(seq_num::text, 3, '0');
  NEW.po_number := new_po_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_po_number();

-- Recalculate purchase order total_amount when items change
CREATE OR REPLACE FUNCTION recalculate_po_total()
RETURNS TRIGGER AS $$
DECLARE
  po_id UUID;
BEGIN
  po_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
  UPDATE purchase_orders
  SET total_amount = COALESCE(
    (SELECT SUM(quantity_ordered * unit_price) FROM purchase_order_items WHERE purchase_order_id = po_id),
    0
  )
  WHERE id = po_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER recalculate_po_total_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_po_total();

-- ==================== RLS (Permissive until Phase 8) ====================
ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on material_categories" ON material_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on materials" ON materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on stock_transactions" ON stock_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on purchase_orders" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on purchase_order_items" ON purchase_order_items FOR ALL USING (true) WITH CHECK (true);
