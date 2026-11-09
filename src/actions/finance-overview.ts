"use server"

import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { todayIST } from "@/lib/payment-terms"
import type { AgingBuckets, CashflowData, FinanceOverview, OutstandingBill } from "@/lib/finance-types"

// Every finance mutation invalidates one of these tags; the 60s TTL is the fallback.
const FIN_TAGS = ["finance", "invoices", "payments", "purchase_invoices", "expenses", "expense_categories"]

const MONTHS_WINDOW = 12
const round2 = (n: number) => Math.round(n * 100) / 100

/** Unpaid customer invoices (receivables) and supplier bills (payables), as one list. */
async function loadOutstandingBills(): Promise<OutstandingBill[]> {
  const admin = createAdminClient()
  const [receivablesRes, payablesRes] = await Promise.all([
    admin
      .from("invoices")
      .select("invoice_number, customer_name, issue_date, due_date, total_amount, amount_paid")
      .in("status", ["sent", "partially_paid", "overdue"]),
    admin
      .from("purchase_invoices")
      .select("invoice_number, supplier_name, invoice_date, due_date, total_amount, amount_paid")
      .in("status", ["received", "partially_paid", "overdue"]),
  ])
  if (receivablesRes.error) throw new Error(receivablesRes.error.message)
  if (payablesRes.error) throw new Error(payablesRes.error.message)

  const bills: OutstandingBill[] = []
  for (const inv of receivablesRes.data ?? []) {
    const amount = round2((inv.total_amount ?? 0) - (inv.amount_paid ?? 0))
    if (amount > 0.01) {
      bills.push({
        party: inv.customer_name ?? "—",
        type: "incoming",
        amount,
        bill_ref: inv.invoice_number,
        bill_date: inv.issue_date,
        due_date: inv.due_date,
      })
    }
  }
  for (const inv of payablesRes.data ?? []) {
    const amount = round2((inv.total_amount ?? 0) - (inv.amount_paid ?? 0))
    if (amount > 0.01) {
      bills.push({
        party: inv.supplier_name ?? "—",
        type: "outgoing",
        amount,
        bill_ref: inv.invoice_number,
        bill_date: inv.invoice_date,
        due_date: inv.due_date,
      })
    }
  }
  return bills.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
}

function totalsOf(bills: OutstandingBill[]) {
  const incoming = bills.filter((b) => b.type === "incoming").reduce((s, b) => s + b.amount, 0)
  const outgoing = bills.filter((b) => b.type === "outgoing").reduce((s, b) => s + b.amount, 0)
  return { incoming, outgoing, net: incoming - outgoing }
}

function agingOf(bills: OutstandingBill[], today: string): AgingBuckets {
  const buckets: AgingBuckets = { current: 0, thirtyDays: 0, sixtyDays: 0, ninetyPlus: 0 }
  const todayMs = Date.parse(`${today}T00:00:00Z`)
  for (const b of bills) {
    // no due date → treat as current
    const days = b.due_date ? Math.floor((todayMs - Date.parse(`${b.due_date}T00:00:00Z`)) / 86400000) : 0
    if (days <= 0) buckets.current += b.amount
    else if (days <= 30) buckets.thirtyDays += b.amount
    else if (days <= 60) buckets.sixtyDays += b.amount
    else buckets.ninetyPlus += b.amount
  }
  return buckets
}

/** Receivables + payables from the ERP's own invoices and bills. */
export const getCashflowOutstanding = unstable_cache(
  async (): Promise<CashflowData> => {
    const bills = await loadOutstandingBills()
    return { asOf: new Date().toISOString(), bills, totals: totalsOf(bills) }
  },
  ["finance-cashflow-outstanding"],
  { tags: FIN_TAGS, revalidate: 60 }
)

