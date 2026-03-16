"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  purchaseInvoiceSchema,
  purchasePaymentSchema,
  type PurchaseInvoiceFormData,
  type PurchasePaymentFormData,
} from "@/lib/validators/purchase-invoices"

const VALID_PURCHASE_INVOICE_STATUSES = [
  "draft", "received", "paid", "partially_paid", "overdue", "cancelled",
] as const

// ===== Purchase Invoices =====

export async function getPurchaseInvoices(filters?: { status?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("purchase_invoices")
    .select("*")
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPurchaseInvoice(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("purchase_invoices")
    .select(`
      *,
      purchase_invoice_items(*),
      purchase_payments(*)
    `)
    .eq("id", id)
    .single()

  if (error) throw new Error(error.message)

  return {
    ...data,
    purchase_invoice_items: (data.purchase_invoice_items ?? []).sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        a.created_at.localeCompare(b.created_at)
    ),
    purchase_payments: (data.purchase_payments ?? []).sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        b.created_at.localeCompare(a.created_at)
    ),
  }
}

export async function createPurchaseInvoice(formData: PurchaseInvoiceFormData) {
  const validated = purchaseInvoiceSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: invoice, error: invErr } = await supabase
    .from("purchase_invoices")
    .insert({
      purchase_order_id: validated.purchase_order_id || null,
      supplier_name: validated.supplier_name,
      supplier_gst: validated.supplier_gst || null,
      invoice_number: validated.invoice_number || null,
      tax_rate: validated.tax_rate,
      place_of_supply: validated.place_of_supply || null,
      is_igst: validated.is_igst ?? false,
      invoice_date: validated.invoice_date,
      due_date: validated.due_date || null,
      notes: validated.notes || null,
    })
    .select()
    .single()

  if (invErr) return { error: invErr.message }

  const items = validated.items.map((item) => ({
    purchase_invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    hsn_code: item.hsn_code || null,
  }))

  const { error: itemsErr } = await supabase
    .from("purchase_invoice_items")
    .insert(items)

  if (itemsErr) return { error: itemsErr.message }

  revalidatePath("/finance/purchases")
  return { data: invoice }
}

export async function updatePurchaseInvoiceStatus(id: string, status: string) {
  if (!VALID_PURCHASE_INVOICE_STATUSES.includes(
    status as typeof VALID_PURCHASE_INVOICE_STATUSES[number]
  )) {
    return { error: "Invalid status" }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("purchase_invoices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/finance/purchases")
  revalidatePath(`/finance/purchases/${id}`)
  return { success: true }
}

export async function deletePurchaseInvoice(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("purchase_invoices").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/purchases")
  return { success: true }
}

// ===== Purchase Payments =====

export async function createPurchasePayment(formData: PurchasePaymentFormData) {
  const validated = purchasePaymentSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("purchase_payments")
    .insert({
      purchase_invoice_id: validated.purchase_invoice_id,
      amount: validated.amount,
      method: validated.method,
      reference: validated.reference || null,
      payment_date: validated.payment_date,
      notes: validated.notes || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/finance/purchases")
  return { data }
}

export async function deletePurchasePayment(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("purchase_payments").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/purchases")
  return { success: true }
}

// ===== Helpers =====

export async function getPurchaseOrdersForInvoice() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, po_number, supplier_name, total_amount")
    .in("status", ["received", "partial", "sent"])
    .order("created_at", { ascending: false })

  return data ?? []
}
