"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  invoiceSchema,
  paymentSchema,
  costingSchema,
  type InvoiceFormData,
  type PaymentFormData,
  type CostingFormData,
} from "@/lib/validators/finance"

// ===== Invoices =====

export async function getInvoices(filters?: { status?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getInvoice(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      order:orders(id, order_number, style_name),
      invoice_items(*)
    `)
    .eq("id", id)
    .single()

  if (error) throw new Error(error.message)

  return {
    ...data,
    order: Array.isArray(data.order) ? data.order[0] ?? null : data.order,
    invoice_items: (data.invoice_items ?? []).sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        a.created_at.localeCompare(b.created_at)
    ),
  }
}

export async function createInvoice(formData: InvoiceFormData) {
  const validated = invoiceSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Insert invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      order_id: validated.order_id || null,
      buyer_id: validated.buyer_id || null,
      buyer_name: validated.buyer_name,
      buyer_address: validated.buyer_address || null,
      buyer_gst: validated.buyer_gst || null,
      tax_rate: validated.tax_rate,
      place_of_supply: validated.place_of_supply || null,
      reverse_charge: validated.reverse_charge ?? false,
      is_igst: validated.is_igst ?? false,
      issue_date: validated.issue_date,
      due_date: validated.due_date || null,
      notes: validated.notes || null,
    })
    .select()
    .single()

  if (invErr) return { error: invErr.message }

  // Insert items
  const items = validated.items.map((item) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    hsn_code: item.hsn_code || null,
  }))

  const { error: itemsErr } = await supabase.from("invoice_items").insert(items)
  if (itemsErr) return { error: itemsErr.message }

  revalidatePath("/finance/invoices")
  return { data: invoice }
}

const VALID_INVOICE_STATUSES = ["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"] as const

export async function updateInvoiceStatus(id: string, status: string) {
  if (!VALID_INVOICE_STATUSES.includes(status as typeof VALID_INVOICE_STATUSES[number])) {
    return { error: "Invalid status" }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("invoices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/finance/invoices")
  revalidatePath(`/finance/invoices/${id}`)
  return { success: true }
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("invoices").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/invoices")
  return { success: true }
}

// Helper for invoice creation: fetch order + buyer info
export async function getOrderForInvoice(orderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, style_name,
      buyer:buyers(id, name, address, gst_number),
      order_items(id, size, color, quantity, unit_price)
    `)
    .eq("id", orderId)
    .single()

  if (error) return null

  return {
    ...data,
    buyer: Array.isArray(data.buyer) ? data.buyer[0] ?? null : data.buyer,
    order_items: data.order_items ?? [],
  }
}

// Helper: fetch all orderable (completed/dispatched) orders for invoice creation
export async function getOrdersForInvoice() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, style_name, status, buyer:buyers(id, name)")
    .in("status", ["completed", "dispatched"])
    .order("created_at", { ascending: false })

  if (error) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((o: any) => ({
    ...o,
    buyer: Array.isArray(o.buyer) ? o.buyer[0] ?? null : o.buyer,
  }))
}

// ===== Payments =====

export async function getPayments() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payments")
    .select(`
      *,
      invoice:invoices(id, invoice_number, buyer_name, total_amount)
    `)
    .order("payment_date", { ascending: false })

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({
    ...p,
    invoice: Array.isArray(p.invoice) ? p.invoice[0] ?? null : p.invoice,
  }))
}

export async function createPayment(formData: PaymentFormData) {
  const validated = paymentSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      invoice_id: validated.invoice_id,
      amount: validated.amount,
      method: validated.method,
      reference: validated.reference || null,
      payment_date: validated.payment_date,
      notes: validated.notes || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/finance/payments")
  revalidatePath("/finance/invoices")
  return { data }
}

export async function deletePayment(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("payments").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/payments")
  revalidatePath("/finance/invoices")
  return { success: true }
}

// ===== Order Costing =====