/** Finance Overview: 12 months of sales, purchases and cash, plus receivables and payables. */
export const getFinanceOverview = unstable_cache(
  async (): Promise<FinanceOverview> => {
    const admin = createAdminClient()
    const today = todayIST()
    const [ty, tm] = today.split("-").map(Number)

    // Month scaffold (oldest → newest) so charts show every month even when empty
    const monthOrder: string[] = []
    const monthLabels = new Map<string, string>()
    for (let i = MONTHS_WINDOW - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(ty, tm - 1 - i, 1))
      const key = d.toISOString().slice(0, 7)
      monthOrder.push(key)
      monthLabels.set(key, d.toLocaleString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }))
    }
    const start = `${monthOrder[0]}-01`

    const [salesRes, creditRes, receiptsRes, billsRes, paidRes, expensesRes, bills] = await Promise.all([
      admin
        .from("invoices")
        .select("total_amount, issue_date")
        .gte("issue_date", start)
        .not("status", "in", "(cancelled,draft)"),
      admin
        .from("credit_notes")
        .select("total_amount, issue_date")
        .gte("issue_date", start)
        .eq("status", "issued"),
      admin
        .from("payments")
        .select("amount, payment_date, invoice:invoices(customer_name)")
        .gte("payment_date", start),
      admin
        .from("purchase_invoices")
        .select("total_amount, invoice_date")
        .gte("invoice_date", start)
        .not("status", "in", "(cancelled,draft)"),
      admin
        .from("purchase_payments")
        .select("amount, payment_date, purchase_invoice:purchase_invoices(supplier_name)")
        .gte("payment_date", start),
      admin
        .from("expenses")
        .select("amount, expense_date, category:expense_categories(name)")
        .gte("expense_date", start),
      loadOutstandingBills(),
    ])
    for (const r of [salesRes, creditRes, receiptsRes, billsRes, paidRes, expensesRes]) {
      if (r.error) throw new Error(r.error.message)
    }

    const flow = new Map(monthOrder.map((k) => [k, { inflow: 0, outflow: 0 }]))
    const trade = new Map(monthOrder.map((k) => [k, { sales: 0, purchases: 0 }]))
    const stats = { revenue12m: 0, received12m: 0, purchases12m: 0, paid12m: 0, netCash12m: 0 }
    const customerTotals = new Map<string, number>()
    const supplierTotals = new Map<string, number>()
    const groupTotals = new Map<string, number>()
    const add = (map: Map<string, number>, key: string | null | undefined, amount: number) => {
      if (key) map.set(key, (map.get(key) ?? 0) + amount)
    }
    const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

    for (const r of salesRes.data ?? []) {
      const amt = r.total_amount ?? 0
      stats.revenue12m += amt
      const t = trade.get(r.issue_date.slice(0, 7))
      if (t) t.sales += amt
    }
    for (const r of creditRes.data ?? []) {
      const amt = r.total_amount ?? 0
      stats.revenue12m -= amt
      const t = trade.get(r.issue_date.slice(0, 7))
      if (t) t.sales -= amt
    }
    for (const r of receiptsRes.data ?? []) {
      const amt = r.amount ?? 0
      stats.received12m += amt
      const f = flow.get(r.payment_date.slice(0, 7))
      if (f) f.inflow += amt
      add(customerTotals, one(r.invoice as { customer_name: string | null } | { customer_name: string | null }[] | null)?.customer_name, amt)
    }
    for (const r of billsRes.data ?? []) {
      const amt = r.total_amount ?? 0
      stats.purchases12m += amt
      const t = trade.get(r.invoice_date.slice(0, 7))
      if (t) t.purchases += amt
    }
    for (const r of paidRes.data ?? []) {
      const amt = r.amount ?? 0
      stats.paid12m += amt
      const f = flow.get(r.payment_date.slice(0, 7))
      if (f) f.outflow += amt
      add(supplierTotals, one(r.purchase_invoice as { supplier_name: string | null } | { supplier_name: string | null }[] | null)?.supplier_name, amt)
    }
    stats.netCash12m = stats.received12m - stats.paid12m

    // Where the money went: supplier purchases plus each expense category
    if (stats.purchases12m > 0) groupTotals.set("Purchases", stats.purchases12m)
    for (const r of expensesRes.data ?? []) {
      const name = one(r.category as { name: string } | { name: string }[] | null)?.name ?? "Other expenses"
      add(groupTotals, name, r.amount ?? 0)
    }

    const topN = (map: Map<string, number>, n: number) =>
      [...map.entries()]
        .map(([party, amount]) => ({ party, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, n)

    return {
      stats,
      monthlyFlow: monthOrder.map((k) => ({ month: monthLabels.get(k)!, ...flow.get(k)! })),
      monthlyTrade: monthOrder.map((k) => ({ month: monthLabels.get(k)!, ...trade.get(k)! })),
      expenseBreakdown: topN(groupTotals, 8).map(({ party, amount }) => ({ group: party, amount })),
      topCustomers: topN(customerTotals, 5),
      topSuppliers: topN(supplierTotals, 5),
      outstanding: totalsOf(bills),
      receivablesAging: agingOf(bills.filter((b) => b.type === "incoming"), today),
      payablesAging: agingOf(bills.filter((b) => b.type === "outgoing"), today),
    }
  },
  ["finance-overview"],
  { tags: FIN_TAGS, revalidate: 60 }
)
