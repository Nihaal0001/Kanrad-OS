import { z } from "zod"

export const stageUpdateSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "blocked"]),
  quantity_completed: z.number().min(0),
  quantity_rejected: z.number().min(0),
  notes: z.string().max(1000).optional().or(z.literal("")),
})

export type StageUpdateFormData = z.infer<typeof stageUpdateSchema>

export const qualityCheckSchema = z.object({
  order_id: z.string().min(1, "Order is required"),
  stage_id: z.string().optional().or(z.literal("")),
  quantity_inspected: z.number().min(1, "Must inspect at least 1 piece"),
  quantity_passed: z.number().min(0),
  quantity_failed: z.number().min(0),
  defect_type: z.string().max(200).optional().or(z.literal("")),
  severity: z.enum(["minor", "major", "critical"]).optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
  checked_at: z.string().min(1, "Date is required"),
})

export type QualityCheckFormData = z.infer<typeof qualityCheckSchema>
