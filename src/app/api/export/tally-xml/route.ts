export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

function tallyDate(dateStr: string): string {
  // Tally expects YYYYMMDD
  return dateStr.replace(/-/g, "")
}

function esc(str: string | null | undefined): string {
  if (!str) return ""
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function buildSalesVoucher(inv: {
  invoice_number: string
  issue_date: string
  customer_name: string
  subtotal: number
  tax_amount: number
  total_amount: number
  is_igst: boolean
  tax_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
}): string {
  const halfRate = inv.tax_rate / 2
  const ledgerEntries: string[] = []

  // Debtor (customer) — positive in Tally means receivable
  ledgerEntries.push(`
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${esc(inv.customer_name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${inv.total_amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`)

  // Sales
  ledgerEntries.push(`
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Sales</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${inv.subtotal.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`)

  // GST
  if (inv.is_igst) {
    ledgerEntries.push(`
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Output IGST @${inv.tax_rate}%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${inv.igst_amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`)
  } else {
    ledgerEntries.push(`
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Output CGST @${halfRate}%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${inv.cgst_amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`)
    ledgerEntries.push(`
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Output SGST @${halfRate}%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${inv.sgst_amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`)
  }

  return `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
          <DATE>${tallyDate(inv.issue_date)}</DATE>
          <VOUCHERNUMBER>${esc(inv.invoice_number)}</VOUCHERNUMBER>
          <VOUCHERTYPE>Sales</VOUCHERTYPE>
          <PARTYLEDGERNAME>${esc(inv.customer_name)}</PARTYLEDGERNAME>
          <CSTFORMISSUETYPE/>
          <CSTFORMRECVTYPE/>
          ${ledgerEntries.join("")}
        </VOUCHER>
      </TALLYMESSAGE>`
}

function buildPurchaseVoucher(inv: {
  invoice_number: string | null
  invoice_date: string
  supplier_name: string
  subtotal: number
  tax_amount: number
  total_amount: number
  is_igst: boolean
  tax_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
}): string {
  const halfRate = inv.tax_rate / 2
  const voucherNum = inv.invoice_number ?? "PI"
  const ledgerEntries: string[] = []

  // Creditor (supplier) — credit in purchase
  ledgerEntries.push(`
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${esc(inv.supplier_name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${inv.total_amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`)

  // Purchase
  ledgerEntries.push(`
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Purchases</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${inv.subtotal.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`)

  // GST
  if (inv.is_igst) {
    ledgerEntries.push(`
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Input IGST @${inv.tax_rate}%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${inv.igst_amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`)
  } else {
    ledgerEntries.push(`
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Input CGST @${halfRate}%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${inv.cgst_amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`)
    ledgerEntries.push(`
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Input SGST @${halfRate}%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${inv.sgst_amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`)
  }

  return `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Invoice Voucher View">
          <DATE>${tallyDate(inv.invoice_date)}</DATE>
          <VOUCHERNUMBER>${esc(voucherNum)}</VOUCHERNUMBER>
          <VOUCHERTYPE>Purchase</VOUCHERTYPE>
          <PARTYLEDGERNAME>${esc(inv.supplier_name)}</PARTYLEDGERNAME>
          ${ledgerEntries.join("")}
        </VOUCHER>
      </TALLYMESSAGE>`
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const url = new URL(req.url)
  const from = url.searchParams.get("from") ?? ""
  const to = url.searchParams.get("to") ?? ""

  // Fetch invoices (sales)
  let invQuery = supabase
    .from("invoices")
    .select("invoice_number, issue_date, customer_name, subtotal, tax_amount, total_amount, is_igst, tax_rate, cgst_amount, sgst_amount, igst_amount")
    .not("status", "eq", "cancelled")
    .order("issue_date")

  if (from) invQuery = invQuery.gte("issue_date", from)
  if (to) invQuery = invQuery.lte("issue_date", to)

  const { data: invoices } = await invQuery

  // Fetch purchase invoices
  let piQuery = supabase
    .from("purchase_invoices")
    .select("invoice_number, invoice_date, supplier_name, subtotal, tax_amount, total_amount, is_igst, tax_rate, cgst_amount, sgst_amount, igst_amount")
    .not("status", "eq", "cancelled")
    .order("invoice_date")

  if (from) piQuery = piQuery.gte("invoice_date", from)
  if (to) piQuery = piQuery.lte("invoice_date", to)

  const { data: purchases } = await piQuery

  const salesXml = (invoices ?? []).map(buildSalesVoucher).join("\n")
  const purchaseXml = (purchases ?? []).map(buildPurchaseVoucher).join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>JUST CLOTHING</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${salesXml}
        ${purchaseXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`

  const filename = `tally-export${from ? `-${from}` : ""}${to ? `-to-${to}` : ""}.xml`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
