import { createAdminClient } from "@/lib/supabase/admin"
import { revalidateTag } from "next/cache"
import { askGemini } from "@/lib/ai/gemini"

// Daily market brief built for decisions, not commentary. Every number shown
// is computed by code from real data (prices, inventory, BOMs) and passed to
// the AI, which may ONLY reference those inputs — it writes "what changed"
// and "what to do", and must say when there's nothing actionable.

export interface MarketBrief {
  brief_date: string
  headline: string
  what_changed: string[]
  actions: { action: string; reason: string; urgency: "now" | "this_week" | "monitor" }[]
  sentiment: "positive" | "neutral" | "cautious" | "negative"
  top_story_ids: string[]
  price_snapshot: { name: string; latest: number | null; momPct: number | null; trend3mPct: number | null; asOf: string | null }[]
  context: {
    aluInventoryWeeksLeft: number | null
    aluMaterialsTracked: number
    bomImpactTop: { productSku: string; deltaPct: number }[] | null
  }
  generated_at: string
}

const SYSTEM_PROMPT = `You are a procurement and operations advisor for Kanrad Houseware, an aluminium cookware manufacturer in Bommasandra, Bangalore. They buy aluminium circles (their #1 cost), coatings, packaging; they press, coat and sell kadais/tawas/casseroles to Indian brands.

You will receive COMPUTED FACTS (prices with month-over-month and 3-month trends, their aluminium inventory runway, product cost impact) and recent news items with ids. All numbers are already computed — treat them as ground truth.

Strict rules:
- NEVER invent a number. Only repeat numbers exactly as given.
- Every "what_changed" item and every action must be traceable to a given fact or a given news item. No generic advice ("monitor markets", "stay competitive").
- Actions must be concrete and specific to this factory (e.g. tie aluminium price trend to their circle purchases or inventory runway).
- If the facts genuinely support no action today, return a single action: {"action":"No action needed today","reason":"<one line why>","urgency":"monitor"}.
- Prices marked as benchmark are MONTHLY AVERAGES with ~1 month lag — say "benchmark" when referencing them, never imply they are today's spot price.

Respond ONLY with JSON:
{
  "headline": "one specific sentence — the single most decision-relevant development",
  "what_changed": ["2-4 short items, each stating a concrete change from the given facts/news"],
  "actions": [{"action":"imperative, specific","reason":"grounded in a given fact","urgency":"now|this_week|monitor"}],
  "sentiment": "positive|neutral|cautious|negative",
  "top_story_ids": ["up to 5 ids from the provided news, most decision-relevant first"]
}`

function stripFences(raw: string): string {
  return raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim()
}

