import { z } from "zod"

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Must be > 0"),
  unit_price: z.number().min(0),
  hsn_code: z.string().optional().or(z.literal("")),
})

export const invoiceSchema = z.object({
  order_id: z.string().optional().or(z.literal("")),
  customer_id: z.string().optional().or(z.literal("")),
  customer_name: z.string().min(1, "Customer name is required"),
  customer_address: z.string().optional().or(z.literal("")),
  customer_gst: z.string().optional().or(z.literal("")),
  tax_rate: z.number().min(0).max(100),
  place_of_supply: z.string().optional().or(z.literal("")),
  reverse_charge: z.boolean(),
  is_igst: z.boolean(),
  issue_date: z.string().min(1, "Issue date is required"),
  due_date: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
})

export type InvoiceFormData = z.infer<typeof invoiceSchema>

export const paymentSchema = z.object({
  invoice_id: z.string().min(1, "Invoice is required"),
  amount: z.number().positive("Must be > 0"),
  method: z.enum(["cash", "bank_transfer", "cheque", "upi", "other"]),
  reference: z.string().optional().or(z.literal("")),
  payment_date: z.string().min(1, "Payment date is required"),
  notes: z.string().optional().or(z.literal("")),
})

export type PaymentFormData = z.infer<typeof paymentSchema>

export const costingSchema = z.object({
  material_cost: z.number().min(0),
  labor_cost: z.number().min(0),
  overhead_cost: z.number().min(0),
  other_cost: z.number().min(0),
  notes: z.string().optional().or(z.literal("")),
})

export type CostingFormData = z.infer<typeof costingSchema>
