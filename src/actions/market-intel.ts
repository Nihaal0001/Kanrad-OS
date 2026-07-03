"use server"

import { unstable_cache, revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateMarketBrief, type MarketBrief } from "@/lib/market/brief"
import { syncPcpsHistory } from "@/actions/fetch-commodity-prices"

// ── Auth helper (mirror of users.ts requireAdmin) ────────────────────────────

async function requireAdmin(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") return { error: "Forbidden: admin only" }
  return { ok: true }
}

// ── Commodity price history ──────────────────────────────────────────────────

export interface CommodityHistory {
  id: string
  name: string
  unit: string
  latest: number | null
  latestDate: string | null
  momPct: number | null
  yoyPct: number | null
  points: { date: string; price: number }[] // ascending, ~2 years
}

export const getCommodityHistory = unstable_cache(
  async (): Promise<CommodityHistory[]> => {
    const admin = createAdminClient()
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const from = twoYearsAgo.toISOString().split("T")[0]

    const [{ data: commodities }, { data: history }] = await Promise.all([
      admin.from("commodities").select("id, name, unit").eq("is_active", true).order("name"),
      admin
        .from("commodity_price_history")
        .select("commodity_id, price_per_unit, recorded_at")
        .gte("recorded_at", from)
        .order("recorded_at", { ascending: true }),
    ])

    const byCommodity = new Map<string, { date: string; price: number }[]>()
    for (const row of history ?? []) {
      const list = byCommodity.get(row.commodity_id) ?? []
      list.push({ date: row.recorded_at, price: Number(row.price_per_unit) })
      byCommodity.set(row.commodity_id, list)
    }

    const pctChange = (now: number, then: number | undefined) =>
      then && then > 0 ? Math.round(((now - then) / then) * 1000) / 10 : null

    return (commodities ?? []).map((c) => {
      const points = byCommodity.get(c.id) ?? []
      const latest = points.at(-1) ?? null

      let momPct: number | null = null
      let yoyPct: number | null = null
      if (latest) {
        const latestT = new Date(latest.date).getTime()
        const nearestBefore = (daysBack: number, tolerance: number) => {
          const target = latestT - daysBack * 86400000
          let best: { date: string; price: number } | undefined
          let bestDist = Infinity
          for (const p of points) {
            const dist = Math.abs(new Date(p.date).getTime() - target)
            if (dist < bestDist && new Date(p.date).getTime() < latestT) {
              best = p
              bestDist = dist
            }
          }
          return best && bestDist <= tolerance * 86400000 ? best : undefined
        }
        momPct = pctChange(latest.price, nearestBefore(30, 20)?.price)
        yoyPct = pctChange(latest.price, nearestBefore(365, 45)?.price)
      }

      return {
        id: c.id,
        name: c.name,
        unit: c.unit,
        latest: latest?.price ?? null,
        latestDate: latest?.date ?? null,
        momPct,
        yoyPct,
        points,
      }
    })
  },
  ["commodity-history"],
  { tags: ["commodity-prices"], revalidate: 300 }
)

// ── BOM cost impact ──────────────────────────────────────────────────────────

export interface BomImpactRow {
  bomId: string
  productSku: string
  productName: string
  costNow: number
  costThen: number
  deltaAbs: number
  deltaPct: number
  aluSharePct: number
}

export type BomCostImpact =
  | {
      available: true
      aluNow: number
      aluThen: number
      aluDeltaPct: number
      asOf: string
      baselineDate: string
      rows: BomImpactRow[]
    }
  | { available: false; reason: string }

