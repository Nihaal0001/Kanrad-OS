"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  stageUpdateSchema,
  type StageUpdateFormData,
} from "@/lib/validators/production"
import { logAudit } from "@/actions/audit"

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
  // Get active orders with their daily piece logs (stage-free production tracking)
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, product_variant, total_quantity, status, deadline, priority,
      customer:customers(id, name, company),
      production_daily_logs(quantity_produced, quantity_rejected)
    `)
    .in("status", ["confirmed", "in_production"])
    .order("deadline", { ascending: true })

  if (error) throw new Error(error.message)

  // Normalize nested relations and roll the daily logs up into produced/rejected totals.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((order: any) => {
    const logs: Array<{ quantity_produced: number; quantity_rejected: number }> =
      order.production_daily_logs ?? []
    const totalProduced = logs.reduce((s, l) => s + (l.quantity_produced ?? 0), 0)
    const totalRejected = logs.reduce((s, l) => s + (l.quantity_rejected ?? 0), 0)
    return {
      id: order.id,
      order_number: order.order_number,
      product_variant: order.product_variant,
      total_quantity: order.total_quantity,
      status: order.status,
      deadline: order.deadline,
      priority: order.priority,
      customer: Array.isArray(order.customer) ? order.customer[0] ?? null : order.customer,
      total_produced: totalProduced,
      total_rejected: totalRejected,
    }
  })
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

  // Costing must be done before production can be logged against an order —
  // mirrors the draft → confirmed gate in updateOrderStatus, but enforced
  // here directly since this is the actual write path production uses.
  const { data: costing } = await supabase
    .from("order_costings")
    .select("id")
    .eq("order_id", data.order_id)
    .maybeSingle()
  if (!costing) return { error: "Complete costing for this order before logging production." }

  // Captured before the upsert so we can consume only the incremental
  // quantity from inventory — logDailyProduction upserts on (order_id,
  // log_date), so editing an existing day's log must not re-consume
  // material for the portion already deducted.
  const { data: existingLog } = await supabase
    .from("production_daily_logs")
    .select("quantity_produced")
    .eq("order_id", data.order_id)
    .eq("log_date", data.log_date)
    .maybeSingle()
  const deltaProduced = data.quantity_produced - (existingLog?.quantity_produced ?? 0)

  // Order + BOM fetched up front — needed both for the shortage check below
  // (must reject before writing anything) and for the consumption/status
  // logic further down.
  const { data: order } = await supabase
    .from("orders")
    .select("order_number, total_quantity, status, product_variant")
    .eq("id", data.order_id)
    .single()

  const admin = createAdminClient()
  const { data: bom } = order
    ? await admin
        .from("bom_headers")
        .select("id, product_sku")
        .eq("product_name", order.product_variant)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null }

  const { data: bomItems } = bom
    ? await admin
        .from("bom_items")
        .select("qty_required, wastage_pct, material:materials(id, name, sku, current_stock, unit)")
        .eq("bom_id", bom.id)
    : { data: null }

  // Block logging production if there isn't enough raw material on hand to
  // cover today's pieces — surfaces the shortage instead of silently letting
  // stock (and other orders drawing on the same material) go negative.
  if (deltaProduced > 0 && bomItems) {
    const short: string[] = []
    for (const bi of bomItems) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mat = Array.isArray(bi.material) ? bi.material[0] : bi.material as any
      if (!mat) continue
      const needed = bi.qty_required * (1 + (bi.wastage_pct ?? 0) / 100) * deltaProduced
      if (needed > (mat.current_stock ?? 0)) {
        short.push(`${mat.name} (need ${Math.round(needed * 100) / 100} ${mat.unit}, have ${mat.current_stock ?? 0})`)
      }
    }
    if (short.length > 0) {
      return {
        error: `Not enough material in stock to log this production: ${short.join(", ")}. Raise a purchase order for the shortage first.`,
      }
    }
  }

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

  // Audit the production output entry
  await logAudit({
    entityType: "production_log",
    entityId: data.order_id,
    entityLabel: `${order?.order_number ?? "Order"} — ${data.log_date}`,
    action: "created",
    newValues: {
      quantity_produced: data.quantity_produced,
      quantity_rejected: data.quantity_rejected,
    },
  })

  if (order) {
    const { data: logs } = await supabase
      .from("production_daily_logs")
      .select("quantity_produced")
      .eq("order_id", data.order_id)

    const totalProduced = (logs ?? []).reduce((s, l) => s + (l.quantity_produced ?? 0), 0)

    // Deduct raw materials for the pieces made in *this* log, FIFO — oldest
    // purchased batch consumed first, same rule as manual stock adjustments.
    // Sufficiency was already checked above before the log was written.
    if (bomItems && deltaProduced > 0) {
      for (const bi of bomItems) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mat = Array.isArray(bi.material) ? bi.material[0] : bi.material as any
        if (!mat) continue
        const needed = Math.round(
          bi.qty_required * (1 + (bi.wastage_pct ?? 0) / 100) * deltaProduced * 10000
        ) / 10000
        if (needed <= 0) continue

        await admin.from("stock_transactions").insert({
          material_id: mat.id,
          type: "production_out",
          quantity: -needed,
          reference_type: "order",
          reference_id: data.order_id,
          notes: `Auto-consumed for ${order.order_number} — ${data.log_date}`,
        })

        let remaining = needed
        const { data: batches } = await admin
          .from("stock_batches")
          .select("id, quantity_remaining")
          .eq("material_id", mat.id)
          .gt("quantity_remaining", 0)
          .order("received_at", { ascending: true })

        for (const batch of batches ?? []) {
          if (remaining <= 0) break
          const consume = Math.min(remaining, batch.quantity_remaining)
          await admin
            .from("stock_batches")
            .update({ quantity_remaining: batch.quantity_remaining - consume })
            .eq("id", batch.id)
          remaining -= consume
        }
      }

      revalidateTag("materials", {})
      revalidateTag("stock_transactions", {})
    }

    await admin.from("warehouse_items").upsert(
      {
        order_id: data.order_id,
        item_name: order.product_variant,
        sku: bom?.product_sku ?? null,
        quantity: totalProduced,
        unit: "pcs",
      },
      { onConflict: "order_id" }
    )

    if (["confirmed", "in_production"].includes(order.status)) {
      const nextStatus =
        order.total_quantity > 0 && totalProduced >= order.total_quantity
          ? "completed"
          : "in_production"

      if (nextStatus !== order.status) {
        await supabase.from("orders").update({ status: nextStatus }).eq("id", data.order_id)
        await logAudit({
          entityType: "order",
          entityId: data.order_id,
          entityLabel: order.order_number,
          action: "status_changed",
          oldValues: { status: order.status },
          newValues: { status: nextStatus },
        })
        revalidateTag("orders", {})
        revalidatePath("/orders")
        revalidatePath(`/orders/${data.order_id}`)
      }
    }

    revalidateTag("warehouse_items", {})
    revalidatePath("/warehouse")
  }

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
