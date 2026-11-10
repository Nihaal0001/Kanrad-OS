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
 * Weight of one piece (kg) for an aluminium circle. Both IB and non-IB circles use the
 * same diameter x diameter x thickness formula when a stored calculated weight is absent.
 */
export function circlePieceWeightKg(m: CircleCostable | null | undefined): number | null {
  if (!m || (m.unit ?? "") !== "kg") return null
  const dims =
    m.diameter_mm && m.thickness_mm
      ? { dia: Number(m.diameter_mm), thick: Number(m.thickness_mm) }
      : sizeFromName(m.name)
  if (dims) return dims.dia * dims.dia * dims.thick * CIRCLE_WEIGHT_FACTOR
  return m.weight_kg && m.weight_kg > 0 ? Number(m.weight_kg) : null
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

// ── Circles stocked in pcs, ordered in kg ────────────────────────────────────
// A circle's stock unit is pcs. On a purchase order it is ordered in kg at a price per kg;
// the PO line stores the equivalent pieces (kg ÷ weight per piece) and price per piece, so
// receiving, stock and cost averaging all work in pcs.

/** True for aluminium circles: marked IB/non-IB, or a "272X2.4"-style size name. */
export function isCircleMaterial(m: CircleCostable | null | undefined): boolean {
  return !!m && (!!m.circle_type || sizeFromName(m.name) !== null)
}

/** Weight of one piece (kg): stored calculated weight, else the size formula for any circle type. */
export function circleWeightFor(m: CircleCostable | null | undefined): number | null {
  if (!m) return null
  const dims =
    m.diameter_mm && m.thickness_mm
      ? { dia: Number(m.diameter_mm), thick: Number(m.thickness_mm) }
      : sizeFromName(m.name)
  if (dims) return dims.dia * dims.dia * dims.thick * CIRCLE_WEIGHT_FACTOR
  return m.weight_kg && m.weight_kg > 0 ? Number(m.weight_kg) : null
}

/** Pieces and price per piece for a circle PO line ordered by kg. */
export function circleLineFromKg(kg: number, pricePerKg: number, weightPerPiece: number, ibPlatePrice = 0) {
  const pieces = Math.round(kg / weightPerPiece)
  return {
    pieces,
    unitPrice: Math.round((pricePerKg * weightPerPiece + ibPlatePrice) * 100) / 100,
    // The supplier's PO amount is based on the exact kg purchase. The IB plate
    // component is per estimated piece. Do not derive this from rounded pieces ×
    // rounded unit cost, which creates visible mismatches on the PO.
    lineAmount: Math.round((kg * pricePerKg + pieces * ibPlatePrice) * 100) / 100,
  }
}

/** IB circle price per piece = utensil weight x aluminium price per kg + IB plate price. */
export function ibCircleUnitPrice(weightKg: number, pricePerKg: number, ibPlatePrice: number) {
  return Math.round((weightKg * pricePerKg + ibPlatePrice) * 100) / 100
}
