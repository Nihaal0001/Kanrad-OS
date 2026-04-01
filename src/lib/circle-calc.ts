/**
 * Circle weight calculation for non-IB aluminium circles.
 *
 * Formula: diameter × diameter × thickness × CIRCLE_WEIGHT_FACTOR = weight (kg)
 * where diameter and thickness are in millimetres.
 *
 * The constant 0.000002127 is derived from:
 *   π/4 × density_of_aluminium(2.7 g/cm³) × unit_conversion(mm→kg)
 *
 * ─── Making this configurable ────────────────────────────────────────────────
 * Currently the factor is a hard constant below. To make it editable without
 * a code deploy, store it in Supabase:
 *
 *   CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
 *   INSERT INTO settings VALUES ('circle_weight_factor', '0.000002127');
 *
 * Then fetch it at runtime:
 *   const { data } = await supabase.from("settings")
 *     .select("value").eq("key", "circle_weight_factor").single()
 *   const factor = parseFloat(data?.value ?? "0.000002127")
 *
 * Pass it as an optional 4th argument to calculateCircleWeight().
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Default weight factor. Change this constant — or make it DB-driven — to update the formula. */
export const CIRCLE_WEIGHT_FACTOR = 0.000002127

/**
 * Returns true if the coating/finish value indicates an IB (Induction Base/Bottom) circle.
 *
 * IB circles are excluded from the standard weight calculation by business rule.
 * Handles common variants: "IB", "IB Coating", "Nonstick IB", "INDUCTION BASE".
 * Explicitly does NOT match "Non-IB".
 */
export function isIBCoating(coating: string | null | undefined): boolean {
  const upper = (coating ?? "").trim().toUpperCase()
  if (!upper) return false
  // "Non-IB" explicitly starts with "NON" — not an IB circle
  if (upper.startsWith("NON")) return false
  return upper.includes("IB") || upper.includes("INDUCTION")
}

/**
 * Calculates the weight (kg) of a non-IB aluminium circle.
 *
 * Returns null — meaning "not applicable" — when:
 *   - The coating is IB (excluded by business rule)
 *   - diameter or thickness is missing, non-numeric, or ≤ 0
 *
 * @param diameter   Circle diameter in mm (accepts number or string like "240" or "240mm")
 * @param thickness  Circle thickness in mm (accepts number or string like "3" or "3mm")
 * @param coating    Coating/finish label stored in the `color` field (e.g., "IB", "Nonstick")
 * @param factor     Override the default weight factor (for configurable/test scenarios)
 */
export function calculateCircleWeight(
  diameter: number | string | null | undefined,
  thickness: number | string | null | undefined,
  coating: string | null | undefined,
  factor: number = CIRCLE_WEIGHT_FACTOR
): number | null {
  // Business rule: IB circles are excluded from this calculation
  if (isIBCoating(coating)) return null

  // Parse strings — strip unit suffixes like "mm"
  const dia = typeof diameter === "string" ? parseFloat(diameter) : diameter
  const thick = typeof thickness === "string" ? parseFloat(thickness) : thickness

  // Reject missing or invalid values
  if (dia == null || thick == null) return null
  if (!Number.isFinite(dia) || !Number.isFinite(thick)) return null
  if (dia <= 0 || thick <= 0) return null

  return dia * dia * thick * factor
}

/**
 * Returns true when a line item's quantity is measured in kg (not pcs).
 * This is the case for non-IB aluminium circles — i.e., thickness_mm is set and coating is not IB.
 */
export function isCircleKgItem(
  thickness_mm: number | null | undefined,
  coating: string | null | undefined
): boolean {
  if (!thickness_mm || thickness_mm <= 0) return false
  return !isIBCoating(coating)
}

/**
 * Converts a kg quantity to number of pieces for a non-IB circle.
 *
 * pieces = totalKg ÷ (dia × dia × thick × factor)
 *
 * Returns null if the weight per piece cannot be calculated (IB, missing dims, etc.)
 */
export function kgToPieces(
  totalKg: number | null | undefined,
  diameter: number | string | null | undefined,
  thickness: number | string | null | undefined,
  coating: string | null | undefined
): number | null {
  if (!totalKg || totalKg <= 0) return null
  const weightPerPiece = calculateCircleWeight(diameter, thickness, coating)
  if (!weightPerPiece || weightPerPiece <= 0) return null
  return Math.round(totalKg / weightPerPiece)
}

/**
 * Formats a circle weight for display (e.g., "2.312 kg").
 * Returns null if the weight cannot be calculated.
 */
export function formatCircleWeight(
  diameter: number | string | null | undefined,
  thickness: number | string | null | undefined,
  coating: string | null | undefined
): string | null {
  const weight = calculateCircleWeight(diameter, thickness, coating)
  if (weight === null) return null
  return `${weight.toFixed(3)} kg`
}
