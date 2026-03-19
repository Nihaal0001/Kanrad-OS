"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/actions/audit"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" as const }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") return { error: "Forbidden: admin only" as const }
  return { supabase, user }
}

// ===== Chart of Accounts =====

export async function getChartOfAccounts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .eq("is_active", true)
    .order("account_code", { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

// ===== Journal Entries =====

export async function getJournalEntries(filters?: {
  referenceType?: string
  from?: string
  to?: string
  search?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from("journal_entries")
    .select(`
      *,
      journal_entry_lines(
        *,
        account:chart_of_accounts(account_code, name, type)
      )
    `)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (filters?.referenceType) query = query.eq("reference_type", filters.referenceType)
  if (filters?.from) query = query.gte("entry_date", filters.from)
  if (filters?.to) query = query.lte("entry_date", filters.to)
  if (filters?.search) {
    const escaped = filters.search.replace(/%/g, "\\%").replace(/_/g, "\\_")
    query = query.ilike("description", `%${escaped}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((entry) => ({
    ...entry,
    journal_entry_lines: (entry.journal_entry_lines ?? []).map((line: Record<string, unknown>) => ({
      ...line,
      account: Array.isArray(line.account) ? (line.account[0] ?? null) : line.account,
    })),
  }))
}

export async function deleteJournalEntry(id: string) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth

  const { supabase } = auth
  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .select("id, description, reference_type, reference_id")
    .eq("id", id)
    .single()

  if (entryError || !entry) return { error: entryError?.message ?? "Journal entry not found" }

  const { error } = await supabase.from("journal_entries").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/finance/journal")
  revalidatePath("/finance/ledger")
  revalidatePath("/finance/trial-balance")
  revalidatePath("/finance/reports")
  revalidatePath("/finance")
  await logAudit({
    entityType: "journal_entry",
    entityId: id,
    entityLabel: entry.description,
    action: "deleted",
    newValues: {
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
    },
  })
  return { success: true }
}

// ===== Ledger (account-level view) =====

export async function getLedger(accountCode: string, filters?: { from?: string; to?: string }) {
  const supabase = await createClient()

  // Verify account exists
  const { data: account, error: accErr } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .eq("account_code", accountCode)
    .single()

  if (accErr) throw new Error("Account not found")

  let query = supabase
    .from("journal_entry_lines")
    .select(`
      *,
      journal_entry:journal_entries(id, entry_date, description, reference_type)
    `)
    .eq("account_code", accountCode)
    .order("journal_entries.entry_date", { ascending: true })
    .order("created_at", { ascending: true })

  if (filters?.from) {
    query = query.gte("journal_entries.entry_date", filters.from)
  }
  if (filters?.to) {
    query = query.lte("journal_entries.entry_date", filters.to)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const lines = (data ?? []).map((line: Record<string, unknown>) => ({
    ...line,
    journal_entry: Array.isArray(line.journal_entry) ? (line.journal_entry[0] ?? null) : line.journal_entry,
  }))

  // Compute running balance
  // For asset/cogs/expense accounts: balance = debits - credits (debit-normal)
  // For liability/equity/revenue: balance = credits - debits (credit-normal)
  const debitNormal = ["asset", "cogs", "expense"].includes(account.type)
  let runningBalance = 0

  const ledgerEntries = lines.map((line) => {
    const debit = Number(line.debit) || 0
    const credit = Number(line.credit) || 0
    runningBalance += debitNormal ? debit - credit : credit - debit

    const je = line.journal_entry as { entry_date: string; description: string; reference_type: string | null } | null
    return {
      entry_date: je?.entry_date ?? "",
      journal_entry_id: line.journal_entry_id as string,
      description: (line.description as string | null) ?? je?.description ?? "",
      reference_type: je?.reference_type ?? null,
      debit,
      credit,
      running_balance: runningBalance,
    }
  })

  return { account, entries: ledgerEntries }
}

// ===== Trial Balance =====

export async function getTrialBalance(filters?: { from?: string; to?: string }) {
  const supabase = await createClient()

  // Fetch all non-header accounts
  const { data: accounts, error: accErr } = await supabase
    .from("chart_of_accounts")
    .select("account_code, name, type, is_header")
    .eq("is_active", true)
    .eq("is_header", false)
    .order("account_code", { ascending: true })

  if (accErr) throw new Error(accErr.message)

  // Aggregate journal entry lines per account
  const linesQuery = supabase
    .from("journal_entry_lines")
    .select(`
      account_code,
      debit,
      credit,
      journal_entry:journal_entries(entry_date)
    `)

  if (filters?.from || filters?.to) {
    // We need the join filter — use RPC approach via a simpler method
    // Supabase doesn't support nested filter on joined columns directly,
    // so we fetch all and filter in JS
  }

  const { data: lines, error: linesErr } = await linesQuery
  if (linesErr) throw new Error(linesErr.message)

  // Group by account_code
  const totals: Record<string, { debit: number; credit: number }> = {}

  for (const line of lines ?? []) {
    const je = Array.isArray(line.journal_entry) ? line.journal_entry[0] : line.journal_entry
    const entryDate: string = je?.entry_date ?? ""

    // Date filters
    if (filters?.from && entryDate < filters.from) continue
    if (filters?.to && entryDate > filters.to) continue

    if (!totals[line.account_code]) totals[line.account_code] = { debit: 0, credit: 0 }
    totals[line.account_code].debit += Number(line.debit) || 0
    totals[line.account_code].credit += Number(line.credit) || 0
  }

  const rows = (accounts ?? []).map((acc) => {
    const t = totals[acc.account_code] ?? { debit: 0, credit: 0 }
    const debitNormal = ["asset", "cogs", "expense"].includes(acc.type)
    const balance = debitNormal ? t.debit - t.credit : t.credit - t.debit

    return {
      account_code: acc.account_code,
      name: acc.name,
      type: acc.type,
      total_debit: t.debit,
      total_credit: t.credit,
      balance,
    }
  })

  // Only include accounts with activity
  const activeRows = rows.filter((r) => r.total_debit > 0 || r.total_credit > 0)

  const totalDebits = activeRows.reduce((s, r) => s + r.total_debit, 0)
  const totalCredits = activeRows.reduce((s, r) => s + r.total_credit, 0)

  return { rows: activeRows, totalDebits, totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.01 }
}

// ===== HSN Master (for autocomplete) =====

export async function getHsnMaster(search?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("hsn_master")
    .select("*")
    .order("code", { ascending: true })
    .limit(50)

  if (search) {
    const escaped = search.replace(/%/g, "\\%").replace(/_/g, "\\_")
    query = query.or(`code.ilike.${escaped}%,description.ilike.%${escaped}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}
