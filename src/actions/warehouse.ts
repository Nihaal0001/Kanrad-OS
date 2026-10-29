"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMasterCartonRatios } from "@/lib/master-cartons"
import { warehouseSkuDispatchSchema, type WarehouseSkuDispatchFormData } from "@/lib/validators/warehouse"
import { logAudit } from "@/actions/audit"

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

      const orderIds = [...new Set(items.map((i) => i.order_id).filter(Boolean))] as string[]
      const orderNumberById = new Map<string, string>()
      if (orderIds.length > 0) {
        const { data: linkedOrders } = await supabase
          .from("orders")
          .select("id, order_number")
          .in("id", orderIds)
        for (const o of linkedOrders ?? []) {
          orderNumberById.set(o.id, o.order_number)
        }
      }

      return items.map((i) => ({
        ...i,
        master_cartons: ratios.has(i.item_name) ? Math.round(i.quantity * ratios.get(i.item_name)! * 1000) / 1000 : null,
        brand: (i.sku && brandBySku.get(i.sku)) || "Unbranded",
        order_number: i.order_id ? orderNumberById.get(i.order_id) ?? null : null,
      }))
    },
    [`warehouse-items-${filters?.status ?? "all"}-${filters?.location ?? "all"}`],
    { tags: ["warehouse_items"], revalidate: 60 }
  )()
}

export const getWarehouseDispatches = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("warehouse_dispatches")
      .select(`
        id, brand, item_name, quantity, bill_no, dispatched_at, notes,
        warehouse_item:warehouse_items(sku),
        order:orders(order_number)
      `)
      .order("dispatched_at", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((d: any) => ({
      ...d,
      warehouse_item: Array.isArray(d.warehouse_item) ? d.warehouse_item[0] ?? null : d.warehouse_item,
      order: Array.isArray(d.order) ? d.order[0] ?? null : d.order,
    }))
  },
  ["warehouse-dispatches"],
  { tags: ["warehouse_items"], revalidate: 60 }
)

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
 * Dispatch a quantity of a SKU straight out of the warehouse, drawing FIFO
 * (oldest entry_date first) across ALL in-warehouse stock for that SKU —
 * which can span several orders' production runs, or unlinked/manual stock,
 * in one dispatch. Logs a warehouse_dispatches row per warehouse row
 * consumed, flips any order whose stock just hit zero to "dispatched", and
 * — for whatever portion is attributable to a customer order — finds or
 * creates one sales invoice per bill number (adding a line item per order),
 * so a single invoice can cover several orders dispatched together.
 * Unlinked stock still dispatches, it just can't be invoiced (no customer to
 * bill), which is why the invoice number is only required when the dispatch
 * actually touches order-linked stock.
 *
 * Idempotent per request_id: the very first thing this does is insert
 * request_id into warehouse_dispatch_requests. A duplicate submission
 * (double-click before the button disables, a retried request, two tabs)
 * hits the primary key and returns early as a no-op, before any stock is
 * touched — otherwise a single intended dispatch of 50 could read+write the
 * same stock twice and send out 100.
 */
export async function dispatchWarehouseSku(formData: WarehouseSkuDispatchFormData) {
  const validated = warehouseSkuDispatchSchema.parse(formData)
  const billNo = validated.bill_no?.trim() || null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  // created_by references profiles(id), not the auth user id directly —
  // user.id is the auth.users id, which only coincidentally equals a
  // profile's own id. Resolving it wrong caused an intermittent foreign key
  // violation on this insert for any user whose profile id differs from
  // their auth id.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle()
  const createdBy = profile?.id ?? null

  const { error: dedupeError } = await admin
    .from("warehouse_dispatch_requests")
    .insert({ id: validated.request_id })
  if (dedupeError) {
    if (dedupeError.code === "23505") return { success: true }
    return { error: dedupeError.message }
  }

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
    return { error: `Cannot dispatch more than the ${available} available.` }
  }

  // Build the consumption plan before writing anything, so the invoice
  // number requirement can be checked up front rather than partway through.
  let remaining = validated.quantity
  const plan: { row: NonNullable<typeof rows>[number]; consume: number }[] = []
  for (const row of rows ?? []) {
    if (remaining <= 0) break
    const consume = Math.min(remaining, row.quantity)
    plan.push({ row, consume })
    remaining -= consume
  }

  const touchesOrder = plan.some((p) => p.row.order_id)
  if (touchesOrder && !billNo) {
    return { error: "Invoice number is required — this dispatch includes stock linked to a customer order." }
  }

  const today = new Date().toISOString().split("T")[0]
  // Consumed quantity per order, so each order gets exactly one invoice line
  // even if its stock is split across several warehouse rows.
  const consumedByOrder = new Map<string, number>()

  // Each plan row targets a different warehouse_items id, so the update +
  // dispatch-log-insert (+ order status flip) for one row never depends on
  // another row's result — running them one at a time multiplied a
  // multi-row dispatch into that many sequential round trips for no reason.
  const rowResults = await Promise.all(
    plan.map(
      async ({
        row,
        consume,
      }): Promise<{ ok: true; orderId: string | null; consume: number } | { ok: false; error: string }> => {
        const newQty = Math.round((row.quantity - consume) * 1000) / 1000
        const nowFullyDispatched = newQty <= 0

        const { error: updateError } = await admin
          .from("warehouse_items")
          .update({
            quantity: newQty,
            ...(nowFullyDispatched ? { status: "dispatched", exit_date: today } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
        if (updateError) return { ok: false, error: updateError.message }

        const { error: dispatchError } = await admin.from("warehouse_dispatches").insert({
          warehouse_item_id: row.id,
          order_id: row.order_id ?? null,
          quantity: consume,
          bill_no: billNo,
          brand: validated.brand,
          item_name: validated.item_name,
          notes: validated.notes || null,
          created_by: createdBy,
        })
        if (dispatchError) return { ok: false, error: dispatchError.message }

        // That order's entire warehouse stock (one row per order, enforced
        // by a unique constraint) just hit zero — reflect that on the order
        // itself so "Completed" orders don't sit there forever once
        // everything has actually shipped.
        if (row.order_id && nowFullyDispatched) {
          await admin.from("orders").update({ status: "dispatched" }).eq("id", row.order_id).neq("status", "cancelled")
        }

        return { ok: true, orderId: row.order_id, consume }
      }
    )
  )

  const failedRow = rowResults.find((r) => !r.ok)
  if (failedRow && !failedRow.ok) return { error: failedRow.error }

  for (const r of rowResults) {
    if (r.ok && r.orderId) {
      consumedByOrder.set(r.orderId, (consumedByOrder.get(r.orderId) ?? 0) + r.consume)
    }
  }

  // Invoice whatever portion is attributable to a customer order — may now
  // span several orders dispatched together under one bill number.
  for (const [orderId, qty] of consumedByOrder) {
    if (!billNo) continue
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
      .eq("bill_no", billNo)
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
          bill_no: billNo,
          notes: `Dispatch bill ${billNo} — order ${order.order_number}`,
        })
        .select("id")
        .single()
      if (invoiceError) return { error: invoiceError.message }
      invoiceId = newInvoice.id
    }

    const description = validated.sku ? `${validated.item_name} (${validated.sku})` : validated.item_name

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
  revalidatePath("/orders")

  await logAudit({
    entityType: "warehouse_dispatch",
    entityLabel: validated.sku,
    action: "created",
    newValues: {
      sku: validated.sku,
      quantity: validated.quantity,
      bill_no: billNo,
      order_ids: [...consumedByOrder.keys()],
    },
  })

  return { success: true }
}
