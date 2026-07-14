/**
 * Shift policy: everyone starts at 8:00 AM. Shift ends at 6:00 PM for male
 * workers, 5:00 PM for female workers. Time worked *outside* that window —
 * arriving early or leaving late — is overtime, paid at the worker's OT rate,
 * down to the minute (not rounded to whole hours). Time *missed inside* the
 * window — arriving late or leaving early — is valued at that same OT rate
 * and deducted from BASE pay as a payroll deduction, not netted out of the
 * OT hours themselves. The two are symmetric: every minute outside the shift
 * either earns OT or costs a deduction, never both.
 */

const SHIFT_START = "08:00"
const SHIFT_END: Record<"male" | "female", string> = {
  male: "18:00",
  female: "17:00",
}

export interface OvertimeResult {
  /** OT hours: early-arrival minutes before shift start + late-departure minutes after shift end. */
  overtimeHours: number
  /** Minutes late past 8:00 AM (0 if on time or early) — deducted from base pay. */
  lateMinutes: number
  /** Minutes checked out before shift end (0 if on time or stayed later) — deducted from base pay. */
  earlyMinutes: number
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

  const shiftStart = toMinutes(SHIFT_START)
  const shiftEnd = toMinutes(SHIFT_END[gender === "female" ? "female" : "male"])
  const inMinutes = toMinutes(checkIn)
  const outMinutes = toMinutes(checkOut)

  const lateMinutes = Math.max(0, inMinutes - shiftStart)
  const earlyMinutes = Math.max(0, shiftEnd - outMinutes)

  const earlyArrivalOtMinutes = Math.max(0, shiftStart - inMinutes)
  const lateDepartureOtMinutes = Math.max(0, outMinutes - shiftEnd)
  const overtimeMinutes = earlyArrivalOtMinutes + lateDepartureOtMinutes

  return {
    overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100,
    lateMinutes,
    earlyMinutes,
  }
}

/** ₹ value of late-arrival + early-departure minutes, valued at the worker's OT rate — subtracted from base pay. */
export function lateDeductionAmount(lateMinutes: number, otRate: number): number {
  return Math.round((lateMinutes / 60) * otRate * 100) / 100
}
