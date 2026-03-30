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
-- ============================================================
-- Migration 00003: Production + Quality Tables
-- production_stages, production_tracking, quality_checks
-- ============================================================

-- ==================== PRODUCTION STAGES (reference table) ====================
CREATE TABLE IF NOT EXISTS production_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sequence INT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the 7 stages
INSERT INTO production_stages (name, sequence, description) VALUES
  ('Fabric Sourcing',   1, 'Sourcing and receiving raw fabric materials'),
  ('Cutting',          2, 'Cutting fabric as per patterns and measurements'),
  ('Stitching',        3, 'Stitching cut pieces together'),
  ('Quality Check',    4, 'Inline quality inspection of stitched garments'),
  ('Finishing',        5, 'Ironing, trimming threads, and finishing touches'),
  ('Packing',          6, 'Packing garments with tags and labels'),
  ('Dispatch',         7, 'Final dispatch and shipping to buyer')
ON CONFLICT (sequence) DO NOTHING;

-- ==================== PRODUCTION TRACKING ====================
CREATE TABLE IF NOT EXISTS production_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES production_stages(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  quantity_completed INT NOT NULL DEFAULT 0,
  quantity_rejected INT NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (order_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_tracking_order ON production_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_prod_tracking_stage ON production_tracking(stage_id);
CREATE INDEX IF NOT EXISTS idx_prod_tracking_status ON production_tracking(status);

-- ==================== QUALITY CHECKS ====================
CREATE TABLE IF NOT EXISTS quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES production_stages(id) ON DELETE SET NULL,
  inspected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  quantity_inspected INT NOT NULL DEFAULT 0,
  quantity_passed INT NOT NULL DEFAULT 0,
  quantity_failed INT NOT NULL DEFAULT 0,
  defect_type TEXT, -- e.g. 'stitching', 'measurement', 'fabric', 'finishing'
  severity TEXT CHECK (severity IN ('minor', 'major', 'critical')),
  notes TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_order ON quality_checks(order_id);
CREATE INDEX IF NOT EXISTS idx_qc_stage ON quality_checks(stage_id);
CREATE INDEX IF NOT EXISTS idx_qc_checked_at ON quality_checks(checked_at);

-- ==================== TRIGGERS ====================

-- Auto-update updated_at for production_tracking
CREATE OR REPLACE TRIGGER update_production_tracking_updated_at
  BEFORE UPDATE ON production_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-create 7 production_tracking rows when order is confirmed
CREATE OR REPLACE FUNCTION on_order_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status changes TO 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    INSERT INTO production_tracking (order_id, stage_id, status)
    SELECT NEW.id, id, 'pending'
    FROM production_stages
    ORDER BY sequence
    ON CONFLICT (order_id, stage_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_on_order_confirmed
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION on_order_confirmed();

-- Auto-update order status when all production stages are completed
CREATE OR REPLACE FUNCTION on_production_stage_complete()
RETURNS TRIGGER AS $$
DECLARE
  total_stages INT;
  completed_stages INT;
BEGIN
  -- Only fire when status changes TO 'completed'
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT COUNT(*) INTO total_stages
    FROM production_tracking WHERE order_id = NEW.order_id;

    SELECT COUNT(*) INTO completed_stages
    FROM production_tracking WHERE order_id = NEW.order_id AND status = 'completed';

    IF total_stages > 0 AND total_stages = completed_stages THEN
      UPDATE orders SET status = 'completed' WHERE id = NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_on_production_stage_complete
  AFTER UPDATE ON production_tracking
  FOR EACH ROW
  EXECUTE FUNCTION on_production_stage_complete();

-- Set started_at when stage moves to in_progress, completed_at when completed
CREATE OR REPLACE FUNCTION set_production_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_production_timestamps
  BEFORE UPDATE ON production_tracking
  FOR EACH ROW
  EXECUTE FUNCTION set_production_timestamps();

-- ==================== RLS (Permissive until Phase 8) ====================
ALTER TABLE production_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on production_stages" ON production_stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on production_tracking" ON production_tracking FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quality_checks" ON quality_checks FOR ALL USING (true) WITH CHECK (true);
-- ============================================================
-- Migration 00004: Tasks + Notifications
-- ============================================================

-- ==================== TASKS ====================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES production_stages(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  due_date DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

-- ==================== NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'low_stock', 'deadline', 'stage_complete', 'qc_failure', 'task_assigned', 'order_confirmed'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reference_type TEXT, -- 'order', 'material', 'task', 'quality_check'
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ==================== TRIGGERS ====================

-- Auto-update updated_at for tasks
CREATE OR REPLACE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Notification on order confirmed
CREATE OR REPLACE FUNCTION notify_order_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    INSERT INTO notifications (type, title, message, reference_type, reference_id)
    VALUES (
      'order_confirmed',
      'Order Confirmed',
      'Order ' || NEW.order_number || ' (' || NEW.style_name || ') has been confirmed and moved to production.',
      'order',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_notify_order_confirmed
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_confirmed();

-- Notification on production stage completed
CREATE OR REPLACE FUNCTION notify_stage_complete()
RETURNS TRIGGER AS $$
DECLARE
  stage_name TEXT;
  order_number TEXT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT ps.name INTO stage_name FROM production_stages ps WHERE ps.id = NEW.stage_id;
    SELECT o.order_number INTO order_number FROM orders o WHERE o.id = NEW.order_id;

    INSERT INTO notifications (type, title, message, reference_type, reference_id)
    VALUES (
      'stage_complete',
      'Stage Completed',
      stage_name || ' stage completed for order ' || order_number || '.',
      'order',
      NEW.order_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_notify_stage_complete
  AFTER UPDATE ON production_tracking
  FOR EACH ROW
  EXECUTE FUNCTION notify_stage_complete();

-- Notification on QC failure (quantity_failed > 0)
CREATE OR REPLACE FUNCTION notify_qc_failure()
RETURNS TRIGGER AS $$
DECLARE
  order_number TEXT;
BEGIN
  IF NEW.quantity_failed > 0 AND NEW.severity IN ('major', 'critical') THEN
    SELECT o.order_number INTO order_number FROM orders o WHERE o.id = NEW.order_id;
    INSERT INTO notifications (type, title, message, reference_type, reference_id)
    VALUES (
      'qc_failure',
      'QC Failure Alert',
      order_number || ': ' || NEW.quantity_failed || ' pieces failed QC (' || COALESCE(NEW.severity, 'unknown') || ' severity).',
      'order',
      NEW.order_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_notify_qc_failure
  AFTER INSERT ON quality_checks
  FOR EACH ROW
  EXECUTE FUNCTION notify_qc_failure();

-- ==================== RLS (Permissive until Phase 8) ====================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
-- =============================================
-- JUST CLOTHING ERP — Finance Tables Migration
-- Phase 6: Invoices, Payments, Order Costing
-- =============================================

-- ===== Invoices =====
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL DEFAULT '',
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL,
  -- Buyer snapshot so invoice stays valid even if buyer is edited
  buyer_name TEXT NOT NULL,
  buyer_address TEXT,
  buyer_gst TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(subtotal * tax_rate / 100, 2)) STORED,
  total_amount NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(subtotal + subtotal * tax_rate / 100, 2)) STORED,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'cancelled')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate invoice number: INV-YYMMDD-NNN
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYMMDD');
  seq INT;
  new_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || today || '-%';
  new_number := 'INV-' || today || '-' || LPAD(seq::TEXT, 3, '0');
  NEW.invoice_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_number();

-- ===== Invoice Items =====
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sync invoice subtotal whenever items change
CREATE OR REPLACE FUNCTION update_invoice_subtotal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET
    subtotal = (
      SELECT COALESCE(SUM(quantity * unit_price), 0)
      FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_invoice_subtotal
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_subtotal();

-- ===== Payments =====
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('cash', 'bank_transfer', 'cheque', 'upi', 'other')),
  reference TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sync invoice amount_paid and status when payments are added/removed
CREATE OR REPLACE FUNCTION sync_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  inv_id UUID;
  total_paid NUMERIC(12,2);
  inv_total NUMERIC(12,2);
BEGIN
  inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM payments WHERE invoice_id = inv_id;

  SELECT total_amount INTO inv_total
  FROM invoices WHERE id = inv_id;

  UPDATE invoices SET
    amount_paid = total_paid,
    status = CASE
      WHEN total_paid >= inv_total AND inv_total > 0 THEN 'paid'
      WHEN total_paid > 0 THEN 'partially_paid'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = inv_id
    AND status NOT IN ('cancelled', 'draft');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_payment_status();

-- ===== Order Costings =====
CREATE TABLE order_costings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  material_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  overhead_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (
    material_cost + labor_cost + overhead_cost + other_cost
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at triggers
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_order_costings_updated_at
  BEFORE UPDATE ON order_costings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== RLS =====
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_costings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all invoice_items" ON invoice_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all order_costings" ON order_costings FOR ALL USING (true) WITH CHECK (true);
-- =============================================
-- JUST CLOTHING ERP — HR Tables Migration
-- Phase 7: Attendance, Leaves, Shifts, Payroll
-- =============================================

-- ===== Shifts =====
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Worker Shifts (assignment) =====
CREATE TABLE worker_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Attendance =====
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'half_day', 'leave')),
  check_in TIME,
  check_out TIME,
  overtime_hours NUMERIC(4,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(worker_id, date)
);

-- ===== Leaves =====
CREATE TABLE leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'casual' CHECK (leave_type IN ('sick', 'casual', 'earned', 'unpaid', 'other')),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days INTEGER GENERATED ALWAYS AS (to_date - from_date + 1) STORED,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Payroll =====
CREATE TABLE payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  working_days INTEGER NOT NULL DEFAULT 0,
  days_present INTEGER NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  daily_wage NUMERIC(10,2) NOT NULL DEFAULT 0,
  overtime_rate NUMERIC(10,2) NOT NULL DEFAULT 0,  -- per hour
  base_wage NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(daily_wage * days_present, 2)
  ) STORED,
  overtime_pay NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(overtime_rate * overtime_hours, 2)
  ) STORED,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_wage NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(daily_wage * days_present + overtime_rate * overtime_hours - deductions + bonus, 2)
  ) STORED,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'paid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(worker_id, period_start, period_end)
);

