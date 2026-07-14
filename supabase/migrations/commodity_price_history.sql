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
CREATE POLICY "commodity_price_history_read_authenticated" ON commodity_price_history
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "commodity_price_history_write_admin" ON commodity_price_history
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin'));
