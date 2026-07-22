export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { authConnector, applyInbound, type PulledBalance } from "@/lib/tally/sync"

/** POST /api/tally/inbound — balances pulled FROM Tally. Body: { balances: PulledBalance[] } */
export async function POST(req: NextRequest) {
  if (!authConnector(req)) return new NextResponse("Unauthorized", { status: 401 })
  try {
    const body = (await req.json()) as { balances?: PulledBalance[] }
    if (!Array.isArray(body.balances)) return NextResponse.json({ error: "balances[] required" }, { status: 400 })
    const stored = await applyInbound(body.balances)
    return NextResponse.json({ stored })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "inbound failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
