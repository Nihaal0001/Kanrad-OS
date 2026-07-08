"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMasterCartonRatios } from "@/lib/master-cartons"

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

      return items.map((i) => ({
        ...i,
        master_cartons: ratios.has(i.item_name) ? Math.round(i.quantity * ratios.get(i.item_name)! * 1000) / 1000 : null,
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
