#!/usr/bin/env node
/**
 * Kanrad ↔ Tally Prime connector agent.
 *
 * Runs on the same machine/LAN as Tally Prime (which exposes its XML gateway on
 * http://localhost:9000). Bridges the cloud Kanrad app and the local Tally:
 *
 *   push: GET  {KANRAD_URL}/api/tally/outbox   → POST each voucher/master to Tally
 *         POST {KANRAD_URL}/api/tally/ack       ← per-item success/error
 *   pull: export Trial Balance from Tally       → POST {KANRAD_URL}/api/tally/inbound
 *
 * Config is read from a sibling .env file (see .env.example). Node 18+ required.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// ── Config ───────────────────────────────────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url))
loadEnv(join(here, ".env"))

const KANRAD_URL = required("KANRAD_URL").replace(/\/$/, "")
const SECRET = required("TALLY_CONNECTOR_SECRET")
const TALLY_URL = process.env.TALLY_URL || "http://localhost:9000"
const COMPANY = process.env.TALLY_COMPANY || "KANRAD ERP"
const POLL_SECONDS = Number(process.env.POLL_SECONDS || 60)

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function kanrad(path, init = {}) {
  const res = await fetch(`${KANRAD_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json", ...(init.headers || {}) },
  })
  if (!res.ok) throw new Error(`Kanrad ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

async function tally(xml) {
  const res = await fetch(TALLY_URL, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml })
  if (!res.ok) throw new Error(`Tally → ${res.status}`)
  return res.text()
}

// ── Minimal Tally XML (mirrors src/lib/tally/xml.ts) ─────────────────────────
const esc = (s) => (s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"))

function importEnvelope(company, messages) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA>
<REQUESTDESC><REPORTNAME>All Masters</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
<REQUESTDATA>${messages.join("")}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`
}

function trialBalanceRequest(company) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA>
<REQUESTDESC><REPORTNAME>Trial Balance</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></REQUESTDESC>
</EXPORTDATA></BODY></ENVELOPE>`
}

function parseImportResponse(xml) {
  const n = (t) => { const m = xml.match(new RegExp(`<${t}>\\s*([0-9-]+)\\s*</${t}>`, "i")); return m ? parseInt(m[1], 10) || 0 : 0 }
  const errors = n("ERRORS") + n("EXCEPTIONS") + n("LINEERROR")
  const lineErr = xml.match(/<LINEERROR>([\s\S]*?)<\/LINEERROR>/i)
  return { created: n("CREATED"), altered: n("ALTERED"), errors, message: lineErr ? lineErr[1].trim() : null }
}

function parseTrialBalance(xml) {
  const out = []
  const re = /<DSPACCNAME>[\s\S]*?<DSPDISPNAME>([\s\S]*?)<\/DSPDISPNAME>[\s\S]*?<\/DSPACCNAME>[\s\S]*?<DSPCLDRAMT>[\s\S]*?<DSPCLDRAMTA?>([\s\S]*?)<\/DSPCLDRAMTA?>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    const name = decode(m[1].trim())
    const amt = parseFloat((m[2] || "0").replace(/[^0-9.\-]/g, "")) || 0
    if (name) out.push({ ledger_name: name, parent: null, closing_balance: amt })
  }
  return out
}
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#4;/g, "")

function listAccountsRequest(company) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA>
<REQUESTDESC><REPORTNAME>List of Accounts</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><ACCOUNTTYPE>All Ledgers</ACCOUNTTYPE></STATICVARIABLES></REQUESTDESC>
</EXPORTDATA></BODY></ENVELOPE>`
}

// Parse <LEDGER> master blocks → party ledgers (name, parent group, gstin, state, address)
function parseLedgers(xml) {
  const out = []
  const re = /<LEDGER\s+NAME="([^"]*)"[^>]*>([\s\S]*?)<\/LEDGER>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    const name = decode(m[1].trim())
    const body = m[2]
    const tag = (t) => { const x = body.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, "i")); return x ? decode(x[1].trim()) : null }
    const parent = tag("PARENT")
    if (!name || !parent) continue
    out.push({
      name,
      parent,
      gstin: tag("PARTYGSTIN") || tag("GSTIN") || null,
      state: tag("LEDSTATENAME") || null,
      address: tag("ADDRESS") || null,
    })
  }
  return out
}

function billsRequest(company, reportName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA>
<REQUESTDESC><REPORTNAME>${reportName}</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></REQUESTDESC>
</EXPORTDATA></BODY></ENVELOPE>`
}

// Tally dates come as YYYYMMDD or DD-Mon-YYYY → ISO (YYYY-MM-DD); else null
function isoDate(s) {
  if (!s) return null
  const t = s.trim()
  let m = t.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})$/)
  if (m) {
    const mon = { jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12" }[m[2].toLowerCase()]
    const yr = m[3].length === 2 ? "20" + m[3] : m[3]
    if (mon) return `${yr}-${mon}-${String(m[1]).padStart(2,"0")}`
  }
  return null
}

// Parse bill-outstanding rows. Tally's shape varies by version, so we read the
// common tags and skip rows we can't make sense of.
function parseBills(xml, type) {
  const out = []
  const blocks = xml.match(/<BILLOUTSTANDING>[\s\S]*?<\/BILLOUTSTANDING>|<BILLFIXED>[\s\S]*?<\/BILLFIXED>/gi) || []
  for (const b of blocks) {
    const tag = (t) => { const x = b.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, "i")); return x ? decode(x[1].trim()) : null }
    const party = tag("PARTYNAME") || tag("BILLPARTY") || tag("NAME")
    const amtRaw = tag("CLOSINGBAL") || tag("BILLCL") || tag("AMOUNT") || tag("BILLAMOUNT")
    if (!party || !amtRaw) continue
    const amount = Math.abs(parseFloat(amtRaw.replace(/[^0-9.\-]/g, "")) || 0)
    if (!amount) continue
    out.push({
      party, type, amount,
      bill_ref: tag("BILLREF") || tag("NAME") || null,
      bill_date: isoDate(tag("BILLDATE")),
      due_date: isoDate(tag("BILLDUEDATE") || tag("DUEDATE")),
    })
  }
  return out
}

// ── Cycles ───────────────────────────────────────────────────────────────────
async function pushCycle() {
  const { items, count } = await kanrad("/api/tally/outbox")
  if (!count) { log(`push: nothing pending`); return }
  log(`push: ${count} item(s)`)
  const acks = []
  for (const item of items) {
    try {
      const resp = await tally(importEnvelope(COMPANY, [item.xml]))
      const r = parseImportResponse(resp)
      const ok = r.errors === 0 && r.created + r.altered > 0
      acks.push({ sync_id: item.sync_id, ok, error: ok ? null : (r.message || `Tally: ${r.errors} error(s)`) })
      log(`  ${item.entity_type} ${ok ? "✓" : "✗ " + (r.message || "")}`)
    } catch (e) {
      acks.push({ sync_id: item.sync_id, ok: false, error: String(e).slice(0, 300) })
      log(`  ${item.entity_type} ✗ ${e}`)
    }
  }
  const { updated } = await kanrad("/api/tally/ack", { method: "POST", body: JSON.stringify({ acks }) })
  log(`push: acked ${updated}`)
}

async function pullCycle() {
  const resp = await tally(trialBalanceRequest(COMPANY))
  const balances = parseTrialBalance(resp)
  if (!balances.length) { log(`pull: no balances parsed`); return }
  const { stored } = await kanrad("/api/tally/inbound", { method: "POST", body: JSON.stringify({ balances }) })
  log(`pull: stored ${stored} ledger balance(s)`)
}

async function importMastersCycle() {
  const resp = await tally(listAccountsRequest(COMPANY))
  const ledgers = parseLedgers(resp)
  if (!ledgers.length) { log(`import: no ledgers parsed`); return }
  const r = await kanrad("/api/tally/import", { method: "POST", body: JSON.stringify({ ledgers }) })
  log(`import: ${r.customers} customers, ${r.suppliers} suppliers (${r.skipped} non-party skipped)`)
}

async function pullOutstandingCycle() {
  const [recv, pay] = await Promise.all([
    tally(billsRequest(COMPANY, "Bills Receivable")),
    tally(billsRequest(COMPANY, "Bills Payable")),
  ])
  const bills = [...parseBills(recv, "incoming"), ...parseBills(pay, "outgoing")]
  if (!bills.length) { log(`outstanding: no bills parsed`); return }
  const { stored } = await kanrad("/api/tally/outstanding", { method: "POST", body: JSON.stringify({ bills }) })
  log(`outstanding: stored ${stored} bill(s)`)
}

async function cycle() {
  try { await pushCycle() } catch (e) { log(`push error: ${e}`) }
  try { await importMastersCycle() } catch (e) { log(`import error: ${e}`) }
  try { await pullCycle() } catch (e) { log(`pull error: ${e}`) }
  try { await pullOutstandingCycle() } catch (e) { log(`outstanding error: ${e}`) }
}

// ── Main loop ────────────────────────────────────────────────────────────────
log(`Kanrad ↔ Tally connector started`)
log(`  Kanrad:  ${KANRAD_URL}`)
log(`  Tally:   ${TALLY_URL}  (company "${COMPANY}")`)
log(`  Poll:    every ${POLL_SECONDS}s`)
await cycle()
setInterval(cycle, POLL_SECONDS * 1000)

// ── Utils ────────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`) }
function required(key) { const v = process.env[key]; if (!v) { console.error(`Missing ${key} in .env`); process.exit(1) } return v }
function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const i = t.indexOf("=")
      if (i === -1) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!(k in process.env)) process.env[k] = v
    }
  } catch { /* no .env file — rely on real env vars */ }
}
