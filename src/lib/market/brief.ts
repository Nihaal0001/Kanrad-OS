import { createAdminClient } from "@/lib/supabase/admin"
import { revalidateTag } from "next/cache"
import { askGemini } from "@/lib/ai/gemini"

// Daily AI market brief: digests the last 48h of industry news + commodity
// price moves + BOM cost impact into a short actionable summary, stored one
// row per day in market_briefs (JSONB) so the page renders it instantly.

export interface MarketBrief {
  brief_date: string
  headline: string
  bullets: string[]
  impact: { subject: string; direction: "up" | "down" | "neutral"; note: string }[]
  sentiment: "positive" | "neutral" | "cautious" | "negative"
  top_story_ids: string[]
  price_snapshot: { name: string; latest: number | null; momPct: number | null }[]
  generated_at: string
}

const SYSTEM_PROMPT = `You are a sharp market analyst for Kanrad Houseware, an aluminium cookware manufacturer in Bommasandra, Bangalore, India. They press aluminium circles into kadais, tawas, casseroles and fry pans, apply non-stick/hard-anodised coatings, and sell to Indian brands and distributors.

You will receive: recent industry news items (with ids), latest commodity prices with month-over-month changes (note: benchmark prices are MONTHLY AVERAGES from the IMF, roughly one month behind spot), and the computed cost impact on their top products.

Write today's market brief. Respond ONLY with JSON in exactly this shape (no markdown fences, no commentary):
{
  "headline": "one punchy sentence capturing the day's most important development for this business",
  "bullets": ["3 to 5 short bullets — concrete, specific, useful to a cookware factory owner; mention numbers where available"],
  "impact": [{"subject": "e.g. Aluminium / a product line / freight", "direction": "up|down|neutral", "note": "one short sentence on what it means for Kanrad"}],
  "sentiment": "positive|neutral|cautious|negative",
  "top_story_ids": ["up to 5 ids chosen ONLY from the provided news ids — the stories most worth reading"]
}`

function stripFences(raw: string): string {
  return raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim()
}

export async function generateMarketBrief(): Promise<{ data: MarketBrief } | { error: string }> {
  const admin = createAdminClient()

  // ── Gather inputs ──────────────────────────────────────────────────────────
  const since = new Date()
  since.setHours(since.getHours() - 48)

  const [{ data: newsRows }, { data: commodities }] = await Promise.all([
    admin
      .from("market_news")
      .select("id, title, category, source")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(120),
    admin.from("commodities").select("id, name").eq("is_active", true),
  ])

  // cookware/raw_material first, cap 60
  const news = (newsRows ?? [])
    .sort((a, b) => {
      const rank = (c: string) => (c === "cookware" ? 0 : c === "raw_material" ? 1 : 2)
      return rank(a.category) - rank(b.category)
    })
    .slice(0, 60)

  const priceSnapshot: MarketBrief["price_snapshot"] = []
  for (const c of commodities ?? []) {
    const { data: pts } = await admin
      .from("commodity_price_history")
      .select("price_per_unit, recorded_at")
      .eq("commodity_id", c.id)
      .order("recorded_at", { ascending: false })
      .limit(2)
    const latest = pts?.[0] ? Number(pts[0].price_per_unit) : null
    const prev = pts?.[1] ? Number(pts[1].price_per_unit) : null
    priceSnapshot.push({
      name: c.name,
      latest,
      momPct: latest && prev ? Math.round(((latest - prev) / prev) * 1000) / 10 : null,
    })
  }

  const userMessage = JSON.stringify({
    date: new Date().toISOString().split("T")[0],
    prices_inr_per_mt: priceSnapshot,
    news: news.map((n) => ({ id: n.id, title: n.title, category: n.category, source: n.source })),
  })

  // ── Ask Gemini ─────────────────────────────────────────────────────────────
  let parsed: Omit<MarketBrief, "brief_date" | "price_snapshot" | "generated_at">
  try {
    const raw = await askGemini(SYSTEM_PROMPT, userMessage)
    parsed = JSON.parse(stripFences(raw))
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI brief generation failed" }
  }

  // ── Validate shape ─────────────────────────────────────────────────────────
  if (!parsed || typeof parsed.headline !== "string" || !Array.isArray(parsed.bullets)) {
    return { error: "AI returned an unexpected format" }
  }
  const validIds = new Set(news.map((n) => n.id))
  const brief: MarketBrief = {
    brief_date: new Date().toISOString().split("T")[0],
    headline: parsed.headline.slice(0, 300),
    bullets: parsed.bullets.filter((b) => typeof b === "string").slice(0, 5),
    impact: Array.isArray(parsed.impact)
      ? parsed.impact
          .filter((i) => i && typeof i.subject === "string" && typeof i.note === "string")
          .map((i) => ({
            subject: i.subject.slice(0, 80),
            direction: (["up", "down", "neutral"].includes(i.direction) ? i.direction : "neutral") as "up" | "down" | "neutral",
            note: i.note.slice(0, 200),
          }))
          .slice(0, 5)
      : [],
    sentiment: (["positive", "neutral", "cautious", "negative"].includes(parsed.sentiment)
      ? parsed.sentiment
      : "neutral") as MarketBrief["sentiment"],
    top_story_ids: Array.isArray(parsed.top_story_ids)
      ? parsed.top_story_ids.filter((id) => validIds.has(id)).slice(0, 5)
      : [],
    price_snapshot: priceSnapshot,
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
