"use server"

import { createClient } from "@/lib/supabase/server"

export async function exportAllData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const [
    { data: orders },
    { data: buyers },
    { data: orderItems },
    { data: materials },
    { data: stockTx },
    { data: purchaseOrders },
    { data: invoices },
    { data: invoiceItems },
    { data: payments },
    { data: expenses },
    { data: purchaseInvoices },
    { data: purchasePayments },
    { data: production },
    { data: attendance },
    { data: leaves },
    { data: payroll },
    { data: tasks },
    { data: auditLogs },
  ] = await Promise.all([
    supabase.from("orders").select("*, buyer:buyers(name, company)").order("created_at", { ascending: false }),
    supabase.from("buyers").select("*").order("name"),
    supabase.from("order_items").select("*, order:orders(order_number)").order("created_at", { ascending: false }),
    supabase.from("materials").select("*, category:material_categories(name)").order("name"),
    supabase.from("stock_transactions").select("*, material:materials(name, sku)").order("created_at", { ascending: false }),
    supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
    supabase.from("invoices").select("*").order("issue_date", { ascending: false }),
    supabase.from("invoice_items").select("*, invoice:invoices(invoice_number)").order("created_at", { ascending: false }),
    supabase.from("payments").select("*, invoice:invoices(invoice_number, buyer_name)").order("payment_date", { ascending: false }),
    supabase.from("expenses").select("*, category:expense_categories(name)").order("expense_date", { ascending: false }),
    supabase.from("purchase_invoices").select("*").order("invoice_date", { ascending: false }),
    supabase.from("purchase_payments").select("*").order("payment_date", { ascending: false }),
    supabase.from("production_tracking").select("*, order:orders(order_number), stage:production_stages(name)").order("updated_at", { ascending: false }),
    supabase.from("attendance").select("*, worker:profiles(full_name, department)").order("date", { ascending: false }),
    supabase.from("leaves").select("*, worker:profiles!worker_id(full_name, department)").order("created_at", { ascending: false }),
    supabase.from("payroll").select("*, worker:profiles(full_name, department)").order("period_start", { ascending: false }),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(5000),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flatten = (arr: any[] | null, joinKeys: string[]) => {
    if (!arr) return []
    return arr.map((row) => {
      const flat: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(row)) {
        if (joinKeys.includes(k) && v && typeof v === "object" && !Array.isArray(v)) {
          for (const [jk, jv] of Object.entries(v as Record<string, unknown>)) {
            flat[`${k}_${jk}`] = jv
          }
        } else {
          flat[k] = v
        }
      }
      return flat
    })
  }

  return {
    data: {
      Orders: flatten(orders, ["buyer"]),
      Buyers: buyers ?? [],
      "Order Items": flatten(orderItems, ["order"]),
      Materials: flatten(materials, ["category"]),
      "Stock Transactions": flatten(stockTx, ["material"]),
      "Purchase Orders": purchaseOrders ?? [],
      Invoices: invoices ?? [],
      "Invoice Items": flatten(invoiceItems, ["invoice"]),
      Payments: flatten(payments, ["invoice"]),
      Expenses: flatten(expenses, ["category"]),
      "Purchase Invoices": purchaseInvoices ?? [],
      "Purchase Payments": purchasePayments ?? [],
      Production: flatten(production, ["order", "stage"]),
      Attendance: flatten(attendance, ["worker"]),
      Leaves: flatten(leaves, ["worker"]),
      Payroll: flatten(payroll, ["worker"]),
      Tasks: tasks ?? [],
      "Audit Log": auditLogs ?? [],
    },
  }
}
