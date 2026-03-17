"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
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

export async function getWorkers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, department, is_active")
    .eq("is_active", true)
    .order("full_name")

  if (error) throw new Error(error.message)
  return data ?? []
}

// ===== Shifts =====

export async function getShifts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return data ?? []
}

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

  revalidatePath("/hr/shifts")
  return { data }
}

export async function deleteShift(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("shifts").delete().eq("id", id)
  if (error) return { error: error.message }

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
  // month is YYYY-MM, filter where period_start starts with that prefix
  if (filters?.month) {
    query = query.gte("period_start", `${filters.month}-01`).lte("period_start", `${filters.month}-31`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({
    ...p,
    worker: Array.isArray(p.worker) ? p.worker[0] ?? null : p.worker,
  }))
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
