"use server"

import { createClient } from "@/lib/supabase/server"

// ===== Finance Dashboard =====

export async function getFinanceDashboard() {
  const supabase = await createClient()

  const now = new Date()
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`
  const lastMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`

  const [
    invoicesRes,
    revenueThisMonthRes,
    expensesThisMonthRes,
    expensesLastMonthRes,
    costingsRes,
    purchaseInvoicesRes,
    materialsRes,
    expenseReceiptsRes,
    purchaseReceiptsRes,
  ] = await Promise.all([
    // Revenue: all non-cancelled invoices (for totals + aging)
    supabase
      .from("invoices")
      .select("total_amount, amount_paid, status, due_date")
      .neq("status", "cancelled"),
    // Revenue this month (for net profit — matches P&L report)
    supabase
      .from("invoices")
      .select("total_amount")
      .gte("issue_date", thisMonthStart)
      .neq("status", "cancelled"),
    // Expenses this month
    supabase
      .from("expenses")
      .select("amount")
      .gte("expense_date", thisMonthStart),
    // Expenses last month
    supabase
      .from("expenses")
      .select("amount")
      .gte("expense_date", lastMonthStart)
      .lt("expense_date", lastMonthEnd),
    // COGS from order costings
    supabase.from("order_costings").select("total_cost"),
    // Purchase invoices for payables
    supabase
      .from("purchase_invoices")
      .select("total_amount, amount_paid, status, due_date")
      .neq("status", "cancelled"),
    // Inventory valuation
    supabase.from("materials").select("current_stock, cost_per_unit").eq("is_active", true),
    // Audit readiness: expenses with/without receipt
    supabase.from("expenses").select("receipt_url"),
    // Audit readiness: purchase invoices count
    supabase.from("purchase_invoices").select("id").neq("status", "cancelled"),
  ])

  const invoices = invoicesRes.data ?? []
  const revenueThisMonth = revenueThisMonthRes.data ?? []
  const expensesThisMonth = expensesThisMonthRes.data ?? []
  const expensesLastMonth = expensesLastMonthRes.data ?? []
  const costings = costingsRes.data ?? []
  const purchaseInvoices = purchaseInvoicesRes.data ?? []
  const materials = materialsRes.data ?? []
  const allExpenses = expenseReceiptsRes.data ?? []
  const allPurchaseInvoices = purchaseReceiptsRes.data ?? []

  // Revenue
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_amount ?? 0), 0)
  const totalReceived = invoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0)
  const totalOutstanding = totalInvoiced - totalReceived

  // Expenses
  const expThisMonth = expensesThisMonth.reduce((s, e) => s + (e.amount ?? 0), 0)
  const expLastMonth = expensesLastMonth.reduce((s, e) => s + (e.amount ?? 0), 0)
  const expChange = expLastMonth > 0 ? ((expThisMonth - expLastMonth) / expLastMonth) * 100 : 0

  // COGS
  const totalCogs = costings.reduce((s, c) => s + (c.total_cost ?? 0), 0)

  // Net profit: this month invoiced revenue - COGS - this month expenses (matches P&L report)
  const revenueThisMonthTotal = revenueThisMonth.reduce((s, i) => s + (i.total_amount ?? 0), 0)
  const netProfit = revenueThisMonthTotal - totalCogs - expThisMonth

  // Receivables aging
  const today = new Date()
  const receivablesAging = computeAging(
    invoices
      .filter((i) => i.status !== "paid" && i.status !== "draft" && i.due_date)
      .map((i) => ({
        amount: (i.total_amount ?? 0) - (i.amount_paid ?? 0),
        due_date: i.due_date!,
      })),
    today
  )

  // Payables aging
  const payablesAging = computeAging(
    purchaseInvoices
      .filter((i) => i.status !== "paid" && i.due_date)
      .map((i) => ({
        amount: (i.total_amount ?? 0) - (i.amount_paid ?? 0),
        due_date: i.due_date!,
      })),
    today
  )

  // Inventory valuation
  const inventoryValue = materials.reduce(
    (s, m) => s + (m.current_stock ?? 0) * (m.cost_per_unit ?? 0),
    0
  )

  // Audit readiness
  const expensesWithReceipt = allExpenses.filter((e) => e.receipt_url).length
  const totalTransactions = allExpenses.length + allPurchaseInvoices.length
  const transactionsWithDocs = expensesWithReceipt // purchase invoices don't have receipt_url

  return {
    revenue: { invoiced: totalInvoiced, received: totalReceived, outstanding: totalOutstanding },
    expenses: { thisMonth: expThisMonth, lastMonth: expLastMonth, changePercent: expChange },
    cogs: totalCogs,
    netProfit,
    receivablesAging,
    payablesAging,
    inventoryValue,
    auditReadiness: { withDocs: transactionsWithDocs, total: totalTransactions },
  }
}

