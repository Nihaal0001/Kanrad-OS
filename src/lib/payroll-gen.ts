import { createAdminClient } from "@/lib/supabase/admin"
import { lateDeductionAmount } from "@/lib/attendance-ot"

/** Working days in a month = total days minus Sundays. */
export function workingDaysInMonth(year: number, month0: number): number {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month0, d).getDay() !== 0) count++ // 0 = Sunday
  }
  return count
}

/**
 * Generate draft payroll for every salaried, active worker for a full calendar
 * month (1st–last day). daily_wage = monthly_salary ÷ working days; days_present
 * from attendance (present = 1, half day = 0.5, rounded). Overtime hours are
 * summed from attendance.overtime_hours (full hours worked past shift end —
 * see calculateOvertime), paid at the worker's profiles.ot_rate. Late-arrival
 * and early-departure minutes (attendance.late_minutes / early_minutes) are
 * valued at that same OT rate and land in `deductions`, coming off base pay
 * rather than reducing OT hours. Skips workers who already have a payroll
 * record for that period, so it never overwrites manual edits. No auth —
 * callers gate it.
 */
export async function runMonthlyPayroll(
  year: number,
  month0: number
): Promise<{ count: number; period: string } | { error: string }> {
  const admin = createAdminClient()
  const mm = String(month0 + 1).padStart(2, "0")
  const lastDay = new Date(year, month0 + 1, 0).getDate()
  const periodStart = `${year}-${mm}-01`
  const periodEnd = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`
  const workingDays = workingDaysInMonth(year, month0)

  const [{ data: workers }, { data: existing }] = await Promise.all([
    admin.from("profiles").select("id, monthly_salary, ot_rate").eq("is_active", true).gt("monthly_salary", 0),
    admin.from("payroll").select("worker_id").eq("period_start", periodStart).eq("period_end", periodEnd),
  ])

  // PostgREST enforces a hard per-request row cap (1000 on this project) that
  // a client-side .limit() can't override — a plant this size produces
  // ~1300+ attendance rows/month, so an unpaginated fetch silently drops the
  // back half of the month. Page through with .range() instead.
  const attendance: { worker_id: string; date: string; status: string; overtime_hours: number | null; late_minutes: number | null; early_minutes: number | null }[] = []
  const PAGE_SIZE = 1000
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error } = await admin
      .from("attendance")
      .select("worker_id, date, status, overtime_hours, late_minutes, early_minutes")
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { error: error.message }
    attendance.push(...(page ?? []))
    if (!page || page.length < PAGE_SIZE) break
  }

  const presentByWorker: Record<string, number> = {}
  const overtimeByWorker: Record<string, number> = {}
  const deductibleMinutesByWorker: Record<string, number> = {}
  for (const a of attendance) {
    // Sundays aren't working days (excluded from workingDaysInMonth, the
    // divisor for daily_wage), so attendance on a Sunday is pure overtime —
    // it must not also inflate days_present, or base pay ends up covering
    // days beyond the month's actual working-day count.
    const isSunday = new Date(a.date + "T00:00:00").getDay() === 0
    const add = isSunday ? 0 : a.status === "present" ? 1 : a.status === "half_day" ? 0.5 : 0
    if (add > 0) presentByWorker[a.worker_id] = (presentByWorker[a.worker_id] ?? 0) + add
    if (a.overtime_hours) overtimeByWorker[a.worker_id] = (overtimeByWorker[a.worker_id] ?? 0) + Number(a.overtime_hours)
    const minutes = Number(a.late_minutes ?? 0) + Number(a.early_minutes ?? 0)
    if (minutes) deductibleMinutesByWorker[a.worker_id] = (deductibleMinutesByWorker[a.worker_id] ?? 0) + minutes
  }
  const alreadyDone = new Set((existing ?? []).map((p) => p.worker_id))

  const rows = (workers ?? [])
    .filter((w) => !alreadyDone.has(w.id))
    .map((w) => ({
      worker_id: w.id,
      period_start: periodStart,
      period_end: periodEnd,
      working_days: workingDays,
      days_present: Math.round(presentByWorker[w.id] ?? 0),
      overtime_hours: Math.round((overtimeByWorker[w.id] ?? 0) * 100) / 100,
      daily_wage: workingDays > 0 ? Math.round((w.monthly_salary / workingDays) * 100) / 100 : 0,
      overtime_rate: w.ot_rate ?? 0,
      deductions: lateDeductionAmount(deductibleMinutesByWorker[w.id] ?? 0, w.ot_rate ?? 0),
      bonus: 0,
      status: "draft" as const,
    }))

  const period = `${periodStart} → ${periodEnd}`
  if (rows.length === 0) return { count: 0, period }
  const { error } = await admin.from("payroll").insert(rows)
  if (error) return { error: error.message }
  return { count: rows.length, period }
}
