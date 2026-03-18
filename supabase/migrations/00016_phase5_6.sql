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
