-- ============================================================
-- 00012_automation_triggers.sql
-- Low-stock notification trigger + Leave request notification trigger
-- ============================================================

-- 1. Low-stock alert: fires when current_stock drops below min_stock_level
CREATE OR REPLACE FUNCTION notify_low_stock() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock <= NEW.min_stock_level
     AND NEW.min_stock_level > 0
     AND (OLD.current_stock > OLD.min_stock_level OR OLD.current_stock IS DISTINCT FROM NEW.current_stock)
  THEN
    -- Throttle: only one notification per material per 24 hours
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE type = 'low_stock' AND reference_id = NEW.id::text
        AND created_at > now() - interval '24 hours'
    ) THEN
      INSERT INTO notifications (type, title, message, reference_type, reference_id)
      VALUES (
        'low_stock',
        'Low Stock Alert',
        NEW.name || ' is low (' || NEW.current_stock || ' ' || NEW.unit || ', min: ' || NEW.min_stock_level || ')',
        'material',
        NEW.id::text
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_low_stock ON materials;
CREATE TRIGGER trigger_notify_low_stock
  AFTER UPDATE OF current_stock ON materials
  FOR EACH ROW
  EXECUTE FUNCTION notify_low_stock();


-- 2. Leave request notification: fires when a new leave request is created
CREATE OR REPLACE FUNCTION notify_leave_request() RETURNS TRIGGER AS $$
DECLARE
  worker_name TEXT;
BEGIN
  SELECT full_name INTO worker_name FROM profiles WHERE id = NEW.worker_id;

  INSERT INTO notifications (type, title, message, reference_type, reference_id)
  VALUES (
    'leave_request',
    'New Leave Request',
    COALESCE(worker_name, 'A worker') || ' requested ' || NEW.leave_type || ' leave ('
      || NEW.from_date || ' to ' || NEW.to_date || ')',
    'leave',
    NEW.id::text
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_leave_request ON leaves;
CREATE TRIGGER trigger_notify_leave_request
  AFTER INSERT ON leaves
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_request();


-- 3. Add 'overdue' to invoice status constraint (cron job sets this)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'));
