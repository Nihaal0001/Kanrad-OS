-- Aluminium circles are STOCKED and RECEIVED in pcs, but ORDERED in kg on purchase orders.
--   * purchase_order_items keeps the kg order (quantity_kg, price_per_kg); quantity_ordered / unit_price
--     hold the pieces and the price per piece, so receiving, stock and cost averaging are all in pcs.
--   * IB circles are ordered the same way; the IB plate price (per piece) is entered separately and
--     added to the piece price:  price per piece = weight x price per kg + IB plate price.
--   * Existing kg-unit circles are converted to pcs here (stock, minimum, cost, batches, history,
--     BOM lines, PO lines) using the weight per piece:
--        stored weight_kg, else (non-IB / unmarked) diameter x diameter x thickness x 0.000002127.
--     IB circles with no weight yet cannot be converted; they switch to pcs with cost reset to 0
--     (their next PO sets the weight and price) — they hold no stock today.

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS quantity_kg  NUMERIC(12,3) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC(10,2) DEFAULT NULL,
  -- IB circles: price of the induction-base plate per piece, added on top of weight x price per kg
  ADD COLUMN IF NOT EXISTS ib_plate_price NUMERIC(10,2) DEFAULT NULL;

DO $$
DECLARE
  r  RECORD;
  d  NUMERIC;
  t  NUMERIC;
  fw NUMERIC;   -- weight from the size formula
  w  NUMERIC;   -- weight used to convert (NULL = unknown)
  mm TEXT[];
BEGIN
  FOR r IN SELECT * FROM materials WHERE unit = 'kg' LOOP
    d := r.diameter_mm;
    t := r.thickness_mm;
    IF d IS NULL OR t IS NULL THEN
      mm := regexp_match(trim(r.name), '^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)$');
      d := NULL; t := NULL;
      IF mm IS NOT NULL AND mm[1]::numeric >= 100 AND mm[2]::numeric <= 10 THEN
        d := mm[1]::numeric; t := mm[2]::numeric;
      END IF;
    END IF;

    -- only aluminium circles: marked IB/non-IB, or a "272X2.4"-style size name
    IF r.circle_type IS NULL AND (d IS NULL OR t IS NULL) THEN CONTINUE; END IF;

    fw := CASE WHEN d IS NOT NULL AND t IS NOT NULL THEN d * d * t * 0.000002127 END;
    w  := CASE WHEN r.weight_kg > 0 THEN r.weight_kg
               WHEN r.circle_type IS DISTINCT FROM 'ib' THEN fw
          END;

    IF w IS NOT NULL THEN
      UPDATE materials SET
        unit           = 'pcs',
        weight_kg      = round(w, 4),
        current_stock  = round(current_stock / w, 0),
        min_stock_level = round(min_stock_level / w, 0),
        cost_per_unit  = round(cost_per_unit * w, 2)
      WHERE id = r.id;

      UPDATE stock_batches
         SET quantity_remaining = round(quantity_remaining / w, 0),
             unit_cost          = round(unit_cost * w, 2)
       WHERE material_id = r.id;

      UPDATE stock_transactions SET quantity = round(quantity / w, 0) WHERE material_id = r.id;

      UPDATE purchase_order_receipts rc SET quantity = round(rc.quantity / w, 0)
        FROM purchase_order_items poi
       WHERE rc.purchase_order_item_id = poi.id AND poi.material_id = r.id;

      UPDATE purchase_order_items SET
        quantity_kg       = quantity_ordered,
        price_per_kg      = unit_price,
        weight_kg         = round(w, 4),
        quantity_received = round(quantity_received / w, 0),
        unit_price        = round(unit_price * w, 2),
        quantity_ordered  = round(quantity_ordered / w, 0)
      WHERE material_id = r.id;

      UPDATE bom_items SET qty_required = round(qty_required / w, 4), unit = 'pcs'
       WHERE material_id = r.id AND unit = 'kg';

    ELSIF r.current_stock = 0 THEN
      -- IB circle, weight not recorded yet: nothing to convert (no stock); its next PO sets weight and price
      UPDATE materials SET unit = 'pcs', cost_per_unit = 0 WHERE id = r.id;
      -- BOM lines typed in kg: use the size-formula weight as the best available figure
      IF fw IS NOT NULL THEN
        UPDATE bom_items SET qty_required = round(qty_required / fw, 2), unit = 'pcs'
         WHERE material_id = r.id AND unit = 'kg';
      END IF;
    END IF;
  END LOOP;
END $$;
