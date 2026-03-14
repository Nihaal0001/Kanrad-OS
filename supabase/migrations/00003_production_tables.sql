-- ============================================================
-- Migration 00003: Production + Quality Tables
-- production_stages, production_tracking, quality_checks
-- ============================================================

-- ==================== PRODUCTION STAGES (reference table) ====================
CREATE TABLE IF NOT EXISTS production_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sequence INT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the 7 stages
INSERT INTO production_stages (name, sequence, description) VALUES
  ('Fabric Sourcing',   1, 'Sourcing and receiving raw fabric materials'),
  ('Cutting',          2, 'Cutting fabric as per patterns and measurements'),
  ('Stitching',        3, 'Stitching cut pieces together'),
  ('Quality Check',    4, 'Inline quality inspection of stitched garments'),
  ('Finishing',        5, 'Ironing, trimming threads, and finishing touches'),
  ('Packing',          6, 'Packing garments with tags and labels'),
  ('Dispatch',         7, 'Final dispatch and shipping to buyer')
ON CONFLICT (sequence) DO NOTHING;

-- ==================== PRODUCTION TRACKING ====================
CREATE TABLE IF NOT EXISTS production_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES production_stages(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  quantity_completed INT NOT NULL DEFAULT 0,
  quantity_rejected INT NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (order_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_tracking_order ON production_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_prod_tracking_stage ON production_tracking(stage_id);
CREATE INDEX IF NOT EXISTS idx_prod_tracking_status ON production_tracking(status);

-- ==================== QUALITY CHECKS ====================
CREATE TABLE IF NOT EXISTS quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES production_stages(id) ON DELETE SET NULL,
  inspected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  quantity_inspected INT NOT NULL DEFAULT 0,
  quantity_passed INT NOT NULL DEFAULT 0,
  quantity_failed INT NOT NULL DEFAULT 0,
  defect_type TEXT, -- e.g. 'stitching', 'measurement', 'fabric', 'finishing'
  severity TEXT CHECK (severity IN ('minor', 'major', 'critical')),
  notes TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_order ON quality_checks(order_id);
CREATE INDEX IF NOT EXISTS idx_qc_stage ON quality_checks(stage_id);
CREATE INDEX IF NOT EXISTS idx_qc_checked_at ON quality_checks(checked_at);

-- ==================== TRIGGERS ====================

-- Auto-update updated_at for production_tracking
CREATE OR REPLACE TRIGGER update_production_tracking_updated_at
  BEFORE UPDATE ON production_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-create 7 production_tracking rows when order is confirmed
CREATE OR REPLACE FUNCTION on_order_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status changes TO 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    INSERT INTO production_tracking (order_id, stage_id, status)
    SELECT NEW.id, id, 'pending'
    FROM production_stages
    ORDER BY sequence
    ON CONFLICT (order_id, stage_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_on_order_confirmed
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION on_order_confirmed();

-- Auto-update order status when all production stages are completed
CREATE OR REPLACE FUNCTION on_production_stage_complete()
RETURNS TRIGGER AS $$
DECLARE
  total_stages INT;
  completed_stages INT;
BEGIN
  -- Only fire when status changes TO 'completed'
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT COUNT(*) INTO total_stages
    FROM production_tracking WHERE order_id = NEW.order_id;

    SELECT COUNT(*) INTO completed_stages
    FROM production_tracking WHERE order_id = NEW.order_id AND status = 'completed';

    IF total_stages > 0 AND total_stages = completed_stages THEN
      UPDATE orders SET status = 'completed' WHERE id = NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_on_production_stage_complete
  AFTER UPDATE ON production_tracking
  FOR EACH ROW
  EXECUTE FUNCTION on_production_stage_complete();

-- Set started_at when stage moves to in_progress, completed_at when completed
CREATE OR REPLACE FUNCTION set_production_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_production_timestamps
  BEFORE UPDATE ON production_tracking
  FOR EACH ROW
  EXECUTE FUNCTION set_production_timestamps();

-- ==================== RLS (Permissive until Phase 8) ====================
ALTER TABLE production_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on production_stages" ON production_stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on production_tracking" ON production_tracking FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quality_checks" ON quality_checks FOR ALL USING (true) WITH CHECK (true);
