-- AI-assisted finance document import

ALTER TABLE purchase_invoices
ADD COLUMN IF NOT EXISTS document_path TEXT,
ADD COLUMN IF NOT EXISTS document_url TEXT;

CREATE TABLE IF NOT EXISTS finance_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_hint TEXT CHECK (target_hint IN ('purchase_invoice', 'expense')) NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'partially_submitted', 'submitted', 'failed')),
  item_count INTEGER NOT NULL DEFAULT 0,
  submitted_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES finance_import_batches(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('purchase_invoice', 'expense')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'failed', 'submitted')),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_url TEXT,
  extraction_confidence NUMERIC(5,2),
  extraction_warnings TEXT[] NOT NULL DEFAULT '{}',
  extraction_error TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_record_type TEXT CHECK (created_record_type IN ('purchase_invoice', 'expense')) NULL,
  created_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_finance_import_batches_updated_at
  BEFORE UPDATE ON finance_import_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_finance_import_items_updated_at
  BEFORE UPDATE ON finance_import_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_finance_import_items_batch_id
  ON finance_import_items(batch_id);

CREATE INDEX IF NOT EXISTS idx_finance_import_items_status
  ON finance_import_items(status);

ALTER TABLE finance_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_import_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all finance_import_batches" ON finance_import_batches;
CREATE POLICY "allow all finance_import_batches"
  ON finance_import_batches FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow all finance_import_items" ON finance_import_items;
CREATE POLICY "allow all finance_import_items"
  ON finance_import_items FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('finance-documents', 'finance-documents', true)
ON CONFLICT (id) DO NOTHING;
