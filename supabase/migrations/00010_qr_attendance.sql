-- ============================================
-- JUST CLOTHING ERP — QR Attendance System
-- Migration 00010
-- ============================================

-- ===== 1. QR Attendance Logs =====
CREATE TABLE IF NOT EXISTS qr_attendance_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  type          TEXT        NOT NULL CHECK (type IN ('IN', 'OUT')),
  status        TEXT        NOT NULL CHECK (status IN ('Verified', 'Flagged')),
  lat           NUMERIC(10, 6),
  long          NUMERIC(10, 6),
  flag_reason   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for per-employee today lookups (IN/OUT detection)
CREATE INDEX IF NOT EXISTS idx_qr_logs_employee_ts
  ON qr_attendance_logs (employee_id, timestamp DESC);

-- Index for cron anomaly queries
CREATE INDEX IF NOT EXISTS idx_qr_logs_timestamp
  ON qr_attendance_logs (timestamp);

-- ===== 2. RLS =====
ALTER TABLE qr_attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated insert QR logs"
  ON qr_attendance_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Employee reads own QR logs"
  ON qr_attendance_logs FOR SELECT
  USING (
    employee_id = (
      SELECT id FROM profiles WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "Admin reads all QR logs"
  ON qr_attendance_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'production_manager', 'floor_supervisor')
    )
  );

-- ===== 3. Seed office_location setting =====
INSERT INTO app_settings (key, value)
VALUES ('office_location', '{"lat": 0, "long": 0, "radius_m": 50}'::jsonb)
ON CONFLICT (key) DO NOTHING;
