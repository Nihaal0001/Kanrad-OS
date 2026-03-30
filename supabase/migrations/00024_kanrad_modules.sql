-- ============================================================
-- Migration 00024: Warehouse, Logistics, Rejections, Production
--                  Targets, Issues tables
-- ============================================================

-- ── warehouse_items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_items (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name     text         NOT NULL,
  sku           text,
  category      text,
  quantity      numeric(12,3) NOT NULL DEFAULT 0,
  unit          text         NOT NULL DEFAULT 'pcs',
  location      text,
  status        text         NOT NULL DEFAULT 'in_warehouse'
                             CHECK (status IN ('in_warehouse','dispatched')),
  entry_date    date         NOT NULL DEFAULT CURRENT_DATE,
  exit_date     date,
  remarks       text,
  created_by    uuid         REFERENCES profiles(id),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouse_items_authenticated"
  ON warehouse_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── shipments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
  id                     uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number        text  UNIQUE,
  order_id               uuid  REFERENCES orders(id),
  customer_name          text,
  courier_name           text,
  tracking_number        text,
  status                 text  NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','dispatched','in_transit','delivered','delayed')),
  expected_delivery_date date,
  notes                  text,
  created_by             uuid  REFERENCES profiles(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipments_authenticated"
  ON shipments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-generate shipment_number: SHP-YYMMDD-NNN
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today     text := to_char(now(), 'YYMMDD');
  seq_num   int;
BEGIN
  SELECT COUNT(*) + 1
    INTO seq_num
    FROM shipments
   WHERE shipment_number LIKE 'SHP-' || today || '-%';

  NEW.shipment_number := 'SHP-' || today || '-' || lpad(seq_num::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shipment_number
  BEFORE INSERT ON shipments
  FOR EACH ROW
  WHEN (NEW.shipment_number IS NULL)
  EXECUTE FUNCTION generate_shipment_number();

-- ── rejections ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rejections (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  stage       text         NOT NULL
                           CHECK (stage IN ('production','warehouse','logistics','client')),
  item_name   text         NOT NULL,
  quantity    numeric(12,3) NOT NULL,
  reason      text         NOT NULL,
  return_type text         CHECK (return_type IN ('loss','return_to_usable','non_saleable','saleable')),
  notes       text,
  created_by  uuid         REFERENCES profiles(id),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rejections_authenticated"
  ON rejections
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── production_targets ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_targets (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name     text          NOT NULL,
  daily_target_qty numeric(12,3) NOT NULL,
  target_date      date          NOT NULL,
  actual_qty       numeric(12,3),
  status           text          NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','met','not_met')),
  created_by       uuid          REFERENCES profiles(id),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE production_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_targets_authenticated"
  ON production_targets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── issues ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issues (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module      text        NOT NULL,
  issue_type  text        NOT NULL,
  description text        NOT NULL,
  severity    text        NOT NULL DEFAULT 'medium'
                          CHECK (severity IN ('medium','high','critical')),
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','in_progress','resolved')),
  resolved_at timestamptz,
  created_by  uuid        REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issues_authenticated"
  ON issues
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
