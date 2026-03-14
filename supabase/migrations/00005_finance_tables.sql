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