function computeAging(
  items: { amount: number; due_date: string }[],
  today: Date
) {
  const buckets = { current: 0, thirtyDays: 0, sixtyDays: 0, ninetyPlus: 0 }

  for (const item of items) {
    if (item.amount <= 0) continue
    const due = new Date(item.due_date)
    const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays <= 0) buckets.current += item.amount
    else if (diffDays <= 30) buckets.thirtyDays += item.amount
    else if (diffDays <= 60) buckets.sixtyDays += item.amount
    else buckets.ninetyPlus += item.amount
  }

  return buckets
}

// ===== Cash Flow Statement (last 12 months, detailed) =====

export async function getCashFlowStatement() {
  const supabase = await createClient()

  const now = new Date()
  // Cover the full 12-month window with 3 bulk queries instead of 36 sequential ones
  const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const startStr = startDate.toISOString().split("T")[0]
  const endStr = endDate.toISOString().split("T")[0]

  const [paymentsRes, expensesRes, purchasePaymentsRes] = await Promise.all([
    supabase.from("payments").select("amount, payment_date").gte("payment_date", startStr).lt("payment_date", endStr),
    supabase.from("expenses").select("amount, expense_date").gte("expense_date", startStr).lt("expense_date", endStr),
    supabase.from("purchase_payments").select("amount, payment_date").gte("payment_date", startStr).lt("payment_date", endStr),
  ])

  // Group amounts by "YYYY-MM" month key
  function groupByMonth(items: { amount: number | null; [key: string]: unknown }[], dateField: string): Record<string, number> {
    const map: Record<string, number> = {}
    for (const item of items) {
      const date = item[dateField] as string | null
      if (!date) continue
      const monthKey = date.slice(0, 7)
      map[monthKey] = (map[monthKey] ?? 0) + (item.amount ?? 0)
    }
    return map
  }

  const inflowByMonth = groupByMonth(paymentsRes.data ?? [], "payment_date")
  const expensesByMonth = groupByMonth(expensesRes.data ?? [], "expense_date")
  const purchaseByMonth = groupByMonth(purchasePaymentsRes.data ?? [], "payment_date")

  const rows: {
    monthKey: string
    month: string
    inflow: number
    purchaseOutflow: number
    expenseOutflow: number
    outflow: number
    net: number
    runningBalance: number
  }[] = []

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const monthKey = `${year}-${String(month).padStart(2, "0")}`
    const label = d.toLocaleString("en-IN", { month: "short", year: "numeric" })

    const inflow = inflowByMonth[monthKey] ?? 0
    const expenseOutflow = expensesByMonth[monthKey] ?? 0
    const purchaseOutflow = purchaseByMonth[monthKey] ?? 0
    const outflow = expenseOutflow + purchaseOutflow

    rows.push({ monthKey, month: label, inflow, purchaseOutflow, expenseOutflow, outflow, net: inflow - outflow, runningBalance: 0 })
  }

  // Compute running balance
  let running = 0
  for (const row of rows) {
    running += row.net
    row.runningBalance = running
  }

  return rows
}

// ===== Cash Flow Month Detail =====

export async function getCashFlowMonthDetail(monthKey: string) {
  // monthKey: "YYYY-MM"
  const [year, mon] = monthKey.split("-").map(Number)
  const start = `${monthKey}-01`
  const nextD = new Date(year, mon, 1)
  const end = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, "0")}-01`

  const supabase = await createClient()

  const [paymentsRes, expensesRes, purchasePaymentsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, method, reference, payment_date, invoice:invoices(invoice_number, customer_name)")
      .gte("payment_date", start)
      .lt("payment_date", end)
      .order("payment_date"),
    supabase
      .from("expenses")
      .select("id, amount, expense_date, description, category:expense_categories(name)")
      .gte("expense_date", start)
      .lt("expense_date", end)
      .order("expense_date"),
    supabase
      .from("purchase_payments")
      .select("id, amount, method, reference, payment_date, invoice:purchase_invoices(invoice_number, supplier_name)")
      .gte("payment_date", start)
      .lt("payment_date", end)
      .order("payment_date"),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payments = (paymentsRes.data ?? []).map((p: any) => ({
    ...p,
    invoice: Array.isArray(p.invoice) ? p.invoice[0] ?? null : p.invoice,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expenses = (expensesRes.data ?? []).map((e: any) => ({
    ...e,
    category: Array.isArray(e.category) ? e.category[0] ?? null : e.category,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchasePayments = (purchasePaymentsRes.data ?? []).map((p: any) => ({
    ...p,
    invoice: Array.isArray(p.invoice) ? p.invoice[0] ?? null : p.invoice,
  }))

  const label = new Date(year, mon - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" })

  return { label, payments, expenses, purchasePayments }
}

// ===== Cash Flow (last 6 months, for dashboard chart) =====

export async function getCashFlowData() {
  const supabase = await createClient()
  const months: { month: string; inflow: number; outflow: number }[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const start = `${year}-${String(month).padStart(2, "0")}-01`
    const nextD = new Date(year, month, 1)
    const end = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, "0")}-01`
    const label = d.toLocaleString("en-IN", { month: "short", year: "2-digit" })

    const [paymentsIn, expensesOut, purchasePaymentsOut] = await Promise.all([
      supabase.from("payments").select("amount").gte("payment_date", start).lt("payment_date", end),
      supabase.from("expenses").select("amount").gte("expense_date", start).lt("expense_date", end),
      supabase.from("purchase_payments").select("amount").gte("payment_date", start).lt("payment_date", end),
    ])

    const inflow = (paymentsIn.data ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
    const outflow =
      (expensesOut.data ?? []).reduce((s, e) => s + (e.amount ?? 0), 0) +
      (purchasePaymentsOut.data ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)

    months.push({ month: label, inflow, outflow })
  }

  return months
}

