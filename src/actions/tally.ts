"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getOutstanding, type CashflowData } from "@/lib/tally/outstanding"
import { getVouchers, type TallyVoucher } from "@/lib/tally/vouchers"

/** Receivables (incoming) + payables (outgoing) pulled from Tally; sample until first sync. */
export async function getCashflowOutstanding(): Promise<CashflowData> {
  return getOutstanding()
}

export interface TallyLedgerBalance {
  ledger_name: string
  parent: string | null
  closing_balance: number
  as_of: string | null
  updated_at: string
}

export interface TallySyncStatus {
  lastPulledAt: string | null
  balances: TallyLedgerBalance[]
}

/** Status of the (pull-only) Tally sync: balances pulled in from Tally. */
export async function getTallySyncStatus(): Promise<TallySyncStatus> {
  const admin = createAdminClient()

  const [balancesRes, pullRes] = await Promise.all([
    admin.from("tally_ledger_balances").select("ledger_name, parent, closing_balance, as_of, updated_at").order("ledger_name"),
    admin.from("tally_pull_state").select("last_pulled_at").eq("id", 1).maybeSingle(),
  ])

  return {
    lastPulledAt: pullRes.data?.last_pulled_at ?? null,
    balances: (balancesRes.data ?? []).map((b) => ({ ...b, closing_balance: Number(b.closing_balance) })),
  }
}

// ===== Tally-sourced Finance dashboard =====

interface AgingBuckets {
  current: number
  thirtyDays: number
  sixtyDays: number
  ninetyPlus: number
}

export interface TallyFinanceDashboard {
  isSample: boolean
  lastSyncedAt: string | null
  stats: {
    revenue12m: number // Sales − Credit Notes
    received12m: number // Receipt vouchers — money received for orders
    purchases12m: number // Purchase − Debit Notes
    paid12m: number // Payment vouchers
    netCash12m: number // received − paid
  }
  monthlyFlow: { month: string; inflow: number; outflow: number }[]
  monthlyTrade: { month: string; sales: number; purchases: number }[]
  expenseBreakdown: { group: string; amount: number }[]
  topCustomers: { party: string; amount: number }[]
  topSuppliers: { party: string; amount: number }[]
  outstanding: { incoming: number; outgoing: number; net: number }
  receivablesAging: AgingBuckets
  payablesAging: AgingBuckets
}

const MONTHS_WINDOW = 12

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

function agingFromDueDates(bills: { amount: number; due_date: string | null }[], today: Date): AgingBuckets {
  const buckets: AgingBuckets = { current: 0, thirtyDays: 0, sixtyDays: 0, ninetyPlus: 0 }
  for (const b of bills) {
    if (b.amount <= 0) continue
    // no due date → treat as current
    const diffDays = b.due_date
      ? Math.floor((today.getTime() - new Date(b.due_date).getTime()) / 86400000)
      : 0
    if (diffDays <= 0) buckets.current += b.amount
    else if (diffDays <= 30) buckets.thirtyDays += b.amount
    else if (diffDays <= 60) buckets.sixtyDays += b.amount
    else buckets.ninetyPlus += b.amount
  }
  return buckets
}

// Sample expense split shown until ledger balances (with parent groups) sync.
const MOCK_EXPENSE_BREAKDOWN = [
  { group: "Purchase Accounts", amount: 1860000 },
  { group: "Direct Expenses", amount: 540000 },
  { group: "Indirect Expenses", amount: 385000 },
  { group: "Power & Fuel", amount: 210000 },
  { group: "Employee Cost", amount: 175000 },
]

