import { createClient } from "@/lib/supabase/server"

export async function buildERPContext(): Promise<string> {
  const supabase = await createClient()

  const today = new Date().toISOString().split("T")[0]
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  const now = new Date()
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`

  const [
    ordersRes,
    dueRes,
    lowStockRes,
    productionRes,
    pendingLeavesRes,
    recentQCRes,
    workersRes,
    expensesThisMonthRes,
    expensesLastMonthRes,
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
      .select("order_number, product_variant, deadline, status, customer:customers(name)")
      .in("status", ["confirmed", "in_production"])
      .lte("deadline", weekFromNow)
      .gte("deadline", today)
      .order("deadline"),

    // Low stock materials
    supabase
      .from("materials")
      .select("name, sku, current_stock, min_stock_level, unit")
      .filter("current_stock", "lt", "min_stock_level" as unknown as number)
      .order("name"),

    // Production tracking — in progress or blocked
    supabase
      .from("production_tracking")
      .select(`
        status, quantity_completed, quantity_rejected,
        order:orders(order_number, product_variant),
        stage:production_stages(name)
      `)
      .in("status", ["in_progress", "blocked"])
      .limit(20),

    // Pending leaves
    supabase
      .from("leaves")
      .select("id")
      .eq("status", "pending"),

    // Recent QC failures (last 7 days)
    supabase
      .from("quality_checks")
      .select("quantity_failed, defect_type, order:orders(order_number)")
      .gt("quantity_failed", 0)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10),

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
  ])

  // Handle low stock with raw SQL-like filter workaround
  // The filter above may not work for column-to-column comparison
  // So we fetch all materials and filter in JS
  const allMaterialsRes = await supabase
    .from("materials")
    .select("name, sku, current_stock, min_stock_level, unit")
    .order("name")
    .limit(100)

  const lowStockItems = (allMaterialsRes.data ?? []).filter(
    (m) => m.current_stock < m.min_stock_level
  )

  const activeOrders = ordersRes.data ?? []
  const dueThisWeek = dueRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const production = (productionRes.data ?? []) as any[]
  const pendingLeaves = pendingLeavesRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentQC = (recentQCRes.data ?? []) as any[]
  const workers = workersRes.data ?? []

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
      const customer = Array.isArray(o.customer) ? o.customer[0]?.name : o.customer?.name
      lines.push(`  - ${o.order_number}: ${o.product_variant}${customer ? ` for ${customer}` : ""}, deadline ${o.deadline}, status: ${o.status}`)
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

  if (production.length > 0) {
    lines.push("Production in progress/blocked:")
    for (const p of production) {
      const orderNum = Array.isArray(p.order) ? p.order[0]?.order_number : p.order?.order_number
      const stageName = Array.isArray(p.stage) ? p.stage[0]?.name : p.stage?.name
      lines.push(`  - ${orderNum ?? "?"} at ${stageName ?? "?"}: ${p.status}, completed: ${p.quantity_completed ?? 0}, rejected: ${p.quantity_rejected ?? 0}`)
    }
    lines.push("")
  }

  if (recentQC.length > 0) {
    lines.push("Recent QC failures (last 7 days):")
    for (const q of recentQC) {
      const orderNum = Array.isArray(q.order) ? q.order[0]?.order_number : q.order?.order_number
      lines.push(`  - ${orderNum ?? "?"}: ${q.quantity_failed} failed, defect: ${q.defect_type ?? "unspecified"}`)
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
