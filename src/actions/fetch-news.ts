"use server"

import { fetchAndStoreNews } from "@/lib/market/news-feeds"

/** Manual "Fetch Latest News" — same pipeline as the daily cron. */
export async function fetchMarketNews(): Promise<{ inserted: number; error?: string }> {
  try {
    const result = await fetchAndStoreNews()
    return { inserted: result.inserted }
  } catch (err) {
    return { inserted: 0, error: err instanceof Error ? err.message : "News fetch failed" }
  }
}
