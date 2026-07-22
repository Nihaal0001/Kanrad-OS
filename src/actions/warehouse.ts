"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMasterCartonRatios } from "@/lib/master-cartons"
import { warehouseSkuDispatchSchema, type WarehouseSkuDispatchFormData } from "@/lib/validators/warehouse"

// ── Queries ──────────────────────────────────────────────────

export async function getWarehouseItems(filters?: { status?: string; location?: string }) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      let query = supabase
        .from("warehouse_items")
        .select("*")
        .order("created_at", { ascending: false })

      if (filters?.status) query = query.eq("status", filters.status)
      if (filters?.location) query = query.eq("location", filters.location)

      const { data, error } = await query
      if (error) throw new Error(error.message)

      const items = data ?? []
      const ratios = await getMasterCartonRatios(supabase, [...new Set(items.map((i) => i.item_name))])

      const skus = [...new Set(items.map((i) => i.sku).filter(Boolean))] as string[]
      const brandBySku = new Map<string, string>()
      if (skus.length > 0) {
        const { data: products } = await supabase
          .from("bom_headers")
          .select("product_sku, brand")
          .in("product_sku", skus)
        for (const p of products ?? []) {
          if (p.brand) brandBySku.set(p.product_sku, p.brand)
        }
      }

      return items.map((i) => ({
        ...i,
        master_cartons: ratios.has(i.item_name) ? Math.round(i.quantity * ratios.get(i.item_name)! * 1000) / 1000 : null,
        brand: (i.sku && brandBySku.get(i.sku)) || "Unbranded",
      }))
    },
    [`warehouse-items-${filters?.status ?? "all"}-${filters?.location ?? "all"}`],
    { tags: ["warehouse_items"], revalidate: 60 }
  )()
}

export const getWarehouseLocations = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("warehouse_items")
      .select("location")
      .not("location", "is", null)

    if (error) return []

    const unique = Array.from(
      new Set((data ?? []).map((r: { location: string | null }) => r.location).filter(Boolean))
    ) as string[]

    return unique.sort()
  },
  ["warehouse-locations"],
  { tags: ["warehouse_items"], revalidate: 60 }
)

// ── Mutations ────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

/**
 * Dispatch a quantity of a SKU straight out of the warehouse under a bill
 * number — not tied to a single customer order (stock for one SKU can come
 * from several orders' production runs). Consumes the oldest stock first
 * across all in-warehouse rows for that SKU, logs a warehouse_dispatches row
 * per row consumed, and — for whatever portion is linked to a customer order —
 * finds or creates a sales invoice for that customer + bill number (adding a
 * line item to it), so it shows up in Finance → Receivables. Stock with no
 * linked order still dispatches, it just can't be invoiced.
 */
export async function dispatchWarehouseSku(formData: WarehouseSkuDispatchFormData) {
  const validated = warehouseSkuDispatchSchema.parse(formData)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  const { data: rows, error: rowsError } = await admin
    .from("warehouse_items")
    .select("id, item_name, sku, quantity, order_id")
    .eq("sku", validated.sku)
    .eq("status", "in_warehouse")
    .gt("quantity", 0)
    .order("entry_date", { ascending: true })

  if (rowsError) return { error: rowsError.message }

  const available = (rows ?? []).reduce((s, r) => s + r.quantity, 0)
  if (validated.quantity > available) {
    return { error: `Cannot dispatch more than the ${available} available for this SKU.` }
  }

  let remaining = validated.quantity
  const today = new Date().toISOString().split("T")[0]
  // Consumed quantity per order, so each order gets exactly one invoice line
  // even if its stock is split across several warehouse rows.
  const consumedByOrder = new Map<string, number>()

  for (const row of rows ?? []) {
    if (remaining <= 0) break
    const consume = Math.min(remaining, row.quantity)
    const newQty = Math.round((row.quantity - consume) * 1000) / 1000

    const { error: updateError } = await admin
      .from("warehouse_items")
      .update({
        quantity: newQty,
        ...(newQty <= 0 ? { status: "dispatched", exit_date: today } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    if (updateError) return { error: updateError.message }

    const { error: dispatchError } = await admin.from("warehouse_dispatches").insert({
      warehouse_item_id: row.id,
      order_id: row.order_id ?? null,
      quantity: consume,
      bill_no: validated.bill_no,
      notes: validated.notes || null,
      created_by: user.id,
    })
    if (dispatchError) return { error: dispatchError.message }

    if (row.order_id) {
      consumedByOrder.set(row.order_id, (consumedByOrder.get(row.order_id) ?? 0) + consume)
    }
    remaining -= consume
  }

  // Invoice whatever portion is attributable to a customer order.
  for (const [orderId, qty] of consumedByOrder) {
    const { data: order } = await admin
      .from("orders")
      .select("id, order_number, customer_id, gst_rate")
      .eq("id", orderId)
      .single()
    if (!order?.customer_id) continue

    const { data: customer } = await admin
      .from("customers")
      .select("id, name, address, gstin, payment_terms")
      .eq("id", order.customer_id)
      .single()
    if (!customer) continue

    const { data: orderItems } = await admin
      .from("order_items")
      .select("quantity, unit_price")
      .eq("order_id", orderId)
    const totalQty = (orderItems ?? []).reduce((s, i) => s + i.quantity, 0)
    const totalValue = (orderItems ?? []).reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const avgUnitPrice = totalQty > 0 ? totalValue / totalQty : 0

    const { data: existingInvoice } = await admin
      .from("invoices")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("bill_no", validated.bill_no)
      .neq("status", "cancelled")
      .maybeSingle()

    let invoiceId: string | null = existingInvoice?.id ?? null
    if (!invoiceId) {
      const { data: newInvoice, error: invoiceError } = await admin
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
          bill_no: validated.bill_no,
          notes: `Dispatch bill ${validated.bill_no} — order ${order.order_number}`,
        })
        .select("id")
        .single()
      if (invoiceError) return { error: invoiceError.message }
      invoiceId = newInvoice.id
    }

    const rowForSku = (rows ?? []).find((r) => r.order_id === orderId)
    const description = rowForSku?.sku ? `${rowForSku.item_name} (${rowForSku.sku})` : rowForSku?.item_name ?? validated.sku

    await admin.from("invoice_items").insert({
      invoice_id: invoiceId,
      description,
      quantity: qty,
      unit_price: avgUnitPrice,
    })
  }

  revalidateTag("warehouse_items", {})
  revalidateTag("invoices", {})
  revalidatePath("/warehouse")
  revalidatePath("/finance/invoices")
  revalidatePath("/finance/receivables")
  revalidatePath("/history")
  return { success: true }
}