-- Updated_at triggers
CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_leaves_updated_at
  BEFORE UPDATE ON leaves
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payroll_updated_at
  BEFORE UPDATE ON payroll
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== RLS =====
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all shifts" ON shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all worker_shifts" ON worker_shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all leaves" ON leaves FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all payroll" ON payroll FOR ALL USING (true) WITH CHECK (true);
-- ============================================
-- JUST CLOTHING ERP — Phase 8: Auth + RLS
-- ============================================
-- Run this in your Supabase SQL Editor AFTER
-- enabling Email auth in Authentication → Providers.
-- Disable "Confirm email" in Auth → Settings for
-- an internal app (no email server needed).
-- ============================================

-- ============================================
-- 1. Link profiles to Supabase Auth users
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_id_idx ON profiles(auth_id) WHERE auth_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email) WHERE email IS NOT NULL;

-- ============================================
-- 2. Auto-create profile on new auth user signup
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
BEGIN
  -- Check if a profile already exists with this email (manually inserted workers, etc.)
  SELECT id INTO existing_id FROM public.profiles WHERE email = NEW.email LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- Link existing profile to the auth user
    UPDATE public.profiles SET auth_id = NEW.id WHERE id = existing_id;
  ELSE
    -- Create a new profile
    INSERT INTO public.profiles (auth_id, full_name, email, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'worker'  -- always start with minimum privilege; admin grants elevated roles manually
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================
-- 3. Update RLS: require authentication
--    Drop the old "allow all" policies and
--    replace with "authenticated users only"
-- ============================================

-- profiles
DROP POLICY IF EXISTS "Allow all access to profiles" ON profiles;
CREATE POLICY "Authenticated access to profiles" ON profiles FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- buyers
DROP POLICY IF EXISTS "Allow all access to buyers" ON buyers;
CREATE POLICY "Authenticated access to buyers" ON buyers FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- orders
DROP POLICY IF EXISTS "Allow all access to orders" ON orders;
CREATE POLICY "Authenticated access to orders" ON orders FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- order_items
DROP POLICY IF EXISTS "Allow all access to order_items" ON order_items;
CREATE POLICY "Authenticated access to order_items" ON order_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- order_materials
DROP POLICY IF EXISTS "Allow all access to order_materials" ON order_materials;
CREATE POLICY "Authenticated access to order_materials" ON order_materials FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- material_categories
DROP POLICY IF EXISTS "Allow all access to material_categories" ON material_categories;
CREATE POLICY "Authenticated access to material_categories" ON material_categories FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- materials
DROP POLICY IF EXISTS "Allow all access to materials" ON materials;
CREATE POLICY "Authenticated access to materials" ON materials FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stock_transactions
DROP POLICY IF EXISTS "Allow all access to stock_transactions" ON stock_transactions;
CREATE POLICY "Authenticated access to stock_transactions" ON stock_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- purchase_orders
DROP POLICY IF EXISTS "Allow all access to purchase_orders" ON purchase_orders;
CREATE POLICY "Authenticated access to purchase_orders" ON purchase_orders FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- purchase_order_items
DROP POLICY IF EXISTS "Allow all access to purchase_order_items" ON purchase_order_items;
CREATE POLICY "Authenticated access to purchase_order_items" ON purchase_order_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- production_stages
DROP POLICY IF EXISTS "Allow all access to production_stages" ON production_stages;
CREATE POLICY "Authenticated access to production_stages" ON production_stages FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- production_tracking
DROP POLICY IF EXISTS "Allow all access to production_tracking" ON production_tracking;
CREATE POLICY "Authenticated access to production_tracking" ON production_tracking FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- quality_checks
DROP POLICY IF EXISTS "Allow all access to quality_checks" ON quality_checks;
CREATE POLICY "Authenticated access to quality_checks" ON quality_checks FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tasks
DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;
CREATE POLICY "Authenticated access to tasks" ON tasks FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- notifications
DROP POLICY IF EXISTS "Allow all access to notifications" ON notifications;
CREATE POLICY "Authenticated access to notifications" ON notifications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- invoices
DROP POLICY IF EXISTS "Allow all access to invoices" ON invoices;
CREATE POLICY "Authenticated access to invoices" ON invoices FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- invoice_items
DROP POLICY IF EXISTS "Allow all access to invoice_items" ON invoice_items;
CREATE POLICY "Authenticated access to invoice_items" ON invoice_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payments
DROP POLICY IF EXISTS "Allow all access to payments" ON payments;
CREATE POLICY "Authenticated access to payments" ON payments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- order_costings
DROP POLICY IF EXISTS "Allow all access to order_costings" ON order_costings;
CREATE POLICY "Authenticated access to order_costings" ON order_costings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- shifts
DROP POLICY IF EXISTS "Allow all access to shifts" ON shifts;
CREATE POLICY "Authenticated access to shifts" ON shifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- worker_shifts
DROP POLICY IF EXISTS "Allow all access to worker_shifts" ON worker_shifts;
CREATE POLICY "Authenticated access to worker_shifts" ON worker_shifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- attendance
DROP POLICY IF EXISTS "Allow all access to attendance" ON attendance;
CREATE POLICY "Authenticated access to attendance" ON attendance FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- leaves
DROP POLICY IF EXISTS "Allow all access to leaves" ON leaves;
CREATE POLICY "Authenticated access to leaves" ON leaves FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payroll
DROP POLICY IF EXISTS "Allow all access to payroll" ON payroll;
CREATE POLICY "Authenticated access to payroll" ON payroll FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
-- ============================================
-- JUST CLOTHING ERP — Phase 8b: Role Permissions Table
-- ============================================
-- Moves role permissions from hardcoded constants
-- into the database so they can be edited via the UI.
-- Run this in the Supabase SQL Editor.
-- ============================================

CREATE TABLE IF NOT EXISTS role_permissions (
  role        TEXT NOT NULL CHECK (role IN ('admin', 'production_manager', 'inventory_manager', 'qc_head', 'floor_supervisor', 'worker')),
  permission  TEXT NOT NULL,
  PRIMARY KEY (role, permission)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to role_permissions" ON role_permissions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed with defaults (safe to re-run — ON CONFLICT DO NOTHING)
INSERT INTO role_permissions (role, permission) VALUES
  -- admin: everything
  ('admin', 'dashboard'), ('admin', 'orders'), ('admin', 'inventory'),
  ('admin', 'production'), ('admin', 'quality'), ('admin', 'tasks'),
  ('admin', 'finance'), ('admin', 'hr'), ('admin', 'notifications'),
  ('admin', 'settings'), ('admin', 'users'),

  -- production_manager
  ('production_manager', 'dashboard'), ('production_manager', 'orders'),
  ('production_manager', 'production'), ('production_manager', 'quality'),
  ('production_manager', 'tasks'), ('production_manager', 'hr'),
  ('production_manager', 'notifications'), ('production_manager', 'settings'),

  -- inventory_manager
  ('inventory_manager', 'dashboard'), ('inventory_manager', 'orders'),
  ('inventory_manager', 'inventory'), ('inventory_manager', 'tasks'),
  ('inventory_manager', 'finance'), ('inventory_manager', 'notifications'),
  ('inventory_manager', 'settings'),

  -- qc_head
  ('qc_head', 'dashboard'), ('qc_head', 'production'), ('qc_head', 'quality'),
  ('qc_head', 'tasks'), ('qc_head', 'notifications'), ('qc_head', 'settings'),

  -- floor_supervisor
  ('floor_supervisor', 'dashboard'), ('floor_supervisor', 'production'),
  ('floor_supervisor', 'quality'), ('floor_supervisor', 'tasks'),
  ('floor_supervisor', 'hr'), ('floor_supervisor', 'notifications'),
  ('floor_supervisor', 'settings'),

  -- worker
  ('worker', 'dashboard'), ('worker', 'tasks'), ('worker', 'notifications')

ON CONFLICT DO NOTHING;
-- App settings key-value store
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Seed default org row so getOrgSettings always has something
insert into app_settings (key, value)
values ('org', '{}'::jsonb)
on conflict (key) do nothing;

-- RLS
alter table app_settings enable row level security;

create policy "Authenticated users can read settings"
  on app_settings for select
  using (auth.uid() is not null);

create policy "Authenticated users can upsert settings"
  on app_settings for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update settings"
  on app_settings for update
  using (auth.uid() is not null);
-- ============================================
-- JUST CLOTHING ERP — QR Attendance System
-- Migration 00010
-- ============================================

-- ===== 1. QR Attendance Logs =====
CREATE TABLE IF NOT EXISTS qr_attendance_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  type          TEXT        NOT NULL CHECK (type IN ('IN', 'OUT')),
  status        TEXT        NOT NULL CHECK (status IN ('Verified', 'Flagged')),
  lat           NUMERIC(10, 6),
  long          NUMERIC(10, 6),
  flag_reason   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for per-employee today lookups (IN/OUT detection)
CREATE INDEX IF NOT EXISTS idx_qr_logs_employee_ts
  ON qr_attendance_logs (employee_id, timestamp DESC);

-- Index for cron anomaly queries
CREATE INDEX IF NOT EXISTS idx_qr_logs_timestamp
  ON qr_attendance_logs (timestamp);

-- ===== 2. RLS =====
ALTER TABLE qr_attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated insert QR logs"
  ON qr_attendance_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Employee reads own QR logs"
  ON qr_attendance_logs FOR SELECT
  USING (
    employee_id = (
      SELECT id FROM profiles WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "Admin reads all QR logs"
  ON qr_attendance_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'production_manager', 'floor_supervisor')
    )
  );

-- ===== 3. Seed office_location setting =====
INSERT INTO app_settings (key, value)
VALUES ('office_location', '{"lat": 0, "long": 0, "radius_m": 50}'::jsonb)
ON CONFLICT (key) DO NOTHING;
-- =============================================
-- JUST CLOTHING ERP — GST Compliance Migration
-- Adds HSN codes, Place of Supply, Reverse Charge,
-- CGST/SGST/IGST split, FY-sequential invoice numbers
-- =============================================

-- ===== Add GST-compliance columns to invoices =====
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS place_of_supply TEXT,
  ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_igst BOOLEAN NOT NULL DEFAULT false;

-- CGST / SGST / IGST as generated columns
-- Note: PostgreSQL generated columns cannot reference other generated columns,
-- so we re-derive from subtotal + tax_rate instead of tax_amount.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN NOT is_igst THEN ROUND(subtotal * tax_rate / 200, 2) ELSE 0 END
  ) STORED,
  ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN NOT is_igst THEN ROUND(subtotal * tax_rate / 200, 2) ELSE 0 END
  ) STORED,
  ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN is_igst THEN ROUND(subtotal * tax_rate / 100, 2) ELSE 0 END
  ) STORED;

