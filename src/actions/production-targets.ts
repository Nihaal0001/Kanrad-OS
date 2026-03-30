"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/actions/audit"

// ── Validators ───────────────────────────────────────────────

export const productionTargetSchema = z.object({
  product_name: z.string().min(1, "Product name is required").max(200),
  daily_target_qty: z.number({ invalid_type_error: "Target quantity must be a number" }).min(0.001, "Target must be greater than 0"),
  target_date: z.string().min(1, "Target date is required"),
})

export const recordActualSchema = z.object({
  actual_qty: z.number({ invalid_type_error: "Actual quantity must be a number" }).min(0),
})

export type ProductionTargetFormData = z.infer<typeof productionTargetSchema>
export type RecordActualFormData = z.infer<typeof recordActualSchema>

// ── Queries ──────────────────────────────────────────────────

export async function getProductionTargets(filters?: { status?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("production_targets")
    .select("*")
    .order("target_date", { ascending: false })

  if (filters?.status) query = query.eq("status", filters.status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

// ── Mutations ────────────────────────────────────────────────

export async function createProductionTarget(formData: ProductionTargetFormData) {
  const validated = productionTargetSchema.parse(formData)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("production_targets")
    .insert({
      product_name: validated.product_name,
      daily_target_qty: validated.daily_target_qty,
      target_date: validated.target_date,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  void logAudit({
    entityType: "production_target",
    entityId: data.id,
    entityLabel: validated.product_name,
    action: "created",
    newValues: { product_name: validated.product_name, daily_target_qty: validated.daily_target_qty, target_date: validated.target_date },
  })

  revalidatePath("/production/targets")
  return { data }
}

export async function recordActualProduction(id: string, formData: RecordActualFormData) {
  const validated = recordActualSchema.parse(formData)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Fetch the target to compare
  const { data: target, error: fetchErr } = await supabase
    .from("production_targets")
    .select("daily_target_qty")
    .eq("id", id)
    .single()

  if (fetchErr || !target) return { error: "Target not found" }

  const status = validated.actual_qty >= target.daily_target_qty ? "met" : "not_met"

  const { data, error } = await supabase
    .from("production_targets")
    .update({
      actual_qty: validated.actual_qty,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  void logAudit({
    entityType: "production_target",
    entityId: id,
    entityLabel: data.product_name,
    action: "updated",
    newValues: { actual_qty: validated.actual_qty, status },
  })

  revalidatePath("/production/targets")
  return { data }
}
