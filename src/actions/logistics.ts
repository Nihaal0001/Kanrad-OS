"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/actions/audit"
import { shipmentSchema } from "@/lib/validators/logistics"
import type { ShipmentFormData } from "@/lib/validators/logistics"

const VALID_STATUSES = ["pending", "dispatched", "in_transit", "delivered", "delayed"] as const

// ── Queries ──────────────────────────────────────────────────

export async function getShipments(filters?: { status?: string }) {
  const supabase = await createClient()
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
}

// Lightweight order list for the create form select
export async function getOrdersForSelect() {
  const supabase = await createClient()
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
}

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

  revalidatePath("/logistics")
  return { success: true }
}

export async function markShipmentDelayed(id: string) {
  return updateShipmentStatus(id, "delayed")
}
