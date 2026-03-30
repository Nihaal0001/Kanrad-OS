"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/actions/audit"

// ── Validators ───────────────────────────────────────────────

export const rejectionSchema = z.object({
  stage: z.enum(["production", "warehouse", "logistics", "client"]),
  item_name: z.string().min(1, "Item name is required").max(200),
  quantity: z.number({ invalid_type_error: "Quantity must be a number" }).min(0.001, "Quantity must be greater than 0"),
  reason: z.string().min(1, "Reason is required").max(1000),
  notes: z.string().max(2000).optional().or(z.literal("")),
})

export const approveReturnSchema = z.object({
  return_type: z.enum(["loss", "return_to_usable", "non_saleable", "saleable"]),
})

export type RejectionFormData = z.infer<typeof rejectionSchema>
export type ApproveReturnFormData = z.infer<typeof approveReturnSchema>

// ── Queries ──────────────────────────────────────────────────

export async function getRejections() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rejections")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getRejectionSummary() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rejections")
    .select("quantity, return_type")

  if (error) return { totalRejected: 0, totalReturned: 0, totalLoss: 0 }

  const rows = data ?? []
  const totalRejected = rows.reduce((acc, r) => acc + (r.quantity ?? 0), 0)
  const totalReturned = rows
    .filter((r) => r.return_type === "return_to_usable" || r.return_type === "saleable")
    .reduce((acc, r) => acc + (r.quantity ?? 0), 0)
  const totalLoss = rows
    .filter((r) => r.return_type === "loss" || r.return_type === "non_saleable")
    .reduce((acc, r) => acc + (r.quantity ?? 0), 0)

  return { totalRejected, totalReturned, totalLoss }
}

// ── Mutations ────────────────────────────────────────────────

export async function createRejection(formData: RejectionFormData) {
  const validated = rejectionSchema.parse(formData)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("rejections")
    .insert({
      stage: validated.stage,
      item_name: validated.item_name,
      quantity: validated.quantity,
      reason: validated.reason,
      notes: validated.notes || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  void logAudit({
    entityType: "rejection",
    entityId: data.id,
    entityLabel: `${validated.item_name} (${validated.stage})`,
    action: "created",
    newValues: { stage: validated.stage, quantity: validated.quantity, reason: validated.reason },
  })

  revalidatePath("/rejections")
  return { data }
}

export async function approveRejectionReturn(id: string, formData: ApproveReturnFormData) {
  const validated = approveReturnSchema.parse(formData)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("rejections")
    .update({ return_type: validated.return_type })
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  void logAudit({
    entityType: "rejection",
    entityId: id,
    entityLabel: data.item_name,
    action: "updated",
    newValues: { return_type: validated.return_type },
  })

  revalidatePath("/rejections")
  return { data }
}
