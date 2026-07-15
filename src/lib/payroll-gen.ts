import { createAdminClient } from "@/lib/supabase/admin"
import { lateDeductionAmount, baseHourlyRate, workingDaysInMonth } from "@/lib/attendance-ot"

export { workingDaysInMonth }

/**
 * Generate draft payroll for every active worker for a full calendar month
 * (1st–last day) — including anyone with no salary on file yet, so they still
 * show up in the payroll list with real attendance/OT/deductions rather than
 * being silently skipped; their base_wage just reads 0 until a salary is set.
 * daily_wage = monthly_salary ÷ working days; days_present from attendance
 * (present = 1, half day = 0.5, rounded; Sundays excluded even if marked
 * present, since they're outside the working-day divisor). Overtime hours are
 * summed from attendance.overtime_hours (time worked outside the shift
 * window, including all Sunday hours — see calculateOvertime), paid at the
 * worker's profiles.ot_rate. Late-arrival and early-departure minutes
 * (attendance.late_minutes / early_minutes) are valued at the worker's BASE
 * hourly rate (monthly salary ÷ working days ÷ shift hours — not the OT rate)
 * and land in `deductions`, coming off base pay rather than reducing OT hours.
 * Skips workers who already have a payroll record for that period, so it
 * never overwrites manual edits. No auth — callers gate it.
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
    admin.from("profiles").select("id, monthly_salary, ot_rate, gender").eq("is_active", true),
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
    .map((w) => {
      const salary = w.monthly_salary ?? 0
      const hourlyRate = baseHourlyRate(salary, workingDays, w.gender as "male" | "female" | null)
      return {
        worker_id: w.id,
        period_start: periodStart,
        period_end: periodEnd,
        working_days: workingDays,
        days_present: Math.round(presentByWorker[w.id] ?? 0),
        overtime_hours: Math.round((overtimeByWorker[w.id] ?? 0) * 100) / 100,
        daily_wage: workingDays > 0 ? Math.round((salary / workingDays) * 100) / 100 : 0,
        overtime_rate: w.ot_rate ?? 0,
        deductions: lateDeductionAmount(deductibleMinutesByWorker[w.id] ?? 0, hourlyRate),
        bonus: 0,
        status: "draft" as const,
      }
    })

  const period = `${periodStart} → ${periodEnd}`
  if (rows.length === 0) return { count: 0, period }
  const { error } = await admin.from("payroll").insert(rows)
  if (error) return { error: error.message }
  return { count: rows.length, period }
}
