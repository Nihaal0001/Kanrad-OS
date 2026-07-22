"use server"

import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"

export const getHistoryOrders = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, product_variant, status, total_quantity, created_at, customer:customers(name, company)")
      .in("status", ["completed", "dispatched", "cancelled"])
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((o: any) => ({
      ...o,
      customer: Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer,
    }))
  },
  ["history-orders"],
  { tags: ["orders"], revalidate: 60 }
)

export const getHistoryProduction = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("production_daily_logs")
      .select("id, log_date, quantity_produced, quantity_rejected, created_at, order:orders(order_number, product_variant)")
      .order("log_date", { ascending: false })

    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((p: any) => ({
      ...p,
      order: Array.isArray(p.order) ? p.order[0] ?? null : p.order,
    }))
  },
  ["history-production"],
  { tags: ["production"], revalidate: 60 }
)

export const getHistoryPurchaseOrders = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("id, po_number, supplier_name, status, total_amount, created_at")
      .in("status", ["received", "cancelled"])
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  },
  ["history-purchase-orders"],
  { tags: ["purchase_orders"], revalidate: 60 }
)

export const getHistoryLogistics = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("shipments")
      .select("id, shipment_number, customer_name, courier_name, tracking_number, status, expected_delivery_date, created_at")
      .eq("status", "delivered")
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  },
  ["history-logistics"],
  { tags: ["shipments"], revalidate: 60 }
)

export const getHistoryFinance = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, customer_name, total_amount, amount_paid, status, issue_date, created_at")
      .eq("status", "paid")
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  },
  ["history-finance"],
  { tags: ["invoices"], revalidate: 60 }
)

/** Purchase invoices (payables) that have been fully paid off. */
export const getHistoryPayables = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("purchase_invoices")
      .select("id, invoice_number, supplier_name, total_amount, amount_paid, status, invoice_date, created_at")
      .eq("status", "paid")
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  },
  ["history-payables"],
  { tags: ["purchase_invoices"], revalidate: 60 }
)

/** Every warehouse dispatch (SKU-wise, with bill number) that's gone out. */
export const getHistoryDispatches = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("warehouse_dispatches")
      .select(`
        id, quantity, bill_no, dispatched_at, notes, created_at,
        warehouse_item:warehouse_items(item_name, sku),
        order:orders(order_number)
      `)
      .order("dispatched_at", { ascending: false })

    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((d: any) => ({
      ...d,
      warehouse_item: Array.isArray(d.warehouse_item) ? d.warehouse_item[0] ?? null : d.warehouse_item,
      order: Array.isArray(d.order) ? d.order[0] ?? null : d.order,
    }))
  },
  ["history-dispatches"],
  { tags: ["warehouse_items"], revalidate: 60 }
)
