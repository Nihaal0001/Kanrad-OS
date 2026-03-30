"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  stageUpdateSchema,
  qualityCheckSchema,
  type StageUpdateFormData,
  type QualityCheckFormData,
} from "@/lib/validators/production"

// ==================== Production Stages ====================

export async function getProductionStages() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("production_stages")
    .select("*")
    .order("sequence")

  if (error) throw new Error(error.message)
  return data
}

// ==================== Production Tracking ====================

export async function getProductionOverview() {
  const supabase = await createClient()
  // Get all active orders (confirmed or in_production) with their tracking rows
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, product_variant, total_quantity, status, deadline, priority,
      customer:customers(id, name, company),
      production_tracking(
        id, status, quantity_completed, quantity_rejected, stage_id,
        stage:production_stages(id, name, sequence)
      )
    `)
    .in("status", ["confirmed", "in_production"])
    .order("deadline", { ascending: true })

  if (error) throw new Error(error.message)

  // Normalize nested relations (Supabase returns 1:1 joins as arrays)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((order: any) => ({
    ...order,
    customer: Array.isArray(order.customer) ? order.customer[0] ?? null : order.customer,
    production_tracking: (order.production_tracking ?? []).map((t: {
      stage: { id: string; name: string; sequence: number } | { id: string; name: string; sequence: number }[] | null
    }) => ({
      ...t,
      stage: Array.isArray(t.stage) ? t.stage[0] ?? null : t.stage,
    })),
  }))
}

export async function getOrderProduction(orderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, product_variant, total_quantity, status, deadline, priority,
      customer:customers(id, name, company),
      production_tracking(
        id, status, quantity_completed, quantity_rejected, quantity_input, waste_notes, notes, started_at, completed_at, stage_id, assigned_to,
        stage:production_stages(id, name, sequence, description)
      )
    `)
    .eq("id", orderId)
    .single()

  if (error) throw new Error(error.message)

  // Auto-init tracking rows if none exist (trigger only fires on UPDATE, not INSERT)
  if (
    (!data.production_tracking || data.production_tracking.length === 0) &&
    ["confirmed", "in_production"].includes(data.status)
  ) {
    const { data: stages } = await supabase
      .from("production_stages")
      .select("id")
      .order("sequence")

    if (stages && stages.length > 0) {
      await supabase.from("production_tracking").insert(
        stages.map((s) => ({ order_id: orderId, stage_id: s.id, status: "pending" }))
      )
      // Re-fetch with tracking rows
      const { data: refreshed, error: refreshErr } = await supabase
        .from("orders")
        .select(`
          id, order_number, product_variant, total_quantity, status, deadline, priority,
          customer:customers(id, name, company),
          production_tracking(
            id, status, quantity_completed, quantity_rejected, quantity_input, waste_notes, notes, started_at, completed_at, stage_id, assigned_to,
            stage:production_stages(id, name, sequence, description)
          )
        `)
        .eq("id", orderId)
        .single()
      if (!refreshErr && refreshed) {
        return normalizeOrder(refreshed)
      }
    }
  }

  return normalizeOrder(data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeOrder(data: any) {
  return {
    ...data,
    customer: Array.isArray(data.customer) ? data.customer[0] ?? null : data.customer,
    production_tracking: (data.production_tracking ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t: any) => ({
        ...t,
        stage: Array.isArray(t.stage) ? t.stage[0] ?? null : t.stage,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => (a.stage?.sequence ?? 0) - (b.stage?.sequence ?? 0)),
  }
}

export async function updateProductionStage(
  trackingId: string,
  orderId: string,
  formData: StageUpdateFormData
) {
  const validated = stageUpdateSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("production_tracking")
    .update({
      status: validated.status,
      quantity_completed: validated.quantity_completed,
      quantity_rejected: validated.quantity_rejected,
      quantity_input: validated.quantity_input ?? null,
      waste_notes: validated.waste_notes || null,
      notes: validated.notes || null,
    })
    .eq("id", trackingId)

  if (error) return { error: error.message }

  // If moving to in_production, update order status too
  if (validated.status === "in_progress") {
    await supabase
      .from("orders")
      .update({ status: "in_production" })
      .eq("id", orderId)
      .eq("status", "confirmed")
  }

  revalidatePath("/production")
  revalidatePath(`/production/${orderId}`)
  return { success: true }
}

// ==================== Quality Checks ====================

export async function getQualityChecks(filters?: {
  order_id?: string
  severity?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from("quality_checks")
    .select(`
      *,
      order:orders(id, order_number, product_variant),
      stage:production_stages(id, name)
    `)
    .order("checked_at", { ascending: false })

  if (filters?.order_id) {
    query = query.eq("order_id", filters.order_id)
  }
  if (filters?.severity) {
    query = query.eq("severity", filters.severity)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function createQualityCheck(formData: QualityCheckFormData) {
  const validated = qualityCheckSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("quality_checks")
    .insert({
      order_id: validated.order_id,
      stage_id: validated.stage_id || null,
      quantity_inspected: validated.quantity_inspected,
      quantity_passed: validated.quantity_passed,
      quantity_failed: validated.quantity_failed,
      defect_type: validated.defect_type || null,
      severity: validated.severity || null,
      notes: validated.notes || null,
      checked_at: validated.checked_at,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/quality")
  revalidatePath(`/production/${validated.order_id}`)
  return { data }
}

export async function deleteQualityCheck(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("quality_checks").delete().eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/quality")
  return { success: true }
}
