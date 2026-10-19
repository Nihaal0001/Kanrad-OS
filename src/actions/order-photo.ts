"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { createHash } from "crypto"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createOrder } from "@/actions/orders"
import { orderSignature } from "@/lib/order-photo-match"

const BUCKET = "order-photos"
// <userId>/<timestamp>-<12 hex>.<ext> — exactly what the extract route writes
const PHOTO_PATH = /^[0-9a-f-]{36}\/\d{10,}-[a-f0-9]{12}\.(jpg|png|webp)$/

const payloadSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  deadline: z.string().min(1, "Deadline is required"),
  photoPath: z.string().min(1),
  photoHash: z.string().regex(/^[a-f0-9]{64}$/),
  allowDuplicate: z.boolean().optional(),
  items: z
    .array(
      z.object({
        product_name: z.string().min(1),
        quantity: z.number().int().min(1),
        unit_price: z.number().min(0),
      })
    )
    .min(1, "At least one item is required"),
})

export type PhotoOrderPayload = z.infer<typeof payloadSchema>

export async function createOrderFromPhoto(input: PhotoOrderPayload) {
  const parsed = payloadSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid order" }
  const payload = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // The photo must be one this user uploaded (path is prefixed by their id)
  if (!PHOTO_PATH.test(payload.photoPath) || !payload.photoPath.startsWith(`${user.id}/`)) {
    return { error: "Invalid photo reference" }
  }

  const admin = createAdminClient()

  // Never trust the client's hash: recompute it from the stored file (this also proves the file exists)
  const { data: file, error: fileError } = await admin.storage.from(BUCKET).download(payload.photoPath)
  if (fileError || !file) return { error: "The uploaded photo could not be found — please upload it again." }
  const photoHash = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex")

  // Server-side guard: every line must be a real, active BOM product.
  const names = [...new Set(payload.items.map((i) => i.product_name))]
  const { data: boms, error: bomError } = await admin
    .from("bom_headers")
    .select("product_name")
    .eq("is_active", true)
    .in("product_name", names)
  if (bomError) return { error: bomError.message }
  const known = new Set((boms ?? []).map((b) => b.product_name as string))
  const unknown = names.filter((n) => !known.has(n))
  if (unknown.length) return { error: `Not in the product list: ${unknown.join(", ")}` }

  if (!payload.allowDuplicate) {
    // 1) the same photo file
    const { data: sameFile } = await admin
      .from("orders")
      .select("order_number")
      .eq("source_photo_hash", photoHash)
      .neq("status", "cancelled")
      .limit(1)
    if (sameFile?.length) {
      return { duplicate: `This photo was already used for ${sameFile[0].order_number}.` }
    }

    // 2) a re-photographed sheet: same customer, same lines, last 30 days
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { data: recent } = await admin
      .from("orders")
      .select("order_number, order_items(product_variant, quantity)")
      .eq("customer_id", payload.customer_id)
      .neq("status", "cancelled")
      .gte("created_at", since)
    const mine = orderSignature(payload.items.map((i) => ({ product: i.product_name, qty: i.quantity })))
    const twin = (recent ?? []).find((o) => {
      const items = (o.order_items ?? []) as Array<{ product_variant: string; quantity: number }>
      return orderSignature(items.map((i) => ({ product: i.product_variant, qty: i.quantity }))) === mine
    })
    if (twin) {
      return { duplicate: `${twin.order_number} for this customer has exactly the same items and quantities.` }
    }
  }

  const result = await createOrder({
    customer_id: payload.customer_id,
    deadline: payload.deadline,
    priority: "normal",
    status: "draft", // costing is required before it can be confirmed
    gst_rate: 18,
    description: "Created from photo order sheet",
    notes: "",
    items: payload.items.map((i) => ({
      product_variant: i.product_name,
      size: "",
      color: "",
      quantity: i.quantity,
      unit_price: i.unit_price,
      hsn_code: "",
      thickness_mm: null,
    })),
  })
  if ("error" in result && result.error) return { error: result.error }
  const order = result.data!

  const { error: attachError } = await admin
    .from("orders")
    .update({ source_photo_path: payload.photoPath, source_photo_hash: photoHash })
    .eq("id", order.id)
  if (attachError?.code === "23505") {
    // Lost a race with an identical submit — undo this order, keep the first
    await admin.from("orders").delete().eq("id", order.id)
    return { duplicate: "This photo was just used for another order." }
  }
  if (attachError) {
    // The order is valid; only the attachment failed. Say so rather than hide it.
    return {
      data: { id: order.id, orderNumber: order.order_number },
      warning: `Order created but the photo could not be attached: ${attachError.message}`,
    }
  }

  revalidateTag("orders", {})
  revalidatePath("/orders")
  return { data: { id: order.id, orderNumber: order.order_number } }
}

/** Remove an uploaded photo that never became an order (user cancelled). */
export async function discardOrderPhoto(photoPath: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !PHOTO_PATH.test(photoPath) || !photoPath.startsWith(`${user.id}/`)) return { success: false }

  const admin = createAdminClient()
  const { data: used } = await admin.from("orders").select("id").eq("source_photo_path", photoPath).limit(1)
  if (used?.length) return { success: false }
  await admin.storage.from(BUCKET).remove([photoPath])
  return { success: true }
}
