"use server"

import { createClient } from "@/lib/supabase/server"

export async function getHistoryOrders() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, product_variant, status, quantity, created_at, customer:customers(name, company)")
    .in("status", ["completed", "dispatched", "cancelled"])
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((o: any) => ({
    ...o,
    customer: Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer,
  }))
}

export async function getHistoryProduction() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("production_tracking")
    .select("id, batch_number, status, created_at, order:orders(order_number, product_variant)")
    .eq("status", "completed")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({
    ...p,
    order: Array.isArray(p.order) ? p.order[0] ?? null : p.order,
  }))
}

export async function getHistoryPurchaseOrders() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("id, po_number, supplier_name, status, total_amount, created_at")
    .in("status", ["received", "cancelled"])
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getHistoryLogistics() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("shipments")
    .select("id, shipment_number, customer_name, courier_name, tracking_number, status, expected_delivery_date, created_at")
    .eq("status", "delivered")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getHistoryFinance() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("finance_transactions")
    .select("id, transaction_date, description, amount, transaction_type, payment_status, created_at")
    .eq("payment_status", "paid")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
