export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GST IRP Schema v1.1 — https://einvoice1.gst.gov.in/Others/APIDocuments
// This generates a valid e-invoice JSON payload ready to upload to the IRP portal.

function formatGstDate(dateStr: string): string {
  // IRP expects DD/MM/YYYY
  const [y, m, d] = dateStr.split("-")
  return `${d}/${m}/${y}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  // Fetch invoice with items
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      `
      invoice_number, issue_date, due_date,
      buyer_name, buyer_address, buyer_gst,
      place_of_supply, is_igst, reverse_charge,
      subtotal, tax_rate, tax_amount, total_amount,
      cgst_amount, sgst_amount, igst_amount,
      invoice_items (
        description, quantity, unit_price, amount, hsn_code
      )
    `
    )
    .eq("id", id)
    .single()

  if (error || !invoice) {
    return new Response("Invoice not found", { status: 404 })
  }

  // Fetch org settings for seller details
  const { data: settings } = await supabase
    .from("org_settings")
    .select("org_name, gstin, address, state_code, pincode")
    .single()

  const sellerGstin = settings?.gstin ?? "29AABCU9603R1ZX" // placeholder
  const sellerName = settings?.org_name ?? "JUST CLOTHING"
  const sellerAddr = settings?.address ?? ""
  const sellerStateCode = settings?.state_code ?? "29"

  const buyerStateCode = invoice.place_of_supply ?? "29"

  // Build item list
  const items = (invoice.invoice_items ?? []).map((item: {
    description: string
    quantity: number
    unit_price: number
    amount: number
    hsn_code: string | null
  }, idx: number) => {
    const taxableVal = item.amount
    const taxRate = invoice.tax_rate
    const halfRate = taxRate / 2

    const itemGst: Record<string, number> = invoice.is_igst
      ? { IgstAmt: Math.round((taxableVal * taxRate) / 100 * 100) / 100 }
      : {
          CgstAmt: Math.round((taxableVal * halfRate) / 100 * 100) / 100,
          SgstAmt: Math.round((taxableVal * halfRate) / 100 * 100) / 100,
        }

    return {
      SlNo: String(idx + 1),
      PrdDesc: item.description,
      IsServc: "N",
      HsnCd: item.hsn_code ?? "6201",
      Qty: item.quantity,
      Unit: "PCS",
      UnitPrice: item.unit_price,
      TotAmt: item.amount,
      Discount: 0,
      AssAmt: taxableVal,
      GstRt: taxRate,
      ...itemGst,
      TotItemVal: taxableVal + Object.values(itemGst).reduce((a, b) => a + b, 0),
    }
  })

  const payload = {
    Version: "1.1",
    TranDtls: {
      TaxSch: "GST",
      SupTyp: invoice.is_igst ? "INTER" : "INTRA",
      RegRev: invoice.reverse_charge ? "Y" : "N",
      EcmGstin: null,
      IgstOnIntra: "N",
    },
    DocDtls: {
      Typ: "INV",
      No: invoice.invoice_number,
      Dt: formatGstDate(invoice.issue_date),
    },
    SellerDtls: {
      Gstin: sellerGstin,
      LglNm: sellerName,
      TrdNm: sellerName,
      Addr1: sellerAddr,
      Loc: "Bangalore",
      Pin: parseInt(settings?.pincode ?? "560001"),
      Stcd: sellerStateCode,
    },
    BuyerDtls: {
      Gstin: invoice.buyer_gst ?? "URP",
      LglNm: invoice.buyer_name,
      TrdNm: invoice.buyer_name,
      Pos: buyerStateCode,
      Addr1: invoice.buyer_address ?? "",
      Loc: invoice.buyer_name,
      Pin: 999999,
      Stcd: buyerStateCode,
    },
    ItemList: items,
    ValDtls: {
      AssVal: invoice.subtotal,
      CgstVal: invoice.cgst_amount,
      SgstVal: invoice.sgst_amount,
      IgstVal: invoice.igst_amount,
      CesVal: 0,
      Discount: 0,
      OthChrg: 0,
      RndOffAmt: 0,
      TotInvVal: invoice.total_amount,
    },
    PayDtls: {
      Nm: invoice.buyer_name,
      Mode: "Credit",
      ...(invoice.due_date ? { PayDueDt: formatGstDate(invoice.due_date) } : {}),
    },
  }

  return Response.json(payload)
}
