"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidateTag, revalidatePath } from "next/cache"

const TROY_OZ_PER_MT = 32_150.75

// ── Metals API (LME Aluminium + Nickel) ──────────────────────────────────────

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

// ── World Bank Commodity Price API (free, no key, monthly updates) ────────────

async function fetchWorldBankUsd(indicator: string): Promise<number | null> {
  const url = `https://api.worldbank.org/v2/en/indicator/${indicator}?format=json&mrv=1&per_page=1`
  try {
    const res = await fetch(url, { cache: "no-store" })
    const data = await res.json()
    return data?.[1]?.[0]?.value ?? null // USD per MT
  } catch {
    return null
  }
}

async function getUsdInr(): Promise<number> {
  // Fallback exchange rate fetch from a free endpoint if Metals API key not configured
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" })
    const data = await res.json()
    return data?.rates?.INR ?? 84
  } catch {
    return 84
  }
}

// ── Main fetch action ─────────────────────────────────────────────────────────

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

  // Load commodity IDs by name
  const { data: commodityRows } = await admin
    .from("commodities")
    .select("id, name")
    .eq("is_active", true)

  const byName = new Map((commodityRows ?? []).map(c => [c.name.toLowerCase(), c.id]))

  // Check which commodities already have a price logged today
  const { data: todayPrices } = await admin
    .from("commodity_price_history")
    .select("commodity_id")
    .eq("recorded_at", today)

  const alreadyLogged = new Set((todayPrices ?? []).map(p => p.commodity_id))

  // ── Fetch LME prices ──────────────────────────────────────────────────────
  const { aluminium, nickel } = await fetchLmePricesInr()

  const lmePrices: { name: string; priceInr: number | null }[] = [
    { name: "lme aluminium", priceInr: aluminium },
    { name: "lme nickel", priceInr: nickel },
  ]

  for (const { name, priceInr } of lmePrices) {
    const commodityId = byName.get(name)
    if (!commodityId) { errors.push(`Commodity not found in DB: "${name}"`); continue }
    if (alreadyLogged.has(commodityId)) { skipped++; continue }
    if (!priceInr) { errors.push(`No price data for ${name}`); continue }

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

  // ── Fetch World Bank prices ───────────────────────────────────────────────
  // Iron Ore: PIORECR_USD — spot price, 62% Fe, fob Qingdao (USD/MT)
  // Coking Coal: PCOALAU_USD — Australian hard coking coal (USD/MT)
  const worldBankCommodities: { name: string; indicator: string }[] = [
    { name: "iron ore", indicator: "PIORECR_USD" },
    { name: "coking coal", indicator: "PCOALAU_USD" },
  ]

  // Get USD/INR for World Bank conversion
  const usdInr = process.env.METALS_API_KEY
    ? null // will be fetched inline if LME call succeeded
    : await getUsdInr()

  // Use exchange rate: if Metals API is configured, re-use; otherwise fetch separately
  const exchangeRate = usdInr ?? (await getUsdInr())

  for (const { name, indicator } of worldBankCommodities) {
    const commodityId = byName.get(name)
    if (!commodityId) { errors.push(`Commodity not found in DB: "${name}"`); continue }
    if (alreadyLogged.has(commodityId)) { skipped++; continue }

    const priceUsd = await fetchWorldBankUsd(indicator)
    if (!priceUsd) { errors.push(`No World Bank data for ${indicator}`); continue }

    const priceInr = Math.round(priceUsd * exchangeRate)

    const { error } = await admin.from("commodity_price_history").insert({
      commodity_id: commodityId,
      price_per_unit: priceInr,
      unit: "MT",
      recorded_at: today,
      notes: `Auto-fetched from World Bank (${indicator}) · $${priceUsd.toFixed(2)}/MT`,
    })
    if (error) errors.push(`Insert error (${name}): ${error.message}`)
    else inserted++
  }

  if (inserted > 0) {
    revalidateTag("commodity-prices", {})
    revalidatePath("/market-intel")
  }

  return { inserted, skipped, errors }
}
