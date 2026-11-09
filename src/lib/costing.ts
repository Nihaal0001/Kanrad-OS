import { CIRCLE_WEIGHT_FACTOR } from "@/lib/circle-calc"

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

// ── Aluminium circles in BOMs ────────────────────────────────────────────────
// Circles are bought and priced per kg, but a BOM counts them in pieces. A BOM line in
// "pcs" for a kg-circle therefore costs  weight-per-piece × price-per-kg  and uses up
// weight-per-piece kg of stock. These helpers do that conversion in one place.


export interface CircleCostable {
  name?: string | null
  unit?: string | null
  cost_per_unit: number
  circle_type?: "ib" | "non_ib" | null
  weight_kg?: number | null
  diameter_mm?: number | null
  thickness_mm?: number | null
}

/** Size from a material name like "272X2.4" (diameter × thickness, mm). */
function sizeFromName(name: string | null | undefined): { dia: number; thick: number } | null {
  const m = (name ?? "").trim().match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/i)
  if (!m) return null
  const dia = Number(m[1])
  const thick = Number(m[2])
  // Sanity range so an unrelated "5x16" item is never read as a circle
  return dia >= 100 && thick > 0 && thick <= 10 ? { dia, thick } : null
}

/**
 * Weight of one piece (kg) for a kg-priced aluminium circle, or null when it isn't one or
 * the weight isn't known. IB circles use the weight entered on their PO; others use the
 * stored weight, else the size formula.
 */
export function circlePieceWeightKg(m: CircleCostable | null | undefined): number | null {
  if (!m || (m.unit ?? "") !== "kg") return null
  if (m.weight_kg && m.weight_kg > 0) return Number(m.weight_kg)
  if (m.circle_type === "ib") return null
  const dims =
    m.diameter_mm && m.thickness_mm
      ? { dia: Number(m.diameter_mm), thick: Number(m.thickness_mm) }
      : sizeFromName(m.name)
  return dims ? dims.dia * dims.dia * dims.thick * CIRCLE_WEIGHT_FACTOR : null
}

/** Price for ONE unit of a BOM line: per piece for a kg-circle counted in pcs, else the stored cost. */
export function bomUnitCost(m: CircleCostable | null | undefined, lineUnit: string | null | undefined): number {
  const base = effectiveCostPerUnit(m)
  const w = lineUnit === "pcs" ? circlePieceWeightKg(m) : null
  return w ? base * w : base
}

/** BOM line quantity expressed in the material's stock unit (pcs of a kg-circle → kg). */
export function bomQtyInStockUnit(
  qty: number,
  m: CircleCostable | null | undefined,
  lineUnit: string | null | undefined
): number {
  const w = lineUnit === "pcs" ? circlePieceWeightKg(m) : null
  return w ? qty * w : qty
}

/** The unit a BOM line should default to when this material is picked. */
export function defaultBomUnit(m: CircleCostable | null | undefined): string {
  return circlePieceWeightKg(m) ? "pcs" : m?.unit ?? "kg"
}
