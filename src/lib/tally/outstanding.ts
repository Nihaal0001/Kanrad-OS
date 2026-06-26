import { createAdminClient } from "@/lib/supabase/admin"

export type OutstandingType = "incoming" | "outgoing"

export interface OutstandingBill {
  party: string
  type: OutstandingType
  amount: number
  bill_ref: string | null
  bill_date: string | null
  due_date: string | null
}

export interface CashflowData {
  asOf: string | null
  bills: OutstandingBill[]
  totals: { incoming: number; outgoing: number; net: number }
  /** true when no Tally data has synced yet and we're showing sample data */
  isSample: boolean
}

// Sample data (real Tally party names) so the screen works before a live sync.
export const MOCK_BILLS: OutstandingBill[] = [
  { party: "V-Guard Industries Ltd.", type: "incoming", amount: 1007370, bill_ref: "KH-INV-2611", bill_date: "2026-06-04", due_date: "2026-07-04" },
  { party: "Vijayalakshmi Appliances", type: "incoming", amount: 75000, bill_ref: "KH-INV-2618", bill_date: "2026-06-11", due_date: "2026-06-21" },
  { party: "Sparrow Home Appliances", type: "incoming", amount: 93500, bill_ref: "KH-INV-2620", bill_date: "2026-06-12", due_date: "2026-06-30" },
  { party: "Super Distributors", type: "incoming", amount: 60675, bill_ref: "KH-INV-2609", bill_date: "2026-06-10", due_date: "2026-07-10" },
  { party: "Impressio Appliances Pvt Ltd", type: "incoming", amount: 22844, bill_ref: "KH-INV-2625", bill_date: "2026-06-15", due_date: "2026-07-15" },
  { party: "Suryodaya Packaging Industries", type: "outgoing", amount: 45451, bill_ref: "PUR-883", bill_date: "2026-06-10", due_date: "2026-06-25" },
  { party: "GAIL Gas Ltd", type: "outgoing", amount: 23599, bill_ref: "GAIL-5521", bill_date: "2026-06-11", due_date: "2026-06-29" },
  { party: "Ganga Minerals", type: "outgoing", amount: 12800, bill_ref: "GM-204", bill_date: "2026-06-10", due_date: "2026-07-09" },
  { party: "S V Packaging", type: "outgoing", amount: 38113, bill_ref: "SVP-77", bill_date: "2026-06-10", due_date: "2026-07-05" },
  { party: "Southfield Powder Coatings Pvt Ltd", type: "outgoing", amount: 70000, bill_ref: "SPC-310", bill_date: "2026-06-10", due_date: "2026-07-02" },
]

export function computeTotals(bills: OutstandingBill[]) {
  const incoming = bills.filter((b) => b.type === "incoming").reduce((s, b) => s + b.amount, 0)
  const outgoing = bills.filter((b) => b.type === "outgoing").reduce((s, b) => s + b.amount, 0)
  return { incoming, outgoing, net: incoming - outgoing }
}

/** Read the synced outstandings; fall back to sample data until the first pull. */
export async function getOutstanding(): Promise<CashflowData> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("tally_outstanding")
    .select("party, type, amount, bill_ref, bill_date, due_date, synced_at")
    .order("due_date", { ascending: true, nullsFirst: false })

  if (!data || data.length === 0) {
    return { asOf: null, bills: MOCK_BILLS, totals: computeTotals(MOCK_BILLS), isSample: true }
  }

  const bills: OutstandingBill[] = data.map((b) => ({
    party: b.party,
    type: b.type as OutstandingType,
    amount: Number(b.amount),
    bill_ref: b.bill_ref,
    bill_date: b.bill_date,
    due_date: b.due_date,
  }))
  return {
    asOf: data[0]?.synced_at ?? null,
    bills,
    totals: computeTotals(bills),
    isSample: false,
  }
}

/** Replace the outstanding snapshot with the latest pull from Tally. */
export async function replaceOutstanding(bills: OutstandingBill[]): Promise<number> {
  const admin = createAdminClient()
  // snapshot semantics — clear then insert the fresh set
  await admin.from("tally_outstanding").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  const rows = bills
    .filter((b) => b.party && (b.type === "incoming" || b.type === "outgoing"))
    .map((b) => ({
      party: b.party.trim(),
      type: b.type,
      amount: Math.round((Number(b.amount) || 0) * 100) / 100,
      bill_ref: b.bill_ref?.trim() || null,
      bill_date: b.bill_date || null,
      due_date: b.due_date || null,
    }))
  if (rows.length === 0) return 0
  const { error } = await admin.from("tally_outstanding").insert(rows)
  if (error) throw new Error(error.message)
  return rows.length
}
