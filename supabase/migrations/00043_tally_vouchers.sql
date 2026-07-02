-- ============================================================================
-- Tally vouchers — read-only mirror of accounting vouchers pulled from Tally
--
-- The connector exports vouchers (Sales / Purchase / Receipt / Payment / …)
-- over a rolling window, month-chunked, and each chunk replaces its date range
-- here (windowed replace → Tally-side edits, deletions and cancellations
-- self-heal). Powers the Finance dashboard graphs (money in/out, sales vs
-- purchases, top parties). Nothing is posted to Tally; this is read-only.
--
-- Apply in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tally_vouchers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key     TEXT NOT NULL UNIQUE,  -- Tally GUID, else connector-side hash of (type|number|date|party|amount)
  guid           TEXT,
  voucher_date   DATE NOT NULL,
  voucher_type   TEXT NOT NULL,         -- Sales | Purchase | Receipt | Payment | Journal | Credit Note | Debit Note | Contra | Other
  voucher_number TEXT,
  party          TEXT,
  amount         NUMERIC(14,2) NOT NULL DEFAULT 0,  -- absolute; direction derived from voucher_type
  is_cancelled   BOOLEAN NOT NULL DEFAULT false,
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tally_vouchers_date ON tally_vouchers (voucher_date);
CREATE INDEX IF NOT EXISTS idx_tally_vouchers_type ON tally_vouchers (voucher_type);

ALTER TABLE tally_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tally_vouchers" ON tally_vouchers
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
