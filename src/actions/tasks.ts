"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { taskSchema, type TaskFormData } from "@/lib/validators/tasks"

export async function getTasks(filters?: { status?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("tasks")
    .select(`
      *,
      order:orders(id, order_number, product_variant),
      stage:production_stages(id, name)
    `)
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // Normalize joins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((t: any) => ({
    ...t,
    order: Array.isArray(t.order) ? t.order[0] ?? null : t.order,
    stage: Array.isArray(t.stage) ? t.stage[0] ?? null : t.stage,
  }))
}

const VALID_TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const

export async function createTask(formData: TaskFormData) {
  const validated = taskSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: validated.title,
      description: validated.description || null,
      order_id: validated.order_id || null,
      stage_id: validated.stage_id || null,
      priority: validated.priority,
      status: validated.status,
      due_date: validated.due_date || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/tasks")
  return { data }
}

export async function updateTask(id: string, formData: TaskFormData) {
  const validated = taskSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: validated.title,
      description: validated.description || null,
      order_id: validated.order_id || null,
      stage_id: validated.stage_id || null,
      priority: validated.priority,
      status: validated.status,
      due_date: validated.due_date || null,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/tasks")
  return { data }
}

export async function updateTaskStatus(id: string, status: string) {
  if (!VALID_TASK_STATUSES.includes(status as typeof VALID_TASK_STATUSES[number])) {
    return { error: "Invalid status" }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/tasks")
  return { success: true }
}

export async function deleteTask(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("tasks").delete().eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/tasks")
  return { success: true }
}
