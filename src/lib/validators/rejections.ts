import { z } from "zod"

export const rejectionSchema = z.object({
  stage: z.enum(["production", "warehouse", "logistics", "client"]),
  item_name: z.string().min(1, "Item name is required").max(200),
  quantity: z.number({ invalid_type_error: "Quantity must be a number" }).min(0.001, "Quantity must be greater than 0"),
  reason: z.string().min(1, "Reason is required").max(1000),
  notes: z.string().max(2000).optional().or(z.literal("")),
})

export const approveReturnSchema = z.object({
  return_type: z.enum(["loss", "return_to_usable", "non_saleable", "saleable"]),
})

export type RejectionFormData = z.infer<typeof rejectionSchema>
export type ApproveReturnFormData = z.infer<typeof approveReturnSchema>
