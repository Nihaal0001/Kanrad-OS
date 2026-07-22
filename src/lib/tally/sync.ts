import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildLedgerMaster,
  buildStockItemMaster,
  buildSalesVoucher,
  buildPurchaseVoucher,
  buildPurchaseOrderVoucher,
  buildReceiptVoucher,
  buildPaymentVoucher,
  type PulledBalance,
} from "@/lib/tally/xml"

export const TALLY_COMPANY = process.env.TALLY_COMPANY || "KANRAD ERP"

/** Bank ledger changes most months (new one opened in Tally) — stored in app_settings so it's editable without a redeploy. */
export async function getBankLedger(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data } = await admin.from("app_settings").select("value").eq("key", "tally_bank_ledger").maybeSingle()
  const name = (data?.value as { name?: string } | null)?.name
  return name?.trim() || process.env.TALLY_BANK_LEDGER || "Bank"
}

/** Bearer-secret auth for the connector agent. */
export function authConnector(req: Request): boolean {
  const secret = process.env.TALLY_CONNECTOR_SECRET
  if (!secret) return false
  return req.headers.get("authorization") === `Bearer ${secret}`
}

function hash(parts: unknown[]): string {
  return createHash("sha1").update(JSON.stringify(parts)).digest("hex")
}

type Kind = "master" | "voucher"
interface Candidate {
  entity_type: string
  entity_id: string
  kind: Kind
  xml: string
  hash: string
}

interface OutboxItem {
  sync_id: string
  entity_type: string
  kind: Kind
  xml: string
}

/**
 * Reconcile syncable entities against tally_sync and return everything still
 * pending, masters before vouchers. Masters are keyed by name (re-pushed when
 * they change); vouchers are pushed once (create-once) to avoid duplicates.
 */
