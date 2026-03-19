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
