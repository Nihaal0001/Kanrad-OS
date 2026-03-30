"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/actions/audit"

// ── Validators ───────────────────────────────────────────────

export const warehouseItemSchema = z.object({
  item_name: z.string().min(1, "Item name is required").max(200),
  sku: z.string().max(100).optional().or(z.literal("")),
  category: z.string().max(100).optional().or(z.literal("")),
  quantity: z.number({ invalid_type_error: "Quantity must be a number" }).min(0),
  unit: z.string().min(1, "Unit is required").max(50),
  location: z.string().max(200).optional().or(z.literal("")),
  remarks: z.string().max(1000).optional().or(z.literal("")),
})

export const exitItemSchema = z.object({
  exit_date: z.string().min(1, "Exit date is required"),
})

export type WarehouseItemFormData = z.infer<typeof warehouseItemSchema>
export type ExitItemFormData = z.infer<typeof exitItemSchema>

// ── Queries ──────────────────────────────────────────────────

export async function getWarehouseItems(filters?: {
  status?: string
  location?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from("warehouse_items")
    .select("*")
    .order("created_at", { ascending: false })

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.location) query = query.eq("location", filters.location)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getWarehouseLocations(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("warehouse_items")
    .select("location")
    .not("location", "is", null)

  if (error) return []

  const unique = Array.from(
    new Set((data ?? []).map((r: { location: string | null }) => r.location).filter(Boolean))
  ) as string[]

  return unique.sort()
}

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

  revalidatePath("/warehouse")
  return { data }
}
