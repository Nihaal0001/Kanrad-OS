import { NextResponse } from "next/server"
import { fetchCommodityPrices } from "@/actions/fetch-commodity-prices"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await fetchCommodityPrices()
  return NextResponse.json({ ok: true, ...result })
}
