import { createAdminClient } from "@/lib/supabase/admin"

export type VoucherType =
  | "Sales"
  | "Purchase"
  | "Receipt"
  | "Payment"
  | "Journal"
  | "Credit Note"
  | "Debit Note"
  | "Contra"
  | "Other"

export interface TallyVoucher {
  source_key: string
  guid: string | null
  voucher_date: string // ISO YYYY-MM-DD
  voucher_type: VoucherType
  voucher_number: string | null
  party: string | null
  amount: number
}

export interface VouchersData {
  vouchers: TallyVoucher[]
  /** true when no Tally vouchers have synced yet and we're showing sample data */
  isSample: boolean
}

// Sample vouchers (real Tally party names, spread over the last 6 months) so
// the Finance dashboard works before the first live sync.
const SAMPLE_CUSTOMERS = [
  "V-Guard Industries Ltd.",
  "Vijayalakshmi Appliances",
  "Sparrow Home Appliances",
  "Super Distributors",
  "Impressio Appliances Pvt Ltd",
]
const SAMPLE_SUPPLIERS = [
  "Suryodaya Packaging Industries",
  "GAIL Gas Ltd",
  "Ganga Minerals",
  "S V Packaging",
  "Southfield Powder Coatings Pvt Ltd",
]

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function buildMockVouchers(): TallyVoucher[] {
  const out: TallyVoucher[] = []
  const now = new Date()
  let n = 0
  for (let back = 5; back >= 0; back--) {
    const base = new Date(now.getFullYear(), now.getMonth() - back, 1)
    // deterministic month-over-month growth so trends look plausible
    const scale = 1 + (5 - back) * 0.12
    SAMPLE_CUSTOMERS.forEach((party, i) => {
      const day = 3 + i * 5
      const sale = Math.round((180000 + i * 90000) * scale)
      out.push({
        source_key: `mock-s-${++n}`, guid: null, voucher_date: iso(new Date(base.getFullYear(), base.getMonth(), day)),
        voucher_type: "Sales", voucher_number: `KH-INV-${2500 + n}`, party, amount: sale,
      })
      out.push({
        source_key: `mock-r-${++n}`, guid: null, voucher_date: iso(new Date(base.getFullYear(), base.getMonth(), Math.min(day + 12, 28))),
        voucher_type: "Receipt", voucher_number: `RCPT-${400 + n}`, party, amount: Math.round(sale * 0.85),
      })
    })
    SAMPLE_SUPPLIERS.forEach((party, i) => {
      const day = 4 + i * 5
      const buy = Math.round((60000 + i * 25000) * scale)
      out.push({
        source_key: `mock-p-${++n}`, guid: null, voucher_date: iso(new Date(base.getFullYear(), base.getMonth(), day)),
        voucher_type: "Purchase", voucher_number: `PUR-${800 + n}`, party, amount: buy,
      })
      out.push({
        source_key: `mock-y-${++n}`, guid: null, voucher_date: iso(new Date(base.getFullYear(), base.getMonth(), Math.min(day + 10, 28))),
        voucher_type: "Payment", voucher_number: `PAY-${100 + n}`, party, amount: Math.round(buy * 0.9),
      })
    })
  }
  return out
}

/** Vouchers from the last N months; sample data until the first live pull. */
export async function getVouchers(months = 12): Promise<VouchersData> {
  const admin = createAdminClient()
  const now = new Date()
  const from = iso(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1))

  const { data } = await admin
    .from("tally_vouchers")
    .select("source_key, guid, voucher_date, voucher_type, voucher_number, party, amount")
    .gte("voucher_date", from)
    .eq("is_cancelled", false)
    .order("voucher_date", { ascending: true })
    .limit(10000)

  if (!data || data.length === 0) {
    return { vouchers: buildMockVouchers(), isSample: true }
  }

  return {
    vouchers: data.map((v) => ({
      source_key: v.source_key,
      guid: v.guid,
      voucher_date: v.voucher_date,
      voucher_type: v.voucher_type as VoucherType,
      voucher_number: v.voucher_number,
      party: v.party,
      amount: Number(v.amount),
    })),
    isSample: false,
  }
}

/**
 * Windowed replace: wipe [fromDate, toDate] and insert the fresh pull for that
 * range. The connector re-pulls month chunks every cycle, so Tally-side edits,
 * deletions and cancellations self-heal. Returns rows stored.
 */
export async function replaceVoucherRange(
  fromDate: string,
  toDate: string,
  vouchers: TallyVoucher[]
): Promise<number> {
  const admin = createAdminClient()

  const { error: delError } = await admin
    .from("tally_vouchers")
    .delete()
    .gte("voucher_date", fromDate)
    .lte("voucher_date", toDate)
  if (delError) throw new Error(delError.message)

  // dedupe by source_key (last wins) and keep rows inside the window
  const bySourceKey = new Map<string, TallyVoucher>()
  for (const v of vouchers) {
    if (!v.source_key || !v.voucher_date || !v.voucher_type) continue
    if (v.voucher_date < fromDate || v.voucher_date > toDate) continue
    bySourceKey.set(v.source_key, v)
  }

  const rows = [...bySourceKey.values()].map((v) => ({
    source_key: v.source_key,
    guid: v.guid?.trim() || null,
    voucher_date: v.voucher_date,
    voucher_type: v.voucher_type,
    voucher_number: v.voucher_number?.trim() || null,
    party: v.party?.trim() || null,
    amount: Math.round(Math.abs(Number(v.amount) || 0) * 100) / 100,
    is_cancelled: false,
  }))

  if (rows.length > 0) {
    const { error } = await admin.from("tally_vouchers").insert(rows)
    if (error) throw new Error(error.message)
  }

  await admin
    .from("tally_pull_state")
    .update({ last_pulled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", 1)

  return rows.length
}
