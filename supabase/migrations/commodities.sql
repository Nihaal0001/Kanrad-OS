-- Proper commodities table for Market Intel — separate from inventory categories.
-- Tracks real market-traded commodity prices (LME rates, coil prices, etc.)

CREATE TABLE IF NOT EXISTS commodities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'MT',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE commodities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commodities_read_authenticated" ON commodities
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "commodities_write_admin" ON commodities
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin'));

INSERT INTO commodities (name, unit) VALUES
  ('LME Aluminium', 'MT'),
  ('LME Nickel', 'MT'),
  ('Ferro Chrome / Chromium', 'MT'),
  ('Stainless Steel 304 Coil', 'MT'),
  ('Stainless Steel 316 Coil', 'MT'),
  ('Iron Ore', 'MT'),
  ('Coking Coal', 'MT');

-- Recreate commodity_price_history referencing commodities instead of material_categories
-- (table was just created and should be empty — safe to drop and recreate)
DROP TABLE IF EXISTS commodity_price_history;

CREATE TABLE commodity_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id UUID NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
  price_per_unit NUMERIC(12, 2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'MT',
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON commodity_price_history(commodity_id);
CREATE INDEX ON commodity_price_history(recorded_at DESC);
ALTER TABLE commodity_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commodity_price_history_read_authenticated" ON commodity_price_history
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "commodity_price_history_write_admin" ON commodity_price_history
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin'));
