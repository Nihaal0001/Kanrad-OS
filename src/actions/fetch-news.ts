"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

const FEEDS = [
  { url: "https://news.google.com/rss/search?q=cookware+kitchenware+industry+market&hl=en&gl=US&ceid=US:en", category: "cookware" },
  { url: "https://news.google.com/rss/search?q=aluminium+cookware+kadai+pressure+cooker+india&hl=en-IN&gl=IN&ceid=IN:en", category: "cookware" },
  { url: "https://news.google.com/rss/search?q=non+stick+cookware+houseware+india+market&hl=en-IN&gl=IN&ceid=IN:en", category: "cookware" },
  { url: "https://news.google.com/rss/search?q=cookware+export+import+india+trade&hl=en-IN&gl=IN&ceid=IN:en", category: "cookware" },
  { url: "https://news.google.com/rss/search?q=aluminium+price+commodity+international&hl=en&gl=US&ceid=US:en", category: "raw_material" },
  { url: "https://news.google.com/rss/search?q=aluminium+steel+price+india&hl=en-IN&gl=IN&ceid=IN:en", category: "raw_material" },
  { url: "https://news.google.com/rss/search?q=india+manufacturing+industry+news&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  { url: "https://news.google.com/rss/search?q=Karnataka+Bangalore+industry+manufacturing&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  { url: "https://news.google.com/rss/search?q=Bommasandra+industrial+area&hl=en-IN&gl=IN&ceid=IN:en", category: "industry" },
  { url: "https://news.google.com/rss/search?q=india+GST+import+export+manufacturing+regulation&hl=en-IN&gl=IN&ceid=IN:en", category: "regulation" },
]

function extractField(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))
  if (!match) return ""
  return (match[1] ?? match[2] ?? "").replace(/<[^>]+>/g, "").trim()
}

export async function fetchMarketNews(): Promise<{ inserted: number; error?: string }> {
  try {
    const admin = createAdminClient()

    const since = new Date()
    since.setDate(since.getDate() - 7)
    const { data: existing } = await admin
      .from("market_news")
      .select("title")
      .gte("created_at", since.toISOString())
    const seen = new Set((existing ?? []).map((n: { title: string }) => n.title.toLowerCase().slice(0, 80)))

    let inserted = 0

    for (const feed of FEEDS) {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "KanradERP/1.0" },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) continue

        const xml = await res.text()
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi
        let match

        while ((match = itemRegex.exec(xml)) !== null) {
          const item = match[1]
          const title = extractField(item, "title")
          if (!title || title.length < 10) continue

          const key = title.toLowerCase().slice(0, 80)
          if (seen.has(key)) continue

          const link = extractField(item, "link") || item.match(/<link>([^<]+)<\/link>/)?.[1] || ""
          const description = extractField(item, "description").replace(/<[^>]+>/g, "").slice(0, 300).trim()
          const pubDate = extractField(item, "pubDate")
          const source = extractField(item, "source") || "Google News"

          let published_at = new Date().toISOString().split("T")[0]
          if (pubDate) {
            const d = new Date(pubDate)
            if (!isNaN(d.getTime())) published_at = d.toISOString().split("T")[0]
          }

          const { error } = await admin.from("market_news").insert({
            title: title.slice(0, 200),
            summary: description || null,
            url: link || null,
            category: feed.category,
            source,
            published_at,
          })

          if (!error) {
            seen.add(key)
            inserted++
          }
        }
      } catch {
        // skip failed feeds
      }
    }

    revalidatePath("/market-intel")
    return { inserted }
  } catch (err) {
    return { inserted: 0, error: err instanceof Error ? err.message : "Failed" }
  }
}