export async function buildOutbox(limit = 200): Promise<{ company: string; items: OutboxItem[] }> {
  const admin = createAdminClient()
  const candidates: Candidate[] = []

  // Finance only — Kanrad owns inventory; Tally gets accounting ledgers/vouchers,
  // never stock items or inventory movements.
  const [customers, suppliers, invoices, purchases, purchaseOrders, receipts, payments, bankLedger] = await Promise.all([
    admin.from("customers").select("id, name, gstin, address, state").eq("is_active", true),
    admin.from("suppliers").select("id, name, gstin, address, state").eq("is_active", true),
    admin
      .from("invoices")
      .select("id, invoice_number, issue_date, customer_name, subtotal, total_amount, is_igst, tax_rate, cgst_amount, sgst_amount, igst_amount")
      .in("status", ["sent", "paid", "partially_paid"]),
    admin
      .from("purchase_invoices")
      .select("id, invoice_number, invoice_date, supplier_name, subtotal, total_amount, is_igst, tax_rate, cgst_amount, sgst_amount, igst_amount")
      .neq("status", "cancelled"),
    admin
      .from("purchase_orders")
      .select("id, po_number, order_date, expected_date, supplier_name, status, items:purchase_order_items(quantity_ordered, unit_price, material:materials(id, name, unit))")
      .not("status", "in", "(draft,cancelled)"),
    admin.from("payments").select("id, amount, payment_date, reference, invoice:invoices(invoice_number, customer_name)"),
    admin.from("purchase_payments").select("id, amount, payment_date, reference, tally_ledger, pi:purchase_invoices(invoice_number, supplier_name)"),
    getBankLedger(admin),
  ])

  for (const c of customers.data ?? []) {
    candidates.push({
      entity_type: "customer", entity_id: c.id, kind: "master",
      xml: buildLedgerMaster({ name: c.name, parent: "Sundry Debtors", gstin: c.gstin, address: c.address, state: c.state }),
      hash: hash([c.name, c.gstin, c.address, c.state]),
    })
  }
  for (const s of suppliers.data ?? []) {
    candidates.push({
      entity_type: "supplier", entity_id: s.id, kind: "master",
      xml: buildLedgerMaster({ name: s.name, parent: "Sundry Creditors", gstin: s.gstin, address: s.address, state: s.state }),
      hash: hash([s.name, s.gstin, s.address, s.state]),
    })
  }
  for (const inv of invoices.data ?? []) {
    candidates.push({
      entity_type: "sales_invoice", entity_id: inv.id, kind: "voucher",
      xml: buildSalesVoucher(inv), hash: hash([inv.invoice_number, inv.total_amount]),
    })
  }
  for (const pi of purchases.data ?? []) {
    candidates.push({
      entity_type: "purchase_invoice", entity_id: pi.id, kind: "voucher",
      xml: buildPurchaseVoucher(pi), hash: hash([pi.invoice_number, pi.total_amount]),
    })
  }
  // Purchase Orders need item lines to reference Tally Stock Items, so push
  // each distinct material (name + unit only — no stock/cost data) as a
  // lightweight master before the PO vouchers that reference it.
  type POItem = { quantity_ordered: number; unit_price: number; material: { id: string; name: string; unit: string } | { id: string; name: string; unit: string }[] | null }
  const seenStockItems = new Set<string>()
  for (const po of (purchaseOrders.data ?? []) as Array<{ id: string; po_number: string; order_date: string; expected_date: string | null; supplier_name: string; items: POItem[] }>) {
    const items = po.items
      .map((i) => ({ ...i, material: Array.isArray(i.material) ? i.material[0] ?? null : i.material }))
      .filter((i): i is POItem & { material: { id: string; name: string; unit: string } } => !!i.material)

    for (const i of items) {
      if (seenStockItems.has(i.material.id)) continue
      seenStockItems.add(i.material.id)
      candidates.push({
        entity_type: "material", entity_id: i.material.id, kind: "master",
        xml: buildStockItemMaster({ name: i.material.name, unit: i.material.unit }),
        hash: hash([i.material.name, i.material.unit]),
      })
    }

    if (items.length === 0) continue
    candidates.push({
      entity_type: "purchase_order", entity_id: po.id, kind: "voucher",
      xml: buildPurchaseOrderVoucher({
        po_number: po.po_number,
        order_date: po.order_date,
        expected_date: po.expected_date,
        supplier_name: po.supplier_name,
        items: items.map((i) => ({ material_name: i.material.name, unit: i.material.unit, quantity: i.quantity_ordered, rate: i.unit_price })),
      }),
      hash: hash([po.po_number, items.map((i) => [i.material.name, i.quantity_ordered, i.unit_price])]),
    })
  }

  for (const p of (receipts.data ?? []) as Array<{ id: string; amount: number; payment_date: string; reference: string | null; invoice: { invoice_number: string; customer_name: string } | { invoice_number: string; customer_name: string }[] | null }>) {
    const inv = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice
    if (!inv) continue
    candidates.push({
      entity_type: "receipt", entity_id: p.id, kind: "voucher",
      xml: buildReceiptVoucher({ number: p.reference || inv.invoice_number, date: p.payment_date, party: inv.customer_name, amount: p.amount, bankLedger }),
      hash: hash([p.id, p.amount]),
    })
  }
  for (const p of (payments.data ?? []) as Array<{ id: string; amount: number; payment_date: string; reference: string | null; tally_ledger: string | null; pi: { invoice_number: string; supplier_name: string } | { invoice_number: string; supplier_name: string }[] | null }>) {
    const pi = Array.isArray(p.pi) ? p.pi[0] : p.pi
    if (!pi) continue
    candidates.push({
      entity_type: "payment", entity_id: p.id, kind: "voucher",
      xml: buildPaymentVoucher({ number: p.reference || pi.invoice_number, date: p.payment_date, party: pi.supplier_name, amount: p.amount, bankLedger: p.tally_ledger?.trim() || bankLedger }),
      hash: hash([p.id, p.amount]),
    })
  }

  // Existing sync state
  const { data: existing } = await admin.from("tally_sync").select("id, entity_type, entity_id, payload_hash, status")
  const byKey = new Map((existing ?? []).map((r) => [`${r.entity_type}|${r.entity_id}`, r]))

  const items: OutboxItem[] = []
  for (const c of candidates) {
    if (items.length >= limit) break
    const row = byKey.get(`${c.entity_type}|${c.entity_id}`)
    if (!row) {
      const { data: ins } = await admin
        .from("tally_sync")
        .insert({ entity_type: c.entity_type, entity_id: c.entity_id, payload_hash: c.hash, status: "pending" })
        .select("id").single()
      if (ins) items.push({ sync_id: ins.id, entity_type: c.entity_type, kind: c.kind, xml: c.xml })
      continue
    }
    const synced = row.status === "synced"
    // Vouchers are create-once; masters re-push when their content changes.
    const needsPush = c.kind === "master" ? !synced || row.payload_hash !== c.hash : !synced
    if (needsPush) {
      if (row.payload_hash !== c.hash || row.status === "error") {
        await admin.from("tally_sync").update({ payload_hash: c.hash, status: "pending", updated_at: new Date().toISOString() }).eq("id", row.id)
      }
      items.push({ sync_id: row.id, entity_type: c.entity_type, kind: c.kind, xml: c.xml })
    }
  }

  // Masters first
  items.sort((a, b) => (a.kind === "master" ? 0 : 1) - (b.kind === "master" ? 0 : 1))
  return { company: TALLY_COMPANY, items }
}

export interface Ack {
  sync_id: string
  ok: boolean
  tally_guid?: string | null
  error?: string | null
}

export async function applyAcks(acks: Ack[]): Promise<number> {
  const admin = createAdminClient()
  let n = 0
  for (const a of acks) {
    const { error } = await admin
      .from("tally_sync")
      .update({
        status: a.ok ? "synced" : "error",
        tally_guid: a.tally_guid ?? null,
        last_error: a.ok ? null : (a.error ?? "Unknown error").slice(0, 500),
        synced_at: a.ok ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", a.sync_id)
    if (!error) n++
  }
  return n
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
