import { z } from "zod"

export const shipmentSchema = z.object({
  order_id: z.string().optional().or(z.literal("")),
  customer_name: z.string().max(200).optional().or(z.literal("")),
  courier_name: z.string().max(200).optional().or(z.literal("")),
  tracking_number: z.string().max(200).optional().or(z.literal("")),
  expected_delivery_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
})

export type ShipmentFormData = z.infer<typeof shipmentSchema>
