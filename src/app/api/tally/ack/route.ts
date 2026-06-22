export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { authConnector, applyAcks, type Ack } from "@/lib/tally/sync"

/** POST /api/tally/ack — connector reports per-item push results. Body: { acks: Ack[] } */
export async function POST(req: NextRequest) {
  if (!authConnector(req)) return new NextResponse("Unauthorized", { status: 401 })
  try {
    const body = (await req.json()) as { acks?: Ack[] }
    if (!Array.isArray(body.acks)) return NextResponse.json({ error: "acks[] required" }, { status: 400 })
    const updated = await applyAcks(body.acks)
    return NextResponse.json({ updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ack failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
