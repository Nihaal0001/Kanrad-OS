import { z } from "zod"

export const warehouseSkuDispatchSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  bill_no: z.string().min(1, "Bill number is required").max(100),
  notes: z.string().max(1000).optional().or(z.literal("")),
})

export type WarehouseSkuDispatchFormData = z.infer<typeof warehouseSkuDispatchSchema>
