export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { authConnector } from "@/lib/tally/sync"
import { replaceVoucherRange, type TallyVoucher } from "@/lib/tally/vouchers"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** POST /api/tally/vouchers — vouchers pulled FROM Tally (read-only).
 *  Body: { from_date, to_date, vouchers: TallyVoucher[] } — replaces that date
 *  window (vouchers may be empty: an empty month still clears stale rows). */
export async function POST(req: NextRequest) {
  if (!authConnector(req)) return new NextResponse("Unauthorized", { status: 401 })
  try {
    const body = (await req.json()) as { from_date?: string; to_date?: string; vouchers?: TallyVoucher[] }
    if (!body.from_date || !ISO_DATE.test(body.from_date) || !body.to_date || !ISO_DATE.test(body.to_date)) {
      return NextResponse.json({ error: "from_date and to_date (YYYY-MM-DD) required" }, { status: 400 })
    }
    if (!Array.isArray(body.vouchers)) {
      return NextResponse.json({ error: "vouchers[] required" }, { status: 400 })
    }
    const stored = await replaceVoucherRange(body.from_date, body.to_date, body.vouchers)
    revalidatePath("/finance")
    return NextResponse.json({ stored })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "voucher import failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
