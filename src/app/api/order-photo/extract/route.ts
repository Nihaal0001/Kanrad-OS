export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { createHash } from "crypto"
import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit } from "@/lib/rate-limit"
import { getProducts } from "@/actions/bom"
import { getCustomers } from "@/actions/customers"
import { extractOrderSheet } from "@/lib/ai/order-photo"
import { matchProduct, rankCustomer } from "@/lib/order-photo-match"

const ORDER_PHOTO_BUCKET = "order-photos"
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_BYTES = 4 * 1024 * 1024 // Vercel request-body ceiling is 4.5MB

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  if (!rateLimit(`order_photo:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many uploads — wait a minute and try again." }, { status: 429 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get("photo")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Attach a photo of the order sheet." }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Photo is too large (max 4 MB)." }, { status: 413 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const hash = createHash("sha256").update(bytes).digest("hex")
  const admin = createAdminClient()

  // Same file uploaded before → warn up front (authoritative re-check happens on create)
  const [{ data: dupes }, products, customers] = await Promise.all([
    admin
      .from("orders")
      .select("id, order_number, status")
      .eq("source_photo_hash", hash)
      .neq("status", "cancelled")
      .limit(1),
    getProducts(),
    getCustomers(),
  ])
  const duplicate = dupes?.[0] ? { orderId: dupes[0].id as string, orderNumber: dupes[0].order_number as string } : null

  const catalog = products.map((p) => ({ id: p.id as string, name: p.product_name as string, sku: p.product_sku as string, materialCost: Number(p.materialCost) || 0 }))

  let extracted
  try {
    extracted = await extractOrderSheet(bytes, file.type)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? `Could not read the sheet: ${err.message}` : "Could not read the sheet." },
      { status: 502 }
    )
  }

  // Nothing readable → stop and ask for a better photo rather than show an empty review
  if (extracted.lines.length === 0) {
    const why = extracted.warnings.length ? ` (${extracted.warnings.join("; ")})` : ""
    return NextResponse.json(
      { error: `No order lines could be read from this photo${why}. Retake it flat, in good light, with all four edges and the Product Code and Quantity columns visible.` },
      { status: 422 }
    )
  }

  // Keep the original only once we know we can read it
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const photoPath = `${user.id}/${Date.now()}-${hash.slice(0, 12)}.${ext}`
  const { error: uploadError } = await admin.storage
    .from(ORDER_PHOTO_BUCKET)
    .upload(photoPath, bytes, { contentType: file.type, upsert: false })
  if (uploadError) {
    return NextResponse.json({ error: `Could not store the photo: ${uploadError.message}` }, { status: 500 })
  }

  const lines = extracted.lines.map((line, i) => {
    const match = matchProduct(line, catalog)
    return {
      key: `l${i}`,
      code: line.code,
      writtenName: line.name,
      quantity: line.quantity,
      confidence: line.confidence,
      note: line.note,
      match,
    }
  })

  return NextResponse.json({
    photoPath,
    photoHash: hash,
    duplicate,
    customerId: rankCustomer(extracted.customer_hint, customers),
    customerHint: extracted.customer_hint,
    deadline: extracted.deadline,
    warnings: extracted.warnings,
    lines,
    products: catalog,
  })
}
