-- ============================================================================
-- Fine-grained page-level permissions
--
-- Access control was coarse: 11 broad "module" keys (dashboard, orders,
-- inventory, production, finance, hr, notifications, settings, users,
-- analytics, tasks) each gated a whole group of pages at once — e.g. granting
-- "finance" gave Finance + Costing + Outstanding + Tally Sync together, with
-- no way to grant just one.
--
-- This migration is purely ADDITIVE: it expands every existing grant (in
-- role_permissions, and in each user's profiles.department override) into
-- the full set of individual page keys that module covered, so no one's
-- access shrinks. It never deletes or renames an existing coarse row/token —
-- those keep working unchanged for the handful of server-side checks that
-- still read them directly (dashboard/users redirects, finance-import gate,
-- einvoice route, AI tool permission map).
--
-- Page keys mirror src/lib/permission-tree.ts MODULE_TO_PAGE_KEYS — keep both
-- in sync if the nav structure (src/lib/constants.ts `navigation`) changes.
--
-- Apply in the Supabase SQL editor.
-- ============================================================================

-- Part A — expand role_permissions: every role keeps its existing coarse
-- grants, and additionally gains every page key under each module it has.
WITH page_key_expansion(module, page_key) AS (
  VALUES
    ('dashboard','dashboard'), ('dashboard','market-intel'), ('dashboard','schedule'), ('dashboard','forecasting'),
    ('notifications','notifications'),
    ('orders','orders'), ('orders','logistics'),
    ('production','production'), ('production','rejections'),
    ('inventory','master-inventory'), ('inventory','inventory'),
    ('inventory','inventory:purchase-orders'), ('inventory','inventory:approvals'),
    ('inventory','warehouse'), ('inventory','products'),
    ('finance','finance'), ('finance','finance:costing'),
    ('finance','finance:outstanding'), ('finance','finance:tally'),
    ('hr','hr'), ('hr','hr:attendance'), ('hr','kiosk'),
    ('hr','hr:leaves'), ('hr','hr:payroll'), ('hr','hr:shifts'),
    ('settings','history'), ('settings','reach-out'), ('settings','issues'), ('settings','settings'),
    ('users','users')
)
INSERT INTO role_permissions (role, permission)
SELECT rp.role, pke.page_key
FROM role_permissions rp
JOIN page_key_expansion pke ON pke.module = rp.permission
ON CONFLICT DO NOTHING;

-- Part B — backfill profiles.department (per-user override). Rename the 3
-- tokens that drifted from their page's real slug, then expand any remaining
-- coarse module tokens (bare "inventory", "finance", etc.) into their full
-- page-key set the same way Part A did, so a user who had e.g. "inventory"
-- keeps every inventory page after the cutover to page-level filtering.
-- ("production_targets" has no matching page today — left as harmless inert text.)
WITH page_key_expansion(module, page_key) AS (
  VALUES
    ('dashboard','dashboard'), ('dashboard','market-intel'), ('dashboard','schedule'), ('dashboard','forecasting'),
    ('notifications','notifications'),
    ('orders','orders'), ('orders','logistics'),
    ('production','production'), ('production','rejections'),
    ('inventory','master-inventory'), ('inventory','inventory'),
    ('inventory','inventory:purchase-orders'), ('inventory','inventory:approvals'),
    ('inventory','warehouse'), ('inventory','products'),
    ('finance','finance'), ('finance','finance:costing'),
    ('finance','finance:outstanding'), ('finance','finance:tally'),
    ('hr','hr'), ('hr','hr:attendance'), ('hr','kiosk'),
    ('hr','hr:leaves'), ('hr','hr:payroll'), ('hr','hr:shifts'),
    ('settings','history'), ('settings','reach-out'), ('settings','issues'), ('settings','settings'),
    ('users','users')
),
renamed AS (
  SELECT id,
    ARRAY(
      SELECT DISTINCT CASE trim(tok)
        WHEN 'bom' THEN 'products'
        WHEN 'master_inventory' THEN 'master-inventory'
        WHEN 'purchase_orders' THEN 'inventory:purchase-orders'
        ELSE trim(tok)
      END
      FROM unnest(string_to_array(department, ',')) AS tok
    ) AS toks
  FROM profiles
  WHERE department IS NOT NULL AND department <> ''
),
expanded AS (
  SELECT r.id,
    ARRAY(
      SELECT DISTINCT x FROM (
        SELECT unnest(r.toks) AS x
        UNION
        SELECT pke.page_key FROM unnest(r.toks) AS t JOIN page_key_expansion pke ON pke.module = t
      ) u
    ) AS final_toks
  FROM renamed r
)
UPDATE profiles p SET department = array_to_string(e.final_toks, ',')
FROM expanded e WHERE p.id = e.id;