export const getBomCostImpact = unstable_cache(
  async (): Promise<BomCostImpact> => {
    const admin = createAdminClient()

    // Aluminium benchmark series
    const { data: alu } = await admin
      .from("commodities")
      .select("id")
      .ilike("name", "%aluminium%")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
    if (!alu) return { available: false, reason: "No aluminium commodity configured" }

    const { data: pts } = await admin
      .from("commodity_price_history")
      .select("price_per_unit, recorded_at")
      .eq("commodity_id", alu.id)
      .order("recorded_at", { ascending: false })
      .limit(30)
    const series = (pts ?? []).map((p) => ({ date: p.recorded_at as string, price: Number(p.price_per_unit) }))
    if (series.length < 2) {
      return { available: false, reason: "Aluminium price history builds after the first price sync" }
    }

    const now = series[0]
    const nowT = new Date(now.date).getTime()
    const baseline = series.find((p) => nowT - new Date(p.date).getTime() >= 21 * 86400000)
    if (!baseline) {
      return { available: false, reason: "Need at least ~1 month of aluminium history for a comparison" }
    }

    const ratio = now.price / baseline.price
    const aluDeltaPct = Math.round((ratio - 1) * 1000) / 10

    // BOMs with material costs + category
    const { data: boms } = await admin
      .from("bom_headers")
      .select(
        `id, product_sku, product_name,
         items:bom_items(qty_required, wastage_pct,
           material:materials(cost_per_unit, category:material_categories(name)))`
      )
      .eq("is_active", true)

    const rows: BomImpactRow[] = []
    for (const bom of boms ?? []) {
      let costNow = 0
      let costThen = 0
      let aluCost = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const rawItem of (bom.items ?? []) as any[]) {
        const material = Array.isArray(rawItem.material) ? rawItem.material[0] : rawItem.material
        const category = Array.isArray(material?.category) ? material.category[0] : material?.category
        const costPerUnit = Number(material?.cost_per_unit ?? 0)
        const effectiveQty = Number(rawItem.qty_required) * (1 + Number(rawItem.wastage_pct ?? 0) / 100)
        const line = effectiveQty * costPerUnit
        costNow += line
        const isAlu = /alumin/i.test(category?.name ?? "")
        if (isAlu) {
          aluCost += line
          costThen += line / ratio // back out the aluminium move
        } else {
          costThen += line
        }
      }
      if (costNow <= 0) continue
      rows.push({
        bomId: bom.id,
        productSku: bom.product_sku,
        productName: bom.product_name,
        costNow: Math.round(costNow * 100) / 100,
        costThen: Math.round(costThen * 100) / 100,
        deltaAbs: Math.round((costNow - costThen) * 100) / 100,
        deltaPct: costThen > 0 ? Math.round(((costNow - costThen) / costThen) * 1000) / 10 : 0,
        aluSharePct: Math.round((aluCost / costNow) * 1000) / 10,
      })
    }

    rows.sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs))

    if (rows.length === 0) {
      return {
        available: false,
        reason:
          "Material rates are ₹0 — set material costs in Master Inventory and BOM cost impact will compute automatically",
      }
    }

    return {
      available: true,
      aluNow: now.price,
      aluThen: baseline.price,
      aluDeltaPct,
      asOf: now.date,
      baselineDate: baseline.date,
      rows,
    }
  },
  ["bom-cost-impact"],
  { tags: ["commodity-prices", "bom"], revalidate: 3600 }
)

// ── Daily AI brief ───────────────────────────────────────────────────────────

export interface TopStory {
  id: string
  title: string
  url: string | null
  source: string | null
  category: string
  published_at: string
}

const getLatestBriefCached = unstable_cache(
  async (): Promise<{ brief: MarketBrief | null; topStories: TopStory[] }> => {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("market_briefs")
      .select("content")
      .order("brief_date", { ascending: false })
      .limit(1)
      .maybeSingle()

    // table missing (migration not applied yet) or no rows → no brief
    if (error || !data?.content) return { brief: null, topStories: [] }
    const brief = data.content as MarketBrief

    let topStories: TopStory[] = []
    if (brief.top_story_ids?.length) {
      const { data: stories } = await admin
        .from("market_news")
        .select("id, title, url, source, category, published_at")
        .in("id", brief.top_story_ids)
      topStories = (stories ?? []) as TopStory[]
    }
    return { brief, topStories }
  },
  ["latest-market-brief"],
  { tags: ["market-brief"], revalidate: 300 }
)

export async function getTodaysBrief() {
  return getLatestBriefCached()
}

export async function regenerateMarketBrief(): Promise<{ data: MarketBrief } | { error: string }> {
  const auth = await requireAdmin()
  if ("error" in auth) return auth
  return generateMarketBrief()
}

/** Manual safety hatch — the daily cron backfills automatically on first run. */
export async function runPriceHistoryBackfill(): Promise<{ inserted: number; errors: string[] }> {
  const auth = await requireAdmin()
  if ("error" in auth) return { inserted: 0, errors: [auth.error] }
  const result = await syncPcpsHistory({ monthsBack: 26 })
  if (result.inserted > 0) revalidateTag("commodity-prices", {})
  return { inserted: result.inserted, errors: result.errors }
}