/** Aggregate Tally vouchers + outstanding + ledger balances into dashboard data. */
export async function getTallyFinanceDashboard(): Promise<TallyFinanceDashboard> {
  const admin = createAdminClient()

  const [vouchersData, outstandingData, balancesRes, pullRes] = await Promise.all([
    getVouchers(MONTHS_WINDOW),
    getOutstanding(),
    admin.from("tally_ledger_balances").select("ledger_name, parent, closing_balance"),
    admin.from("tally_pull_state").select("last_pulled_at").eq("id", 1).maybeSingle(),
  ])

  const { vouchers, isSample } = vouchersData

  // Month scaffold (oldest → newest) so charts show every month even when empty
  const now = new Date()
  const monthOrder: string[] = []
  const monthLabels = new Map<string, string>()
  for (let i = MONTHS_WINDOW - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthOrder.push(key)
    monthLabels.set(key, d.toLocaleString("en-IN", { month: "short", year: "2-digit" }))
  }

  const flow = new Map<string, { inflow: number; outflow: number }>()
  const trade = new Map<string, { sales: number; purchases: number }>()
  for (const key of monthOrder) {
    flow.set(key, { inflow: 0, outflow: 0 })
    trade.set(key, { sales: 0, purchases: 0 })
  }

  const stats = { revenue12m: 0, received12m: 0, purchases12m: 0, paid12m: 0, netCash12m: 0 }
  const customerTotals = new Map<string, number>()
  const supplierTotals = new Map<string, number>()

  const add = (map: Map<string, number>, key: string | null, amount: number) => {
    if (!key) return
    map.set(key, (map.get(key) ?? 0) + amount)
  }

  for (const v of vouchers as TallyVoucher[]) {
    const key = monthKey(v.voucher_date)
    const f = flow.get(key)
    const t = trade.get(key)
    switch (v.voucher_type) {
      case "Sales":
        stats.revenue12m += v.amount
        if (t) t.sales += v.amount
        break
      case "Credit Note":
        stats.revenue12m -= v.amount
        if (t) t.sales -= v.amount
        break
      case "Purchase":
        stats.purchases12m += v.amount
        if (t) t.purchases += v.amount
        break
      case "Debit Note":
        stats.purchases12m -= v.amount
        if (t) t.purchases -= v.amount
        break
      case "Receipt":
        stats.received12m += v.amount
        if (f) f.inflow += v.amount
        add(customerTotals, v.party, v.amount)
        break
      case "Payment":
        stats.paid12m += v.amount
        if (f) f.outflow += v.amount
        add(supplierTotals, v.party, v.amount)
        break
    }
  }
  stats.netCash12m = stats.received12m - stats.paid12m

  const topN = (map: Map<string, number>, n: number) =>
    [...map.entries()]
      .map(([party, amount]) => ({ party, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, n)

  // Expense breakdown from ledger balances grouped by parent (expense groups)
  const groupTotals = new Map<string, number>()
  for (const b of balancesRes.data ?? []) {
    const parent = (b.parent ?? "").trim()
    if (!parent || !/expense|purchase account/i.test(parent)) continue
    const amount = Math.abs(Number(b.closing_balance) || 0)
    if (amount > 0) add(groupTotals, parent, amount)
  }
  let expenseBreakdown = topN(groupTotals, 8).map(({ party, amount }) => ({ group: party, amount }))
  if (expenseBreakdown.length === 0 && isSample) expenseBreakdown = MOCK_EXPENSE_BREAKDOWN

  const bills = outstandingData.bills
  const today = new Date()

  return {
    isSample,
    lastSyncedAt: pullRes.data?.last_pulled_at ?? null,
    stats,
    monthlyFlow: monthOrder.map((key) => ({ month: monthLabels.get(key)!, ...flow.get(key)! })),
    monthlyTrade: monthOrder.map((key) => ({ month: monthLabels.get(key)!, ...trade.get(key)! })),
    expenseBreakdown,
    topCustomers: topN(customerTotals, 5),
    topSuppliers: topN(supplierTotals, 5),
    outstanding: outstandingData.totals,
    receivablesAging: agingFromDueDates(bills.filter((b) => b.type === "incoming"), today),
    payablesAging: agingFromDueDates(bills.filter((b) => b.type === "outgoing"), today),
  }
}
