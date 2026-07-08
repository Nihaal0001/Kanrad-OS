"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  invoiceSchema,
  paymentSchema,
  costingSchema,
  type InvoiceFormData,
  type PaymentFormData,
  type CostingFormData,
} from "@/lib/validators/finance"
import { logAudit } from "@/actions/audit"

// ===== Invoices =====

export async function getInvoices(filters?: { status?: string }) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      let query = supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false })

      if (filters?.status) query = query.eq("status", filters.status)

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return data ?? []
    },
    [`invoices-${filters?.status ?? "all"}`],
    { tags: ["invoices"], revalidate: 60 }
  )()
}

/** Outstanding customer invoices — money owed to Kanrad, with any shipment bill it came from. */
export const getReceivables = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("*")
      .in("status", ["sent", "partially_paid"])
      .order("due_date", { ascending: true, nullsFirst: false })

    if (error) throw new Error(error.message)

    const outstanding = (invoices ?? []).filter((inv) => inv.total_amount - inv.amount_paid > 0.01)
    if (outstanding.length === 0) return []

    const { data: shipments } = await supabase
      .from("shipments")
      .select("invoice_id, bill_no")
      .in("invoice_id", outstanding.map((i) => i.id))

    const billByInvoice = new Map((shipments ?? []).map((s) => [s.invoice_id, s.bill_no]))

    return outstanding.map((inv) => ({
      ...inv,
      amount_due: Math.round((inv.total_amount - inv.amount_paid) * 100) / 100,
      bill_no: billByInvoice.get(inv.id) ?? null,
    }))
  },
  ["receivables"],
  { tags: ["invoices", "shipments"], revalidate: 60 }
)

export async function getInvoice(id: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          order:orders(id, order_number, product_variant),
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
    },
    [`invoice-${id}`],
    { tags: ["invoices"], revalidate: 60 }
  )()
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
      customer_id: validated.customer_id || null,
      customer_name: validated.customer_name,
      customer_address: validated.customer_address || null,
      customer_gst: validated.customer_gst || null,
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

  revalidateTag("invoices", {})
  revalidateTag("orders", {})
  revalidatePath("/finance/invoices")
  await logAudit({ entityType: "invoice", entityId: invoice.id, entityLabel: invoice.invoice_number, action: "created" })
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
  await logAudit({ entityType: "invoice", entityId: id, action: "status_changed", newValues: { status } })
  return { success: true }
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", id)
    .single()

  if (invoiceError || !invoice) return { error: invoiceError?.message ?? "Invoice not found" }

  if (invoice.status === "paid") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_id", user.id)
      .maybeSingle()

    if (profileError) return { error: profileError.message }
    if (profile?.role !== "admin") {
      return { error: "Only the owner can delete a paid invoice" }
    }
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id")
    .eq("invoice_id", id)

  if (paymentsError) return { error: paymentsError.message }

  const paymentIds = (payments ?? []).map((payment) => payment.id)

  if (paymentIds.length > 0) {
    const { error: paymentJournalError } = await supabase
      .from("journal_entries")
      .delete()
      .eq("reference_type", "payment")
      .in("reference_id", paymentIds)

    if (paymentJournalError) return { error: paymentJournalError.message }
  }

  const { error: invoiceJournalError } = await supabase
    .from("journal_entries")
    .delete()
    .eq("reference_type", "invoice")
    .eq("reference_id", id)

  if (invoiceJournalError) return { error: invoiceJournalError.message }

  const { error } = await supabase.from("invoices").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/invoices")
  revalidatePath("/finance/payments")
  revalidatePath("/finance/cash-flow")
  revalidatePath("/finance/journal")
  revalidatePath("/finance/ledger")
  revalidatePath("/finance/trial-balance")
  revalidatePath("/finance/reports")
  revalidatePath("/finance/bank-recon")
  revalidatePath("/finance")
  await logAudit({ entityType: "invoice", entityId: id, action: "deleted" })
  return { success: true }
}

