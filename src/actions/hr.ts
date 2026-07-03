"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runMonthlyPayroll } from "@/lib/payroll-gen"
import {
  attendanceSchema,
  leaveSchema,
  shiftSchema,
  payrollSchema,
  type AttendanceFormData,
  type LeaveFormData,
  type ShiftFormData,
  type PayrollFormData,
} from "@/lib/validators/hr"

// ===== Workers (profiles) =====

export const getWorkers = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, department, is_active, monthly_salary, gender, ot_rate")
      .eq("is_active", true)
      .order("full_name")
    if (error) throw new Error(error.message)
    return data ?? []
  },
  ["workers"],
  { tags: ["workers"], revalidate: 300 }
)

/** Set monthly salary for one or more workers. */
export async function setWorkerSalaries(updates: { id: string; monthly_salary: number }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  let updated = 0
  for (const u of updates) {
    const salary = Number.isFinite(u.monthly_salary) && u.monthly_salary >= 0 ? u.monthly_salary : 0
    const { error } = await admin.from("profiles").update({ monthly_salary: salary }).eq("id", u.id)
    if (!error) updated++
  }

  revalidateTag("workers", {})
  revalidatePath("/hr/payroll")
  return { updated }
}

/** Set gender (male/female — determines shift window: 8am-6pm vs 8am-5pm)
 *  and per-hour OT rate for one or more workers. */
export async function setWorkerGenderAndOT(
  updates: { id: string; gender: "male" | "female" | null; ot_rate: number }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  let updated = 0
  for (const u of updates) {
    const ot_rate = Number.isFinite(u.ot_rate) && u.ot_rate >= 0 ? u.ot_rate : 0
    const { error } = await admin
      .from("profiles")
      .update({ gender: u.gender, ot_rate })
      .eq("id", u.id)
    if (!error) updated++
  }

  revalidateTag("workers", {})
  revalidatePath("/hr/attendance")
  revalidatePath("/hr/payroll")
  return { updated }
}

/**
 * Live monthly payroll register: every worker with their monthly salary, days
 * present/absent from attendance, and salary payable for the days worked.
 * `month` is "YYYY-MM" (defaults to the current month).
 */
/** "YYYY-MM" only — guards against partial/invalid values from the native
 *  month <input> (it fires onChange mid-keystroke in some browsers). */
function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

export async function getPayrollRegister(month?: string) {
  const admin = createAdminClient()
  const now = new Date()
  const useMonth = month && isValidMonth(month) ? month : undefined
  const [y, m] = useMonth
    ? useMonth.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1]
  const month0 = m - 1
  const mm = String(m).padStart(2, "0")
  const lastDay = new Date(y, m, 0).getDate()
  const periodStart = `${y}-${mm}-01`
  const periodEnd = `${y}-${mm}-${String(lastDay).padStart(2, "0")}`

  // working days = days in month minus Sundays
  let workingDays = 0
  for (let d = 1; d <= lastDay; d++) if (new Date(y, month0, d).getDay() !== 0) workingDays++

  const attendanceP = admin.from("attendance").select("worker_id, status").gte("date", periodStart).lte("date", periodEnd)

  // Order by roll number (sheet order); fall back to name if the roll_no column
  // hasn't been added yet (migration 00040 not applied).
  type WRow = { id: string; full_name: string; department: string | null; monthly_salary: number | null; roll_no?: number | null }
  const primary = await admin
    .from("profiles")
    .select("id, full_name, department, monthly_salary, roll_no")
    .eq("is_active", true)
    .order("roll_no", { ascending: true, nullsFirst: false })
    .order("full_name")
  let workers = (primary.data ?? []) as WRow[]
  if (primary.error) {
    const fb = await admin
      .from("profiles")
      .select("id, full_name, department, monthly_salary")
      .eq("is_active", true)
      .order("full_name")
    workers = (fb.data ?? []) as WRow[]
  }
  const { data: attendance } = await attendanceP

  const present: Record<string, number> = {}
  for (const a of attendance ?? []) {
    const add = a.status === "present" ? 1 : a.status === "half_day" ? 0.5 : 0
    if (add > 0) present[a.worker_id] = (present[a.worker_id] ?? 0) + add
  }

  const rows = (workers ?? []).map((w) => {
    const monthlySalary = Number(w.monthly_salary ?? 0)
    const daysPresent = present[w.id] ?? 0
    const daysAbsent = Math.max(0, workingDays - daysPresent)
    const payable = workingDays > 0 ? Math.round((monthlySalary / workingDays) * daysPresent * 100) / 100 : 0
    return {
      id: w.id,
      roll_no: (w.roll_no as number | null) ?? null,
      full_name: w.full_name as string,
      role: (w.department as string | null) ?? null, // "Operator" | "Helper" | null
      monthly_salary: monthlySalary,
      days_present: daysPresent,
      days_absent: daysAbsent,
      payable,
    }
  })

  return { month: `${y}-${mm}`, workingDays, rows }
}

