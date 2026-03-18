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
