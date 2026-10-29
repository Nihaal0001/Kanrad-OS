-- Deleting the last payment on an invoice left it "partially_paid"/"paid"
-- with 0 paid, because the sync functions kept the old status when
-- total_paid = 0. Revert such invoices to their unpaid state.

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
      WHEN status IN ('paid', 'partially_paid') THEN 'sent'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = inv_id
    AND status NOT IN ('cancelled', 'draft');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
      WHEN status IN ('paid', 'partially_paid') THEN 'received'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = inv_id
    AND status NOT IN ('cancelled', 'draft');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
