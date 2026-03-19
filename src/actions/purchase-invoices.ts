"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/actions/audit"
import {
  purchaseInvoiceSchema,
  purchasePaymentSchema,
  type PurchaseInvoiceFormData,
  type PurchasePaymentFormData,
} from "@/lib/validators/purchase-invoices"

const VALID_PURCHASE_INVOICE_STATUSES = [
  "draft", "received", "paid", "partially_paid", "overdue", "cancelled",
] as const

async function validateLinkedPurchaseOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  purchaseOrderId: string
) {
  const { data: purchaseOrder, error } = await supabase
    .from("purchase_orders")
    .select("id, approval_status")
    .eq("id", purchaseOrderId)
    .maybeSingle()

  if (error) {
    return { error: error.message }
  }

  if (!purchaseOrder) {
    return { error: "Linked purchase order was not found" }
  }

  if (purchaseOrder.approval_status !== "approved") {
    return { error: "Only approved purchase orders can be linked to a purchase invoice" }
  }

  return { data: purchaseOrder }
}

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

  // If linked to a PO, fetch PO + items for matching
  let linkedPO = null
  if (data.purchase_order_id) {
    const { data: po } = await supabase
      .from("purchase_orders")
      .select(`*, purchase_order_items(*)`)
      .eq("id", data.purchase_order_id)
      .single()
    if (po) {
      linkedPO = {
        ...po,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        purchase_order_items: (po.purchase_order_items ?? []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)),
      }
    }
  }

  return {
    ...data,
    linked_po: linkedPO,
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

  if (validated.purchase_order_id) {
    const poCheck = await validateLinkedPurchaseOrder(supabase, validated.purchase_order_id)
    if ("error" in poCheck && poCheck.error) return { error: poCheck.error }
  }

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
      document_path: validated.document_path || null,
      document_url: validated.document_url || null,
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
  await logAudit({
    entityType: "purchase_invoice",
    entityId: invoice.id,
    entityLabel: validated.invoice_number || validated.supplier_name,
    action: "created",
    newValues: {
      purchase_order_id: validated.purchase_order_id || null,
      supplier_name: validated.supplier_name,
      invoice_number: validated.invoice_number || null,
      invoice_date: validated.invoice_date,
      tax_rate: validated.tax_rate,
      item_count: validated.items.length,
    },
  })
  return { data: invoice }
}

export async function createImportedPurchaseInvoice(
  formData: PurchaseInvoiceFormData & {
    document_path?: string
    document_url?: string
  }
) {
  const validated = purchaseInvoiceSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  if (validated.purchase_order_id) {
    const poCheck = await validateLinkedPurchaseOrder(supabase, validated.purchase_order_id)
    if ("error" in poCheck && poCheck.error) return { error: poCheck.error }
  }

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
      document_path: formData.document_path || null,
      document_url: formData.document_url || null,
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
  await logAudit({
    entityType: "purchase_invoice",
    entityId: invoice.id,
    entityLabel: validated.invoice_number || validated.supplier_name,
    action: "created",
    newValues: {
      purchase_order_id: validated.purchase_order_id || null,
      supplier_name: validated.supplier_name,
      invoice_number: validated.invoice_number || null,
      invoice_date: validated.invoice_date,
      tax_rate: validated.tax_rate,
      item_count: validated.items.length,
      imported: true,
    },
  })
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
  await logAudit({ entityType: "purchase_invoice", entityId: id, action: "status_changed", newValues: { status } })
  return { success: true }
}

export async function deletePurchaseInvoice(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: invoice, error: invoiceError } = await supabase
    .from("purchase_invoices")
    .select("id, status")
    .eq("id", id)
    .single()

  if (invoiceError || !invoice) return { error: invoiceError?.message ?? "Purchase invoice not found" }

  if (invoice.status === "paid") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_id", user.id)
      .maybeSingle()

    if (profileError) return { error: profileError.message }
    if (profile?.role !== "admin") {
      return { error: "Only the owner can delete a paid purchase invoice" }
    }
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("purchase_payments")
    .select("id")
    .eq("purchase_invoice_id", id)

  if (paymentsError) return { error: paymentsError.message }

  const paymentIds = (payments ?? []).map((payment) => payment.id)

  if (paymentIds.length > 0) {
    const { error: paymentJournalError } = await supabase
      .from("journal_entries")
      .delete()
      .eq("reference_type", "purchase_payment")
      .in("reference_id", paymentIds)

    if (paymentJournalError) return { error: paymentJournalError.message }
  }

  const { error: invoiceJournalError } = await supabase
    .from("journal_entries")
    .delete()
    .eq("reference_type", "purchase_invoice")
    .eq("reference_id", id)

  if (invoiceJournalError) return { error: invoiceJournalError.message }

  const { error } = await supabase.from("purchase_invoices").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/purchases")
  revalidatePath("/finance/cash-flow")
  revalidatePath("/finance/journal")
  revalidatePath("/finance/ledger")
  revalidatePath("/finance/trial-balance")
  revalidatePath("/finance/reports")
  revalidatePath("/finance/bank-recon")
  revalidatePath("/finance")
  await logAudit({ entityType: "purchase_invoice", entityId: id, action: "deleted" })
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
  revalidatePath("/finance/cash-flow")
  revalidatePath("/finance")
  await logAudit({
    entityType: "purchase_payment",
    entityId: data.id,
    action: "created",
    newValues: {
      purchase_invoice_id: validated.purchase_invoice_id,
      amount: validated.amount,
      method: validated.method,
      payment_date: validated.payment_date,
    },
  })
  return { data }
}

