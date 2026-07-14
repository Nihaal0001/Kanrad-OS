-- Remove dummy clothing materials inserted by the initial seed file.
-- These were placeholder data for a garment company and are not relevant
-- to Deepam cookware production.

DELETE FROM materials WHERE sku IN (
  'FAB-CPOP-001', 'FAB-CJER-001', 'FAB-DNM-001', 'FAB-PLN-001',
  'FAB-RVS-001',  'FAB-ILK-001',
  'TRM-BTN-M15',  'TRM-BTN-P12',  'TRM-ZIP-008',  'TRM-ZIP-006',
  'TRM-ELS-100',  'TRM-SNP-018',  'TRM-HKE-001',
  'THR-POL-001',  'THR-COT-001',  'THR-OVL-001',  'THR-EMB-001',
  'LBL-CAR-001',  'LBL-BRD-001',  'LBL-SZE-001',
  'PKG-PLY-001',  'PKG-BOX-SML',  'PKG-BOX-LRG',  'PKG-TAG-HNG',  'PKG-TIS-001'
);

-- Remove the dummy garment categories (only if empty — safe if categories were reused)
DELETE FROM material_categories
WHERE name IN ('Fabric', 'Trims', 'Thread', 'Labels', 'Accessories')
  AND NOT EXISTS (
    SELECT 1 FROM materials WHERE category_id = material_categories.id
  );
