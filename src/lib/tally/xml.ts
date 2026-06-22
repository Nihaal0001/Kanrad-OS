/**
 * Tally Prime XML helpers — shared by the sync API and the connector agent.
 *
 * Tally imports/exports data as XML through its gateway (default
 * http://localhost:9000). Masters (ledgers, stock items) must exist before the
 * vouchers that post to them, so the outbox returns masters first.
 */

export function esc(str: string | null | undefined): string {
  if (str == null) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** YYYY-MM-DD (or Date) → Tally's YYYYMMDD */
export function tallyDate(date: string | Date): string {
  const s = typeof date === "string" ? date : date.toISOString().slice(0, 10)
  return s.slice(0, 10).replace(/-/g, "")
}

// ── Masters ────────────────────────────────────────────────────────────────

export interface PartyMaster {
  name: string
  /** "Sundry Debtors" for customers, "Sundry Creditors" for suppliers */
  parent: string
  gstin?: string | null
  address?: string | null
  state?: string | null
  phone?: string | null
}

export function buildLedgerMaster(p: PartyMaster): string {
  return `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${esc(p.name)}" ACTION="Create">
          <NAME>${esc(p.name)}</NAME>
          <PARENT>${esc(p.parent)}</PARENT>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          ${p.gstin ? `<PARTYGSTIN>${esc(p.gstin)}</PARTYGSTIN>` : ""}
          ${p.state ? `<LEDSTATENAME>${esc(p.state)}</LEDSTATENAME>` : ""}
          ${p.gstin ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>` : ""}
          ${p.address ? `<ADDRESS.LIST><ADDRESS>${esc(p.address)}</ADDRESS></ADDRESS.LIST>` : ""}
        </LEDGER>
      </TALLYMESSAGE>`
}

export interface StockItemMaster {
  name: string
  unit: string
  category?: string | null
}

export function buildStockItemMaster(s: StockItemMaster): string {
  return `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <STOCKITEM NAME="${esc(s.name)}" ACTION="Create">
          <NAME>${esc(s.name)}</NAME>
          ${s.category ? `<CATEGORY>${esc(s.category)}</CATEGORY>` : ""}
          <BASEUNITS>${esc(s.unit)}</BASEUNITS>
        </STOCKITEM>
      </TALLYMESSAGE>`
}

// ── Vouchers ─────────────────────────────────────────────────────────────────

export interface SalesVoucher {
  invoice_number: string
  issue_date: string
  customer_name: string
  subtotal: number
  total_amount: number
  is_igst: boolean
  tax_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
}

export function buildSalesVoucher(inv: SalesVoucher): string {
  const half = inv.tax_rate / 2
  const entries: string[] = [
    ledgerEntry(inv.customer_name, true, -inv.total_amount),
    ledgerEntry("Sales", false, inv.subtotal),
  ]
  if (inv.is_igst) {
    entries.push(ledgerEntry(`Output IGST @${inv.tax_rate}%`, false, inv.igst_amount))
  } else {
    entries.push(ledgerEntry(`Output CGST @${half}%`, false, inv.cgst_amount))
    entries.push(ledgerEntry(`Output SGST @${half}%`, false, inv.sgst_amount))
  }
  return voucher("Sales", inv.issue_date, inv.invoice_number, inv.customer_name, entries)
}

export interface PurchaseVoucher {
  invoice_number: string | null
  invoice_date: string
  supplier_name: string
  subtotal: number
  total_amount: number
  is_igst: boolean
  tax_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
}

export function buildPurchaseVoucher(inv: PurchaseVoucher): string {
  const half = inv.tax_rate / 2
  const entries: string[] = [
    ledgerEntry(inv.supplier_name, false, inv.total_amount),
    ledgerEntry("Purchases", true, -inv.subtotal),
  ]
  if (inv.is_igst) {
    entries.push(ledgerEntry(`Input IGST @${inv.tax_rate}%`, true, -inv.igst_amount))
  } else {
    entries.push(ledgerEntry(`Input CGST @${half}%`, true, -inv.cgst_amount))
    entries.push(ledgerEntry(`Input SGST @${half}%`, true, -inv.sgst_amount))
  }
  return voucher("Purchase", inv.invoice_date, inv.invoice_number ?? "PI", inv.supplier_name, entries)
}

export interface MoneyVoucher {
  /** voucher number — invoice/payment reference */
  number: string
  date: string
  /** party ledger (customer for receipts, supplier for payments) */
  party: string
  amount: number
  /** cash/bank ledger to balance against */
  bankLedger: string
}

/** Customer payment received → Receipt voucher (Dr bank, Cr party) */
export function buildReceiptVoucher(v: MoneyVoucher): string {
  const entries = [
    ledgerEntry(v.party, false, v.amount),
    ledgerEntry(v.bankLedger, true, -v.amount),
  ]
  return voucher("Receipt", v.date, v.number, v.party, entries)
}

/** Supplier payment made → Payment voucher (Dr party, Cr bank) */
export function buildPaymentVoucher(v: MoneyVoucher): string {
  const entries = [
    ledgerEntry(v.party, true, -v.amount),
    ledgerEntry(v.bankLedger, false, v.amount),
  ]
  return voucher("Payment", v.date, v.number, v.party, entries)
}

function ledgerEntry(name: string, deemedPositive: boolean, amount: number): string {
  return `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${esc(name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${deemedPositive ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
          <AMOUNT>${amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`
}

function voucher(type: string, date: string, number: string, party: string, entries: string[]): string {
  return `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${type}" ACTION="Create" OBJVIEW="${type === "Sales" || type === "Purchase" ? "Invoice Voucher View" : "Accounting Voucher View"}">
          <DATE>${tallyDate(date)}</DATE>
          <VOUCHERNUMBER>${esc(number)}</VOUCHERNUMBER>
          <VOUCHERTYPENAME>${type}</VOUCHERTYPENAME>
          <PARTYLEDGERNAME>${esc(party)}</PARTYLEDGERNAME>
          ${entries.join("")}
        </VOUCHER>
      </TALLYMESSAGE>`
}

// ── Envelopes ────────────────────────────────────────────────────────────────

/** Wrap one or more TALLYMESSAGE blocks into an Import Data envelope. */
export function importEnvelope(company: string, messages: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${messages.join("")}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
}

/** Export request for the Trial Balance (ledger closing balances) — used to pull FROM Tally. */
export function trialBalanceExportRequest(company: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Trial Balance</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`
}

// ── Response parsing (no XML lib — Tally responses are simple & regular) ──────

export interface ImportResult {
  created: number
  altered: number
  errors: number
  lastVchId: string | null
  raw: string
}

/** Parse the <RESPONSE> block Tally returns after an Import Data request. */
export function parseImportResponse(xml: string): ImportResult {
  const num = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}>\\s*([0-9-]+)\\s*</${tag}>`, "i"))
    return m ? parseInt(m[1], 10) || 0 : 0
  }
  const lastVch = xml.match(/<LASTVCHID>\s*([0-9]+)\s*<\/LASTVCHID>/i)
  return {
    created: num("CREATED"),
    altered: num("ALTERED"),
    errors: num("ERRORS") + num("EXCEPTIONS"),
    lastVchId: lastVch ? lastVch[1] : null,
    raw: xml.slice(0, 2000),
  }
}

export interface PulledBalance {
  ledger_name: string
  parent: string | null
  closing_balance: number
}

/**
 * Parse ledger rows from a Trial Balance XML export. Tally formats vary by
 * version; this handles the common DSPACCNAME/DSPCLDRAMT shape.
 */
export function parseTrialBalance(xml: string): PulledBalance[] {
  const out: PulledBalance[] = []
  const rowRe = /<DSPACCNAME>[\s\S]*?<DSPDISPNAME>([\s\S]*?)<\/DSPDISPNAME>[\s\S]*?<\/DSPACCNAME>[\s\S]*?<DSPCLDRAMT>[\s\S]*?<DSPCLDRAMTA?>([\s\S]*?)<\/DSPCLDRAMTA?>/gi
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(xml)) !== null) {
    const name = decodeEntities(m[1].trim())
    const amt = parseFloat((m[2] || "0").replace(/[^0-9.-]/g, "")) || 0
    if (name) out.push({ ledger_name: name, parent: null, closing_balance: amt })
  }
  return out
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#4;/g, "")
}
