-- ============================================
-- JUST CLOTHING ERP — Phase 8: Auth + RLS
-- ============================================
-- Run this in your Supabase SQL Editor AFTER
-- enabling Email auth in Authentication → Providers.
-- Disable "Confirm email" in Auth → Settings for
-- an internal app (no email server needed).
-- ============================================

-- ============================================
-- 1. Link profiles to Supabase Auth users
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_id_idx ON profiles(auth_id) WHERE auth_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email) WHERE email IS NOT NULL;

-- ============================================
-- 2. Auto-create profile on new auth user signup
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
BEGIN
  -- Check if a profile already exists with this email (manually inserted workers, etc.)
  SELECT id INTO existing_id FROM public.profiles WHERE email = NEW.email LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- Link existing profile to the auth user
    UPDATE public.profiles SET auth_id = NEW.id WHERE id = existing_id;
  ELSE
    -- Create a new profile
    INSERT INTO public.profiles (auth_id, full_name, email, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'worker'  -- always start with minimum privilege; admin grants elevated roles manually
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================
-- 3. Update RLS: require authentication
--    Drop the old "allow all" policies and
--    replace with "authenticated users only"
-- ============================================

-- profiles
DROP POLICY IF EXISTS "Allow all access to profiles" ON profiles;
CREATE POLICY "Authenticated access to profiles" ON profiles FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- buyers
DROP POLICY IF EXISTS "Allow all access to buyers" ON buyers;
CREATE POLICY "Authenticated access to buyers" ON buyers FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- orders
DROP POLICY IF EXISTS "Allow all access to orders" ON orders;
CREATE POLICY "Authenticated access to orders" ON orders FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- order_items
DROP POLICY IF EXISTS "Allow all access to order_items" ON order_items;
CREATE POLICY "Authenticated access to order_items" ON order_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- order_materials
DROP POLICY IF EXISTS "Allow all access to order_materials" ON order_materials;
CREATE POLICY "Authenticated access to order_materials" ON order_materials FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- material_categories
DROP POLICY IF EXISTS "Allow all access to material_categories" ON material_categories;
CREATE POLICY "Authenticated access to material_categories" ON material_categories FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- materials
DROP POLICY IF EXISTS "Allow all access to materials" ON materials;
CREATE POLICY "Authenticated access to materials" ON materials FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stock_transactions
DROP POLICY IF EXISTS "Allow all access to stock_transactions" ON stock_transactions;
CREATE POLICY "Authenticated access to stock_transactions" ON stock_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- purchase_orders
DROP POLICY IF EXISTS "Allow all access to purchase_orders" ON purchase_orders;
CREATE POLICY "Authenticated access to purchase_orders" ON purchase_orders FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- purchase_order_items
DROP POLICY IF EXISTS "Allow all access to purchase_order_items" ON purchase_order_items;
CREATE POLICY "Authenticated access to purchase_order_items" ON purchase_order_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- production_stages
DROP POLICY IF EXISTS "Allow all access to production_stages" ON production_stages;
CREATE POLICY "Authenticated access to production_stages" ON production_stages FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- production_tracking
DROP POLICY IF EXISTS "Allow all access to production_tracking" ON production_tracking;
CREATE POLICY "Authenticated access to production_tracking" ON production_tracking FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- quality_checks
DROP POLICY IF EXISTS "Allow all access to quality_checks" ON quality_checks;
CREATE POLICY "Authenticated access to quality_checks" ON quality_checks FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tasks
DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;
CREATE POLICY "Authenticated access to tasks" ON tasks FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- notifications
DROP POLICY IF EXISTS "Allow all access to notifications" ON notifications;
CREATE POLICY "Authenticated access to notifications" ON notifications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- invoices
DROP POLICY IF EXISTS "Allow all access to invoices" ON invoices;
CREATE POLICY "Authenticated access to invoices" ON invoices FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- invoice_items
DROP POLICY IF EXISTS "Allow all access to invoice_items" ON invoice_items;
CREATE POLICY "Authenticated access to invoice_items" ON invoice_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payments
DROP POLICY IF EXISTS "Allow all access to payments" ON payments;
CREATE POLICY "Authenticated access to payments" ON payments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- order_costings
DROP POLICY IF EXISTS "Allow all access to order_costings" ON order_costings;
CREATE POLICY "Authenticated access to order_costings" ON order_costings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- shifts
DROP POLICY IF EXISTS "Allow all access to shifts" ON shifts;
CREATE POLICY "Authenticated access to shifts" ON shifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- worker_shifts
DROP POLICY IF EXISTS "Allow all access to worker_shifts" ON worker_shifts;
CREATE POLICY "Authenticated access to worker_shifts" ON worker_shifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- attendance
DROP POLICY IF EXISTS "Allow all access to attendance" ON attendance;
CREATE POLICY "Authenticated access to attendance" ON attendance FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- leaves
DROP POLICY IF EXISTS "Allow all access to leaves" ON leaves;
CREATE POLICY "Authenticated access to leaves" ON leaves FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payroll
DROP POLICY IF EXISTS "Allow all access to payroll" ON payroll;
CREATE POLICY "Authenticated access to payroll" ON payroll FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
