-- Lets a supplier payment specify which Tally bank/cash ledger it should be
-- booked against, overriding the single global "tally_bank_ledger" setting
-- for that one transaction (e.g. a cash payment vs. a specific bank account).
ALTER TABLE purchase_payments ADD COLUMN IF NOT EXISTS tally_ledger TEXT;
