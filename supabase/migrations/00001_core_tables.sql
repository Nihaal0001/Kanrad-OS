-- ============================================
-- JUST CLOTHING ERP — Core Tables Migration
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'production_manager', 'inventory_manager', 'qc_head', 'floor_supervisor', 'worker')),
  department TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Buyers
CREATE TABLE buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  gst_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL,
  style_name TEXT NOT NULL,
  description TEXT,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  deadline DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_production', 'completed', 'dispatched', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Order Items (size/color breakdown)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Order Materials (bill of materials per order — used in Phase 3)
CREATE TABLE order_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  material_id UUID,
  quantity_required NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity_allocated NUMERIC(10,2) DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'meters',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Auto-generate order numbers
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
  new_order_number TEXT;
BEGIN
  today_str := to_char(now(), 'YYMMDD');

  SELECT COUNT(*) + 1 INTO seq_num
  FROM orders
  WHERE order_number LIKE 'JC-ORD-' || today_str || '-%';

  new_order_number := 'JC-ORD-' || today_str || '-' || lpad(seq_num::TEXT, 3, '0');

  NEW.order_number := new_order_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_order_number();

-- ============================================
-- Auto-update updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_buyers_updated_at
  BEFORE UPDATE ON buyers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Auto-calculate total_quantity from order_items
-- ============================================
CREATE OR REPLACE FUNCTION recalculate_order_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE orders SET total_quantity = (
      SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = OLD.order_id
    ) WHERE id = OLD.order_id;
    RETURN OLD;
  ELSE
    UPDATE orders SET total_quantity = (
      SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = NEW.order_id
    ) WHERE id = NEW.order_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalc_order_qty_insert
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_quantity();

CREATE TRIGGER recalc_order_qty_update
  AFTER UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_quantity();

CREATE TRIGGER recalc_order_qty_delete
  AFTER DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_quantity();

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_deadline ON orders(deadline);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_materials_order_id ON order_materials(order_id);

-- ============================================
-- Disable RLS for now (enabled in Phase 8)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_materials ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (no auth yet)
CREATE POLICY "Allow all access to profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to buyers" ON buyers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to order_materials" ON order_materials FOR ALL USING (true) WITH CHECK (true);