/** Manual trigger: generate draft payroll for the previous calendar month. */
export async function generatePreviousMonthPayroll() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const result = await runMonthlyPayroll(prev.getFullYear(), prev.getMonth())
  if ("error" in result) return result

  revalidateTag("workers", {})
  revalidatePath("/hr/payroll")
  return result
}

/**
 * Bulk-add floor workers as plain profiles (no login account) so they can be
 * marked for attendance / payroll. Accepts a list of names (one per worker).
 */
export async function createWorkers(input: { names: string[]; department?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const names = Array.from(
    new Set((input.names ?? []).map((n) => n.trim()).filter((n) => n.length > 0 && n.length <= 100))
  )
  if (names.length === 0) return { error: "Enter at least one worker name" }

  const department = input.department?.trim() || null
  const rows = names.map((full_name) => ({ full_name, role: "worker", department, is_active: true }))

  // profiles is RLS-protected — insert via the service-role client (same as user creation)
  const admin = createAdminClient()
  const { data, error } = await admin.from("profiles").insert(rows).select("id")
  if (error) return { error: error.message }

  revalidateTag("workers", {})
  revalidatePath("/hr")
  revalidatePath("/hr/attendance")
  return { count: data?.length ?? 0 }
}

// ===== Shifts =====

export const getShifts = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .order("name")
    if (error) throw new Error(error.message)
    return data ?? []
  },
  ["shifts"],
  { tags: ["shifts"], revalidate: 3600 }
)

