"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/actions/audit"
import { warehouseDispatchSchema } from "@/lib/validators/logistics"
import type { WarehouseDispatchFormData } from "@/lib/validators/logistics"

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

/** Orders that currently have dispatchable warehouse stock (quantity > 0).
 *  unit_price is the order's weighted-average per-piece value, purely so the
 *  ship form can preview the invoice value live — the server recomputes it
 *  authoritatively at submit time. */
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
    const rows = (data ?? []).map((w: any) => {
      const order = Array.isArray(w.order) ? w.order[0] ?? null : w.order
      const customer = order ? (Array.isArray(order.customer) ? order.customer[0] ?? null : order.customer) : null
      return {
        warehouse_item_id: w.id,
        item_name: w.item_name,
        sku: w.sku,
        quantity: w.quantity,
        unit: w.unit,
        order_id: order?.id as string | null,
        order_number: order?.order_number ?? null,
        customer_name: customer?.name ?? null,
      }
    }).filter((w) => w.order_id)

    if (rows.length === 0) return []

    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, quantity, unit_price")
      .in("order_id", rows.map((r) => r.order_id!))

    const priceByOrder = new Map<string, number>()
    for (const orderId of new Set((items ?? []).map((i) => i.order_id))) {
      const rowsForOrder = (items ?? []).filter((i) => i.order_id === orderId)
      const totalQty = rowsForOrder.reduce((s, i) => s + i.quantity, 0)
      const totalValue = rowsForOrder.reduce((s, i) => s + i.quantity * i.unit_price, 0)
      priceByOrder.set(orderId, totalQty > 0 ? totalValue / totalQty : 0)
    }

    return rows.map((r) => ({ ...r, unit_price: priceByOrder.get(r.order_id!) ?? 0 }))
  },
  ["warehouse-stock-for-orders"],
  { tags: ["warehouse_items"], revalidate: 30 }
)

// ── Mutations ────────────────────────────────────────────────

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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

/**
 * Ship some (or all) of an order's ready-to-ship warehouse stock under a bill
 * number. This is the one place a shipment gets created — it:
 *  1. Decrements warehouse_items.quantity (partial-dispatch aware; flips
 *     status to 'dispatched' once it reaches zero) and logs a
 *     warehouse_dispatches ledger row.
 *  2. Auto-generates a sales invoice for the shipped value (value = shipped
 *     quantity x the order's weighted-average unit price — not user-entered),
 *     which is what makes the shipment show up under Finance → Receivables.
 *  3. Creates the shipment record itself, already 'dispatched', linked to
 *     both the warehouse stock it came from and the invoice it generated.
 */
export async function shipWarehouseStock(formData: WarehouseDispatchFormData) {
  const validated = warehouseDispatchSchema.parse(formData)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  const { data: item, error: itemError } = await admin
    .from("warehouse_items")
    .select("id, item_name, sku, quantity, status, order_id")
    .eq("order_id", validated.order_id)
    .maybeSingle()

  if (itemError) return { error: itemError.message }
  if (!item) return { error: "No warehouse stock found for this order." }
  if (item.status !== "in_warehouse") return { error: "This order's stock has already been fully dispatched." }
  if (validated.quantity > item.quantity) {
    return { error: `Cannot dispatch more than the ${item.quantity} available.` }
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, order_number, customer_id, gst_rate")
    .eq("id", validated.order_id)
    .single()
  if (orderError || !order) return { error: "Order not found." }
  if (!order.customer_id) return { error: "This order has no customer on file — cannot generate an invoice." }

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id, name, address, gstin, payment_terms")
    .eq("id", order.customer_id)
    .single()
  if (customerError || !customer) return { error: "Customer not found." }

  // Weighted-average unit price across the order's line items, so a multi-product
  // order still produces a sensible per-piece value for a partial shipment.
  const { data: orderItems } = await admin
    .from("order_items")
    .select("quantity, unit_price")
    .eq("order_id", validated.order_id)

  const totalQty = (orderItems ?? []).reduce((s, i) => s + i.quantity, 0)
  const totalValue = (orderItems ?? []).reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const avgUnitPrice = totalQty > 0 ? totalValue / totalQty : 0
  const shippedValue = Math.round(avgUnitPrice * validated.quantity * 100) / 100

  const remaining = Math.round((item.quantity - validated.quantity) * 1000) / 1000
  const today = new Date().toISOString().split("T")[0]

  const { error: updateError } = await admin
    .from("warehouse_items")
    .update({
      quantity: remaining,
      ...(remaining <= 0 ? { status: "dispatched", exit_date: today } : {}),
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

  // Receivable — the invoice this shipment generates.
  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .insert({
      order_id: order.id,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_address: customer.address || null,
      customer_gst: customer.gstin || null,
      tax_rate: order.gst_rate ?? 18,
      issue_date: today,
      due_date: addDays(today, customer.payment_terms ?? 30),
      status: "sent",
      notes: `Shipment bill ${validated.bill_no} — order ${order.order_number}`,
    })
    .select()
    .single()
  if (invoiceError) return { error: invoiceError.message }

  const { error: invoiceItemError } = await admin.from("invoice_items").insert({
    invoice_id: invoice.id,
    description: item.sku ? `${item.item_name} (${item.sku})` : item.item_name,
    quantity: validated.quantity,
    unit_price: avgUnitPrice,
  })
  if (invoiceItemError) return { error: invoiceItemError.message }

  const { data: shipment, error: shipmentError } = await admin
    .from("shipments")
    .insert({
      order_id: order.id,
      customer_name: customer.name,
      courier_name: validated.courier_name || null,
      tracking_number: validated.tracking_number || null,
      expected_delivery_date: validated.expected_delivery_date || null,
      notes: validated.notes || null,
      status: "dispatched",
      warehouse_item_id: item.id,
      quantity: validated.quantity,
      bill_no: validated.bill_no,
      value: shippedValue,
      invoice_id: invoice.id,
      created_by: user.id,
    })
    .select()
    .single()
  if (shipmentError) return { error: shipmentError.message }

  void logAudit({
    entityType: "shipment",
    entityId: shipment.id,
    entityLabel: shipment.shipment_number,
    action: "created",
    newValues: { bill_no: validated.bill_no, value: shippedValue, quantity: validated.quantity, order_id: order.id },
  })

  revalidateTag("warehouse_items", {})
  revalidateTag("shipments", {})
  revalidateTag("invoices", {})
  revalidatePath("/warehouse")
  revalidatePath("/logistics")
  revalidatePath("/finance/invoices")
  revalidatePath("/finance/receivables")
  return { data: shipment }
}
