"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  expenseSchema,
  expenseCategorySchema,
  type ExpenseFormData,
  type ExpenseCategoryFormData,
} from "@/lib/validators/expenses"

// ===== Expense Categories =====

export async function getExpenseCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("is_active", true)
    .order("name")

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createExpenseCategory(formData: ExpenseCategoryFormData) {
  const validated = expenseCategorySchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ name: validated.name })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/finance/expenses")
  return { data }
}

export async function deleteExpenseCategory(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Prevent deleting default categories
  const { data: category } = await supabase
    .from("expense_categories")
    .select("is_default")
    .eq("id", id)
    .single()

  if (category?.is_default) return { error: "Cannot delete default category" }

  const { error } = await supabase
    .from("expense_categories")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/finance/expenses")
  return { success: true }
}

// ===== Expenses =====

export async function getExpenses(filters?: {
  category_id?: string
  from?: string
  to?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from("expenses")
    .select(`
      *,
      category:expense_categories(id, name),
      order:orders(id, order_number, style_name)
    `)
    .order("expense_date", { ascending: false })

  if (filters?.category_id) {
    query = query.eq("category_id", filters.category_id)
  }
  if (filters?.from) {
    query = query.gte("expense_date", filters.from)
  }
  if (filters?.to) {
    query = query.lte("expense_date", filters.to)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((e: any) => ({
    ...e,
    category: Array.isArray(e.category) ? e.category[0] ?? null : e.category,
    order: Array.isArray(e.order) ? e.order[0] ?? null : e.order,
  }))
}

export async function createExpense(formData: ExpenseFormData) {
  const validated = expenseSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      category_id: validated.category_id,
      order_id: validated.order_id || null,
      amount: validated.amount,
      expense_date: validated.expense_date,
      description: validated.description || null,
      notes: validated.notes || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/finance/expenses")
  revalidatePath("/finance/cash-flow")
  revalidatePath("/finance")
  return { data }
}

export async function updateExpense(id: string, formData: ExpenseFormData) {
  const validated = expenseSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("expenses")
    .update({
      category_id: validated.category_id,
      order_id: validated.order_id || null,
      amount: validated.amount,
      expense_date: validated.expense_date,
      description: validated.description || null,
      notes: validated.notes || null,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/finance/expenses")
  revalidatePath("/finance/cash-flow")
  revalidatePath("/finance")
  return { success: true }
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("expenses").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/expenses")
  revalidatePath("/finance/cash-flow")
  revalidatePath("/finance")
  return { success: true }
}
