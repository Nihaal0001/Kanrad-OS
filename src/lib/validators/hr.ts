import { z } from "zod"

export const attendanceSchema = z.object({
  worker_id: z.string().min(1, "Worker is required"),
  date: z.string().min(1, "Date is required"),
  status: z.enum(["present", "absent", "half_day", "leave"]),
  check_in: z.string().optional().or(z.literal("")),
  check_out: z.string().optional().or(z.literal("")),
  overtime_hours: z.number().min(0).max(16),
  notes: z.string().optional().or(z.literal("")),
}).refine(
  (d) => !d.check_in || !d.check_out || d.check_in <= d.check_out,
  { message: "Check-out must be after check-in", path: ["check_out"] }
)

export type AttendanceFormData = z.infer<typeof attendanceSchema>

export const leaveSchema = z.object({
  worker_id: z.string().min(1, "Worker is required"),
  leave_type: z.enum(["sick", "casual", "earned", "unpaid", "other"]),
  from_date: z.string().min(1, "From date is required"),
  to_date: z.string().min(1, "To date is required"),
  reason: z.string().optional().or(z.literal("")),
}).refine((d) => d.from_date <= d.to_date, {
  message: "End date must be on or after start date",
  path: ["to_date"],
})

export type LeaveFormData = z.infer<typeof leaveSchema>

export const shiftSchema = z.object({
  name: z.string().min(1, "Shift name is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  description: z.string().optional().or(z.literal("")),
})

export type ShiftFormData = z.infer<typeof shiftSchema>

export const payrollSchema = z.object({
  worker_id: z.string().min(1, "Worker is required"),
  period_start: z.string().min(1, "Period start is required"),
  period_end: z.string().min(1, "Period end is required"),
  working_days: z.number().min(0),
  days_present: z.number().min(0),
  overtime_hours: z.number().min(0),
  daily_wage: z.number().min(0),
  overtime_rate: z.number().min(0),
  deductions: z.number().min(0),
  bonus: z.number().min(0),
  notes: z.string().optional().or(z.literal("")),
})

export type PayrollFormData = z.infer<typeof payrollSchema>
