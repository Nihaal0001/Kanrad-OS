export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { authConnector } from "@/lib/tally/sync"
import { replaceOutstanding, type OutstandingBill } from "@/lib/tally/outstanding"

/** POST /api/tally/outstanding — receivables/payables pulled FROM Tally (read-only).
 *  Body: { bills: OutstandingBill[] } — replaces the current snapshot. */
export async function POST(req: NextRequest) {
  if (!authConnector(req)) return new NextResponse("Unauthorized", { status: 401 })
  try {
    const body = (await req.json()) as { bills?: OutstandingBill[] }
    if (!Array.isArray(body.bills)) return NextResponse.json({ error: "bills[] required" }, { status: 400 })
    const stored = await replaceOutstanding(body.bills)
    revalidatePath("/finance/outstanding")
    return NextResponse.json({ stored })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "outstanding import failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
