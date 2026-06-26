-- ============================================================================
-- Tally outstanding bills (receivables / payables) — read-only mirror
--
-- The connector pulls Bills Receivable / Bills Payable from Tally and replaces
-- this snapshot each sync. Powers Finance → Outstanding (cashflow view).
-- Nothing is posted to Tally; this is read-only.
--
-- Apply in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tally_outstanding (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('incoming', 'outgoing')),
  amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  bill_ref   TEXT,
  bill_date  DATE,
  due_date   DATE,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tally_outstanding_type ON tally_outstanding (type);

ALTER TABLE tally_outstanding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tally_outstanding" ON tally_outstanding
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
