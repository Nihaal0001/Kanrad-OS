import { z } from "zod"

export const expenseSchema = z.object({
  category_id: z.string().min(1, "Category is required"),
  order_id: z.string().optional().or(z.literal("")),
  amount: z.number().positive("Must be > 0"),
  expense_date: z.string().min(1, "Date is required"),
  description: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>

export const expenseCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
})

export type ExpenseCategoryFormData = z.infer<typeof expenseCategorySchema>
