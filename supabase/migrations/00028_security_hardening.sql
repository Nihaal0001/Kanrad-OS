-- ============================================================
-- Security hardening migration
-- Fixes: storage bucket exposure, open RLS policies,
--        and missing role-based access on sensitive tables.
-- ============================================================

-- ============================================================
-- 1. Make finance-documents bucket private (Finding #2)
--    Files are financial documents — not for public access.
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'finance-documents';

-- Allow authenticated users with finance/admin role to read objects
-- (application uses signed URLs generated server-side via admin client)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'finance_docs_select'
  ) THEN
    CREATE POLICY "finance_docs_select" ON storage.objects FOR SELECT
      USING (
        bucket_id = 'finance-documents'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          LEFT JOIN public.role_permissions rp ON rp.role = p.role
          WHERE p.auth_id = auth.uid()
            AND (p.role = 'admin' OR rp.permission = 'finance')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'finance_docs_insert'
  ) THEN
    CREATE POLICY "finance_docs_insert" ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'finance-documents'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          LEFT JOIN public.role_permissions rp ON rp.role = p.role
          WHERE p.auth_id = auth.uid()
            AND (p.role = 'admin' OR rp.permission = 'finance')
        )
      );
  END IF;
END $$;


-- ============================================================
-- 2. Fix audit_logs RLS — append-only for authenticated users,
--    admin-only for reads, no updates or deletes (Finding #8)
-- ============================================================

DROP POLICY IF EXISTS "allow all audit_logs" ON audit_logs;

-- Only admins can read audit logs
CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

-- Any authenticated user can insert audit log entries (server actions do this)
CREATE POLICY "audit_logs_insert_authenticated" ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- No UPDATE or DELETE policies — audit logs are intentionally append-only


-- ============================================================
-- 3. Fix finance_import_batches RLS — own records only (Finding #8)
-- ============================================================

DROP POLICY IF EXISTS "allow all finance_import_batches" ON finance_import_batches;

CREATE POLICY "finance_import_batches_own" ON finance_import_batches
  FOR ALL
  USING (
    created_by = (SELECT id FROM profiles WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    created_by = (SELECT id FROM profiles WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 4. Fix finance_import_items RLS — own batch records only (Finding #8)
-- ============================================================

DROP POLICY IF EXISTS "allow all finance_import_items" ON finance_import_items;

CREATE POLICY "finance_import_items_own_batch" ON finance_import_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM finance_import_batches b
      WHERE b.id = batch_id
        AND (
          b.created_by = (SELECT id FROM profiles WHERE auth_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_import_batches b
      WHERE b.id = batch_id
        AND (
          b.created_by = (SELECT id FROM profiles WHERE auth_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
        )
    )
  );


-- ============================================================
-- 5. Role-based RLS on payroll — HR or admin only (Finding #9)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated access to payroll" ON payroll;

CREATE POLICY "payroll_hr_admin" ON payroll
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_permissions rp ON rp.role = p.role
      WHERE p.auth_id = auth.uid()
        AND (p.role = 'admin' OR rp.permission = 'hr')
    )
  );


-- ============================================================
-- 6. Role-based RLS on invoices — finance or admin only (Finding #9)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated access to invoices" ON invoices;

CREATE POLICY "invoices_finance_admin" ON invoices
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
-- 7. Role-based RLS on invoice_items — finance or admin only (Finding #9)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated access to invoice_items" ON invoice_items;

CREATE POLICY "invoice_items_finance_admin" ON invoice_items
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
-- 8. Role-based RLS on payments — finance or admin only (Finding #9)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated access to payments" ON payments;

CREATE POLICY "payments_finance_admin" ON payments
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
-- 9. Role-based RLS on order_costings — finance or admin only (Finding #9)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated access to order_costings" ON order_costings;

CREATE POLICY "order_costings_finance_admin" ON order_costings
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
