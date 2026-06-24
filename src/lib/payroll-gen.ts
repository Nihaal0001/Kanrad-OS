import { createAdminClient } from "@/lib/supabase/admin"

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
 * from attendance (present = 1, half day = 0.5, rounded). Overtime defaults to 0
 * (optional, edited per record). Skips workers who already have a payroll record
 * for that period, so it never overwrites manual edits. No auth — callers gate it.
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

  const [{ data: workers }, { data: attendance }, { data: existing }] = await Promise.all([
    admin.from("profiles").select("id, monthly_salary").eq("is_active", true).gt("monthly_salary", 0),
    admin.from("attendance").select("worker_id, status").gte("date", periodStart).lte("date", periodEnd),
    admin.from("payroll").select("worker_id").eq("period_start", periodStart).eq("period_end", periodEnd),
  ])

  const presentByWorker: Record<string, number> = {}
  for (const a of attendance ?? []) {
    const add = a.status === "present" ? 1 : a.status === "half_day" ? 0.5 : 0
    if (add > 0) presentByWorker[a.worker_id] = (presentByWorker[a.worker_id] ?? 0) + add
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
      overtime_hours: 0,
      daily_wage: workingDays > 0 ? Math.round((w.monthly_salary / workingDays) * 100) / 100 : 0,
      overtime_rate: 0,
      deductions: 0,
      bonus: 0,
      status: "draft" as const,
    }))

  const period = `${periodStart} → ${periodEnd}`
  if (rows.length === 0) return { count: 0, period }
  const { error } = await admin.from("payroll").insert(rows)
  if (error) return { error: error.message }
  return { count: rows.length, period }
}
