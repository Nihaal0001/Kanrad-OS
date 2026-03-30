import { z } from "zod"

export const productionTargetSchema = z.object({
  product_name: z.string().min(1, "Product name is required").max(200),
  daily_target_qty: z.number().min(0.001, "Target must be greater than 0"),
  target_date: z.string().min(1, "Target date is required"),
})

export const recordActualSchema = z.object({
  actual_qty: z.number().min(0),
})

export type ProductionTargetFormData = z.infer<typeof productionTargetSchema>
export type RecordActualFormData = z.infer<typeof recordActualSchema>
