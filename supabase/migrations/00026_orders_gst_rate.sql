-- Add gst_rate to orders table (default 18% for cookware)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18;
