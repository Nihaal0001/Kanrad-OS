export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { authConnector, buildOutbox } from "@/lib/tally/sync"

/** GET /api/tally/outbox — pending masters + vouchers for the connector to push to Tally. */
export async function GET(req: NextRequest) {
  if (!authConnector(req)) return new NextResponse("Unauthorized", { status: 401 })
  try {
    const { company, items } = await buildOutbox()
    return NextResponse.json({ company, count: items.length, items })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "outbox failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
