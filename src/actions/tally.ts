"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getOutstanding, type CashflowData } from "@/lib/tally/outstanding"

/** Receivables (incoming) + payables (outgoing) pulled from Tally; sample until first sync. */
export async function getCashflowOutstanding(): Promise<CashflowData> {
  return getOutstanding()
}

export interface TallyLedgerBalance {
  ledger_name: string
  parent: string | null
  closing_balance: number
  as_of: string | null
  updated_at: string
}

export interface TallySyncStatus {
  lastPulledAt: string | null
  balances: TallyLedgerBalance[]
  push: { synced: number; pending: number; error: number }
  recentErrors: { entity_type: string; last_error: string | null }[]
}

/** Status of the Tally two-way sync: balances pulled in + what Kanrad pushed out. */
export async function getTallySyncStatus(): Promise<TallySyncStatus> {
  const admin = createAdminClient()

  const [balancesRes, syncRes, pullRes] = await Promise.all([
    admin.from("tally_ledger_balances").select("ledger_name, parent, closing_balance, as_of, updated_at").order("ledger_name"),
    admin.from("tally_sync").select("status, entity_type, last_error"),
    admin.from("tally_pull_state").select("last_pulled_at").eq("id", 1).maybeSingle(),
  ])

  const sync = syncRes.data ?? []
  const push = {
    synced: sync.filter((s) => s.status === "synced").length,
    pending: sync.filter((s) => s.status === "pending").length,
    error: sync.filter((s) => s.status === "error").length,
  }
  const recentErrors = sync
    .filter((s) => s.status === "error" && s.last_error)
    .slice(0, 10)
    .map((s) => ({ entity_type: s.entity_type as string, last_error: s.last_error as string | null }))

  return {
    lastPulledAt: pullRes.data?.last_pulled_at ?? null,
    balances: (balancesRes.data ?? []).map((b) => ({ ...b, closing_balance: Number(b.closing_balance) })),
    push,
    recentErrors,
  }
}
