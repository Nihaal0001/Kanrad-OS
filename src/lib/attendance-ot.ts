/**
 * Shift policy: everyone starts at 8:00 AM. Shift ends at 6:00 PM for male
 * workers, 5:00 PM for female workers — time worked past that is overtime,
 * paid in full at the worker's OT rate. Arriving after 8:00 AM is late; the
 * late minutes are valued at the same OT rate and deducted from BASE pay
 * (as a payroll deduction), not netted out of the OT hours themselves.
 */

const SHIFT_START = "08:00"
const SHIFT_END: Record<"male" | "female", string> = {
  male: "18:00",
  female: "17:00",
}

export interface OvertimeResult {
  /** Full OT hours worked past shift end — not reduced for lateness. */
  overtimeHours: number
  /** Minutes late past 8:00 AM (0 if on time or early). */
  lateMinutes: number
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + (m || 0)
}

/** Returns null if either punch time is missing — nothing to compute. */
export function calculateOvertime(
  gender: "male" | "female" | null | undefined,
  checkIn: string | null | undefined,
  checkOut: string | null | undefined
): OvertimeResult | null {
  if (!checkIn || !checkOut) return null

  const shiftEnd = SHIFT_END[gender === "female" ? "female" : "male"]
  const lateMinutes = Math.max(0, toMinutes(checkIn) - toMinutes(SHIFT_START))
  const overtimeMinutes = Math.max(0, toMinutes(checkOut) - toMinutes(shiftEnd))

  return {
    overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100,
    lateMinutes,
  }
}

/** ₹ value of late minutes, valued at the worker's OT rate — subtracted from base pay. */
export function lateDeductionAmount(lateMinutes: number, otRate: number): number {
  return Math.round((lateMinutes / 60) * otRate * 100) / 100
}
