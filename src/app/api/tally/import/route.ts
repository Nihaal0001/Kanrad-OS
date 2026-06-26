export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { authConnector, importTallyLedgers, type InboundLedger } from "@/lib/tally/sync"

/** POST /api/tally/import — party ledgers pulled FROM Tally → Kanrad customers/suppliers.
 *  Body: { ledgers: InboundLedger[] } */
export async function POST(req: NextRequest) {
  if (!authConnector(req)) return new NextResponse("Unauthorized", { status: 401 })
  try {
    const body = (await req.json()) as { ledgers?: InboundLedger[] }
    if (!Array.isArray(body.ledgers)) return NextResponse.json({ error: "ledgers[] required" }, { status: 400 })
    const result = await importTallyLedgers(body.ledgers)
    revalidateTag("customers", {})
    revalidateTag("suppliers", {})
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "import failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
