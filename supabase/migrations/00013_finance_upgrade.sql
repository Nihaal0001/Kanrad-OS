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