-- ===== Add HSN code to invoice_items =====
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS hsn_code TEXT;

-- ===== Fix invoice numbering to be FY-sequential =====
-- Format: INV/25-26/0001 (sequential within April–March financial year)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  fy_start INT;
  fy_label TEXT;
  seq      INT;
  new_num  TEXT;
BEGIN
  -- Indian FY: April (month 4) starts new year
  IF EXTRACT(MONTH FROM NOW()) >= 4 THEN
    fy_start := EXTRACT(YEAR FROM NOW())::INT;
  ELSE
    fy_start := EXTRACT(YEAR FROM NOW())::INT - 1;
  END IF;
  fy_label := RIGHT(fy_start::TEXT, 2) || '-' || RIGHT((fy_start + 1)::TEXT, 2);

  SELECT COUNT(*) + 1 INTO seq
  FROM invoices
  WHERE invoice_number LIKE 'INV/' || fy_label || '/%';

  new_num := 'INV/' || fy_label || '/' || LPAD(seq::TEXT, 4, '0');
  NEW.invoice_number := new_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- ============================================================
-- Migration 00011: Purchase Order Approval
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (approval_status IN ('pending_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;
-- ============================================================
-- 00012_automation_triggers.sql
-- Low-stock notification trigger + Leave request notification trigger
-- ============================================================

-- 1. Low-stock alert: fires when current_stock drops below min_stock_level
CREATE OR REPLACE FUNCTION notify_low_stock() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock <= NEW.min_stock_level
     AND NEW.min_stock_level > 0
     AND (OLD.current_stock > OLD.min_stock_level OR OLD.current_stock IS DISTINCT FROM NEW.current_stock)
  THEN
    -- Throttle: only one notification per material per 24 hours
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE type = 'low_stock' AND reference_id = NEW.id::text
        AND created_at > now() - interval '24 hours'
    ) THEN
      INSERT INTO notifications (type, title, message, reference_type, reference_id)
      VALUES (
        'low_stock',
        'Low Stock Alert',
        NEW.name || ' is low (' || NEW.current_stock || ' ' || NEW.unit || ', min: ' || NEW.min_stock_level || ')',
        'material',
        NEW.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_low_stock ON materials;
CREATE TRIGGER trigger_notify_low_stock
  AFTER UPDATE OF current_stock ON materials
  FOR EACH ROW
  EXECUTE FUNCTION notify_low_stock();


-- 2. Leave request notification: fires when a new leave request is created
CREATE OR REPLACE FUNCTION notify_leave_request() RETURNS TRIGGER AS $$
DECLARE
  worker_name TEXT;
BEGIN
  SELECT full_name INTO worker_name FROM profiles WHERE id = NEW.worker_id;

  INSERT INTO notifications (type, title, message, reference_type, reference_id)
  VALUES (
    'leave_request',
    'New Leave Request',
    COALESCE(worker_name, 'A worker') || ' requested ' || NEW.leave_type || ' leave ('
      || NEW.from_date || ' to ' || NEW.to_date || ')',
    'leave',
    NEW.id::text
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_leave_request ON leaves;
CREATE TRIGGER trigger_notify_leave_request
  AFTER INSERT ON leaves
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_request();


-- 3. Add 'overdue' to invoice status constraint (cron job sets this)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'));
-- =============================================
-- JUST CLOTHING ERP — Finance Upgrade Migration
-- Expense Tracking, Purchase Invoices, Purchase Payments
-- =============================================

-- ===== Expense Categories =====
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default categories
INSERT INTO expense_categories (name, is_default) VALUES
  ('Rent', true),
  ('Electricity', true),
  ('Wages/Salary', true),
  ('Transport/Freight', true),
  ('Packaging', true),
  ('Maintenance', true),
  ('Food/Tea', true),
  ('Miscellaneous', true);


-- ===== Expenses =====
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ===== Purchase Invoices =====
CREATE TABLE purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  supplier_gst TEXT,
  invoice_number TEXT,  -- supplier's own invoice number (NOT auto-generated)
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(subtotal * tax_rate / 100, 2)
  ) STORED,
  total_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(subtotal + subtotal * tax_rate / 100, 2)
  ) STORED,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'received', 'paid', 'partially_paid', 'overdue', 'cancelled')),
  place_of_supply TEXT,
  is_igst BOOLEAN NOT NULL DEFAULT false,
  cgst_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN NOT is_igst THEN ROUND(subtotal * tax_rate / 200, 2) ELSE 0 END
  ) STORED,
  sgst_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN NOT is_igst THEN ROUND(subtotal * tax_rate / 200, 2) ELSE 0 END
  ) STORED,
  igst_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN is_igst THEN ROUND(subtotal * tax_rate / 100, 2) ELSE 0 END
  ) STORED,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_purchase_invoices_updated_at
  BEFORE UPDATE ON purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ===== Purchase Invoice Items =====
