import { z } from "zod"

export const orderItemSchema = z.object({
  product_variant: z.string().min(1, "Product name is required").max(200),
  size: z.string().min(1, "Size is required"),
  color: z.string().optional().or(z.literal("")),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unit_price: z.number().min(0, "Price cannot be negative"),
  hsn_code: z.string().optional().or(z.literal("")),
})

export const orderSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  description: z.string().max(1000).optional().or(z.literal("")),
  deadline: z.string().min(1, "Deadline is required"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  status: z.enum(["draft", "confirmed", "in_production", "completed", "dispatched", "cancelled"]).optional(),
  gst_rate: z.number().min(0).max(28).default(18),
  notes: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
})

export type OrderFormData = z.infer<typeof orderSchema>
export type OrderItemFormData = z.infer<typeof orderItemSchema>
