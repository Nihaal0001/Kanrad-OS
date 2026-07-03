import { NextResponse } from "next/server"
import { generateMarketBrief } from "@/lib/market/brief"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await generateMarketBrief()
  if ("error" in result) {
    // 200 with ok:false — yesterday's brief keeps serving; cron retries tomorrow
    return NextResponse.json({ ok: false, error: result.error })
  }
  return NextResponse.json({ ok: true, headline: result.data.headline, stories: result.data.top_story_ids.length })
}