CREATE TABLE purchase_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  hsn_code TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(quantity * unit_price, 2)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sync purchase invoice subtotal from items (mirrors update_invoice_subtotal)
CREATE OR REPLACE FUNCTION update_purchase_invoice_subtotal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_invoices
  SET subtotal = (
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    FROM purchase_invoice_items
    WHERE purchase_invoice_id = COALESCE(NEW.purchase_invoice_id, OLD.purchase_invoice_id)
  ), updated_at = NOW()
  WHERE id = COALESCE(NEW.purchase_invoice_id, OLD.purchase_invoice_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_purchase_invoice_subtotal
  AFTER INSERT OR UPDATE OR DELETE ON purchase_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_invoice_subtotal();


-- ===== Purchase Payments =====
CREATE TABLE purchase_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'bank_transfer'
    CHECK (method IN ('cash', 'bank_transfer', 'cheque', 'upi', 'other')),
  reference TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sync purchase invoice payment status (mirrors sync_invoice_payment_status)
CREATE OR REPLACE FUNCTION sync_purchase_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  inv_id UUID;
  total_paid NUMERIC(12,2);
  inv_total NUMERIC(12,2);
BEGIN
  inv_id := COALESCE(NEW.purchase_invoice_id, OLD.purchase_invoice_id);

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM purchase_payments WHERE purchase_invoice_id = inv_id;

  SELECT total_amount INTO inv_total
  FROM purchase_invoices WHERE id = inv_id;

  UPDATE purchase_invoices SET
    amount_paid = total_paid,
    status = CASE
      WHEN total_paid >= inv_total AND inv_total > 0 THEN 'paid'
      WHEN total_paid > 0 THEN 'partially_paid'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = inv_id
    AND status NOT IN ('cancelled', 'draft');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_purchase_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON purchase_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_purchase_invoice_payment_status();


-- ===== RLS =====
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all expense_categories" ON expense_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all purchase_invoices" ON purchase_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all purchase_invoice_items" ON purchase_invoice_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all purchase_payments" ON purchase_payments FOR ALL USING (true) WITH CHECK (true);
-- =============================================
-- JUST CLOTHING ERP — Phase 1: Trust & Compliance
-- Audit Trail, HSN/SAC Codes, Journal & Ledger
-- =============================================

-- ===== 1. Audit Trail =====

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,        -- 'order', 'invoice', 'payment', 'material', etc.
  entity_id UUID,                   -- ID of the record that changed
  entity_label TEXT,                -- Human-readable label (e.g. order_number, invoice_number)
  action TEXT NOT NULL              -- 'created', 'updated', 'deleted', 'status_changed'
    CHECK (action IN ('created', 'updated', 'deleted', 'status_changed', 'approved', 'rejected')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name TEXT,             -- Snapshot of user name at time of action
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by entity and date
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_changed_by ON audit_logs(changed_by);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);


-- ===== 2. HSN/SAC Codes =====

-- HSN master table for quick lookup / autocomplete
CREATE TABLE hsn_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  gst_rate NUMERIC(5,2) DEFAULT 0,  -- applicable GST % for reference
  category TEXT,                    -- 'HSN' or 'SAC'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed common HSN codes for garment manufacturing
INSERT INTO hsn_master (code, description, gst_rate, category) VALUES
  ('6201', 'Men''s overcoats, raincoats, cloaks and similar articles', 12, 'HSN'),
  ('6202', 'Women''s overcoats, raincoats, cloaks and similar articles', 12, 'HSN'),
  ('6203', 'Men''s or boys'' suits, ensembles, jackets, trousers', 12, 'HSN'),
  ('6204', 'Women''s or girls'' suits, ensembles, jackets, skirts', 12, 'HSN'),
  ('6205', 'Men''s or boys'' shirts', 12, 'HSN'),
  ('6206', 'Women''s or girls'' blouses and shirts', 12, 'HSN'),
  ('6207', 'Men''s or boys'' singlets, underpants, nightwear', 12, 'HSN'),
  ('6208', 'Women''s or girls'' singlets, slips, nightwear', 12, 'HSN'),
  ('6209', 'Babies'' garments and clothing accessories', 5, 'HSN'),
  ('6210', 'Garments of felt or nonwovens', 12, 'HSN'),
  ('6211', 'Track suits, ski suits, swimwear', 12, 'HSN'),
  ('6212', 'Brassieres, girdles, corsets, suspenders', 12, 'HSN'),
  ('6213', 'Handkerchiefs', 12, 'HSN'),
  ('6214', 'Shawls, scarves, mufflers, veils', 12, 'HSN'),
  ('6215', 'Ties, bow ties and cravats', 12, 'HSN'),
  ('6216', 'Gloves, mittens and mitts', 12, 'HSN'),
  ('6217', 'Other made-up clothing accessories', 12, 'HSN'),
  ('5208', 'Woven fabrics of cotton, < 85% by weight', 5, 'HSN'),
  ('5209', 'Woven fabrics of cotton, >= 85% by weight', 5, 'HSN'),
  ('5210', 'Woven fabrics of cotton, < 85% mixed with man-made fibres', 5, 'HSN'),
  ('5211', 'Woven fabrics of cotton, >= 85% mixed with other fibres', 5, 'HSN'),
  ('5407', 'Woven fabrics of synthetic filament yarn', 12, 'HSN'),
  ('5408', 'Woven fabrics of artificial filament yarn', 12, 'HSN'),
  ('5512', 'Woven fabrics of synthetic staple fibres', 12, 'HSN'),
  ('5608', 'Knotted netting, nets and netting fabrics', 12, 'HSN'),
  ('9988', 'Manufacturing services on physical inputs owned by others', 5, 'SAC'),
  ('9997', 'Other personal services', 18, 'SAC');

-- Add hsn_code to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS hsn_code TEXT;

-- Add hsn_code to materials
ALTER TABLE materials ADD COLUMN IF NOT EXISTS hsn_code TEXT;


-- ===== 3. Chart of Accounts =====

CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'cogs', 'expense')),
  is_header BOOLEAN NOT NULL DEFAULT false,  -- header accounts are for grouping only, no direct entries
  parent_code TEXT REFERENCES chart_of_accounts(account_code) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed standard chart of accounts for garment manufacturing
