/**
 * Shift policy: everyone starts at 8:00 AM. Shift ends at 6:00 PM for male
 * workers (10hr shift), 5:00 PM for female workers (9hr shift). Time worked
 * *outside* that window — arriving early or leaving late — is overtime, paid
 * at the worker's OT rate, down to the minute (not rounded to whole hours).
 * Time *missed inside* the window — arriving late or leaving early — is
 * valued at the worker's BASE hourly rate (monthly salary ÷ working days ÷
 * shift hours, not the OT rate) and deducted from base pay as a payroll
 * deduction, not netted out of the OT hours themselves. Lost time costs what
 * that time was actually worth to pay for; only extra time earns the OT
 * premium.
 */

const SHIFT_START = "08:00"
const SHIFT_END: Record<"male" | "female", string> = {
  male: "18:00",
  female: "17:00",
}
export const SHIFT_HOURS: Record<"male" | "female", number> = {
  male: 10,
  female: 9,
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

/** Working days in a month = total days minus Sundays. */
export function workingDaysInMonth(year: number, month0: number): number {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month0, d).getDay() !== 0) count++ // 0 = Sunday
  }
  return count
}

/** ₹/hour value of a worker's base salary: monthly salary ÷ working days ÷ shift hours. */
export function baseHourlyRate(
  monthlySalary: number,
  workingDays: number,
  gender: "male" | "female" | null | undefined
): number {
  if (workingDays <= 0) return 0
  const dailyWage = monthlySalary / workingDays
  const shiftHours = SHIFT_HOURS[gender === "female" ? "female" : "male"]
  return dailyWage / shiftHours
}

/** ₹ value of late-arrival + early-departure minutes, valued at the worker's BASE hourly rate — subtracted from base pay. */
export function lateDeductionAmount(lateMinutes: number, hourlyRate: number): number {
  return Math.round((lateMinutes / 60) * hourlyRate * 100) / 100
}
