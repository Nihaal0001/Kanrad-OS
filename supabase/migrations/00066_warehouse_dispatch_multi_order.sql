-- Dispatch no longer requires picking a single order first — it draws FIFO
-- across all in-warehouse stock for a SKU, which may span several orders
-- (or none, for unlinked/manual stock). An invoice is only created, and its
-- number only required, when the dispatch actually touches order-linked
-- stock — unlinked stock has no customer to invoice, so bill_no must be
-- nullable again (it was made NOT NULL in 00065 before this distinction
-- existed).
ALTER TABLE warehouse_dispatches ALTER COLUMN bill_no DROP NOT NULL;