INSERT INTO chart_of_accounts (account_code, name, type, is_header, parent_code) VALUES
  -- Assets
  ('1000', 'Assets', 'asset', true, NULL),
  ('1100', 'Cash & Bank', 'asset', false, '1000'),
  ('1200', 'Accounts Receivable', 'asset', false, '1000'),
  ('1300', 'Inventory & Stock', 'asset', false, '1000'),
  ('1400', 'GST Input Credit', 'asset', false, '1000'),
  -- Liabilities
  ('2000', 'Liabilities', 'liability', true, NULL),
  ('2100', 'Accounts Payable', 'liability', false, '2000'),
  ('2200', 'GST Payable (Output)', 'liability', false, '2000'),
  ('2300', 'Salary & Wages Payable', 'liability', false, '2000'),
  -- Equity
  ('3000', 'Equity', 'equity', true, NULL),
  ('3100', 'Owner''s Capital', 'equity', false, '3000'),
  ('3200', 'Retained Earnings', 'equity', false, '3000'),
  -- Revenue
  ('4000', 'Revenue', 'revenue', true, NULL),
  ('4100', 'Sales Revenue', 'revenue', false, '4000'),
  -- Cost of Goods Sold
  ('5000', 'Cost of Goods Sold', 'cogs', true, NULL),
  ('5100', 'Material Cost (COGS)', 'cogs', false, '5000'),
  ('5200', 'Labour Cost (COGS)', 'cogs', false, '5000'),
  ('5300', 'Overhead Cost (COGS)', 'cogs', false, '5000'),
  -- Expenses
  ('6000', 'Operating Expenses', 'expense', true, NULL),
  ('6100', 'Rent', 'expense', false, '6000'),
  ('6200', 'Electricity', 'expense', false, '6000'),
  ('6300', 'Wages & Salary', 'expense', false, '6000'),
  ('6400', 'Transport & Freight', 'expense', false, '6000'),
  ('6500', 'Packaging Expenses', 'expense', false, '6000'),
  ('6600', 'Maintenance', 'expense', false, '6000'),
  ('6700', 'Food & Tea', 'expense', false, '6000'),
  ('6800', 'Purchase Invoice Expense', 'expense', false, '6000'),
  ('6900', 'Miscellaneous Expenses', 'expense', false, '6000');

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all chart_of_accounts" ON chart_of_accounts FOR ALL USING (true) WITH CHECK (true);


-- ===== 4. Journal Entries (Double-Entry) =====

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  reference_type TEXT,   -- 'invoice', 'payment', 'expense', 'purchase_invoice', 'purchase_payment', 'manual'
  reference_id UUID,     -- ID of the source record
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date DESC);
CREATE INDEX idx_journal_entries_ref ON journal_entries(reference_type, reference_id);

CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL REFERENCES chart_of_accounts(account_code),
  description TEXT,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (debit > 0 OR credit > 0),   -- at least one must be non-zero
  CHECK (NOT (debit > 0 AND credit > 0))  -- debit and credit mutually exclusive per line
);

CREATE INDEX idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_entry_lines(account_code);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all journal_entries" ON journal_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all journal_entry_lines" ON journal_entry_lines FOR ALL USING (true) WITH CHECK (true);


-- ===== 5. Trigger: Auto-create journal entry on invoice status change to 'sent' or 'paid' =====

CREATE OR REPLACE FUNCTION create_journal_entry_for_invoice()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
BEGIN
  -- Only trigger when status moves to 'sent' (first recognition of sale)
  IF (NEW.status IN ('sent', 'paid') AND (OLD.status = 'draft' OR OLD IS NULL)) THEN
    -- Insert journal entry header
    INSERT INTO journal_entries (entry_date, description, reference_type, reference_id)
    VALUES (
      COALESCE(NEW.issue_date::DATE, CURRENT_DATE),
      'Sales Invoice ' || NEW.invoice_number || ' — ' || NEW.buyer_name,
      'invoice',
      NEW.id
    )
    RETURNING id INTO je_id;

    -- DR Accounts Receivable (1200) = total_amount
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
    VALUES (je_id, '1200', 'Accounts Receivable — ' || NEW.buyer_name, NEW.total_amount, 0);

    -- CR Sales Revenue (4100) = subtotal
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
    VALUES (je_id, '4100', 'Sales Revenue — ' || NEW.invoice_number, 0, NEW.subtotal);

    -- CR GST Payable (2200) = tax_amount (if any)
    IF NEW.tax_amount > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
      VALUES (je_id, '2200', 'GST Output — ' || NEW.invoice_number, 0, NEW.tax_amount);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_on_invoice_sent
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_journal_entry_for_invoice();


-- ===== 6. Trigger: Auto-create journal entry on payment received =====

CREATE OR REPLACE FUNCTION create_journal_entry_for_payment()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  inv_number TEXT;
  inv_buyer TEXT;
BEGIN
  SELECT invoice_number, buyer_name INTO inv_number, inv_buyer
  FROM invoices WHERE id = NEW.invoice_id;

  INSERT INTO journal_entries (entry_date, description, reference_type, reference_id)
  VALUES (
    NEW.payment_date::DATE,
    'Payment received — ' || inv_number || ' from ' || inv_buyer,
    'payment',
    NEW.id
  )
  RETURNING id INTO je_id;

  -- DR Cash & Bank (1100) = amount received
  INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
  VALUES (je_id, '1100', 'Cash received — ' || inv_number, NEW.amount, 0);

  -- CR Accounts Receivable (1200) = amount received
  INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
  VALUES (je_id, '1200', 'Receivable cleared — ' || inv_number, 0, NEW.amount);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_on_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION create_journal_entry_for_payment();


-- ===== 7. Trigger: Auto-create journal entry on expense =====

-- Map expense category name to COA account code
CREATE OR REPLACE FUNCTION get_expense_account_code(cat_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN cat_name ILIKE '%rent%'         THEN '6100'
    WHEN cat_name ILIKE '%electricity%'  THEN '6200'
    WHEN cat_name ILIKE '%wage%'
      OR cat_name ILIKE '%salary%'       THEN '6300'
    WHEN cat_name ILIKE '%transport%'
      OR cat_name ILIKE '%freight%'      THEN '6400'
    WHEN cat_name ILIKE '%packaging%'    THEN '6500'
    WHEN cat_name ILIKE '%maintenance%'  THEN '6600'
    WHEN cat_name ILIKE '%food%'
      OR cat_name ILIKE '%tea%'          THEN '6700'
    ELSE '6900'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION create_journal_entry_for_expense()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  cat_name TEXT;
  acc_code TEXT;
BEGIN
  SELECT name INTO cat_name FROM expense_categories WHERE id = NEW.category_id;
  acc_code := get_expense_account_code(cat_name);

  INSERT INTO journal_entries (entry_date, description, reference_type, reference_id)
  VALUES (
    NEW.expense_date::DATE,
    'Expense — ' || COALESCE(cat_name, 'Misc') || COALESCE(': ' || NEW.description, ''),
    'expense',
    NEW.id
  )
  RETURNING id INTO je_id;

  -- DR Expense account
  INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
  VALUES (je_id, acc_code, COALESCE(cat_name, 'Expense') || ' — ' || COALESCE(NEW.description, ''), NEW.amount, 0);

  -- CR Cash & Bank (1100)
  INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
  VALUES (je_id, '1100', 'Cash paid — ' || COALESCE(cat_name, 'Expense'), 0, NEW.amount);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_on_expense
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION create_journal_entry_for_expense();


-- ===== 8. Trigger: Auto-create journal entry on purchase invoice received =====

CREATE OR REPLACE FUNCTION create_journal_entry_for_purchase_invoice()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
BEGIN
  IF (NEW.status = 'received' AND OLD.status = 'draft') THEN
    INSERT INTO journal_entries (entry_date, description, reference_type, reference_id)
    VALUES (
      COALESCE(NEW.invoice_date::DATE, CURRENT_DATE),
      'Purchase Invoice ' || COALESCE(NEW.invoice_number, NEW.id::TEXT) || ' — ' || NEW.supplier_name,
      'purchase_invoice',
      NEW.id
    )
    RETURNING id INTO je_id;

    -- DR Purchase Expense (6800) = subtotal
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
    VALUES (je_id, '6800', 'Purchase — ' || NEW.supplier_name, NEW.subtotal, 0);

    -- DR GST Input Credit (1400) = tax_amount (if any)
    IF NEW.tax_amount > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
      VALUES (je_id, '1400', 'GST Input Credit — ' || NEW.supplier_name, NEW.tax_amount, 0);
    END IF;

    -- CR Accounts Payable (2100) = total_amount
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
    VALUES (je_id, '2100', 'Payable — ' || NEW.supplier_name, 0, NEW.total_amount);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_on_purchase_invoice
  AFTER UPDATE ON purchase_invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_journal_entry_for_purchase_invoice();


-- ===== 9. Trigger: Auto-create journal entry on purchase payment =====

CREATE OR REPLACE FUNCTION create_journal_entry_for_purchase_payment()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  pi_number TEXT;
  pi_supplier TEXT;
BEGIN
  SELECT invoice_number, supplier_name INTO pi_number, pi_supplier
  FROM purchase_invoices WHERE id = NEW.purchase_invoice_id;

  INSERT INTO journal_entries (entry_date, description, reference_type, reference_id)
  VALUES (
    NEW.payment_date::DATE,
    'Payment to ' || pi_supplier || COALESCE(' — ' || pi_number, ''),
    'purchase_payment',
    NEW.id
  )
  RETURNING id INTO je_id;

  -- DR Accounts Payable (2100) = amount paid
  INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
  VALUES (je_id, '2100', 'Payable cleared — ' || pi_supplier, NEW.amount, 0);

  -- CR Cash & Bank (1100) = amount paid
  INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
  VALUES (je_id, '1100', 'Cash paid — ' || pi_supplier, 0, NEW.amount);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_on_purchase_payment
  AFTER INSERT ON purchase_payments
  FOR EACH ROW
  EXECUTE FUNCTION create_journal_entry_for_purchase_payment();
-- =============================================
-- JUST CLOTHING ERP — Phases 2 & 3
-- Customers, Suppliers, Dispatch Details, Wastage
-- =============================================

-- ===== Phase 2: Customers (extended buyers for sales contacts) =====

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  gstin TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_ifsc TEXT,
  credit_limit NUMERIC(12,2),
  payment_terms INT DEFAULT 30,   -- net payment days
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all customers" ON customers FOR ALL USING (true) WITH CHECK (true);


-- ===== Phase 2: Suppliers (for purchase contacts) =====

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  gstin TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_ifsc TEXT,
  payment_terms INT DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);

