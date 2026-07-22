import { createAdminClient } from "@/lib/supabase/admin"

/** Bearer-secret auth for the connector agent. */
export function authConnector(req: Request): boolean {
  const secret = process.env.TALLY_CONNECTOR_SECRET
  if (!secret) return false
  return req.headers.get("authorization") === `Bearer ${secret}`
}

export interface InboundLedger {
  name: string
  parent: string
  gstin?: string | null
  address?: string | null
  state?: string | null
}

/**
 * Import party ledgers pulled from Tally into Kanrad: ledgers under a
 * Sundry Debtors group become customers, Sundry Creditors become suppliers.
 * Matched by name (idempotent — updates existing, inserts new). Non-party GL
 * ledgers (Sales, Bank, GST, etc.) are skipped (their balances arrive via the
 * Trial Balance pull instead).
 */
export async function importTallyLedgers(
  ledgers: InboundLedger[]
): Promise<{ customers: number; suppliers: number; skipped: number }> {
  const admin = createAdminClient()
  let customers = 0
  let suppliers = 0
  let skipped = 0

  for (const l of ledgers) {
    const name = (l.name ?? "").trim()
    if (!name) { skipped++; continue }
    const parent = (l.parent ?? "").toLowerCase()
    const table = parent.includes("debtor") ? "customers" : parent.includes("creditor") ? "suppliers" : null
    if (!table) { skipped++; continue }

    const fields = {
      name,
      gstin: l.gstin?.trim() || null,
      address: l.address?.trim() || null,
      state: l.state?.trim() || null,
      is_active: true,
    }

    const { data: existing } = await admin.from(table).select("id").eq("name", name).limit(1)
    if (existing && existing.length > 0) {
      await admin.from(table).update(fields).eq("id", existing[0].id)
    } else {
      await admin.from(table).insert(fields)
    }
    if (table === "customers") customers++
    else suppliers++
  }

  return { customers, suppliers, skipped }
}

export interface PulledBalance {
  ledger_name: string
  parent: string | null
  closing_balance: number
}

/** Store balances pulled from Tally and stamp the pull cursor. */
export async function applyInbound(balances: PulledBalance[]): Promise<number> {
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  let n = 0
  for (const b of balances) {
    const { error } = await admin
      .from("tally_ledger_balances")
      .upsert(
        { ledger_name: b.ledger_name, parent: b.parent, closing_balance: b.closing_balance, as_of: today, updated_at: new Date().toISOString() },
        { onConflict: "ledger_name" }
      )
    if (!error) n++
  }
  await admin.from("tally_pull_state").update({ last_pulled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", 1)
  return n
}