export async function createShift(formData: ShiftFormData) {
  const validated = shiftSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("shifts")
    .insert({
      name: validated.name,
      start_time: validated.start_time,
      end_time: validated.end_time,
      description: validated.description || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidateTag("shifts", {})
  revalidatePath("/hr/shifts")
  return { data }
}

export async function updateShift(id: string, formData: ShiftFormData) {
  const validated = shiftSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("shifts")
    .update({
      name: validated.name,
      start_time: validated.start_time,
      end_time: validated.end_time,
      description: validated.description || null,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidateTag("shifts", {})
  revalidatePath("/hr/shifts")
  return { data }
}

export async function deleteShift(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("shifts").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidateTag("shifts", {})
  revalidatePath("/hr/shifts")
  return { success: true }
}

// ===== Attendance =====

export async function getAttendanceForDate(date: string) {
  const supabase = await createClient()

  const [workersRes, attRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, department")
      .eq("is_active", true)
      .order("full_name"),
    supabase.from("attendance").select("*").eq("date", date),
  ])

  const workers = workersRes.data ?? []
  const attMap = new Map((attRes.data ?? []).map((a) => [a.worker_id, a]))

  return workers.map((w) => ({
    workerId: w.id,
    workerName: w.full_name,
    department: w.department as string | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attendance: (attMap.get(w.id) as any) ?? null,
  }))
}

export async function getAttendance(filters?: { date?: string; date_from?: string; date_to?: string; worker_id?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("attendance")
    .select(`
      *,
      worker:profiles(id, full_name, department)
    `)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

  if (filters?.date) query = query.eq("date", filters.date)
  if (filters?.date_from) query = query.gte("date", filters.date_from)
  if (filters?.date_to) query = query.lte("date", filters.date_to)
  if (filters?.worker_id) query = query.eq("worker_id", filters.worker_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((a: any) => ({
    ...a,
    worker: Array.isArray(a.worker) ? a.worker[0] ?? null : a.worker,
  }))
}

export async function upsertAttendance(formData: AttendanceFormData) {
  const validated = attendanceSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("attendance")
    .upsert(
      {
        worker_id: validated.worker_id,
        date: validated.date,
        status: validated.status,
        check_in: validated.check_in || null,
        check_out: validated.check_out || null,
        overtime_hours: validated.overtime_hours,
        notes: validated.notes || null,
      },
      { onConflict: "worker_id,date" }
    )
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/hr/attendance")
  return { data }
}

type QuickStatus = "present" | "absent" | "half_day" | "leave"

/** One-tap attendance: set a worker's status for a date, preserving any
 *  check-in/out/OT already recorded (only the status column is written). */
export async function quickMarkAttendance(workerId: string, date: string, status: QuickStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("attendance")
    .upsert({ worker_id: workerId, date, status }, { onConflict: "worker_id,date" })

  if (error) return { error: error.message }
  revalidatePath("/hr/attendance")
  revalidatePath("/hr")
  return { success: true }
}

/** Mark every active worker who isn't yet marked for the date as Present. */
export async function markAllPresent(date: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const [{ data: workers }, { data: existing }] = await Promise.all([
    admin.from("profiles").select("id").eq("is_active", true),
    admin.from("attendance").select("worker_id").eq("date", date),
  ])
  const marked = new Set((existing ?? []).map((a) => a.worker_id))
  const toMark = (workers ?? [])
    .filter((w) => !marked.has(w.id))
    .map((w) => ({ worker_id: w.id, date, status: "present" as const }))

  if (toMark.length === 0) return { count: 0 }
  const { error } = await admin.from("attendance").upsert(toMark, { onConflict: "worker_id,date" })
  if (error) return { error: error.message }

  revalidatePath("/hr/attendance")
  revalidatePath("/hr")
  return { count: toMark.length }
}

export async function deleteAttendance(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("attendance").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/hr/attendance")
  return { success: true }
}

// ===== Leaves =====

export async function getLeaves(filters?: { status?: string; worker_id?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("leaves")
    .select(`
      *,
      worker:profiles!worker_id(id, full_name, department)
    `)
    .order("created_at", { ascending: false })

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.worker_id) query = query.eq("worker_id", filters.worker_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((l: any) => ({
    ...l,
    worker: Array.isArray(l.worker) ? l.worker[0] ?? null : l.worker,
  }))
}

export async function createLeave(formData: LeaveFormData) {
  const validated = leaveSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("leaves")
    .insert({
      worker_id: validated.worker_id,
      leave_type: validated.leave_type,
      from_date: validated.from_date,
      to_date: validated.to_date,
      reason: validated.reason || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/hr/leaves")
  return { data }
}

export async function updateLeaveStatus(
  id: string,
  status: "approved" | "rejected",
  rejection_reason?: string
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("leaves")
    .update({
      status,
      rejection_reason: rejection_reason || null,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/hr/leaves")
  return { data }
}

export async function deleteLeave(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("leaves").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/hr/leaves")
  return { success: true }
}

// ===== Payroll =====

export async function getPayrolls(filters?: { status?: string; month?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("payroll")
    .select(`
      *,
      worker:profiles(id, full_name, department)
    `)
    .order("period_start", { ascending: false })

  if (filters?.status) query = query.eq("status", filters.status)
  // month is YYYY-MM, filter where period_start falls within that calendar month
  if (filters?.month && isValidMonth(filters.month)) {
    const [y, m] = filters.month.split("-").map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    query = query.gte("period_start", `${filters.month}-01`).lte("period_start", `${filters.month}-${String(lastDay).padStart(2, "0")}`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({
    ...p,
    worker: Array.isArray(p.worker) ? p.worker[0] ?? null : p.worker,
  }))
}

export async function getPayroll(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payroll")
    .select(`*, worker:profiles(id, full_name, department, role, phone)`)
    .eq("id", id)
    .single()

  if (error) throw new Error(error.message)

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(data as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    worker: Array.isArray((data as any).worker) ? (data as any).worker[0] ?? null : (data as any).worker,
  }
}

export async function createPayroll(formData: PayrollFormData) {
  const validated = payrollSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("payroll")
    .insert({
      worker_id: validated.worker_id,
      period_start: validated.period_start,
      period_end: validated.period_end,
      working_days: validated.working_days,
      days_present: validated.days_present,
      overtime_hours: validated.overtime_hours,
      daily_wage: validated.daily_wage,
      overtime_rate: validated.overtime_rate,
      deductions: validated.deductions,
      bonus: validated.bonus,
      notes: validated.notes || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/hr/payroll")
  return { data }
}

export async function updatePayrollStatus(id: string, status: "draft" | "paid") {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("payroll")
    .update({ status })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/hr/payroll")
  return { success: true }
}

export async function deletePayroll(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("payroll").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/hr/payroll")
  return { success: true }
}

// ===== HR Overview =====

export async function getHROverview() {
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthEnd = nextMonth.toISOString().split("T")[0]

  const [workersRes, todayAttRes, pendingLeavesRes, monthOTRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, department, role")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("attendance")
      .select("*, worker:profiles(id, full_name, department)")
      .eq("date", today),
    supabase
      .from("leaves")
      .select("*, worker:profiles!worker_id(id, full_name, department)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("worker_id, overtime_hours")
      .gte("date", monthStart)
      .lt("date", monthEnd)
      .gt("overtime_hours", 0),
  ])

  const workers = workersRes.data ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todayAtt = (todayAttRes.data ?? []).map((a: any) => ({
    ...a,
    worker: Array.isArray(a.worker) ? a.worker[0] ?? null : a.worker,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingLeaves = (pendingLeavesRes.data ?? []).map((l: any) => ({
    ...l,
    worker: Array.isArray(l.worker) ? l.worker[0] ?? null : l.worker,
  }))

  const monthOT = monthOTRes.data ?? []

  const markedIds = new Set(todayAtt.map((a: { worker_id: string }) => a.worker_id))
  const present = todayAtt.filter((a: { status: string }) => a.status === "present").length
  const absent = todayAtt.filter((a: { status: string }) => a.status === "absent").length
  const halfDay = todayAtt.filter((a: { status: string }) => a.status === "half_day").length
  const onLeave = todayAtt.filter((a: { status: string }) => a.status === "leave").length
  const unmarked = workers.filter((w) => !markedIds.has(w.id)).length

  const otByWorker: Record<string, number> = {}
  for (const r of monthOT) {
    otByWorker[r.worker_id] = (otByWorker[r.worker_id] ?? 0) + (r.overtime_hours ?? 0)
  }

  return {
    totalWorkers: workers.length,
    present,
    absent,
    halfDay,
    onLeave,
    unmarked,
    workers,
    todayAtt,
    unmarkedWorkers: workers.filter((w) => !markedIds.has(w.id)),
    pendingLeaves,
    otByWorker,
  }
}

// Helper: compute attendance summary for a worker over a period
export async function getAttendanceSummary(
  workerId: string,
  periodStart: string,
  periodEnd: string
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("attendance")
    .select("status, overtime_hours")
    .eq("worker_id", workerId)
    .gte("date", periodStart)
    .lte("date", periodEnd)

  if (error) return { days_present: 0, overtime_hours: 0 }

  const records = data ?? []
  const days_present = records.filter(
    (r) => r.status === "present" || r.status === "half_day"
  ).reduce((sum, r) => sum + (r.status === "half_day" ? 0.5 : 1), 0)

  const overtime_hours = records.reduce((sum, r) => sum + (r.overtime_hours ?? 0), 0)

  return { days_present, overtime_hours }
}
