import { createAdminClient } from "@/lib/supabase/admin"
import { revalidateTag, revalidatePath } from "next/cache"

// Single source of truth for market-news fetching — used by both the daily
// cron route and the manual "Fetch Latest News" action (they had drifted into
// two divergent feed lists before this).

// RSS feeds covering cookware, international, India, Karnataka, Bangalore,
// Bommasandra + commodities. `alwaysKeep` feeds skip the relevance filter
// (their query is already exactly on-topic).
const FEEDS: { url: string; category: string; alwaysKeep?: boolean }[] = [
  // ── Cookware / kitchenware (highest priority — shown at top) ──
  { url: "https://news.google.com/rss/search?q=cookware+kitchenware+industry+market&hl=en&gl=US&ceid=US:en", category: "cookware", alwaysKeep: true },
  { url: "https://news.google.com/rss/search?q=aluminium+cookware+kadai+pressure+cooker+india&hl=en-IN&gl=IN&ceid=IN:en", category: "cookware", alwaysKeep: true },
  { url: "https://news.google.com/rss/search?q=non+stick+cookware+houseware+india+market&hl=en-IN&gl=IN&ceid=IN:en", category: "cookware", alwaysKeep: true },
  { url: "https://news.google.com/rss/search?q=cookware+export+import+india+trade&hl=en-IN&gl=IN&ceid=IN:en", category: "cookware", alwaysKeep: true },
  { url: "https://news.google.com/rss/search?q=houseware+kitchenware+BIS+standard+india&hl=en-IN&gl=IN&ceid=IN:en", category: "cookware", alwaysKeep: true },
  // ── Raw material / commodity prices ──
  { url: "https://news.google.com/rss/search?q=aluminium+price+commodity+international&hl=en&gl=US&ceid=US:en", category: "raw_material" },
  { url: "https://news.google.com/rss/search?q=steel+copper+zinc+commodity+price&hl=en&gl=US&ceid=US:en", category: "raw_material" },
  { url: "https://news.google.com/rss/search?q=aluminium+steel+price+india&hl=en-IN&gl=IN&ceid=IN:en", category: "raw_material" },
  { url: "https://news.google.com/rss/search?q=commodity+metal+price+india+2025&hl=en-IN&gl=IN&ceid=IN:en", category: "raw_material" },
  // ── India manufacturing / industry ──
  { url: "https://news.google.com/rss/search?q=india+manufacturing+industry+news&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  { url: "https://news.google.com/rss/search?q=houseware+cookware+aluminium+india&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  // ── Karnataka / Bangalore / Bommasandra ──
  { url: "https://news.google.com/rss/search?q=Karnataka+industry+manufacturing&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  { url: "https://news.google.com/rss/search?q=Bangalore+industrial+manufacturing&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  { url: "https://news.google.com/rss/search?q=Bommasandra+industrial+area&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  // ── Regulation / GST / trade ──
  { url: "https://news.google.com/rss/search?q=india+GST+import+export+manufacturing+regulation&hl=en-IN&gl=IN&ceid=IN:en", category: "regulation" },
  { url: "https://news.google.com/rss/search?q=cookware+BIS+FSSAI+regulation+india&hl=en-IN&gl=IN&ceid=IN:en", category: "regulation" },
]

// Broad-feed noise gate: a story from a non-cookware feed must mention
// something we actually care about. One regex — widen it if too aggressive.
const RELEVANCE =
  /cookware|kitchen|utensil|non[- ]?stick|pressure cooker|kadai|appliance|alumin(i)?um|steel|copper|zinc|nickel|coal|iron ore|commodit|metal|manufactur|factor(y|ies)|industrial|industr(y|ies)|export|import|tariff|duty|GST|BIS|FSSAI|MSME|PLI|inflation|rupee|supply chain|logistics/i

function extractField(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))
  if (!match) return ""
  return (match[1] ?? match[2] ?? "").replace(/<[^>]+>/g, "").trim()
}

interface FeedItem {
  title: string
  summary: string
  url: string
  source: string
  published_at: string
  category: string
}

function parseRssItems(xml: string, category: string): FeedItem[] {
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  const items: FeedItem[] = []
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = extractField(item, "title")
    const link = extractField(item, "link") || item.match(/<link>([^<]+)<\/link>/)?.[1] || ""
    const description = extractField(item, "description")
    const pubDate = extractField(item, "pubDate")
    const source = extractField(item, "source") || "Google News"

    if (!title || title.length < 10) continue

    let published_at = new Date().toISOString().split("T")[0]
    if (pubDate) {
      const d = new Date(pubDate)
      if (!isNaN(d.getTime())) published_at = d.toISOString().split("T")[0]
    }

    const summary = description.replace(/<[^>]+>/g, "").slice(0, 300).trim()
    items.push({ title: title.slice(0, 200), summary, url: link, source, published_at, category })
  }

  return items
}

export async function fetchAndStoreNews(): Promise<{
  fetched: number
  inserted: number
  skippedIrrelevant: number
  errors: number
}> {
  const admin = createAdminClient()
  const results = { fetched: 0, inserted: 0, skippedIrrelevant: 0, errors: 0 }

  // dedupe vs last 7 days by title prefix
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const { data: existing } = await admin
    .from("market_news")
    .select("title")
    .gte("created_at", since.toISOString())
  const existingTitles = new Set((existing ?? []).map((n: { title: string }) => n.title.toLowerCase().slice(0, 80)))

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "KanradERP/1.0 news-fetcher" },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        results.errors++
        continue
      }

      const xml = await res.text()
      const items = parseRssItems(xml, feed.category)
      results.fetched += items.length

      for (const item of items) {
        const key = item.title.toLowerCase().slice(0, 80)
        if (existingTitles.has(key)) continue

        if (!feed.alwaysKeep && !RELEVANCE.test(`${item.title} ${item.summary}`)) {
          results.skippedIrrelevant++
          continue
        }

        const { error } = await admin.from("market_news").insert({
          title: item.title,
          summary: item.summary || null,
          url: item.url || null,
          category: item.category,
          source: item.source,
          published_at: item.published_at,
        })

        if (!error) {
          existingTitles.add(key)
          results.inserted++
        }
      }
    } catch {
      results.errors++
    }
  }

  if (results.inserted > 0) {
    revalidateTag("market-news", {})
    revalidatePath("/market-intel")
  }

  return results
}
