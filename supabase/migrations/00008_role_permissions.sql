-- ============================================
-- JUST CLOTHING ERP — Phase 8b: Role Permissions Table
-- ============================================
-- Moves role permissions from hardcoded constants
-- into the database so they can be edited via the UI.
-- Run this in the Supabase SQL Editor.
-- ============================================

CREATE TABLE IF NOT EXISTS role_permissions (
  role        TEXT NOT NULL CHECK (role IN ('admin', 'production_manager', 'inventory_manager', 'qc_head', 'floor_supervisor', 'worker')),
  permission  TEXT NOT NULL,
  PRIMARY KEY (role, permission)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to role_permissions" ON role_permissions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed with defaults (safe to re-run — ON CONFLICT DO NOTHING)
INSERT INTO role_permissions (role, permission) VALUES
  -- admin: everything
  ('admin', 'dashboard'), ('admin', 'orders'), ('admin', 'inventory'),
  ('admin', 'production'), ('admin', 'quality'), ('admin', 'tasks'),
  ('admin', 'finance'), ('admin', 'hr'), ('admin', 'notifications'),
  ('admin', 'settings'), ('admin', 'users'),

  -- production_manager
  ('production_manager', 'dashboard'), ('production_manager', 'orders'),
  ('production_manager', 'production'), ('production_manager', 'quality'),
  ('production_manager', 'tasks'), ('production_manager', 'hr'),
  ('production_manager', 'notifications'), ('production_manager', 'settings'),

  -- inventory_manager
  ('inventory_manager', 'dashboard'), ('inventory_manager', 'orders'),
  ('inventory_manager', 'inventory'), ('inventory_manager', 'tasks'),
  ('inventory_manager', 'finance'), ('inventory_manager', 'notifications'),
  ('inventory_manager', 'settings'),

  -- qc_head
  ('qc_head', 'dashboard'), ('qc_head', 'production'), ('qc_head', 'quality'),
  ('qc_head', 'tasks'), ('qc_head', 'notifications'), ('qc_head', 'settings'),

  -- floor_supervisor
  ('floor_supervisor', 'dashboard'), ('floor_supervisor', 'production'),
  ('floor_supervisor', 'quality'), ('floor_supervisor', 'tasks'),
  ('floor_supervisor', 'hr'), ('floor_supervisor', 'notifications'),
  ('floor_supervisor', 'settings'),

  -- worker
  ('worker', 'dashboard'), ('worker', 'tasks'), ('worker', 'notifications')

ON CONFLICT DO NOTHING;
