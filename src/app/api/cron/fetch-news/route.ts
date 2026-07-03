import { NextResponse } from "next/server"
import { fetchAndStoreNews } from "@/lib/market/news-feeds"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results = await fetchAndStoreNews()
  return NextResponse.json({ ok: true, ...results })
}
