-- Migration 00021 dropped invoices.buyer_name, but the journal-entry trigger
-- functions rewritten in 00020 still read it. Result: every INSERT on
-- invoice_items (its subtotal sync UPDATEs invoices) and every INSERT on
-- payments failed with: column "buyer_name" does not exist / record "new" has
-- no field "buyer_name". Re-create both functions using customer_name only.

CREATE OR REPLACE FUNCTION create_journal_entry_for_invoice()
RETURNS TRIGGER AS $$
DECLARE
  je_id UUID;
  party_name TEXT;
BEGIN
  party_name := COALESCE(NULLIF(NEW.customer_name, ''), 'Customer');

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
  SELECT invoice_number, COALESCE(NULLIF(customer_name, ''), 'Customer')
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
