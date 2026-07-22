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
        // Pushed items move to Logistics' ship queue and drop out of the warehouse view.
        .eq("pushed_to_logistics", false)
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

/** Queue a warehouse item for shipping — it shows up in Logistics' ship queue,
 *  where the bill no., customer name/contact, and transporter get filled in. */
export async function pushToLogistics(warehouseItemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: item, error: itemError } = await admin
    .from("warehouse_items")
    .select("id, status, quantity, order_id")
    .eq("id", warehouseItemId)
    .maybeSingle()

  if (itemError) return { error: itemError.message }
  if (!item) return { error: "Warehouse item not found." }
  if (item.status !== "in_warehouse" || item.quantity <= 0) {
    return { error: "This item has no stock left to ship." }
  }
  if (!item.order_id) {
    return { error: "This item has no linked order — it can't be shipped through Logistics." }
  }

  const { error } = await admin
    .from("warehouse_items")
    .update({ pushed_to_logistics: true, pushed_at: new Date().toISOString() })
    .eq("id", warehouseItemId)

  if (error) return { error: error.message }

  revalidateTag("warehouse_items", {})
  revalidatePath("/warehouse")
  revalidatePath("/logistics")
  return { success: true }
}

/**
 * Dispatch a quantity of a SKU straight out of the warehouse under a bill
 * number — not tied to a single customer order (stock for one SKU can come
 * from several orders' production runs). Consumes the oldest stock first
 * across all in-warehouse rows for that SKU and logs a warehouse_dispatches
 * row per row consumed, for traceability back to the originating order(s).
 */
export async function dispatchWarehouseSku(formData: WarehouseSkuDispatchFormData) {
  const validated = warehouseSkuDispatchSchema.parse(formData)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  const { data: rows, error: rowsError } = await admin
    .from("warehouse_items")
    .select("id, quantity, order_id")
    .eq("sku", validated.sku)
    .eq("status", "in_warehouse")
    .eq("pushed_to_logistics", false)
    .gt("quantity", 0)
    .order("entry_date", { ascending: true })

  if (rowsError) return { error: rowsError.message }

  const available = (rows ?? []).reduce((s, r) => s + r.quantity, 0)
  if (validated.quantity > available) {
    return { error: `Cannot dispatch more than the ${available} available for this SKU.` }
  }

  let remaining = validated.quantity
  const today = new Date().toISOString().split("T")[0]

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

    remaining -= consume
  }

  revalidateTag("warehouse_items", {})
  revalidatePath("/warehouse")
  return { success: true }
}