export async function generateMarketBrief(): Promise<{ data: MarketBrief } | { error: string }> {
  const admin = createAdminClient()

  // ── Gather inputs (all computed, all real) ─────────────────────────────────
  const since = new Date()
  since.setHours(since.getHours() - 48)
  const since90 = new Date()
  since90.setDate(since90.getDate() - 90)

  const [{ data: newsRows }, { data: commodities }, { data: aluMaterials }, { data: consumption }] = await Promise.all([
    admin
      .from("market_news")
      .select("id, title, category, source")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(120),
    admin.from("commodities").select("id, name").eq("is_active", true),
    admin
      .from("materials")
      .select("id, current_stock, category:material_categories!inner(name)")
      .eq("is_active", true)
      .ilike("material_categories.name", "%alumin%"),
    admin
      .from("stock_transactions")
      .select("material_id, quantity")
      .gte("created_at", since90.toISOString())
      .lt("quantity", 0),
  ])

  const news = (newsRows ?? [])
    .sort((a, b) => {
      const rank = (c: string) => (c === "cookware" ? 0 : c === "raw_material" ? 1 : 2)
      return rank(a.category) - rank(b.category)
    })
    .slice(0, 60)

  // price snapshot with MoM + 3-month trend, computed here
  const priceSnapshot: MarketBrief["price_snapshot"] = []
  for (const c of commodities ?? []) {
    const { data: pts } = await admin
      .from("commodity_price_history")
      .select("price_per_unit, recorded_at")
      .eq("commodity_id", c.id)
      .order("recorded_at", { ascending: false })
      .limit(4)
    const series = (pts ?? []).map((p) => Number(p.price_per_unit))
    const latest = series[0] ?? null
    const prev = series[1] ?? null
    const threeBack = series[3] ?? null
    priceSnapshot.push({
      name: c.name,
      latest,
      momPct: latest && prev ? Math.round(((latest - prev) / prev) * 1000) / 10 : null,
      trend3mPct: latest && threeBack ? Math.round(((latest - threeBack) / threeBack) * 1000) / 10 : null,
      asOf: pts?.[0]?.recorded_at ?? null,
    })
  }

  // aluminium inventory runway (weeks of circle stock at 90-day consumption rate)
  const aluIds = new Set((aluMaterials ?? []).map((m) => m.id))
  let aluConsumed = 0
  for (const t of consumption ?? []) {
    if (aluIds.has(t.material_id)) aluConsumed += Math.abs(Number(t.quantity))
  }
  const aluStock = (aluMaterials ?? []).reduce((s, m) => s + Number(m.current_stock ?? 0), 0)
  const aluWeekly = aluConsumed / 13
  const aluInventoryWeeksLeft = aluWeekly > 0 ? Math.round((aluStock / aluWeekly) * 10) / 10 : null

  // BOM impact top movers (import lazily — same computation the page uses)
  let bomImpactTop: MarketBrief["context"]["bomImpactTop"] = null
  try {
    const { getBomCostImpact } = await import("@/actions/market-intel")
    const impact = await getBomCostImpact()
    if (impact.available) {
      bomImpactTop = impact.rows.slice(0, 3).map((r) => ({ productSku: r.productSku, deltaPct: r.deltaPct }))
    }
  } catch {
    bomImpactTop = null
  }

  const context: MarketBrief["context"] = {
    aluInventoryWeeksLeft,
    aluMaterialsTracked: aluIds.size,
    bomImpactTop,
  }

  const userMessage = JSON.stringify({
    date: new Date().toISOString().split("T")[0],
    computed_facts: {
      benchmark_prices_inr_per_mt: priceSnapshot,
      aluminium_inventory: {
        weeks_of_stock_left: aluInventoryWeeksLeft,
        note: aluInventoryWeeksLeft === null ? "no consumption recorded yet — runway unknown" : "based on last 90 days of usage",
      },
      product_cost_impact_top3: bomImpactTop ?? "not computable yet (material rates are 0)",
    },
    news: news.map((n) => ({ id: n.id, title: n.title, category: n.category, source: n.source })),
  })

  // ── Ask Gemini ─────────────────────────────────────────────────────────────
  let parsed: {
    headline?: unknown
    what_changed?: unknown
    actions?: unknown
    sentiment?: unknown
    top_story_ids?: unknown
  }
  try {
    const raw = await askGemini(SYSTEM_PROMPT, userMessage)
    parsed = JSON.parse(stripFences(raw))
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI brief generation failed" }
  }

  // ── Validate shape ─────────────────────────────────────────────────────────
  if (!parsed || typeof parsed.headline !== "string" || !Array.isArray(parsed.what_changed)) {
    return { error: "AI returned an unexpected format" }
  }
  const validIds = new Set(news.map((n) => n.id))
  const brief: MarketBrief = {
    brief_date: new Date().toISOString().split("T")[0],
    headline: parsed.headline.slice(0, 300),
    what_changed: (parsed.what_changed as unknown[]).filter((b): b is string => typeof b === "string").slice(0, 4),
    actions: Array.isArray(parsed.actions)
      ? (parsed.actions as { action?: unknown; reason?: unknown; urgency?: unknown }[])
          .filter((a) => a && typeof a.action === "string" && typeof a.reason === "string")
          .map((a) => ({
            action: (a.action as string).slice(0, 200),
            reason: (a.reason as string).slice(0, 250),
            urgency: (["now", "this_week", "monitor"].includes(a.urgency as string) ? a.urgency : "monitor") as
              | "now"
              | "this_week"
              | "monitor",
          }))
          .slice(0, 4)
      : [],
    sentiment: (["positive", "neutral", "cautious", "negative"].includes(parsed.sentiment as string)
      ? parsed.sentiment
      : "neutral") as MarketBrief["sentiment"],
    top_story_ids: Array.isArray(parsed.top_story_ids)
      ? (parsed.top_story_ids as unknown[]).filter((id): id is string => typeof id === "string" && validIds.has(id)).slice(0, 5)
      : [],
    price_snapshot: priceSnapshot,
    context,
    generated_at: new Date().toISOString(),
  }

  // ── Store (one row per day) ────────────────────────────────────────────────
  const { error } = await admin
    .from("market_briefs")
    .upsert(
      { brief_date: brief.brief_date, content: brief, updated_at: new Date().toISOString() },
      { onConflict: "brief_date" }
    )
  if (error) return { error: `Brief save failed: ${error.message}` }

  revalidateTag("market-brief", {})
  return { data: brief }
}
