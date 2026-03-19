import { z } from "zod"

export const creditNoteItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.number({ invalid_type_error: "Required" }).min(0.01),
  unit_price: z.number({ invalid_type_error: "Required" }).min(0),
  amount: z.number().min(0),
})

export const creditNoteSchema = z.object({
  invoice_id: z.string().optional().or(z.literal("")),
  order_id: z.string().optional().or(z.literal("")),
  customer_name: z.string().min(1, "Customer name required"),
  customer_gst: z.string().optional().or(z.literal("")),
  issue_date: z.string().min(1, "Issue date required"),
  reason: z.string().optional().or(z.literal("")),
  tax_rate: z.number().min(0).max(100),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(creditNoteItemSchema).min(1, "At least one item required"),
})

export type CreditNoteFormData = z.infer<typeof creditNoteSchema>
