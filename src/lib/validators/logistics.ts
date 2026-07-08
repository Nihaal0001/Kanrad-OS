import { z } from "zod"

export const warehouseDispatchSchema = z.object({
  order_id: z.string().min(1, "Order is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  bill_no: z.string().min(1, "Bill number is required").max(100),
  courier_name: z.string().max(200).optional().or(z.literal("")),
  tracking_number: z.string().max(200).optional().or(z.literal("")),
  expected_delivery_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
})

export type WarehouseDispatchFormData = z.infer<typeof warehouseDispatchSchema>
