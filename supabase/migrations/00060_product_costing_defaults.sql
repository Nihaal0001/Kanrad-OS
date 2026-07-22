-- Saved defaults for the Product Costing calculator, so labor/overhead/other
-- cost and target margin don't need re-entering every time a product is
-- reopened there.
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS labor_cost_per_unit NUMERIC(10,2);
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS overhead_cost_per_unit NUMERIC(10,2);
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS other_cost_per_unit NUMERIC(10,2);
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS margin_pct NUMERIC(5,2);
