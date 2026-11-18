export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit } from "@/lib/rate-limit"
import { getCustomers } from "@/actions/customers"
import { detectDirection, extractBill } from "@/lib/ai/bill-scan"
import { circleWeightFor, isCircleMaterial, type CircleCostable } from "@/lib/costing"
import { matchProduct, rankCustomer } from "@/lib/order-photo-match"

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_BYTES = 4 * 1024 * 1024 // Vercel request-body ceiling is 4.5MB

/** Names that mean "us" on a bill, used to tell a purchase from a sale. */
function ownNames() {
  const extra = (process.env.OWN_COMPANY_NAMES ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  return ["kanrad", ...extra]
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  if (!rateLimit(`bill_scan:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many scans — wait a minute and try again." }, { status: 429 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get("photo")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Attach a photo of the bill." }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large (max 4 MB)." }, { status: 413 })

  const bytes = Buffer.from(await file.arrayBuffer())
  const admin = createAdminClient()

  // The reader call dominates latency; the catalogue reads run alongside it.
  const [materialsRes, categoriesRes, customers, extractedResult] = await Promise.all([
    admin.from("materials").select("id, sku, name, unit, current_stock, cost_per_unit, circle_type, weight_kg, diameter_mm, thickness_mm").eq("is_active", true).order("sku"),
    admin.from("material_categories").select("id, name").order("name"),
    getCustomers(),
    extractBill(bytes, file.type).then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error })
    ),
  ])

  if (!extractedResult.ok) {
    const err = extractedResult.error
    return NextResponse.json(
      { error: err instanceof Error ? `Could not read the bill: ${err.message}` : "Could not read the bill." },
      { status: 502 }
    )
  }
  const bill = extractedResult.value
  if (bill.lines.length === 0) {
    const why = bill.warnings.length ? ` (${bill.warnings.join("; ")})` : ""
    return NextResponse.json(
      { error: `No item lines could be read from this photo${why}. Retake it flat, in good light, with all four edges visible.` },
      { status: 422 }
    )
  }

  const materials = (materialsRes.data ?? []).map((m) => ({
    id: m.id as string,
    sku: m.sku as string,
    name: m.name as string,
    unit: m.unit as string,
    currentStock: Number(m.current_stock) || 0,
    cost: Number(m.cost_per_unit) || 0,
    circleType: (m.circle_type as "ib" | "non_ib" | null) ?? null,
    // For a circle billed in kg: weight of one piece, so the review can convert to pcs
    pieceWeightKg: isCircleMaterial(m as CircleCostable) ? circleWeightFor(m as CircleCostable) : null,
  }))

  const direction = detectDirection(bill.seller_name, bill.buyer_name, ownNames())
  const counterparty = direction === "sales" ? bill.buyer_name : bill.seller_name

  // Possible duplicate: same supplier + bill number already booked
  let duplicate: { id: string; label: string } | null = null
  if (bill.invoice_number && counterparty) {
    if (direction === "sales") {
      const { data } = await admin.from("invoices").select("id, invoice_number").ilike("notes", `%Scanned bill ${bill.invoice_number}%`).limit(1)
      if (data?.[0]) duplicate = { id: data[0].id, label: data[0].invoice_number }
    } else {
      const { data } = await admin
        .from("purchase_invoices")
        .select("id, invoice_number")
        .ilike("supplier_name", counterparty)
        .eq("invoice_number", bill.invoice_number)
        .neq("status", "cancelled")
        .limit(1)
      if (data?.[0]) duplicate = { id: data[0].id, label: data[0].invoice_number ?? bill.invoice_number }
    }
  }

  const lines = bill.lines.map((line, i) => ({
    key: `l${i}`,
    ...line,
    // Code first; if the code is missing or does not hit, fall back to the name (same rules as order photos)
    match: matchProduct({ code: line.code, name: line.name }, materials),
  }))

  return NextResponse.json({
    direction,
    sellerName: bill.seller_name,
    sellerGst: bill.seller_gst,
    sellerAddress: bill.seller_address,
    sellerContact: bill.seller_contact,
    buyerName: bill.buyer_name,
    buyerGst: bill.buyer_gst,
    buyerAddress: bill.buyer_address,
    placeOfSupply: bill.place_of_supply,
    reverseCharge: bill.reverse_charge,
    printedDueDate: bill.due_date,
    poReference: bill.po_reference,
    notes: bill.notes,
    categories: categoriesRes.data ?? [],
    invoiceNumber: bill.invoice_number,
    invoiceDate: bill.invoice_date,
    taxRate: bill.tax_rate,
    isIgst: bill.is_igst,
    totalAmount: bill.total_amount,
    warnings: bill.warnings,
    duplicate,
    customerId: direction === "sales" ? rankCustomer(bill.buyer_name, customers) : null,
    lines,
    materials,
  })
}
