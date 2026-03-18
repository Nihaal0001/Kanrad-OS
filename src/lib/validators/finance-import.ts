import { z } from "zod"

const suggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  confidence: z.number().min(0).max(1).optional(),
})

export const purchaseInvoiceImportItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit_price: z.number().min(0, "Unit price cannot be negative"),
  hsn_code: z.string().optional().or(z.literal("")),
})

export const purchaseInvoiceImportDraftSchema = z.object({
  target_type: z.literal("purchase_invoice"),
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
  document_path: z.string().min(1),
  document_url: z.string().url().optional().or(z.literal("")),
  supplier_suggestions: z.array(suggestionSchema).default([]),
  purchase_order_suggestions: z.array(suggestionSchema).default([]),
  warnings: z.array(z.string()).default([]),
  items: z.array(purchaseInvoiceImportItemSchema).min(1, "At least one item is required"),
})

export const expenseImportDraftSchema = z.object({
  target_type: z.literal("expense"),
  category_id: z.string().min(1, "Category is required"),
  order_id: z.string().optional().or(z.literal("")),
  amount: z.number().positive("Amount must be greater than 0"),
  expense_date: z.string().min(1, "Expense date is required"),
  description: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  receipt_url: z.string().url().optional().or(z.literal("")),
  category_suggestions: z.array(suggestionSchema).default([]),
  order_suggestions: z.array(suggestionSchema).default([]),
  warnings: z.array(z.string()).default([]),
})

export const financeImportBatchItemSchema = z.discriminatedUnion("target_type", [
  purchaseInvoiceImportDraftSchema,
  expenseImportDraftSchema,
])

export const financeImportBatchSchema = z.object({
  target_hint: z.enum(["purchase_invoice", "expense"]).optional(),
  items: z.array(financeImportBatchItemSchema).max(10),
})

export type PurchaseInvoiceImportDraft = z.infer<typeof purchaseInvoiceImportDraftSchema>
export type ExpenseImportDraft = z.infer<typeof expenseImportDraftSchema>
export type FinanceImportBatchItem = z.infer<typeof financeImportBatchItemSchema>
