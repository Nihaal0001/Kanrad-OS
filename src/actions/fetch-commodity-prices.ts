"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidateTag, revalidatePath } from "next/cache"
import { fetchPcpsMonthly, type PcpsIndicator } from "@/lib/market/pcps"
import { getUsdInrMonthEnds, getUsdInrSpot } from "@/lib/market/fx"

const TROY_OZ_PER_MT = 32_150.75

// ── Metals API (optional daily LME quotes — auto-upgrade when key is set) ────

async function fetchLmePricesInr(): Promise<{
  aluminium: number | null
  nickel: number | null
}> {
  const key = process.env.METALS_API_KEY
  if (!key) return { aluminium: null, nickel: null }

  const url = `https://metals-api.com/api/latest?access_key=${key}&base=USD&symbols=LME-ALU,LME-NI,INR`
  const res = await fetch(url, { cache: "no-store" })
  const data = await res.json()

  if (!data.success || !data.rates) return { aluminium: null, nickel: null }

  const usdInr: number = data.rates.INR ?? null          // INR per 1 USD
  const aluUsd: number = data.rates["USDLME-ALU"] ?? null // USD per troy oz
  const niUsd: number = data.rates["USDLME-NI"] ?? null   // USD per troy oz

  if (!usdInr) return { aluminium: null, nickel: null }

  return {
    aluminium: aluUsd ? Math.round(aluUsd * TROY_OZ_PER_MT * usdInr) : null,
    nickel: niUsd ? Math.round(niUsd * TROY_OZ_PER_MT * usdInr) : null,
  }
}

// ── IMF PCPS monthly benchmarks (free, no key) ───────────────────────────────
// One row per calendar month, stored at month-end, converted with that
// month's USD/INR. Backfill and daily top-up are the same idempotent sync —
// an empty commodity gets ~26 months, an up-to-date one gets nothing new.

const PCPS_MAP: { name: string; indicator: PcpsIndicator; note?: string }[] = [
  { name: "lme aluminium", indicator: "PALUM" },
  { name: "lme nickel", indicator: "PNICK" },
  { name: "iron ore", indicator: "PIORECR" },
  { name: "coking coal", indicator: "PCOALAU", note: "Australian coal benchmark (thermal proxy)" },
]

function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`
}

export async function syncPcpsHistory(opts?: { monthsBack?: number }): Promise<{
  inserted: number
  skippedMonths: number
  errors: string[]
}> {
  const admin = createAdminClient()
  const errors: string[] = []
  let inserted = 0
  let skippedMonths = 0

  const { data: commodityRows } = await admin
    .from("commodities")
    .select("id, name")
    .eq("is_active", true)
  const byName = new Map((commodityRows ?? []).map((c) => [c.name.toLowerCase(), c.id]))

  const targets = PCPS_MAP.filter((t) => byName.has(t.name))
  if (targets.length === 0) return { inserted, skippedMonths, errors: ["No PCPS-mapped commodities active"] }

  // Existing PCPS months per commodity (tagged rows only, so manual entries
  // and LME dailies never block the monthly series)
  const ids = targets.map((t) => byName.get(t.name)!)
  const { data: existing } = await admin
    .from("commodity_price_history")
    .select("commodity_id, recorded_at")
    .in("commodity_id", ids)
    .ilike("notes", "IMF PCPS%")
  const have = new Set((existing ?? []).map((r) => `${r.commodity_id}|${String(r.recorded_at).slice(0, 7)}`))

  const anyEmpty = targets.some((t) => !(existing ?? []).some((r) => r.commodity_id === byName.get(t.name)))
  const monthsBack = opts?.monthsBack ?? (anyEmpty ? 26 : 3)

  const start = new Date()
  start.setMonth(start.getMonth() - monthsBack)
  const startPeriod = start.toISOString().slice(0, 7)

  let series: Awaited<ReturnType<typeof fetchPcpsMonthly>>
  try {
    series = await fetchPcpsMonthly(targets.map((t) => t.indicator), startPeriod)
  } catch (e) {
    return { inserted, skippedMonths, errors: [`IMF PCPS fetch failed: ${e instanceof Error ? e.message : e}`] }
  }

  const nowMonth = new Date().toISOString().slice(0, 7)
  const fxByMonth = await getUsdInrMonthEnds(startPeriod, nowMonth)
  const fxSpot = await getUsdInrSpot()

  for (const t of targets) {
    const commodityId = byName.get(t.name)!
    const points = series.get(t.indicator) ?? []
    if (points.length === 0) {
      errors.push(`No PCPS data for ${t.indicator}`)
      continue
    }
    for (const p of points) {
      if (have.has(`${commodityId}|${p.month}`)) {
        skippedMonths++
        continue
      }
      const fx = fxByMonth.get(p.month) ?? fxSpot
      const priceInr = Math.round(p.usd * fx)
      const noteSuffix = t.note ? ` · ${t.note}` : ""
      const { error } = await admin.from("commodity_price_history").insert({
        commodity_id: commodityId,
        price_per_unit: priceInr,
        unit: "MT",
        recorded_at: monthEnd(p.month),
        notes: `IMF PCPS ${t.indicator} monthly avg · $${p.usd.toFixed(2)}/MT @ ₹${fx.toFixed(2)}/USD${noteSuffix}`,
      })
      if (error) errors.push(`Insert error (${t.name} ${p.month}): ${error.message}`)
      else inserted++
    }
  }

  return { inserted, skippedMonths, errors }
}

// ── Main fetch action (cron entry point) ─────────────────────────────────────

export async function fetchCommodityPrices(): Promise<{
  inserted: number
  skipped: number
  errors: string[]
}> {
  const admin = createAdminClient()
  const today = new Date().toISOString().split("T")[0]
  const errors: string[] = []
  let inserted = 0
  let skipped = 0

  const { data: commodityRows } = await admin
    .from("commodities")
    .select("id, name")
    .eq("is_active", true)
  const byName = new Map((commodityRows ?? []).map((c) => [c.name.toLowerCase(), c.id]))

  const { data: todayPrices } = await admin
    .from("commodity_price_history")
    .select("commodity_id")
    .eq("recorded_at", today)
  const alreadyLogged = new Set((todayPrices ?? []).map((p) => p.commodity_id))

  // Daily LME spot quotes — only when a Metals-API key is configured
  const { aluminium, nickel } = await fetchLmePricesInr()
  const lmePrices: { name: string; priceInr: number | null }[] = [
    { name: "lme aluminium", priceInr: aluminium },
    { name: "lme nickel", priceInr: nickel },
  ]
  for (const { name, priceInr } of lmePrices) {
    if (!priceInr) continue // no key or no quote — PCPS monthly covers these
    const commodityId = byName.get(name)
    if (!commodityId) { errors.push(`Commodity not found in DB: "${name}"`); continue }
    if (alreadyLogged.has(commodityId)) { skipped++; continue }

    const { error } = await admin.from("commodity_price_history").insert({
      commodity_id: commodityId,
      price_per_unit: priceInr,
      unit: "MT",
      recorded_at: today,
      notes: "Auto-fetched from Metals API (LME)",
    })
    if (error) errors.push(`Insert error (${name}): ${error.message}`)
    else inserted++
  }

  // Monthly benchmark series (auto-backfills ~26 months on first ever run)
  const pcps = await syncPcpsHistory()
  inserted += pcps.inserted
  errors.push(...pcps.errors)

  if (inserted > 0) {
    revalidateTag("commodity-prices", {})
    revalidatePath("/market-intel")
  }

  return { inserted, skipped, errors }
}