-- Link customers to orders (optional — sits alongside buyer_id)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Link suppliers to purchase_orders (optional — alongside supplier_name text field)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;


-- ===== Phase 2: Dispatch details on orders =====

ALTER TABLE orders ADD COLUMN IF NOT EXISTS transporter_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lr_number TEXT;      -- Lorry Receipt number
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;


-- ===== Phase 3: Wastage / Scrap tracking on production_tracking =====

-- quantity_input: how many pieces entered this stage (before processing)
ALTER TABLE production_tracking ADD COLUMN IF NOT EXISTS quantity_input INT NOT NULL DEFAULT 0;
-- waste_notes: remarks about waste/scrap (machine issues, material defects, etc.)
ALTER TABLE production_tracking ADD COLUMN IF NOT EXISTS waste_notes TEXT;
-- ============================================================
-- Phase 5-6: Credit Notes + Bank Reconciliation
-- ============================================================

-- Credit Notes
CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  buyer_name TEXT NOT NULL,
  buyer_gst TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-number credit notes: CN-YYMMDD-NNN
CREATE OR REPLACE FUNCTION generate_credit_note_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today_prefix TEXT := 'CN-' || TO_CHAR(NOW(), 'YYMMDD') || '-';
  seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM credit_notes
  WHERE credit_note_number LIKE today_prefix || '%';
  NEW.credit_note_number := today_prefix || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_credit_note_number ON credit_notes;
CREATE TRIGGER set_credit_note_number
  BEFORE INSERT ON credit_notes
  FOR EACH ROW
  WHEN (NEW.credit_note_number IS NULL OR NEW.credit_note_number = '')
  EXECUTE FUNCTION generate_credit_note_number();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_credit_note_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_credit_note_updated_at ON credit_notes;
CREATE TRIGGER trg_credit_note_updated_at
  BEFORE UPDATE ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION update_credit_note_updated_at();

-- RLS
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_credit_notes" ON credit_notes;
CREATE POLICY "auth_credit_notes" ON credit_notes
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_credit_note_items" ON credit_note_items;
CREATE POLICY "auth_credit_note_items" ON credit_note_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_order_id ON credit_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_items_cn_id ON credit_note_items(credit_note_id);

-- Bank reconciliation import log (optional — for storing imported statements)
CREATE TABLE IF NOT EXISTS bank_statement_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_date DATE NOT NULL DEFAULT CURRENT_DATE,
  txn_date DATE NOT NULL,
  description TEXT,
  debit NUMERIC(12,2),
  credit NUMERIC(12,2),
  balance NUMERIC(12,2),
  matched_payment_id UUID,
  is_matched BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bank_statement_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_bank_rows" ON bank_statement_rows;
CREATE POLICY "auth_bank_rows" ON bank_statement_rows
  FOR ALL USING (auth.uid() IS NOT NULL);
-- AI-assisted finance document import

ALTER TABLE purchase_invoices
ADD COLUMN IF NOT EXISTS document_path TEXT,
ADD COLUMN IF NOT EXISTS document_url TEXT;

CREATE TABLE IF NOT EXISTS finance_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_hint TEXT CHECK (target_hint IN ('purchase_invoice', 'expense')) NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'partially_submitted', 'submitted', 'failed')),
  item_count INTEGER NOT NULL DEFAULT 0,
  submitted_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES finance_import_batches(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('purchase_invoice', 'expense')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'failed', 'submitted')),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_url TEXT,
  extraction_confidence NUMERIC(5,2),
  extraction_warnings TEXT[] NOT NULL DEFAULT '{}',
  extraction_error TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_record_type TEXT CHECK (created_record_type IN ('purchase_invoice', 'expense')) NULL,
  created_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_finance_import_batches_updated_at
  BEFORE UPDATE ON finance_import_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_finance_import_items_updated_at
  BEFORE UPDATE ON finance_import_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_finance_import_items_batch_id
  ON finance_import_items(batch_id);

CREATE INDEX IF NOT EXISTS idx_finance_import_items_status
  ON finance_import_items(status);

ALTER TABLE finance_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_import_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all finance_import_batches" ON finance_import_batches;
CREATE POLICY "allow all finance_import_batches"
  ON finance_import_batches FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow all finance_import_items" ON finance_import_items;
CREATE POLICY "allow all finance_import_items"
  ON finance_import_items FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('finance-documents', 'finance-documents', true)
ON CONFLICT (id) DO NOTHING;
-- Move style naming to order line items while keeping order-level style summary for compatibility.

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS style_name TEXT;

UPDATE order_items oi
SET style_name = o.style_name
FROM orders o
WHERE oi.order_id = o.id
  AND (oi.style_name IS NULL OR btrim(oi.style_name) = '');

ALTER TABLE order_items
ALTER COLUMN style_name SET NOT NULL;

CREATE OR REPLACE FUNCTION recalculate_order_quantity()
RETURNS TRIGGER AS $$
DECLARE
  target_order_id UUID;
BEGIN
  target_order_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END;

  UPDATE orders
  SET
    total_quantity = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM order_items
      WHERE order_id = target_order_id
    ),
    style_name = COALESCE((
      SELECT string_agg(style_name, ', ' ORDER BY style_name)
      FROM (
        SELECT DISTINCT btrim(style_name) AS style_name
        FROM order_items
        WHERE order_id = target_order_id
          AND btrim(style_name) <> ''
      ) styles
    ), '')
  WHERE id = target_order_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Backfill customers from legacy buyers and attach existing orders to customers.

INSERT INTO customers (
  name,
  company,
  email,
  phone,
  address,
  gstin,
  notes
)
SELECT
  b.name,
  b.company,
  b.email,
  b.phone,
  b.address,
  b.gst_number,
  b.notes