export async function getOrderCostings() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("order_costings")
    .select(`
      *,
      order:orders(id, order_number, style_name, total_quantity)
    `)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((c: any) => ({
    ...c,
    order: Array.isArray(c.order) ? c.order[0] ?? null : c.order,
  }))
}

export async function getOrderCosting(orderId: string) {
  const supabase = await createClient()

  // Fetch existing costing (if any)
  const { data: costing } = await supabase
    .from("order_costings")
    .select("*")
    .eq("order_id", orderId)
    .single()

  // Fetch order + buyer
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(`
      id, order_number, style_name, total_quantity, status,
      buyer:buyers(id, name),
      order_materials(id, quantity_required, quantity_allocated, material_id)
    `)
    .eq("id", orderId)
    .single()

  if (orderErr) throw new Error(orderErr.message)

  // Fetch materials separately (order_materials.material_id has no FK constraint)
  const materialIds = (order.order_materials ?? [])
    .map((om: { material_id: string | null }) => om.material_id)
    .filter(Boolean) as string[]

  const materialsMap: Record<string, { id: string; name: string; cost_per_unit: number; unit: string }> = {}
  if (materialIds.length > 0) {
    const { data: materials } = await supabase
      .from("materials")
      .select("id, name, cost_per_unit, unit")
      .in("id", materialIds)
    for (const m of materials ?? []) {
      materialsMap[m.id] = m
    }
  }

  const normalizedOrder = {
    ...order,
    buyer: Array.isArray(order.buyer) ? order.buyer[0] ?? null : order.buyer,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    order_materials: (order.order_materials ?? []).map((om: any) => ({
      ...om,
      material: om.material_id ? (materialsMap[om.material_id] ?? null) : null,
    })),
  }

  // Compute material cost from order_materials
  const materialCost = normalizedOrder.order_materials.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, om: any) => {
      const costPerUnit = om.material?.cost_per_unit ?? 0
      return sum + om.quantity_allocated * costPerUnit
    },
    0
  )

  return { order: normalizedOrder, costing, computedMaterialCost: materialCost }
}

// ===== Invoice Export =====

export async function getInvoicesForExport() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invoices")
    .select(`*, invoice_items(*)`)
    .order("issue_date", { ascending: false })

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoices = (data ?? []).map((inv: any) => {
    const cgstPct = !inv.is_igst && inv.tax_rate > 0 ? inv.tax_rate / 2 : 0
    const sgstPct = !inv.is_igst && inv.tax_rate > 0 ? inv.tax_rate / 2 : 0
    const igstPct = inv.is_igst ? inv.tax_rate : 0

    return {
      "Invoice #": inv.invoice_number,
      Buyer: inv.buyer_name,
      "Buyer GST": inv.buyer_gst ?? "",
      "Issue Date": inv.issue_date ?? "",
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
      "Amount Paid": inv.amount_paid ?? 0,
      Outstanding: (inv.total_amount ?? 0) - (inv.amount_paid ?? 0),
      Currency: "INR",
      Notes: inv.notes ?? "",
      "Created Date": inv.created_at ? inv.created_at.split("T")[0] : "",
      Status: inv.status,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItems = (data ?? []).flatMap((inv: any) =>
    (inv.invoice_items ?? []).map((item: {
      description: string
      quantity: number
      unit_price: number
      amount: number
    }) => ({
      "Invoice #": inv.invoice_number,
      Buyer: inv.buyer_name,
      Description: item.description,
      Quantity: item.quantity,
      "Unit Price": item.unit_price,
      Amount: item.amount,
    }))
  )

  return { invoices, lineItems }
}

export async function upsertOrderCosting(orderId: string, formData: CostingFormData) {
  const validated = costingSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("order_costings")
    .upsert(
      {
        order_id: orderId,
        material_cost: validated.material_cost,
        labor_cost: validated.labor_cost,
        overhead_cost: validated.overhead_cost,
        other_cost: validated.other_cost,
        notes: validated.notes || null,
      },
      { onConflict: "order_id" }
    )
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/finance/costing")
  revalidatePath(`/finance/costing/${orderId}`)
  return { data }
}

