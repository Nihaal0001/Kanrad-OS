-- Fix all tables that still have USING(true) / unauthenticated-access policies.
-- These were created as temporary open policies in early migrations and were
-- never tightened. Finance tables get role-based access; all others require auth.

-- ============================================================
-- Finance tables — finance or admin role only
-- (matches the pattern established in 00028_security_hardening)
-- ============================================================

DROP POLICY IF EXISTS "allow all expense_categories" ON expense_categories;
CREATE POLICY "expense_categories_finance_admin" ON expense_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  );

DROP POLICY IF EXISTS "allow all expenses" ON expenses;
CREATE POLICY "expenses_finance_admin" ON expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  );

DROP POLICY IF EXISTS "allow all purchase_invoices" ON purchase_invoices;
CREATE POLICY "purchase_invoices_finance_admin" ON purchase_invoices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  );

DROP POLICY IF EXISTS "allow all purchase_invoice_items" ON purchase_invoice_items;
CREATE POLICY "purchase_invoice_items_finance_admin" ON purchase_invoice_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  );

DROP POLICY IF EXISTS "allow all purchase_payments" ON purchase_payments;
CREATE POLICY "purchase_payments_finance_admin" ON purchase_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  );

DROP POLICY IF EXISTS "allow all chart_of_accounts" ON chart_of_accounts;
CREATE POLICY "chart_of_accounts_finance_admin" ON chart_of_accounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  );

DROP POLICY IF EXISTS "allow all journal_entries" ON journal_entries;
CREATE POLICY "journal_entries_finance_admin" ON journal_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  );

DROP POLICY IF EXISTS "allow all journal_entry_lines" ON journal_entry_lines;
CREATE POLICY "journal_entry_lines_finance_admin" ON journal_entry_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'finance')
    )
  );


-- ============================================================
-- Business data — authenticated users only
-- ============================================================

DROP POLICY IF EXISTS "allow all customers" ON customers;
CREATE POLICY "customers_authenticated" ON customers
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "allow all suppliers" ON suppliers;
CREATE POLICY "suppliers_authenticated" ON suppliers
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- Production & operations tables — authenticated users only
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can manage daily logs" ON production_daily_logs;
CREATE POLICY "production_daily_logs_authenticated" ON production_daily_logs
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "production_targets_authenticated" ON production_targets;
CREATE POLICY "production_targets_auth" ON production_targets
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rejections_authenticated" ON rejections;
CREATE POLICY "rejections_auth" ON rejections
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "issues_authenticated" ON issues;
CREATE POLICY "issues_auth" ON issues
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "warehouse_items_authenticated" ON warehouse_items;
CREATE POLICY "warehouse_items_auth" ON warehouse_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "shipments_authenticated" ON shipments;
CREATE POLICY "shipments_auth" ON shipments
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


-- Note: commodities and commodity_price_history policies are fixed at the source
-- in their respective migration files (not yet applied to production).