FROM buyers b
WHERE NOT EXISTS (
  SELECT 1
  FROM customers c
  WHERE lower(btrim(c.name)) = lower(btrim(b.name))
    AND lower(btrim(COALESCE(c.company, ''))) = lower(btrim(COALESCE(b.company, '')))
    AND lower(btrim(COALESCE(c.email, ''))) = lower(btrim(COALESCE(b.email, '')))
);

UPDATE orders o
SET customer_id = c.id
FROM buyers b
JOIN customers c
  ON lower(btrim(c.name)) = lower(btrim(b.name))
 AND lower(btrim(COALESCE(c.company, ''))) = lower(btrim(COALESCE(b.company, '')))
 AND lower(btrim(COALESCE(c.email, ''))) = lower(btrim(COALESCE(b.email, '')))
WHERE o.buyer_id = b.id
  AND o.customer_id IS NULL;
-- Migrate finance documents from legacy buyer snapshots to customer snapshots.

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_address TEXT,
ADD COLUMN IF NOT EXISTS customer_gst TEXT;

UPDATE invoices i
SET
  customer_id = COALESCE(
    i.customer_id,
    o.customer_id,
    (
      SELECT c.id
      FROM buyers b
      JOIN customers c ON c.name = b.name
      WHERE b.id = i.buyer_id
      LIMIT 1
    )
  ),
  customer_name = COALESCE(NULLIF(i.customer_name, ''), NULLIF(i.buyer_name, '')),
  customer_address = COALESCE(NULLIF(i.customer_address, ''), NULLIF(i.buyer_address, '')),
  customer_gst = COALESCE(NULLIF(i.customer_gst, ''), NULLIF(i.buyer_gst, ''))
FROM orders o
WHERE i.order_id = o.id;

UPDATE invoices i
SET customer_id = COALESCE(
  i.customer_id,
  (
    SELECT c.id
    FROM buyers b
    JOIN customers c ON c.name = b.name
    WHERE b.id = i.buyer_id
    LIMIT 1
  )
)
WHERE i.customer_id IS NULL
  AND i.buyer_id IS NOT NULL;

UPDATE invoices
SET
  customer_name = COALESCE(NULLIF(customer_name, ''), NULLIF(buyer_name, '')),
  customer_address = COALESCE(NULLIF(customer_address, ''), NULLIF(buyer_address, '')),
  customer_gst = COALESCE(NULLIF(customer_gst, ''), NULLIF(buyer_gst, ''))
WHERE customer_name IS NULL
   OR customer_address IS NULL
   OR customer_gst IS NULL;

ALTER TABLE invoices
ALTER COLUMN customer_name SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);

ALTER TABLE credit_notes
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_gst TEXT;

UPDATE credit_notes cn
SET
  customer_id = COALESCE(cn.customer_id, inv.customer_id, o.customer_id),
  customer_name = COALESCE(NULLIF(cn.customer_name, ''), NULLIF(cn.buyer_name, ''), inv.customer_name),
  customer_gst = COALESCE(NULLIF(cn.customer_gst, ''), NULLIF(cn.buyer_gst, ''), inv.customer_gst)
FROM invoices inv
LEFT JOIN orders o ON o.id = inv.order_id
WHERE cn.invoice_id = inv.id;

UPDATE credit_notes cn
SET
  customer_id = COALESCE(cn.customer_id, o.customer_id),
  customer_name = COALESCE(NULLIF(cn.customer_name, ''), NULLIF(cn.buyer_name, '')),
  customer_gst = COALESCE(NULLIF(cn.customer_gst, ''), NULLIF(cn.buyer_gst, ''))
FROM orders o
WHERE cn.order_id = o.id;

UPDATE credit_notes
SET
  customer_name = COALESCE(NULLIF(customer_name, ''), NULLIF(buyer_name, '')),
  customer_gst = COALESCE(NULLIF(customer_gst, ''), NULLIF(buyer_gst, ''))
WHERE customer_name IS NULL
   OR customer_gst IS NULL;

ALTER TABLE credit_notes
ALTER COLUMN customer_name SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id ON credit_notes(customer_id);

CREATE OR REPLACE FUNCTION create_journal_entry_for_invoice()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  party_name TEXT;
BEGIN
  party_name := COALESCE(NULLIF(NEW.customer_name, ''), NULLIF(NEW.buyer_name, ''), 'Customer');

  IF (NEW.status IN ('sent', 'paid') AND (OLD.status = 'draft' OR OLD IS NULL)) THEN
    INSERT INTO journal_entries (entry_date, description, reference_type, reference_id)
    VALUES (
      COALESCE(NEW.issue_date::DATE, CURRENT_DATE),
      'Sales Invoice ' || NEW.invoice_number || ' — ' || party_name,
      'invoice',
      NEW.id
    )
    RETURNING id INTO je_id;

    INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
    VALUES (je_id, '1200', 'Accounts Receivable — ' || party_name, NEW.total_amount, 0);

    INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
    VALUES (je_id, '4100', 'Sales Revenue — ' || NEW.invoice_number, 0, NEW.subtotal);

    IF NEW.tax_amount > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
      VALUES (je_id, '2200', 'GST Output — ' || NEW.invoice_number, 0, NEW.tax_amount);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_journal_entry_for_payment()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  inv_number TEXT;
  inv_customer TEXT;
BEGIN
  SELECT invoice_number, COALESCE(NULLIF(customer_name, ''), NULLIF(buyer_name, ''), 'Customer')
  INTO inv_number, inv_customer
  FROM invoices
  WHERE id = NEW.invoice_id;

  INSERT INTO journal_entries (entry_date, description, reference_type, reference_id)
  VALUES (
    NEW.payment_date::DATE,
    'Payment received — ' || inv_number || ' from ' || inv_customer,
    'payment',
    NEW.id
  )
  RETURNING id INTO je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
  VALUES (je_id, '1100', 'Cash received — ' || inv_number, NEW.amount, 0);

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, description, debit, credit)
  VALUES (je_id, '1200', 'Receivable cleared — ' || inv_number, 0, NEW.amount);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Retire legacy buyer schema after customer migration is fully adopted.

ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;

DROP INDEX IF EXISTS idx_orders_buyer_id;

ALTER TABLE orders
DROP COLUMN IF EXISTS buyer_id;

ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_buyer_id_fkey;

ALTER TABLE invoices
DROP COLUMN IF EXISTS buyer_id,
DROP COLUMN IF EXISTS buyer_name,
DROP COLUMN IF EXISTS buyer_address,
DROP COLUMN IF EXISTS buyer_gst;

ALTER TABLE credit_notes
DROP COLUMN IF EXISTS buyer_name,
DROP COLUMN IF EXISTS buyer_gst;

DROP TRIGGER IF EXISTS update_buyers_updated_at ON buyers;

DROP TABLE IF EXISTS buyers;
-- ============================================================
-- Migration 00022 — Kanrad Houseware client schema
-- Run this in Supabase SQL Editor AFTER migrations 00001–00021
-- ============================================================

-- ─── 1. Rename order number prefix (JC → KH) ────────────────
-- Drop existing trigger and function, recreate with KH prefix

DROP TRIGGER IF EXISTS trg_order_number ON orders;
DROP FUNCTION IF EXISTS generate_order_number();

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
DROP FUNCTION IF EXISTS generate_invoice_number();

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
DROP FUNCTION IF EXISTS generate_po_number();

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
-- Clear garment stages and insert houseware stages
TRUNCATE production_stages RESTART IDENTITY CASCADE;

