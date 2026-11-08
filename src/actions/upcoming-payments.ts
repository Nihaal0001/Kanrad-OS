"use server"

import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"

export interface UpcomingPayment {
  id: string
  direction: "incoming" | "outgoing"
  party: string
  reference: string
  due_date: string
  amount: number
  status: string
  href: string
}

/** Payment schedule: customer invoices still to be collected + supplier bills still to be paid. */
export const getUpcomingPayments = unstable_cache(
  async (): Promise<UpcomingPayment[]> => {
    const supabase = createAdminClient()

    const [receivablesRes, payablesRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_number, customer_name, due_date, total_amount, amount_paid, status")
        .in("status", ["sent", "partially_paid", "overdue"])
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(1000),
      supabase
        .from("purchase_invoices")
        .select("id, invoice_number, supplier_name, due_date, total_amount, amount_paid, status")
        .in("status", ["received", "partially_paid", "overdue"])
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(1000),
    ])

    if (receivablesRes.error) throw new Error(receivablesRes.error.message)
    if (payablesRes.error) throw new Error(payablesRes.error.message)

    const round = (n: number) => Math.round(n * 100) / 100

    const incoming: UpcomingPayment[] = (receivablesRes.data ?? [])
      .filter((inv) => (inv.total_amount ?? 0) - (inv.amount_paid ?? 0) > 0.01)
      .map((inv) => ({
        id: inv.id,
        direction: "incoming",
        party: inv.customer_name ?? "—",
        reference: inv.invoice_number ?? "Invoice",
        due_date: inv.due_date as string,
        amount: round((inv.total_amount ?? 0) - (inv.amount_paid ?? 0)),
        status: inv.status,
        href: `/finance/invoices/${inv.id}`,
      }))

    const outgoing: UpcomingPayment[] = (payablesRes.data ?? [])
      .filter((inv) => (inv.total_amount ?? 0) - (inv.amount_paid ?? 0) > 0.01)
      .map((inv) => ({
        id: inv.id,
        direction: "outgoing",
        party: inv.supplier_name ?? "—",
        reference: inv.invoice_number || "Bill",
        due_date: inv.due_date as string,
        amount: round((inv.total_amount ?? 0) - (inv.amount_paid ?? 0)),
        status: inv.status,
        href: `/finance/purchases/${inv.id}`,
      }))

    return [...incoming, ...outgoing].sort((a, b) => a.due_date.localeCompare(b.due_date))
  },
  ["upcoming-payments"],
  {
    tags: ["finance", "invoices", "payments", "purchase_invoices"],
    revalidate: 60,
  }
)
