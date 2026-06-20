import { z } from "zod"

export const stageUpdateSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "blocked"]),
  quantity_completed: z.number().min(0),
  quantity_rejected: z.number().min(0),
  quantity_input: z.number().min(0).optional(),
  waste_notes: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
})

export type StageUpdateFormData = z.infer<typeof stageUpdateSchema>
