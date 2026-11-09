export type OutstandingType = "incoming" | "outgoing"

/** One unpaid customer invoice (incoming) or supplier bill (outgoing). */
export interface OutstandingBill {
  party: string
  type: OutstandingType
  amount: number
  bill_ref: string | null
  bill_date: string | null
  due_date: string | null
}

export interface CashflowData {
  asOf: string | null
  bills: OutstandingBill[]
  totals: { incoming: number; outgoing: number; net: number }
}

export interface AgingBuckets {
  current: number
  thirtyDays: number
  sixtyDays: number
  ninetyPlus: number
}

export interface FinanceOverview {
  stats: {
    revenue12m: number // invoices issued − credit notes
    received12m: number // customer payments received
    purchases12m: number // supplier bills entered
    paid12m: number // supplier payments made
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