// Helper for invoice creation: fetch order + customer info
export async function getOrderForInvoice(orderId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, product_variant,
      customer:customers(id, name, address, gstin),
      order_items(id, product_variant, size, color, quantity, unit_price)
    `)
    .eq("id", orderId)
    .single()

  if (error) return null

  const customer = Array.isArray(data.customer) ? data.customer[0] ?? null : data.customer
  return {
    ...data,
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          address: customer.address ?? null,
          gst_number: customer.gstin ?? null,
        }
      : null,
    order_items: data.order_items ?? [],
  }
}

// Helper: fetch all orderable (completed/dispatched) orders for invoice creation
export const getOrdersForInvoice = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, product_variant, status, customer:customers(id, name)")
      .in("status", ["completed", "dispatched"])
      .order("created_at", { ascending: false })

    if (error) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((o: any) => ({
      ...o,
      customer: (() => {
        const customer = Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer
        if (!customer) return null
        return { id: customer.id, name: customer.name }
      })(),
    }))
  },
  ["orders-for-invoice"],
  { tags: ["orders"], revalidate: 60 }
)

// ===== Payments =====

export const getPayments = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("payments")
      .select(`
        *,
        invoice:invoices(id, invoice_number, customer_name, total_amount)
      `)
      .order("payment_date", { ascending: false })

    if (error) throw new Error(error.message)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((p: any) => ({
      ...p,
      invoice: Array.isArray(p.invoice) ? p.invoice[0] ?? null : p.invoice,
    }))
  },
  ["payments"],
  { tags: ["payments"], revalidate: 60 }
)

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

  revalidateTag("payments", {})
  revalidateTag("invoices", {})
  revalidatePath("/finance/payments")
  revalidatePath("/finance/invoices")
  revalidatePath("/finance/cash-flow")
  revalidatePath("/finance")
  await logAudit({ entityType: "payment", entityId: data.id, action: "created", newValues: { amount: validated.amount, method: validated.method, invoice_id: validated.invoice_id } })
  return { data }
}

export async function deletePayment(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("payments").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidateTag("payments", {})
  revalidateTag("invoices", {})
  revalidatePath("/finance/payments")
  revalidatePath("/finance/invoices")
  revalidatePath("/finance/cash-flow")
  revalidatePath("/finance")
  return { success: true }
}

// ===== Order Costing =====

export const getOrderCostings = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("order_costings")
      .select(`
        *,
        order:orders(id, order_number, product_variant, total_quantity)
      `)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((c: any) => ({
      ...c,
      order: Array.isArray(c.order) ? c.order[0] ?? null : c.order,
    }))
  },
  ["order-costings"],
  { tags: ["order_costings"], revalidate: 60 }
)

export async function getOrderCosting(orderId: string) {
  const supabase = await createClient()

  // Fetch existing costing (if any)
  const { data: costing } = await supabase
    .from("order_costings")
    .select("*")
    .eq("order_id", orderId)
    .single()

  // Fetch order + customer
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(`
      id, order_number, product_variant, total_quantity, status,
      customer:customers(id, name),
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
    customer: Array.isArray(order.customer) ? order.customer[0] ?? null : order.customer,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    order_materials: (order.order_materials ?? []).map((om: any) => ({
      ...om,
      material: om.material_id ? (materialsMap[om.material_id] ?? null) : null,
    })),
  }

  // Compute material cost from order_materials (manual allocation)
  const manualMaterialCost = normalizedOrder.order_materials.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, om: any) => {
      const costPerUnit = om.material?.cost_per_unit ?? 0
      return sum + om.quantity_allocated * costPerUnit
    },
    0
  )

  const computedMaterialCost = manualMaterialCost

  // Fetch revenue from paid/sent invoices for this order
  const { data: invoices } = await supabase
    .from("invoices")
    .select("total_amount, amount_paid, status")
    .eq("order_id", orderId)
    .in("status", ["sent", "paid", "partially_paid"])

  const totalRevenue = (invoices ?? []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, inv: any) => sum + (inv.total_amount ?? 0),
    0
  )
  const totalReceived = (invoices ?? []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, inv: any) => sum + (inv.amount_paid ?? 0),
    0
  )

  return {
    order: normalizedOrder,
    costing,
    computedMaterialCost,
    totalRevenue,
    totalReceived,
    manualMaterialCost,
  }
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
      Customer: inv.customer_name,
      "Customer GST": inv.customer_gst ?? "",
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
      Customer: inv.customer_name,
      Description: item.description,
      Quantity: item.quantity,
      "Unit Price": item.unit_price,
      Amount: item.amount,
    }))
  )

  // Total row for invoices sheet
  const sum = (key: string) => invoices.reduce((s, r) => s + (Number((r as Record<string, unknown>)[key]) || 0), 0)
  const invoicesTotalRow: Record<string, unknown> = {
    "Invoice #": "TOTAL",
    Customer: "", "Customer GST": "", "Issue Date": "", "Due Date": "",
    Subtotal: sum("Subtotal"),
    CGST: sum("CGST"), "CGST %": "",
    SGST: sum("SGST"), "SGST %": "",
    IGST: sum("IGST"), "IGST %": "",
    "Tax (Total)": sum("Tax (Total)"),
    Total: sum("Total"),
    "Amount Paid": sum("Amount Paid"),
    Outstanding: sum("Outstanding"),
    Currency: "", Notes: "", "Created Date": "", Status: "",
  }

  // Total row for line items sheet
  const lineItemsTotalRow: Record<string, unknown> = {
    "Invoice #": "TOTAL", Customer: "", Description: "",
    Quantity: lineItems.reduce((s, r) => s + (Number(r.Quantity) || 0), 0),
    "Unit Price": "",
    Amount: lineItems.reduce((s, r) => s + (Number(r.Amount) || 0), 0),
  }

  return {
    invoices: [...invoices, invoicesTotalRow],
    lineItems: [...lineItems, lineItemsTotalRow],
  }
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

  revalidateTag("order_costings", {})
  revalidatePath("/finance/costing")
  revalidatePath(`/finance/costing/${orderId}`)
  return { data }
}
