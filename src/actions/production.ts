"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  stageUpdateSchema,
  qualityCheckSchema,
  type StageUpdateFormData,
  type QualityCheckFormData,
} from "@/lib/validators/production"

// ==================== Production Stages ====================

export const getProductionStages = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("production_stages")
      .select("*")
      .order("sequence")
    if (error) throw new Error(error.message)
    return data
  },
  ["production-stages"],
  { tags: ["production-stages"], revalidate: 3600 }
)

// ==================== Production Tracking ====================

const _getProductionOverview = unstable_cache(
  async () => {
    const supabase = createAdminClient()
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
  },
  ["production-overview"],
  { tags: ["production", "orders"], revalidate: 30 }
)

export async function getProductionOverview() {
  return _getProductionOverview()
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

  revalidateTag("production", {})
  revalidatePath("/production")
  revalidatePath(`/production/${orderId}`)
  return { success: true }
}

// ==================== Batch Start ====================

export async function startProductionBatch(
  orderId: string,
  plannedQuantity: number,
  plannedStartDate: string,
  dailyTarget?: number
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Ensure tracking rows exist
  const { data: existing } = await supabase
    .from("production_tracking")
    .select("id")
    .eq("order_id", orderId)

  if (!existing || existing.length === 0) {
    const { data: stages } = await supabase
      .from("production_stages")
      .select("id")
      .order("sequence")

    if (stages && stages.length > 0) {
      await supabase.from("production_tracking").insert(
        stages.map((s) => ({ order_id: orderId, stage_id: s.id, status: "pending" }))
      )
    }
  }

  // Set started_at and daily target note on the first (lowest-sequence) tracking row
  const notesValue = dailyTarget ? `Daily target: ${dailyTarget}` : null
  const { data: firstRow } = await supabase
    .from("production_tracking")
    .select("id")
    .eq("order_id", orderId)
    .order("stage_id", { ascending: true })
    .limit(1)
    .single()

  if (firstRow) {
    await supabase
      .from("production_tracking")
      .update({ started_at: plannedStartDate, notes: notesValue })
      .eq("id", firstRow.id)
  }

  // Update order: mark in_production + store planned quantity in total_quantity if changed
  const updates: Record<string, unknown> = { status: "in_production" }
  if (plannedQuantity > 0) {
    updates.total_quantity = plannedQuantity
  }

  const { error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", orderId)

  if (error) return { error: error.message }

  revalidateTag("production", {})
  revalidatePath("/production")
  revalidatePath(`/production/${orderId}`)
  return { success: true }
}

// ==================== Daily Production Entry ====================

export async function getOrdersForBatch() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, product_variant, total_quantity, status,
      customer:customers(id, name)
    `)
    .eq("status", "confirmed")
    .order("deadline", { ascending: true })

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((o: any) => ({
    ...o,
    customer: Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer,
  }))
}

export async function getOrdersForProduction() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, product_variant, total_quantity, status,
      customer:customers(id, name)
    `)
    .in("status", ["confirmed", "in_production"])
    .order("deadline", { ascending: true })

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((o: any) => ({
    ...o,
    customer: Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer,
  }))
}

export async function getOrderProductionSummary(orderId: string) {
  const supabase = await createClient()

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number, product_variant, total_quantity, status")
    .eq("id", orderId)
    .single()

  if (orderErr) throw new Error(orderErr.message)

  const { data: tracking } = await supabase
    .from("production_tracking")
    .select("id, status, quantity_completed, quantity_rejected, stage:production_stages(id, name, sequence)")
    .eq("order_id", orderId)
    .order("stage_id", { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalized = (tracking ?? []).map((t: any) => ({
    ...t,
    stage: Array.isArray(t.stage) ? t.stage[0] ?? null : t.stage,
  }))

  // Use last completed stage qty or current in_progress stage qty as "produced"
  const lastCompleted = normalized.filter((t) => t.status === "completed").pop()
  const inProgress = normalized.find((t) => t.status === "in_progress")
  const activeTracking = inProgress ?? lastCompleted ?? null

  const totalProduced = activeTracking?.quantity_completed ?? 0
  const totalRejected = activeTracking?.quantity_rejected ?? 0

  return {
    order,
    activeTracking,
    totalProduced,
    totalRejected,
    pending: Math.max(0, order.total_quantity - totalProduced),
    tracking: normalized,
  }
}

export async function addDailyProduction(
  orderId: string,
  trackingId: string,
  addQtyProduced: number,
  addQtyRejected: number,
  currentQtyCompleted: number,
  currentQtyRejected: number,
  notes?: string
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  if (addQtyProduced <= 0) return { error: "Produced quantity must be greater than 0" }

  const newCompleted = currentQtyCompleted + addQtyProduced
  const newRejected = currentQtyRejected + (addQtyRejected || 0)

  const { error } = await supabase
    .from("production_tracking")
    .update({
      quantity_completed: newCompleted,
      quantity_rejected: newRejected,
      status: "in_progress",
      notes: notes || null,
    })
    .eq("id", trackingId)

  if (error) return { error: error.message }

  // Mark order as in_production if still confirmed
  await supabase
    .from("orders")
    .update({ status: "in_production" })
    .eq("id", orderId)
    .eq("status", "confirmed")

  revalidateTag("production", {})
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

// ==================== Daily Production Log ====================

export async function logDailyProduction(data: {
  order_id: string
  log_date: string
  quantity_produced: number
  quantity_rejected: number
  notes?: string
}): Promise<{ error?: string } | { success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("production_daily_logs")
    .upsert({
      order_id: data.order_id,
      log_date: data.log_date,
      quantity_produced: data.quantity_produced,
      quantity_rejected: data.quantity_rejected,
      notes: data.notes || null,
    }, { onConflict: "order_id,log_date" })

  if (error) return { error: error.message }

  revalidatePath(`/production/${data.order_id}`)
  revalidateTag("production", {})
  revalidatePath("/production")
  return { success: true }
}

export async function getDailyLogs(orderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("production_daily_logs")
    .select("*")
    .eq("order_id", orderId)
    .order("log_date", { ascending: false })
    .limit(30)

  if (error) throw new Error(error.message)
  return data ?? []
}
