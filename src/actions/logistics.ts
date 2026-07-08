"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/actions/audit"
import { shipmentSchema, warehouseDispatchSchema } from "@/lib/validators/logistics"
import type { ShipmentFormData, WarehouseDispatchFormData } from "@/lib/validators/logistics"

const VALID_STATUSES = ["pending", "dispatched", "in_transit", "delivered", "delayed"] as const

// ── Queries ──────────────────────────────────────────────────

export async function getShipments(filters?: { status?: string }) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      let query = supabase
        .from("shipments")
        .select("*, order:orders(id, order_number, product_variant)")
        .order("created_at", { ascending: false })

      if (filters?.status) query = query.eq("status", filters.status)

      const { data, error } = await query
      if (error) throw new Error(error.message)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((s: any) => ({
        ...s,
        order: Array.isArray(s.order) ? s.order[0] ?? null : s.order,
      }))
    },
    [`shipments-${filters?.status ?? "all"}`],
    { tags: ["shipments"], revalidate: 60 }
  )()
}

export const getOrdersForSelect = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, product_variant, customer:customers(name)")
      .in("status", ["confirmed", "in_production", "completed"])
      .order("created_at", { ascending: false })

    if (error) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((o: any) => ({
      ...o,
      customer: Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer,
    }))
  },
  ["orders-for-select"],
  { tags: ["orders"], revalidate: 60 }
)

/** Orders that currently have dispatchable warehouse stock (quantity > 0). */
export const getWarehouseStockForOrders = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("warehouse_items")
      .select("id, item_name, sku, quantity, unit, order:orders(id, order_number, customer:customers(name))")
      .eq("status", "in_warehouse")
      .gt("quantity", 0)
      .not("order_id", "is", null)
      .order("item_name")

    if (error) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((w: any) => {
      const order = Array.isArray(w.order) ? w.order[0] ?? null : w.order
      const customer = order ? (Array.isArray(order.customer) ? order.customer[0] ?? null : order.customer) : null
      return {
        warehouse_item_id: w.id,
        item_name: w.item_name,
        sku: w.sku,
        quantity: w.quantity,
        unit: w.unit,
        order_id: order?.id ?? null,
        order_number: order?.order_number ?? null,
        customer_name: customer?.name ?? null,
      }
    }).filter((w) => w.order_id)
  },
  ["warehouse-stock-for-orders"],
  { tags: ["warehouse_items"], revalidate: 30 }
)

// ── Mutations ────────────────────────────────────────────────

export async function createShipment(formData: ShipmentFormData) {
  const validated = shipmentSchema.parse(formData)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("shipments")
    .insert({
      order_id: validated.order_id || null,
      customer_name: validated.customer_name || null,
      courier_name: validated.courier_name || null,
      tracking_number: validated.tracking_number || null,
      expected_delivery_date: validated.expected_delivery_date || null,
      notes: validated.notes || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  void logAudit({
    entityType: "shipment",
    entityId: data.id,
    entityLabel: data.shipment_number,
    action: "created",
    newValues: { courier_name: validated.courier_name, tracking_number: validated.tracking_number },
  })

  revalidateTag("shipments", {})
  revalidatePath("/logistics")
  return { data }
}

export async function updateShipmentStatus(id: string, status: string) {
  if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return { error: "Invalid status" }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("shipments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  void logAudit({
    entityType: "shipment",
    entityId: id,
    entityLabel: data.shipment_number,
    action: "status_changed",
    newValues: { status },
  })

  revalidateTag("shipments", {})
  revalidatePath("/logistics")
  return { success: true }
}

export async function markShipmentDelayed(id: string) {
  return updateShipmentStatus(id, "delayed")
}

/** Dispatch some (or all) of an order's warehouse stock. Partial-quantity aware —
 *  decrements warehouse_items.quantity and only flips status to 'dispatched'
 *  once it reaches zero, logging each dispatch as its own ledger row. */
export async function dispatchToOrder(formData: WarehouseDispatchFormData) {
  const validated = warehouseDispatchSchema.parse(formData)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: item, error: itemError } = await admin
    .from("warehouse_items")
    .select("id, item_name, quantity, status")
    .eq("order_id", validated.order_id)
    .maybeSingle()

  if (itemError) return { error: itemError.message }
  if (!item) return { error: "No warehouse stock found for this order." }
  if (item.status !== "in_warehouse") return { error: "This order's stock has already been fully dispatched." }
  if (validated.quantity > item.quantity) {
    return { error: `Cannot dispatch more than the ${item.quantity} available.` }
  }

  const remaining = Math.round((item.quantity - validated.quantity) * 1000) / 1000

  const { error: updateError } = await admin
    .from("warehouse_items")
    .update({
      quantity: remaining,
      ...(remaining <= 0 ? { status: "dispatched", exit_date: new Date().toISOString().split("T")[0] } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id)

  if (updateError) return { error: updateError.message }

  const { error: dispatchError } = await admin.from("warehouse_dispatches").insert({
    warehouse_item_id: item.id,
    order_id: validated.order_id,
    quantity: validated.quantity,
    notes: validated.notes || null,
    created_by: user.id,
  })

  if (dispatchError) return { error: dispatchError.message }

  void logAudit({
    entityType: "warehouse_item",
    entityId: item.id,
    entityLabel: item.item_name,
    action: "status_changed",
    newValues: { dispatched_quantity: validated.quantity, remaining, order_id: validated.order_id },
  })

  revalidateTag("warehouse_items", {})
  revalidatePath("/warehouse")
  revalidatePath("/logistics")
  return { success: true }
}
