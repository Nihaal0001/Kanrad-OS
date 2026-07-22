import { z } from "zod"

export const purchaseInvoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Must be > 0"),
  unit_price: z.number().min(0),
  hsn_code: z.string().optional().or(z.literal("")),
})

export const purchaseInvoiceSchema = z.object({
  purchase_order_id: z.string().optional().or(z.literal("")),
  supplier_name: z.string().min(1, "Supplier name is required"),
  supplier_gst: z.string().optional().or(z.literal("")),
  invoice_number: z.string().optional().or(z.literal("")),
  tax_rate: z.number().min(0).max(100),
  place_of_supply: z.string().optional().or(z.literal("")),
  is_igst: z.boolean(),
  invoice_date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(purchaseInvoiceItemSchema).min(1, "At least one item is required"),
})

export type PurchaseInvoiceFormData = z.infer<typeof purchaseInvoiceSchema>

export const purchasePaymentSchema = z.object({
  purchase_invoice_id: z.string().min(1, "Purchase invoice is required"),
  amount: z.number().positive("Must be > 0"),
  method: z.enum(["cash", "bank_transfer", "cheque", "upi", "other"]),
  reference: z.string().optional().or(z.literal("")),
  payment_date: z.string().min(1, "Payment date is required"),
  notes: z.string().optional().or(z.literal("")),
  tally_ledger: z.string().optional().or(z.literal("")),
})

export type PurchasePaymentFormData = z.infer<typeof purchasePaymentSchema>
