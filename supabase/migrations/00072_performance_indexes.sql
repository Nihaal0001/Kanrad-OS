-- Performance SOP phase 1: FK / filter / order-by indexes and pg_trgm search indexes.
-- Every statement is guarded so a table or column that does not exist is skipped, not fatal.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('b','attendance','worker_id',''),
    ('b','attendance','date',''),
    ('b','bom_items','bom_id',''),
    ('b','bom_items','material_id',''),
    ('b','expenses','category_id',''),
    ('b','expenses','order_id',''),
    ('b','expenses','expense_date',''),
    ('b','invoice_items','invoice_id',''),
    ('b','invoices','buyer_id',''),
    ('b','invoices','customer_id',''),
    ('b','invoices','order_id',''),
    ('b','invoices','status',''),
    ('b','invoices','issue_date',''),
    ('b','invoices','due_date',''),
    ('b','invoices','created_at',''),
    ('b','leaves','worker_id',''),
    ('b','order_costings','order_id',''),
    ('b','orders','bom_id',''),
    ('b','orders','customer_id',''),
    ('b','orders','status',''),
    ('b','orders','created_at',''),
    ('b','payments','invoice_id',''),
    ('b','payments','payment_date',''),
    ('b','payroll','worker_id',''),
    ('b','production_daily_logs','order_id',''),
    ('b','production_daily_logs','log_date',''),
    ('b','production_tracking','assigned_to',''),
    ('b','purchase_invoice_items','purchase_invoice_id',''),
    ('b','purchase_invoices','purchase_order_id',''),
    ('b','purchase_invoices','status',''),
    ('b','purchase_invoices','invoice_date',''),
    ('b','purchase_invoices','due_date',''),
    ('b','purchase_orders','supplier_id',''),
    ('b','purchase_orders','status',''),
    ('b','purchase_orders','created_at',''),
    ('b','purchase_payments','purchase_invoice_id',''),
    ('b','purchase_payments','payment_date',''),
    ('b','shipments','order_id',''),
    ('b','stock_transactions','created_at',''),
    ('b','stock_transactions','material_id',''),
    ('b','tasks','stage_id',''),
    ('b','tasks','status',''),
    ('b','worker_shifts','shift_id',''),
    ('b','worker_shifts','worker_id',''),
    ('b','commodity_price_history','supplier_id',''),
    ('b','notifications','created_at',''),
    ('b','warehouse_dispatches','created_at',''),
    ('p','customers','name','is_active = true'),
    ('p','materials','name','is_active = true'),
    ('p','workers','full_name','is_active = true'),
    ('t','orders','order_number',''),
    ('t','orders','product_variant',''),
    ('t','customers','name',''),
    ('t','customers','company',''),
    ('t','customers','gstin',''),
    ('t','materials','name',''),
    ('t','materials','sku',''),
    ('t','suppliers','name',''),
    ('t','workers','full_name',''),
    ('t','purchase_orders','po_number',''),
    ('t','invoices','customer_name','')
  ) AS v(kind, tbl, col, pred)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.col) THEN
      IF r.kind = 'b' THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)', 'idx_' || r.tbl || '_' || r.col, r.tbl, r.col);
      ELSIF r.kind = 'p' THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%I) WHERE %s', 'idx_' || r.tbl || '_' || r.col || '_active', r.tbl, r.col, r.pred);
      ELSE
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING gin (%I gin_trgm_ops)', 'idx_' || r.tbl || '_' || r.col || '_trgm', r.tbl, r.col);
      END IF;
    END IF;
  END LOOP;
END $$;
