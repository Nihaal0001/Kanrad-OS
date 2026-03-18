"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/actions/audit"
import { creditNoteSchema, type CreditNoteFormData } from "@/lib/validators/credit-notes"

export async function getCreditNotes(filters?: { invoice_id?: string; status?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("credit_notes")
    .select("*, credit_note_items(*)")
    .order("created_at", { ascending: false })

  if (filters?.invoice_id) query = query.eq("invoice_id", filters.invoice_id)
  if (filters?.status) query = query.eq("status", filters.status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCreditNote(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("credit_notes")
    .select("*, credit_note_items(*)")
    .eq("id", id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createCreditNote(formData: CreditNoteFormData) {
  const validated = creditNoteSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const subtotal = validated.items.reduce((s, i) => s + i.amount, 0)
  const taxAmount = Math.round(subtotal * (validated.tax_rate / 100) * 100) / 100
  const totalAmount = subtotal + taxAmount

  const { data: cn, error: cnErr } = await supabase
    .from("credit_notes")
    .insert({
      invoice_id: validated.invoice_id || null,
      order_id: validated.order_id || null,
      buyer_name: validated.buyer_name,
      buyer_gst: validated.buyer_gst || null,
      issue_date: validated.issue_date,
      reason: validated.reason || null,
      subtotal,
      tax_rate: validated.tax_rate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: validated.notes || null,
      credit_note_number: "",
    })
    .select()
    .single()

  if (cnErr || !cn) return { error: cnErr?.message ?? "Failed to create credit note" }

  const items = validated.items.map((item) => ({
    credit_note_id: cn.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: item.amount,
  }))

  const { error: itemsErr } = await supabase.from("credit_note_items").insert(items)
  if (itemsErr) {
    await supabase.from("credit_notes").delete().eq("id", cn.id)
    return { error: itemsErr.message }
  }

  revalidatePath("/finance/credit-notes")
  if (validated.invoice_id) revalidatePath(`/finance/invoices/${validated.invoice_id}`)
  await logAudit({
    entityType: "credit_note",
    entityId: cn.id,
    entityLabel: cn.credit_note_number || validated.buyer_name,
    action: "created",
    newValues: {
      invoice_id: validated.invoice_id || null,
      order_id: validated.order_id || null,
      buyer_name: validated.buyer_name,
      issue_date: validated.issue_date,
      total_amount: totalAmount,
      item_count: validated.items.length,
    },
  })
  return { data: cn }
}

export async function updateCreditNoteStatus(id: string, status: "draft" | "issued" | "cancelled") {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("credit_notes").update({ status }).eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/credit-notes")
  await logAudit({ entityType: "credit_note", entityId: id, action: "status_changed", newValues: { status } })
  return { success: true }
}

export async function deleteCreditNote(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("credit_notes").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/credit-notes")
  await logAudit({ entityType: "credit_note", entityId: id, action: "deleted" })
  return { success: true }
}
