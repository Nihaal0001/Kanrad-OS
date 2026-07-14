-- Enable RLS on hsn_master (was missing — table was publicly accessible)
ALTER TABLE hsn_master ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users; no write access via API (seeded data, managed via migrations)
CREATE POLICY "hsn_master_read_authenticated" ON hsn_master
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