INSERT INTO production_stages (id, name, description, sequence, color) VALUES
  ('raw_material_receipt', 'Raw Material Receipt',  'Receive and allocate raw materials to batch',          1, '#6366f1'),
  ('cutting_pressing',     'Cutting / Pressing',    'Sheet metal or material cutting and pressing',         2, '#f59e0b'),
  ('forming_shaping',      'Forming / Shaping',     'Deep drawing, forming, or injection moulding',        3, '#f97316'),
  ('assembly_welding',     'Assembly / Welding',    'Component assembly, spot/arc welding, riveting',      4, '#ef4444'),
  ('surface_treatment',    'Surface Treatment',     'Polishing, powder coating, anodising, plating',       5, '#8b5cf6'),
  ('quality_check',        'Quality Check',         'Final QC inspection — pass/fail gate before packing', 6, '#10b981'),
  ('packing',              'Packing',               'Retail/export packing, labelling, carton sealing',    7, '#3b82f6')
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      sequence = EXCLUDED.sequence,
      color = EXCLUDED.color;

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
-- ============================================================
-- Migration 00023 — Kanrad Houseware business logic triggers
-- Run AFTER 00022_kanrad_schema.sql
-- ============================================================

-- ─── 1. QC gate: block packing if QC not passed ──────────────
-- Enforces: production_tracking stage 'packing' cannot be marked
-- in_progress/completed unless 'quality_check' stage is completed.

CREATE OR REPLACE FUNCTION enforce_qc_gate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  qc_completed BOOLEAN;
BEGIN
  -- Only apply gate when updating packing stage to in_progress or completed
  IF NEW.stage_id = 'packing' AND NEW.status IN ('in_progress', 'completed') THEN
    SELECT EXISTS (
      SELECT 1 FROM production_tracking
       WHERE order_id = NEW.order_id
         AND stage_id = 'quality_check'
         AND status = 'completed'
    ) INTO qc_completed;

    IF NOT qc_completed THEN
      RAISE EXCEPTION 'QC gate: quality_check stage must be completed before packing can start.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qc_gate
  BEFORE INSERT OR UPDATE ON production_tracking
  FOR EACH ROW EXECUTE FUNCTION enforce_qc_gate();

-- ─── 2. Finished goods: auto-increment on batch completion ───
-- When the 'packing' stage is marked completed, add output_qty
-- to finished_goods and log a finished_goods_transaction.

CREATE OR REPLACE FUNCTION on_packing_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_sku       TEXT;
  v_qty       NUMERIC;
  v_order_id  UUID;
BEGIN
  IF NEW.stage_id = 'packing'
     AND NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed') THEN

    -- Get SKU and output qty from the order
    SELECT o.product_sku, COALESCE(pt.output_qty, o.quantity)
      INTO v_sku, v_qty
      FROM orders o
      LEFT JOIN production_tracking pt
             ON pt.order_id = o.id AND pt.stage_id = 'packing'
     WHERE o.id = NEW.order_id
     LIMIT 1;

    v_order_id := NEW.order_id;

    IF v_sku IS NOT NULL AND v_qty > 0 THEN
      -- Upsert finished_goods qty
      INSERT INTO finished_goods (product_sku, product_name, qty_on_hand, unit)
        SELECT o.product_sku,
               COALESCE(oi.product_name, o.style_name, 'Unknown'),
               v_qty,
               'pcs'
          FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.id = v_order_id
         LIMIT 1
      ON CONFLICT (product_sku)
      DO UPDATE SET
        qty_on_hand = finished_goods.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_at  = NOW();

      -- Log transaction
      INSERT INTO finished_goods_transactions
        (product_sku, txn_type, qty, ref_type, ref_id, notes)
      VALUES
        (v_sku, 'in', v_qty, 'production_batch', v_order_id,
         'Auto: packing stage completed');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_packing_completed
  AFTER INSERT OR UPDATE ON production_tracking
  FOR EACH ROW EXECUTE FUNCTION on_packing_completed();

-- ─── 3. Finished goods: decrement on dispatch ────────────────
-- When an order status changes to 'dispatched', decrement
-- finished_goods qty and log an outbound transaction.

CREATE OR REPLACE FUNCTION on_order_dispatched()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_sku  TEXT;
  v_qty  NUMERIC;
BEGIN
  IF NEW.status = 'dispatched' AND OLD.status != 'dispatched' THEN
    SELECT product_sku, quantity
      INTO v_sku, v_qty
      FROM orders
     WHERE id = NEW.id;

    IF v_sku IS NOT NULL THEN
      UPDATE finished_goods
         SET qty_on_hand = GREATEST(0, qty_on_hand - v_qty),
             updated_at  = NOW()
       WHERE product_sku = v_sku;

      INSERT INTO finished_goods_transactions
        (product_sku, txn_type, qty, ref_type, ref_id, notes)
      VALUES
        (v_sku, 'out', v_qty, 'dispatch', NEW.id,
         'Auto: order dispatched');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_dispatched
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION on_order_dispatched();

-- ─── 4. Low stock alert for finished goods ───────────────────
CREATE OR REPLACE FUNCTION notify_low_finished_goods()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.qty_on_hand <= NEW.reorder_level AND NEW.reorder_level > 0 THEN
    INSERT INTO notifications (type, title, message, entity_type, entity_id)
    VALUES (
      'low_stock',
      'Low Finished Goods: ' || NEW.product_name,
      'Stock of ' || NEW.product_name || ' has fallen to ' ||
        NEW.qty_on_hand || ' ' || NEW.unit || ' (reorder level: ' ||
        NEW.reorder_level || ').',
      'finished_goods',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_low_finished_goods
  AFTER UPDATE ON finished_goods
  FOR EACH ROW EXECUTE FUNCTION notify_low_finished_goods();
-- ============================================================
-- Migration 00024: Warehouse, Logistics, Rejections, Production
--                  Targets, Issues tables
-- ============================================================

-- ── warehouse_items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_items (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name     text         NOT NULL,
  sku           text,
  category      text,
  quantity      numeric(12,3) NOT NULL DEFAULT 0,
  unit          text         NOT NULL DEFAULT 'pcs',
  location      text,
  status        text         NOT NULL DEFAULT 'in_warehouse'
                             CHECK (status IN ('in_warehouse','dispatched')),
  entry_date    date         NOT NULL DEFAULT CURRENT_DATE,
  exit_date     date,
  remarks       text,
  created_by    uuid         REFERENCES profiles(id),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouse_items_authenticated"
  ON warehouse_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── shipments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
  id                     uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number        text  UNIQUE,
  order_id               uuid  REFERENCES orders(id),
  customer_name          text,
  courier_name           text,
  tracking_number        text,
  status                 text  NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','dispatched','in_transit','delivered','delayed')),
  expected_delivery_date date,
  notes                  text,
  created_by             uuid  REFERENCES profiles(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipments_authenticated"
  ON shipments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-generate shipment_number: SHP-YYMMDD-NNN
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today     text := to_char(now(), 'YYMMDD');
  seq_num   int;
BEGIN
  SELECT COUNT(*) + 1
    INTO seq_num
    FROM shipments
   WHERE shipment_number LIKE 'SHP-' || today || '-%';

  NEW.shipment_number := 'SHP-' || today || '-' || lpad(seq_num::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shipment_number
  BEFORE INSERT ON shipments
  FOR EACH ROW
  WHEN (NEW.shipment_number IS NULL)
  EXECUTE FUNCTION generate_shipment_number();

-- ── rejections ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rejections (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  stage       text         NOT NULL
                           CHECK (stage IN ('production','warehouse','logistics','client')),
  item_name   text         NOT NULL,
  quantity    numeric(12,3) NOT NULL,
  reason      text         NOT NULL,
  return_type text         CHECK (return_type IN ('loss','return_to_usable','non_saleable','saleable')),
  notes       text,
  created_by  uuid         REFERENCES profiles(id),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rejections_authenticated"
  ON rejections
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── production_targets ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_targets (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name     text          NOT NULL,
  daily_target_qty numeric(12,3) NOT NULL,
  target_date      date          NOT NULL,
  actual_qty       numeric(12,3),
  status           text          NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','met','not_met')),
  created_by       uuid          REFERENCES profiles(id),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE production_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_targets_authenticated"
  ON production_targets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── issues ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issues (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module      text        NOT NULL,
  issue_type  text        NOT NULL,
  description text        NOT NULL,
  severity    text        NOT NULL DEFAULT 'medium'
                          CHECK (severity IN ('medium','high','critical')),
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','in_progress','resolved')),
  resolved_at timestamptz,
  created_by  uuid        REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issues_authenticated"
  ON issues
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