export async function deletePurchasePayment(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("purchase_payments").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/purchases")
  revalidatePath("/finance/cash-flow")
  revalidatePath("/finance")
  await logAudit({ entityType: "purchase_payment", entityId: id, action: "deleted" })
  return { success: true }
}

// ===== Helpers =====

// ===== Export =====

export async function getPurchaseInvoicesForExport() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("purchase_invoices")
    .select(`
      *,
      purchase_invoice_items(*)
    `)
    .order("invoice_date", { ascending: false })

  if (error) throw new Error(error.message)

  const invoices = (data ?? []).map((inv) => {
    const cgstPct = !inv.is_igst && inv.tax_rate > 0 ? inv.tax_rate / 2 : 0
    const sgstPct = !inv.is_igst && inv.tax_rate > 0 ? inv.tax_rate / 2 : 0
    const igstPct = inv.is_igst ? inv.tax_rate : 0

    return {
      Vendor: inv.supplier_name,
      "Invoice #": inv.invoice_number ?? "",
      Date: inv.invoice_date ?? "",
      "Due Date": inv.due_date ?? "",
      Subtotal: inv.subtotal ?? 0,
      CGST: inv.cgst_amount ?? 0,
      "CGST %": cgstPct > 0 ? `${cgstPct}%` : "",
      SGST: inv.sgst_amount ?? 0,
      "SGST %": sgstPct > 0 ? `${sgstPct}%` : "",
      IGST: inv.igst_amount ?? 0,
      "IGST %": igstPct > 0 ? `${igstPct}%` : "",
      "Tax (Total)": inv.tax_amount ?? 0,
      Total: inv.total_amount ?? 0,
      Currency: "INR",
      "Payment Terms": inv.notes ?? "",
      "Upload Date": inv.created_at ? inv.created_at.split("T")[0] : "",
      Status: inv.status,
    }
  })

  const lineItems = (data ?? []).flatMap((inv) =>
    (inv.purchase_invoice_items ?? []).map((item: {
      description: string
      quantity: number
      unit_price: number
      amount: number
    }) => ({
      "Invoice Vendor": inv.supplier_name,
      "Invoice #": inv.invoice_number ?? "",
      Description: item.description,
      Quantity: item.quantity,
      "Unit Price": item.unit_price,
      Amount: item.amount,
    }))
  )

  // Total row for invoices sheet
  const sum = (key: string) => invoices.reduce((s, r) => s + (Number((r as Record<string, unknown>)[key]) || 0), 0)
  const invoicesTotalRow: Record<string, unknown> = {
    Vendor: "TOTAL",
    "Invoice #": "", Date: "", "Due Date": "",
    Subtotal: sum("Subtotal"),
    CGST: sum("CGST"), "CGST %": "",
    SGST: sum("SGST"), "SGST %": "",
    IGST: sum("IGST"), "IGST %": "",
    "Tax (Total)": sum("Tax (Total)"),
    Total: sum("Total"),
    Currency: "", "Payment Terms": "", "Upload Date": "", Status: "",
  }

  // Total row for line items sheet
  const lineItemsTotalRow: Record<string, unknown> = {
    "Invoice Vendor": "TOTAL", "Invoice #": "", Description: "",
    Quantity: lineItems.reduce((s, r) => s + (Number(r.Quantity) || 0), 0),
    "Unit Price": "",
    Amount: lineItems.reduce((s, r) => s + (Number(r.Amount) || 0), 0),
  }

  return {
    invoices: [...invoices, invoicesTotalRow],
    lineItems: [...lineItems, lineItemsTotalRow],
  }
}

export async function getPurchaseOrdersForInvoice() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, po_number, supplier_name, total_amount")
    .in("status", ["received", "partial", "sent"])
    .eq("approval_status", "approved")
    .order("created_at", { ascending: false })

  return data ?? []
}
