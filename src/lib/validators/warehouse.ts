import { z } from "zod"

export const warehouseItemSchema = z.object({
  item_name: z.string().min(1, "Item name is required").max(200),
  sku: z.string().max(100).optional().or(z.literal("")),
  category: z.string().max(100).optional().or(z.literal("")),
  quantity: z.number().min(0),
  unit: z.string().min(1, "Unit is required").max(50),
  location: z.string().max(200).optional().or(z.literal("")),
  remarks: z.string().max(1000).optional().or(z.literal("")),
})

export const exitItemSchema = z.object({
  exit_date: z.string().min(1, "Exit date is required"),
})

export type WarehouseItemFormData = z.infer<typeof warehouseItemSchema>
export type ExitItemFormData = z.infer<typeof exitItemSchema>
