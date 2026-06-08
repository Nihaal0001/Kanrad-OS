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
