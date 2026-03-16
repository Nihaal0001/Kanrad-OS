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
