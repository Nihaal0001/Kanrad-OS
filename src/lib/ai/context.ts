import { createClient } from "@/lib/supabase/server"

export async function buildERPContext(): Promise<string> {
  const supabase = await createClient()

  const today = new Date().toISOString().split("T")[0]
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  const now = new Date()
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`

  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0]

  const [
    ordersRes,
    dueRes,
    materialsRes,
    recentOutputRes,
    pendingLeavesRes,
    workersRes,
    expensesThisMonthRes,
    expensesLastMonthRes,
    productsRes,
  ] = await Promise.all([
    // Active orders
    supabase
      .from("orders")
      .select("id, order_number, product_variant, status, priority, deadline, total_quantity, customer:customers(name)")
      .in("status", ["confirmed", "in_production"])
      .order("deadline")
      .limit(30),

    // Orders due this week
    supabase
      .from("orders")
      .select("id, order_number, product_variant, deadline, status, total_quantity, customer:customers(name)")
      .in("status", ["confirmed", "in_production"])
      .lte("deadline", weekFromNow)
      .gte("deadline", today)
      .order("deadline"),

    // All materials — column-to-column comparison doesn't work in Supabase JS client,
    // so fetch all and filter in JS
    supabase
      .from("materials")
      .select("name, sku, current_stock, min_stock_level, unit")
      .order("name")
      .limit(500),

    // Recent production output (last 14 days, piece logs)
    supabase
      .from("production_daily_logs")
      .select("quantity_produced, quantity_rejected, log_date, order:orders(order_number, product_variant)")
      .gte("log_date", twoWeeksAgo)
      .order("log_date", { ascending: false })
      .limit(20),

    // Pending leaves
    supabase
      .from("leaves")
      .select("id")
      .eq("status", "pending"),

    // Total workers
    supabase
      .from("profiles")
      .select("id")
      .eq("is_active", true)
      .limit(200),

    // Expenses this month by category
    supabase
      .from("expenses")
      .select("amount, category:expense_categories(name)")
      .gte("expense_date", thisMonthStart),

    // Expenses last month by category
    supabase
      .from("expenses")
      .select("amount, category:expense_categories(name)")
      .gte("expense_date", lastMonthStart)
      .lt("expense_date", thisMonthStart),

    // Product catalogue (SKU + name) — lets the agent resolve product codes the user says
    supabase
      .from("bom_headers")
      .select("product_sku, product_name")
      .eq("is_active", true)
      .order("product_name")
      .limit(300),
  ])

  const lowStockItems = (materialsRes.data ?? []).filter(
    (m) => m.current_stock < m.min_stock_level
  )
  const products = productsRes.data ?? []

  const activeOrders = ordersRes.data ?? []
  const dueThisWeek = dueRes.data ?? []
  const pendingLeaves = pendingLeavesRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentOutput = (recentOutputRes.data ?? []) as any[]
  const workers = workersRes.data ?? []

  // Total pieces produced per active order (all-time), to gauge progress vs deadline
  const activeIds = activeOrders.map((o) => o.id)
  const producedByOrder: Record<string, number> = {}
  if (activeIds.length > 0) {
    const { data: producedLogs } = await supabase
      .from("production_daily_logs")
      .select("order_id, quantity_produced")
      .in("order_id", activeIds)
    for (const l of producedLogs ?? []) {
      producedByOrder[l.order_id] = (producedByOrder[l.order_id] ?? 0) + (l.quantity_produced ?? 0)
    }
  }

  // Build expense anomaly data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function groupExpensesByCategory(data: any[]) {
    const map: Record<string, number> = {}
    for (const exp of data) {
      const cat = Array.isArray(exp.category) ? exp.category[0]?.name : exp.category?.name ?? "Uncategorized"
      map[cat] = (map[cat] ?? 0) + (exp.amount ?? 0)
    }
    return map
  }
  const thisMonthExpenses = groupExpensesByCategory(expensesThisMonthRes.data ?? [])
  const lastMonthExpenses = groupExpensesByCategory(expensesLastMonthRes.data ?? [])
  const expenseAnomalies: string[] = []
  for (const [cat, thisAmt] of Object.entries(thisMonthExpenses)) {
    const lastAmt = lastMonthExpenses[cat] ?? 0
    if (lastAmt > 0 && thisAmt > lastAmt * 1.15) {
      const pct = Math.round(((thisAmt - lastAmt) / lastAmt) * 100)
      expenseAnomalies.push(`${cat}: ₹${thisAmt.toFixed(0)} this month vs ₹${lastAmt.toFixed(0)} last month (+${pct}%)`)
    }
  }

  const lines: string[] = [
    `== KANRAD ERP — Factory Status (${today}) ==`,
    "",
    `Total active workers: ${workers.length}`,
    `Active orders: ${activeOrders.length} (${activeOrders.filter((o) => o.status === "confirmed").length} confirmed, ${activeOrders.filter((o) => o.status === "in_production").length} in production)`,
    "",
  ]

  if (dueThisWeek.length > 0) {
    lines.push(`Orders due this week (${dueThisWeek.length}):`)
    for (const o of dueThisWeek) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customer = Array.isArray(o.customer) ? (o.customer[0] as any)?.name : (o.customer as any)?.name
      const produced = producedByOrder[o.id] ?? 0
      const pct = o.total_quantity > 0 ? Math.round((produced / o.total_quantity) * 100) : 0
      lines.push(`  - ${o.order_number}: ${o.product_variant}${customer ? ` for ${customer}` : ""}, deadline ${o.deadline}, produced ${produced}/${o.total_quantity} pcs (${pct}%), status: ${o.status}`)
    }
    lines.push("")
  }

  if (products.length > 0) {
    lines.push(`Product catalogue — code: name (${products.length}):`)
    for (const p of products) {
      lines.push(`  - ${p.product_sku}: ${p.product_name}`)
    }
    lines.push("")
  }

  if (lowStockItems.length > 0) {
    lines.push(`Low stock items (${lowStockItems.length}):`)
    for (const m of lowStockItems) {
      lines.push(`  - ${m.name} (${m.sku}): ${m.current_stock} ${m.unit} (min: ${m.min_stock_level})`)
    }
    lines.push("")
  }

  if (recentOutput.length > 0) {
    lines.push("Recent production output (last 14 days):")
    for (const p of recentOutput) {
      const orderNum = Array.isArray(p.order) ? p.order[0]?.order_number : p.order?.order_number
      const variant = Array.isArray(p.order) ? p.order[0]?.product_variant : p.order?.product_variant
      const rejected = (p.quantity_rejected ?? 0) > 0 ? `, ${p.quantity_rejected} rejected` : ""
      lines.push(`  - ${p.log_date}: ${orderNum ?? "?"} (${variant ?? "?"}) — ${p.quantity_produced ?? 0} pcs produced${rejected}`)
    }
    lines.push("")
  }

  if (pendingLeaves.length > 0) {
    lines.push(`Pending leave requests: ${pendingLeaves.length}`)
    lines.push("")
  }

  const totalThisMonth = Object.values(thisMonthExpenses).reduce((s, v) => s + v, 0)
  if (totalThisMonth > 0) {
    lines.push(`Expenses this month: ₹${totalThisMonth.toFixed(0)}`)
    for (const [cat, amt] of Object.entries(thisMonthExpenses)) {
      lines.push(`  - ${cat}: ₹${amt.toFixed(0)}`)
    }
    lines.push("")
  }

  if (expenseAnomalies.length > 0) {
    lines.push("⚠ Expense anomalies (>15% increase vs last month):")
    for (const a of expenseAnomalies) {
      lines.push(`  - ${a}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}
