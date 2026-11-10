-- Actual circle counts can differ from the PO estimate (which is derived from kg).
-- Store an approval request before a mismatched count is booked into stock.

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS receipt_completed BOOLEAN NOT NULL DEFAULT false;

UPDATE purchase_order_items
SET receipt_completed = true
WHERE quantity_received >= quantity_ordered AND quantity_received > 0;

CREATE TABLE IF NOT EXISTS purchase_order_receipt_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  purchase_order_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  requested_quantity NUMERIC(12,2) NOT NULL CHECK (requested_quantity > 0),
  current_received NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_quantity NUMERIC(12,2) NOT NULL,
  bill_no TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_variance_status
  ON purchase_order_receipt_approvals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_variance_item
  ON purchase_order_receipt_approvals(purchase_order_item_id, status);

-- Only one live request for a line at a time. A rejected request can be replaced.
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_variance_one_pending
  ON purchase_order_receipt_approvals(purchase_order_item_id)
  WHERE status = 'pending';

ALTER TABLE purchase_order_receipt_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view receipt variance approvals"
  ON purchase_order_receipt_approvals;
CREATE POLICY "Authenticated users can view receipt variance approvals"
  ON purchase_order_receipt_approvals FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can request receipt variance approval"
  ON purchase_order_receipt_approvals;
CREATE POLICY "Authenticated users can request receipt variance approval"
  ON purchase_order_receipt_approvals FOR INSERT
  WITH CHECK (auth.uid() = requested_by AND status = 'pending');
