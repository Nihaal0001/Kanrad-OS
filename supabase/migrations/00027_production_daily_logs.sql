-- Daily production log — records units produced per day per order
CREATE TABLE IF NOT EXISTS production_daily_logs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  log_date           date        NOT NULL DEFAULT CURRENT_DATE,
  quantity_produced  integer     NOT NULL DEFAULT 0,
  quantity_rejected  integer     NOT NULL DEFAULT 0,
  notes              text,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (order_id, log_date)
);

ALTER TABLE production_daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage daily logs"
  ON production_daily_logs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
