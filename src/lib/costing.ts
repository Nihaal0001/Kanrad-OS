export interface CostableMaterial {
  cost_per_unit: number
  max_price?: number | null
}

/**
 * The price BOM/product costing should use for a material: the last PO
 * price once one has been recorded (via PO creation or receipt), falling
 * back to the admin-set max price ceiling until then. Either way the
 * result never exceeds the ceiling — cost_per_unit can drift above it
 * (e.g. a weighted-average receipt, or the ceiling being lowered after
 * the fact), and costing should never reflect more than the ceiling.
 */
export function effectiveCostPerUnit(mat: CostableMaterial | null | undefined): number {
  if (!mat) return 0
  const ceiling = mat.max_price ?? null
  const hasCeiling = ceiling != null && ceiling > 0
  if (mat.cost_per_unit > 0) {
    return hasCeiling ? Math.min(mat.cost_per_unit, ceiling) : mat.cost_per_unit
  }
  return hasCeiling ? ceiling : 0
}
