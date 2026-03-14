-- ============================================================
-- Migration 00004: Tasks + Notifications
-- ============================================================

-- ==================== TASKS ====================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES production_stages(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  due_date DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

-- ==================== NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'low_stock', 'deadline', 'stage_complete', 'qc_failure', 'task_assigned', 'order_confirmed'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reference_type TEXT, -- 'order', 'material', 'task', 'quality_check'
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ==================== TRIGGERS ====================

-- Auto-update updated_at for tasks
CREATE OR REPLACE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Notification on order confirmed
CREATE OR REPLACE FUNCTION notify_order_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    INSERT INTO notifications (type, title, message, reference_type, reference_id)
    VALUES (
      'order_confirmed',
      'Order Confirmed',
      'Order ' || NEW.order_number || ' (' || NEW.style_name || ') has been confirmed and moved to production.',
      'order',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_notify_order_confirmed
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_confirmed();

-- Notification on production stage completed
CREATE OR REPLACE FUNCTION notify_stage_complete()
RETURNS TRIGGER AS $$
DECLARE
  stage_name TEXT;
  order_number TEXT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT ps.name INTO stage_name FROM production_stages ps WHERE ps.id = NEW.stage_id;
    SELECT o.order_number INTO order_number FROM orders o WHERE o.id = NEW.order_id;

    INSERT INTO notifications (type, title, message, reference_type, reference_id)
    VALUES (
      'stage_complete',
      'Stage Completed',
      stage_name || ' stage completed for order ' || order_number || '.',
      'order',
      NEW.order_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_notify_stage_complete
  AFTER UPDATE ON production_tracking
  FOR EACH ROW
  EXECUTE FUNCTION notify_stage_complete();

-- Notification on QC failure (quantity_failed > 0)
CREATE OR REPLACE FUNCTION notify_qc_failure()
RETURNS TRIGGER AS $$
DECLARE
  order_number TEXT;
BEGIN
  IF NEW.quantity_failed > 0 AND NEW.severity IN ('major', 'critical') THEN
    SELECT o.order_number INTO order_number FROM orders o WHERE o.id = NEW.order_id;
    INSERT INTO notifications (type, title, message, reference_type, reference_id)
    VALUES (
      'qc_failure',
      'QC Failure Alert',
      order_number || ': ' || NEW.quantity_failed || ' pieces failed QC (' || COALESCE(NEW.severity, 'unknown') || ' severity).',
      'order',
      NEW.order_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_notify_qc_failure
  AFTER INSERT ON quality_checks
  FOR EACH ROW
  EXECUTE FUNCTION notify_qc_failure();

-- ==================== RLS (Permissive until Phase 8) ====================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
