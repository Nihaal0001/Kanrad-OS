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

/** Value of what's on hand: stock × weighted-average cost (negative stock counts as zero). */
export function stockValue(m: { current_stock: number; cost_per_unit: number }): number {
  return Math.max(0, m.current_stock) * (m.cost_per_unit ?? 0)
}
