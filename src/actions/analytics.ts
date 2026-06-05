"use server"

import { revalidatePath, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ==================== Market Intel — Prices ====================

export const getLatestMaterialPrices = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const [{ data: materials }, { data: prices }] = await Promise.all([
      supabase
        .from("materials")
        .select("id, name, sku, unit, category:material_categories(name)")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("material_price_history")
        .select("material_id, price_per_unit, recorded_at, supplier:suppliers(name)")
        .order("recorded_at", { ascending: false }),
    ])

    const latestMap = new Map<string, { price: number; date: string; supplier: string | null }>()
    for (const p of prices ?? []) {
      if (!latestMap.has(p.material_id)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sup = p.supplier as any
        latestMap.set(p.material_id, {
          price: p.price_per_unit,
          date: p.recorded_at,
          supplier: Array.isArray(sup) ? sup[0]?.name ?? null : sup?.name ?? null,
        })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (materials ?? []).map((m: any) => ({
      ...m,
      category: Array.isArray(m.category) ? m.category[0] ?? null : m.category,
      latest_price: latestMap.get(m.id) ?? null,
    }))
  },
  ["latest-material-prices"],
  { tags: ["price-history", "materials"], revalidate: 300 }
)

export const getMaterialPriceHistory = unstable_cache(
  async (materialId: string) => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("material_price_history")
      .select("id, price_per_unit, recorded_at, notes, supplier:suppliers(name)")
      .eq("material_id", materialId)
      .order("recorded_at", { ascending: true })
      .limit(60)
    if (error) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any) => ({
      ...r,
      supplier: Array.isArray(r.supplier) ? r.supplier[0]?.name ?? null : r.supplier?.name ?? null,
    }))
  },
  ["material-price-history"],
  { tags: ["price-history"], revalidate: 300 }
)

export async function logMaterialPrice(payload: {
  material_id: string
  price_per_unit: number
  supplier_id?: string
  recorded_at: string
  notes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("material_price_history").insert({
    material_id: payload.material_id,
    price_per_unit: payload.price_per_unit,
    supplier_id: payload.supplier_id || null,
    recorded_at: payload.recorded_at,
    notes: payload.notes || null,
  })
  if (error) return { error: error.message }

  revalidatePath("/market-intel")
  return { success: true }
}

// ==================== Market Intel — News ====================

export const getMarketNews = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("market_news")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(50)
    if (error) return []
    return data ?? []
  },
  ["market-news"],
  { tags: ["market-news"], revalidate: 300 }
)

export async function createMarketNews(payload: {
  title: string
  summary?: string
  url?: string
  category: string
  source?: string
  published_at: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("market_news").insert(payload)
  if (error) return { error: error.message }

  revalidatePath("/market-intel")
  return { success: true }
}

export async function deleteMarketNews(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("market_news").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/market-intel")
  return { success: true }
}

// ==================== Schedule ====================

export const getProductionSchedule = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, product_variant, total_quantity, deadline, status, priority, customer:customers(name)")
      .in("status", ["draft", "confirmed", "in_production"])
      .order("deadline", { ascending: true })
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((o: any) => ({
      ...o,
      customer: Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer,
    }))
  },
  ["production-schedule"],
  { tags: ["orders"], revalidate: 60 }
)

export const getShiftRoster = unstable_cache(
  async (weekStart: string) => {
    const supabase = createAdminClient()
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    const weekEnd = end.toISOString().split("T")[0]

    const [workersRes, attendanceRes, shiftsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, department").eq("is_active", true).order("full_name"),
      supabase.from("attendance").select("*, shift:shifts(name, start_time, end_time)").gte("date", weekStart).lte("date", weekEnd),
      supabase.from("shifts").select("*").order("name"),
    ])

    return {
      workers: workersRes.data ?? [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attendance: (attendanceRes.data ?? []).map((a: any) => ({
        ...a,
        shift: Array.isArray(a.shift) ? a.shift[0] ?? null : a.shift,
      })),
      shifts: shiftsRes.data ?? [],
    }
  },
  ["shift-roster"],
  { tags: ["workers", "shifts"], revalidate: 60 }
)

// ==================== Forecasting ====================

export const getDemandForecast = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const since = new Date()
    since.setMonth(since.getMonth() - 12)

    const { data: orders } = await supabase
      .from("orders")
      .select("id, total_quantity, created_at")
      .gte("created_at", since.toISOString())
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: true })

    const monthlyData: Record<string, { count: number; quantity: number }> = {}
    for (const o of orders ?? []) {
      const month = o.created_at.slice(0, 7)
      if (!monthlyData[month]) monthlyData[month] = { count: 0, quantity: 0 }
      monthlyData[month].count++
      monthlyData[month].quantity += o.total_quantity ?? 0
    }

    const actuals: { month: string; label: string; count: number; quantity: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      actuals.push({
        month: key,
        label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
        ...(monthlyData[key] ?? { count: 0, quantity: 0 }),
      })
    }

    // Linear regression on order count
    const n = actuals.length
    const xMean = (n - 1) / 2
    const yMean = actuals.reduce((s, a) => s + a.count, 0) / n
    let num = 0, den = 0
    actuals.forEach((a, i) => { num += (i - xMean) * (a.count - yMean); den += (i - xMean) ** 2 })
    const slope = den !== 0 ? num / den : 0
    const intercept = yMean - slope * xMean

    const projections = Array.from({ length: 3 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() + i + 1)
      return {
        month: d.toISOString().slice(0, 7),
        label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
        count: Math.max(0, Math.round(intercept + slope * (n + i))),
        quantity: 0,
        projected: true,
      }
    })

    return { actuals, projections, trend: (slope > 0.3 ? "up" : slope < -0.3 ? "down" : "stable") as "up" | "down" | "stable" }
  },
  ["demand-forecast"],
  { tags: ["orders"], revalidate: 3600 }
)

export const getInventoryForecast = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const since90 = new Date()
    since90.setDate(since90.getDate() - 90)

    const [{ data: materials }, { data: transactions }] = await Promise.all([
      supabase
        .from("materials")
        .select("id, name, sku, unit, current_stock, min_stock_level, category:material_categories(name)")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("stock_transactions")
        .select("material_id, quantity")
        .gte("created_at", since90.toISOString())
        .lt("quantity", 0),
    ])

    const consumptionMap = new Map<string, number>()
    for (const t of transactions ?? []) {
      consumptionMap.set(t.material_id, (consumptionMap.get(t.material_id) ?? 0) + Math.abs(t.quantity))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (materials ?? []).map((m: any) => {
      const category = Array.isArray(m.category) ? m.category[0] ?? null : m.category
      const totalConsumed = consumptionMap.get(m.id) ?? 0
      const weeklyUsage = totalConsumed / 13
      const weeksLeft = weeklyUsage > 0 ? m.current_stock / weeklyUsage : null
      const stockoutDate = weeksLeft !== null
        ? new Date(Date.now() + weeksLeft * 7 * 86400000).toISOString().split("T")[0]
        : null
      return {
        ...m,
        category,
        weeklyUsage: Math.round(weeklyUsage * 100) / 100,
        weeksLeft: weeksLeft !== null ? Math.round(weeksLeft * 10) / 10 : null,
        stockoutDate,
        status: weeksLeft === null ? "no_data" : weeksLeft <= 2 ? "critical" : weeksLeft <= 4 ? "low" : "ok",
      }
    })
  },
  ["inventory-forecast"],
  { tags: ["materials"], revalidate: 3600 }
)
