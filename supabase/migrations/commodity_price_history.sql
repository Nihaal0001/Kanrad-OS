-- Commodity price history: tracks market prices per material category (commodity)
-- rather than individual inventory items.

CREATE TABLE IF NOT EXISTS commodity_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES material_categories(id) ON DELETE CASCADE,
  price_per_unit NUMERIC(12, 2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commodity_price_history_category_id_idx ON commodity_price_history(category_id);
CREATE INDEX IF NOT EXISTS commodity_price_history_recorded_at_idx ON commodity_price_history(recorded_at DESC);

-- Allow read/write for authenticated users (adjust to your existing RLS pattern)
ALTER TABLE commodity_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role bypass" ON commodity_price_history USING (true) WITH CHECK (true);