// ===== Receivables Aging Detail =====

export async function getReceivablesAging() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name, total_amount, amount_paid, due_date, status")
    .neq("status", "cancelled")
    .neq("status", "paid")
    .neq("status", "draft")
    .not("due_date", "is", null)
    .order("due_date")

  return (data ?? []).map((inv) => ({
    id: inv.id,
    name: `${inv.invoice_number} — ${inv.customer_name}`,
    amount: (inv.total_amount ?? 0) - (inv.amount_paid ?? 0),
    due_date: inv.due_date!,
    status: inv.status,
  }))
}

// ===== Payables Aging Detail =====

export async function getPayablesAging() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("purchase_invoices")
    .select("id, invoice_number, supplier_name, total_amount, amount_paid, due_date, status")
    .neq("status", "cancelled")
    .neq("status", "paid")
    .not("due_date", "is", null)
    .order("due_date")

  return (data ?? []).map((inv) => ({
    id: inv.id,
    name: `${inv.invoice_number || "PI"} — ${inv.supplier_name}`,
    amount: (inv.total_amount ?? 0) - (inv.amount_paid ?? 0),
    due_date: inv.due_date!,
    status: inv.status,
  }))
}

// ===== GST Summary =====

export async function getGSTSummary(start: string, end: string) {
  const supabase = await createClient()

  const [salesRes, purchasesRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("cgst_amount, sgst_amount, igst_amount")
      .gte("issue_date", start)
      .lt("issue_date", end)
      .neq("status", "cancelled"),
    supabase
      .from("purchase_invoices")
      .select("cgst_amount, sgst_amount, igst_amount")
      .gte("invoice_date", start)
      .lt("invoice_date", end)
      .neq("status", "cancelled"),
  ])

  const sales = salesRes.data ?? []
  const purchases = purchasesRes.data ?? []

  const outputCgst = sales.reduce((s, i) => s + (i.cgst_amount ?? 0), 0)
  const outputSgst = sales.reduce((s, i) => s + (i.sgst_amount ?? 0), 0)
  const outputIgst = sales.reduce((s, i) => s + (i.igst_amount ?? 0), 0)

  const inputCgst = purchases.reduce((s, i) => s + (i.cgst_amount ?? 0), 0)
  const inputSgst = purchases.reduce((s, i) => s + (i.sgst_amount ?? 0), 0)
  const inputIgst = purchases.reduce((s, i) => s + (i.igst_amount ?? 0), 0)

  const outputTotal = outputCgst + outputSgst + outputIgst
  const inputTotal = inputCgst + inputSgst + inputIgst

  return {
    output: { cgst: outputCgst, sgst: outputSgst, igst: outputIgst, total: outputTotal },
    input: { cgst: inputCgst, sgst: inputSgst, igst: inputIgst, total: inputTotal },
    netLiability: outputTotal - inputTotal,
  }
}

// ===== P&L =====

export async function getProfitLoss(start: string, end: string) {
  const supabase = await createClient()

  const [revenueRes, expensesRes, costingsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("total_amount")
      .gte("issue_date", start)
      .lt("issue_date", end)
      .neq("status", "cancelled"),
    supabase
      .from("expenses")
      .select("amount, category:expense_categories(name)")
      .gte("expense_date", start)
      .lt("expense_date", end),
    supabase
      .from("order_costings")
      .select("total_cost")
      .gte("created_at", start)
      .lt("created_at", end),
  ])

  const revenue = (revenueRes.data ?? []).reduce((s, i) => s + (i.total_amount ?? 0), 0)
  const cogs = (costingsRes.data ?? []).reduce((s, c) => s + (c.total_cost ?? 0), 0)
  const grossProfit = revenue - cogs

  // Group expenses by category
  const expensesByCategory: Record<string, number> = {}
  let totalExpenses = 0
  for (const exp of expensesRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catName = (exp as any).category?.name ?? (Array.isArray((exp as any).category) ? (exp as any).category[0]?.name : null) ?? "Uncategorized"
    expensesByCategory[catName] = (expensesByCategory[catName] ?? 0) + (exp.amount ?? 0)
    totalExpenses += exp.amount ?? 0
  }

  return {
    revenue,
    cogs,
    grossProfit,
    expenses: expensesByCategory,
    totalExpenses,
    netProfit: grossProfit - totalExpenses,
  }
}
