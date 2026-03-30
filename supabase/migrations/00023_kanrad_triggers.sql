-- ============================================================
-- Migration 00023 — Kanrad ERP business logic triggers
-- Run AFTER 00022_kanrad_schema.sql
-- ============================================================

-- ─── 1. QC gate: block packing if QC not passed ──────────────
CREATE OR REPLACE FUNCTION enforce_qc_gate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  packing_stage_id   UUID;
  qc_stage_id        UUID;
  qc_completed       BOOLEAN;
BEGIN
  SELECT id INTO packing_stage_id FROM production_stages WHERE slug = 'packing' LIMIT 1;
  SELECT id INTO qc_stage_id      FROM production_stages WHERE slug = 'quality_check' LIMIT 1;

  IF NEW.stage_id = packing_stage_id AND NEW.status IN ('in_progress', 'completed') THEN
    SELECT EXISTS (
      SELECT 1 FROM production_tracking
       WHERE order_id = NEW.order_id
         AND stage_id = qc_stage_id
         AND status = 'completed'
    ) INTO qc_completed;

    IF NOT qc_completed THEN
      RAISE EXCEPTION 'QC gate: Quality Check stage must be completed before packing can start.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qc_gate
  BEFORE INSERT OR UPDATE ON production_tracking
  FOR EACH ROW EXECUTE FUNCTION enforce_qc_gate();

-- ─── 2. Finished goods: auto-increment on packing completion ─
CREATE OR REPLACE FUNCTION on_packing_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  packing_stage_id UUID;
  v_style          TEXT;
  v_qty            NUMERIC;
BEGIN
  SELECT id INTO packing_stage_id FROM production_stages WHERE slug = 'packing' LIMIT 1;

  IF NEW.stage_id = packing_stage_id
     AND NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed') THEN

    SELECT o.style_name, COALESCE(NEW.output_qty, o.total_quantity, 0)
      INTO v_style, v_qty
      FROM orders o
     WHERE o.id = NEW.order_id
     LIMIT 1;

    IF v_style IS NOT NULL AND v_qty > 0 THEN
      INSERT INTO finished_goods (product_sku, product_name, qty_on_hand, unit)
      VALUES (
        'FG-' || UPPER(REPLACE(v_style, ' ', '-')),
        v_style,
        v_qty,
        'pcs'
      )
      ON CONFLICT (product_sku)
      DO UPDATE SET
        qty_on_hand = finished_goods.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_at  = NOW();

      INSERT INTO finished_goods_transactions
        (product_sku, txn_type, qty, ref_type, ref_id, notes)
      VALUES (
        'FG-' || UPPER(REPLACE(v_style, ' ', '-')),
        'in', v_qty, 'production_batch', NEW.order_id,
        'Auto: packing stage completed'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_packing_completed
  AFTER INSERT OR UPDATE ON production_tracking
  FOR EACH ROW EXECUTE FUNCTION on_packing_completed();

-- ─── 3. Finished goods: decrement on dispatch ────────────────
CREATE OR REPLACE FUNCTION on_order_dispatched()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_style  TEXT;
  v_sku    TEXT;
  v_qty    NUMERIC;
BEGIN
  IF NEW.status = 'dispatched' AND OLD.status != 'dispatched' THEN
    SELECT style_name, total_quantity
      INTO v_style, v_qty
      FROM orders
     WHERE id = NEW.id;

    v_sku := 'FG-' || UPPER(REPLACE(v_style, ' ', '-'));

    IF v_style IS NOT NULL THEN
      UPDATE finished_goods
         SET qty_on_hand = GREATEST(0, qty_on_hand - v_qty),
             updated_at  = NOW()
       WHERE product_sku = v_sku;

      INSERT INTO finished_goods_transactions
        (product_sku, txn_type, qty, ref_type, ref_id, notes)
      VALUES (v_sku, 'out', v_qty, 'dispatch', NEW.id, 'Auto: order dispatched');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_dispatched
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION on_order_dispatched();

-- ─── 4. Low stock alert for finished goods ───────────────────
CREATE OR REPLACE FUNCTION notify_low_finished_goods()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.qty_on_hand <= NEW.reorder_level AND NEW.reorder_level > 0 THEN
    INSERT INTO notifications (type, title, message, reference_type, reference_id)
    VALUES (
      'low_stock',
      'Low Finished Goods: ' || NEW.product_name,
      'Stock of ' || NEW.product_name || ' has fallen to ' ||
        NEW.qty_on_hand || ' ' || NEW.unit || ' (reorder level: ' ||
        NEW.reorder_level || ').',
      'finished_goods',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_low_finished_goods
  AFTER UPDATE ON finished_goods
  FOR EACH ROW EXECUTE FUNCTION notify_low_finished_goods();
