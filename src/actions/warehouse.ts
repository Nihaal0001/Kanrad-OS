"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/actions/audit"
import { warehouseItemSchema, exitItemSchema } from "@/lib/validators/warehouse"
import type { WarehouseItemFormData, ExitItemFormData } from "@/lib/validators/warehouse"

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
      return data ?? []
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

export interface ProducedItem {
  name: string
  sku: string | null
  category: string | null
}

/**
 * Products that have actually been produced — i.e. orders with logged
 * production output. Used to restrict the warehouse "Add Item" form to
 * finished goods that came off production (not the full BOM catalogue).
 */
export const getProducedItems = unstable_cache(
  async (): Promise<ProducedItem[]> => {
    const supabase = createAdminClient()

    // Distinct product names from orders that have at least one production log
    const { data: logs, error } = await supabase
      .from("production_daily_logs")
      .select("order:orders(product_variant)")

    if (error || !logs) return []

    const names = Array.from(
      new Set(
        logs
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((l: any) => (Array.isArray(l.order) ? l.order[0]?.product_variant : l.order?.product_variant))
          .filter((n: string | null | undefined): n is string => Boolean(n && n.trim()))
          .map((n: string) => n.trim())
      )
    ).sort()

    if (names.length === 0) return []

    // Enrich with SKU/category from the BOM catalogue where the names match
    const { data: boms } = await supabase
      .from("bom_headers")
      .select("product_name, product_sku, category")

    const bomByName = new Map<string, { product_sku: string | null; category: string | null }>()
    for (const b of boms ?? []) {
      bomByName.set(b.product_name, { product_sku: b.product_sku ?? null, category: b.category ?? null })
    }

    return names.map((name) => ({
      name,
      sku: bomByName.get(name)?.product_sku ?? null,
      category: bomByName.get(name)?.category ?? null,
    }))
  },
  ["produced-items"],
  { tags: ["production", "orders"], revalidate: 30 }
)

// ── Mutations ────────────────────────────────────────────────

export async function createWarehouseItem(formData: WarehouseItemFormData) {
  const validated = warehouseItemSchema.parse(formData)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("warehouse_items")
    .insert({
      item_name: validated.item_name,
      sku: validated.sku || null,
      category: validated.category || null,
      quantity: validated.quantity,
      unit: validated.unit,
      location: validated.location || null,
      remarks: validated.remarks || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  void logAudit({
    entityType: "warehouse_item",
    entityId: data.id,
    entityLabel: validated.item_name,
    action: "created",
    newValues: { item_name: validated.item_name, quantity: validated.quantity },
  })

  revalidateTag("warehouse_items", {})
  revalidatePath("/warehouse")
  return { data }
}

export async function exitWarehouseItem(id: string, formData: ExitItemFormData) {
  const validated = exitItemSchema.parse(formData)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("warehouse_items")
    .update({
      status: "dispatched",
      exit_date: validated.exit_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  void logAudit({
    entityType: "warehouse_item",
    entityId: id,
    entityLabel: data.item_name,
    action: "status_changed",
    newValues: { status: "dispatched", exit_date: validated.exit_date },
  })

  revalidateTag("warehouse_items", {})
  revalidatePath("/warehouse")
  return { data }
}
