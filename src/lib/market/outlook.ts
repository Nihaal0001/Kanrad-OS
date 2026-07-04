import { createAdminClient } from "@/lib/supabase/admin"
import { askGemini } from "@/lib/ai/gemini"

// Price outlook: the numbers are computed from actual price history — trend,
// volatility and expected ranges are math, not model output. The AI
// contributes only a qualitative read of drivers/risks from recent news and
// is explicitly forbidden from producing numeric forecasts. If the AI is
// unavailable the statistical outlook still returns.

export interface OutlookDrivers {
  stance: "buy-early" | "neutral" | "wait"
  drivers: string[]
  risks: string[]
  rationale: string
}

export interface CommodityOutlook {
  material_name: string
  unit: string
  last_price: number
  last_date: string
  data_note: string
  points_used: number
  trendPctPerMonth: number | null
  volatilityPct: number | null
  yearHigh: number | null
  yearLow: number | null
  nextMonthRange: { low: number; mid: number; high: number } | null
  threeMonthRange: { low: number; mid: number; high: number } | null
  history: { date: string; price: number }[]
  ai: OutlookDrivers | null
  aiError: string | null
}

export async function computeCommodityOutlook(
  categoryId: string
): Promise<{ data: CommodityOutlook } | { error: string }> {
  const admin = createAdminClient()

  const [{ data: category }, { data: priceHistory }, { data: news }] = await Promise.all([
    admin.from("commodities").select("id, name").eq("id", categoryId).single(),
    admin
      .from("commodity_price_history")
      .select("price_per_unit, unit, recorded_at, notes")
      .eq("commodity_id", categoryId)
      .order("recorded_at", { ascending: true })
      .limit(60),
    admin
      .from("market_news")
      .select("title, category, published_at, source")
      .order("published_at", { ascending: false })
      .limit(25),
  ])

  if (!category) return { error: "Commodity not found" }
  const rows = (priceHistory ?? []).map((p) => ({
    date: p.recorded_at as string,
    price: Number(p.price_per_unit),
    unit: p.unit as string,
    notes: (p.notes as string | null) ?? "",
  }))
  if (rows.length === 0) return { error: "No price history found. Log at least one price first." }

  const last = rows[rows.length - 1]
  const isBenchmark = /IMF PCPS/i.test(last.notes)
  const lastMonthLabel = new Date(last.date).toLocaleString("en-IN", { month: "long", year: "numeric" })
  const data_note = isBenchmark
    ? `IMF benchmark monthly average for ${lastMonthLabel} (published ~1 month behind spot)`
    : `Last logged price on ${lastMonthLabel}`

  // month-over-month % changes from the series
  const changes: number[] = []
  for (let i = 1; i < rows.length; i++) {
    if (rows[i - 1].price > 0) changes.push((rows[i].price - rows[i - 1].price) / rows[i - 1].price)
  }

  let trendPctPerMonth: number | null = null
  let volatilityPct: number | null = null
  let nextMonthRange: CommodityOutlook["nextMonthRange"] = null
  let threeMonthRange: CommodityOutlook["threeMonthRange"] = null

  if (changes.length >= 3) {
    const recent = changes.slice(-3)
    const trend = recent.reduce((s, c) => s + c, 0) / recent.length
    const mean = changes.reduce((s, c) => s + c, 0) / changes.length
    const variance = changes.reduce((s, c) => s + (c - mean) ** 2, 0) / changes.length
    const sigma = Math.sqrt(variance)

    trendPctPerMonth = Math.round(trend * 1000) / 10
    volatilityPct = Math.round(sigma * 1000) / 10

    nextMonthRange = {
      low: Math.round(last.price * (1 + trend - sigma)),
      mid: Math.round(last.price * (1 + trend)),
      high: Math.round(last.price * (1 + trend + sigma)),
    }
    const spread3 = sigma * Math.sqrt(3)
    threeMonthRange = {
      low: Math.round(last.price * ((1 + trend) ** 3 - spread3)),
      mid: Math.round(last.price * (1 + trend) ** 3),
      high: Math.round(last.price * ((1 + trend) ** 3 + spread3)),
    }
  }

  const yearAgo = new Date(last.date)
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const lastYear = rows.filter((r) => new Date(r.date) >= yearAgo)
  const yearHigh = lastYear.length ? Math.max(...lastYear.map((r) => r.price)) : null
  const yearLow = lastYear.length ? Math.min(...lastYear.map((r) => r.price)) : null

  // ── AI: qualitative drivers only (no numbers), optional ────────────────────
  let ai: OutlookDrivers | null = null
  let aiError: string | null = null
  try {
    const systemPrompt = `You are a procurement analyst for Kanrad Houseware, an aluminium cookware manufacturer in Bangalore, India. You will receive computed price statistics (already calculated — do NOT recalculate or invent any numbers) and recent news headlines.

Your job is ONLY qualitative: identify demand/supply drivers and risks relevant to this commodity from the given news, and suggest a procurement stance.

Rules:
- NEVER output a price, percentage, or any number that was not given to you.
- Only reference drivers/risks that are supported by the provided headlines or the provided statistics.
- If the news says nothing relevant to this commodity, say so in the rationale and keep drivers/risks short.

Respond ONLY with JSON: {"stance":"buy-early|neutral|wait","drivers":["..."],"risks":["..."],"rationale":"2 sentences max"}`

    const userMessage = JSON.stringify({
      commodity: category.name,
      computed_stats: {
        last_price_inr: last.price,
        data_note,
        trend_pct_per_month: trendPctPerMonth,
        volatility_pct: volatilityPct,
        year_high: yearHigh,
        year_low: yearLow,
      },
      news: (news ?? []).map((n) => ({ title: n.title, category: n.category, date: n.published_at })),
    })

    const raw = await askGemini(systemPrompt, userMessage)
    const parsed = JSON.parse(raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim())
    ai = {
      stance: ["buy-early", "neutral", "wait"].includes(parsed.stance) ? parsed.stance : "neutral",
      drivers: Array.isArray(parsed.drivers) ? parsed.drivers.filter((d: unknown) => typeof d === "string").slice(0, 4) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.filter((r: unknown) => typeof r === "string").slice(0, 4) : [],
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 400) : "",
    }
  } catch (err) {
    aiError = err instanceof Error ? err.message : "AI driver analysis unavailable"
  }

  return {
    data: {
      material_name: category.name,
      unit: last.unit,
      last_price: last.price,
      last_date: last.date,
      data_note,
      points_used: rows.length,
      trendPctPerMonth,
      volatilityPct,
      yearHigh,
      yearLow,
      nextMonthRange,
      threeMonthRange,
      history: rows.slice(-24).map((r) => ({ date: r.date, price: r.price })),
      ai,
      aiError,
    },
  }
}
