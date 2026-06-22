-- ============================================================================
-- Tally two-way sync (Phase 2)
--
-- Supports a local connector agent that runs next to Tally Prime and talks to
-- both Tally (localhost:9000 XML gateway) and Kanrad (/api/tally/*).
--
--   tally_sync            — per-entity push state + Tally identity (GUID/MASTERID)
--   tally_pull_state      — incremental pull cursor (ALTERID watermark)
--   tally_ledger_balances — read-only mirror of balances pulled FROM Tally
--
-- No existing tables are modified. Apply in the Supabase SQL editor.
-- ============================================================================

-- 1. Per-entity sync mapping ------------------------------------------------
CREATE TABLE IF NOT EXISTS tally_sync (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'customer' | 'supplier' | 'finished_good' | 'sales_invoice'
  -- | 'purchase_invoice' | 'receipt' | 'payment'
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  -- Tally identity returned after a successful import
  tally_guid    TEXT,
  tally_master_id TEXT,
  -- Hash of the last payload we pushed; lets us detect changes and re-push
  payload_hash  TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'synced', 'error')),
  last_error    TEXT,
  synced_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_tally_sync_status ON tally_sync (status);

-- 2. Incremental pull cursor (single row) -----------------------------------
CREATE TABLE IF NOT EXISTS tally_pull_state (
  id                     INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_master_alter_id   BIGINT NOT NULL DEFAULT 0,
  last_voucher_alter_id  BIGINT NOT NULL DEFAULT 0,
  last_pulled_at         TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO tally_pull_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. Balances mirrored from Tally (read-only in Kanrad) ---------------------
CREATE TABLE IF NOT EXISTS tally_ledger_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_name     TEXT NOT NULL UNIQUE,
  parent          TEXT,
  closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  as_of           DATE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RLS — service role (used by /api/tally/*) bypasses RLS; allow
--    authenticated users read-only so a future UI can show sync status.
ALTER TABLE tally_sync            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_pull_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_ledger_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read tally_sync"            ON tally_sync            FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth read tally_pull_state"      ON tally_pull_state      FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth read tally_ledger_balances" ON tally_ledger_balances FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
