-- Photo-to-order intake: keep the original handwritten sheet attached to the
-- order it created, and fingerprint it so repeat uploads can be flagged.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS source_photo_hash TEXT;

-- One live order per photo; closes the check-then-insert race on double submit
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_source_photo_hash
  ON orders(source_photo_hash)
  WHERE source_photo_hash IS NOT NULL AND status <> 'cancelled';

-- Private bucket. All access goes through server routes using the service
-- role (signed URLs), so no storage.objects policies are granted to clients.
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-photos', 'order-photos', false)
ON CONFLICT (id) DO NOTHING;
