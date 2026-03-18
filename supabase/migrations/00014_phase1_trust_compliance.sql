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
