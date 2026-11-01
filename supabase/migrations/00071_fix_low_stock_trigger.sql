-- The live notify_low_stock() inserted a notification without the NOT NULL
-- "title" column. Any stock change that left a material at or below its
-- minimum level (stock_transactions -> materials.current_stock update) hit the
-- trigger and the whole stock movement failed and rolled back.
--
-- Re-create it properly (title, 24h throttle per material) and make the alert
-- best-effort: a notification problem must never block a stock movement.

CREATE OR REPLACE FUNCTION notify_low_stock() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock <= NEW.min_stock_level
     AND NEW.min_stock_level > 0
     AND OLD.current_stock IS DISTINCT FROM NEW.current_stock
  THEN
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE type = 'low_stock' AND reference_id = NEW.id
          AND created_at > now() - interval '24 hours'
      ) THEN
        INSERT INTO notifications (type, title, message, reference_type, reference_id)
        VALUES (
          'low_stock',
          'Low Stock Alert',
          COALESCE(NEW.name, 'A material') || ' is low (' || NEW.current_stock || ' ' ||
            COALESCE(NEW.unit, '') || ', min: ' || NEW.min_stock_level || ')',
          'material',
          NEW.id
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_low_stock skipped: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_low_stock ON materials;
CREATE TRIGGER trigger_notify_low_stock
  AFTER UPDATE OF current_stock ON materials
  FOR EACH ROW
  EXECUTE FUNCTION notify_low_stock();
