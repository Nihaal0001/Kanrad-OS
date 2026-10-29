-- dispatchWarehouseSku filters warehouse_items by sku + status, sorted by
-- entry_date (FIFO consumption), on every single dispatch — the hottest
-- warehouse write-path query. It had no supporting index (only order_id was
-- indexed), so it was a full table scan + sort as the warehouse grows.
CREATE INDEX IF NOT EXISTS idx_warehouse_items_sku_status_entry
  ON warehouse_items(sku, status, entry_date);
