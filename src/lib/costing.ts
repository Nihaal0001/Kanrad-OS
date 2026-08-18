export interface CostableMaterial {
  cost_per_unit: number
}

/**
 * The price BOM/product costing should use for a material — its stored
 * weighted-average cost per unit.
 */
export function effectiveCostPerUnit(mat: CostableMaterial | null | undefined): number {
  return mat?.cost_per_unit ?? 0
}
