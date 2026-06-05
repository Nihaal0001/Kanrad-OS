import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// RSS feeds covering international, India, Karnataka, Bangalore, Bommasandra + commodities
const FEEDS = [
  // Raw material / commodity prices
  { url: "https://news.google.com/rss/search?q=aluminium+price+commodity+international&hl=en&gl=US&ceid=US:en", category: "raw_material" },
  { url: "https://news.google.com/rss/search?q=steel+copper+zinc+commodity+price&hl=en&gl=US&ceid=US:en", category: "raw_material" },
  { url: "https://news.google.com/rss/search?q=aluminium+steel+price+india&hl=en-IN&gl=IN&ceid=IN:en", category: "raw_material" },
  { url: "https://news.google.com/rss/search?q=commodity+metal+price+india+2025&hl=en-IN&gl=IN&ceid=IN:en", category: "raw_material" },
  // India manufacturing / industry
  { url: "https://news.google.com/rss/search?q=india+manufacturing+industry+news&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  { url: "https://news.google.com/rss/search?q=houseware+cookware+aluminium+india&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  // Karnataka / Bangalore
  { url: "https://news.google.com/rss/search?q=Karnataka+industry+manufacturing&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  { url: "https://news.google.com/rss/search?q=Bangalore+industrial+manufacturing&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  // Bommasandra
  { url: "https://news.google.com/rss/search?q=Bommasandra+industrial+area&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  // Regulation / GST / trade
  { url: "https://news.google.com/rss/search?q=india+GST+import+export+manufacturing+regulation&hl=en-IN&gl=IN&ceid=IN:en", category: "regulation" },
]

function extractField(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i"))
  if (!match) return ""
  return (match[1] ?? match[2] ?? "").replace(/<[^>]+>/g, "").trim()
}

function parseRssItems(xml: string, category: string): { title: string; summary: string; url: string; source: string; published_at: string; category: string }[] {
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  const items: { title: string; summary: string; url: string; source: string; published_at: string; category: string }[] = []
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = extractField(item, "title")
    const link = extractField(item, "link") || item.match(/<link>([^<]+)<\/link>/)?.[1] || ""
    const description = extractField(item, "description")
    const pubDate = extractField(item, "pubDate")
    const source = extractField(item, "source") || "Google News"

    if (!title || title.length < 10) continue

    // Parse date
    let published_at = new Date().toISOString().split("T")[0]
    if (pubDate) {
      const d = new Date(pubDate)
      if (!isNaN(d.getTime())) published_at = d.toISOString().split("T")[0]
    }

    // Clean summary — strip HTML, limit length
    const summary = description.replace(/<[^>]+>/g, "").slice(0, 300).trim()

    items.push({ title: title.slice(0, 200), summary, url: link, source, published_at, category })
  }

  return items
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const results = { fetched: 0, inserted: 0, errors: 0 }

  // Get existing titles from last 7 days to avoid duplicates
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const { data: existing } = await admin
    .from("market_news")
    .select("title")
    .gte("created_at", since.toISOString())
  const existingTitles = new Set((existing ?? []).map((n) => n.title.toLowerCase().slice(0, 80)))

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "KanradERP/1.0 news-fetcher" },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) { results.errors++; continue }

      const xml = await res.text()
      const items = parseRssItems(xml, feed.category)
      results.fetched += items.length

      for (const item of items) {
        const key = item.title.toLowerCase().slice(0, 80)
        if (existingTitles.has(key)) continue

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

  return NextResponse.json({ ok: true, ...results })
}
