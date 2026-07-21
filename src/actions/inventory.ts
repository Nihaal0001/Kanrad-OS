"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  materialSchema,
  stockAdjustmentSchema,
  purchaseOrderSchema,
  type MaterialFormData,
  type StockAdjustmentFormData,
  type PurchaseOrderFormData,
} from "@/lib/validators/inventory"

// ==================== Categories ====================

export const getCategories = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("material_categories")
      .select("*")
      .order("name")

    if (error) throw new Error(error.message)
    return data
  },
  ["material-categories"],
  { tags: ["categories"], revalidate: 3600 }
)

// ==================== Materials ====================

export const getMaterials = unstable_cache(
  async (filters?: { category_id?: string; search?: string; low_stock?: boolean }) => {
    const supabase = createAdminClient()
    let query = supabase
      .from("materials")
      .select("*, category:material_categories(id, name)")
      .eq("is_active", true)
      .order("sku", { ascending: true })

    if (filters?.category_id) {
      query = query.eq("category_id", filters.category_id)
    }
    if (filters?.search) {
      const escaped = filters.search.replace(/%/g, "\\%").replace(/_/g, "\\_")
      query = query.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%`)
    }
    if (filters?.low_stock) {
      query = query.lte("current_stock", "min_stock_level" as unknown as number)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
  },
  ["materials"],
  { tags: ["materials"], revalidate: 60 }
)

export async function getMaterial(id: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("materials")
        .select("*, category:material_categories(*)")
        .eq("id", id)
        .single()

      if (error) throw new Error(error.message)
      return data
    },
    [`material-${id}`],
    { tags: ["materials"], revalidate: 60 }
  )()
}

/** Materials pulled from the BOMs of the products on the given orders — used to
 *  scope the PO material picker to what's actually needed once orders are linked.
 *  Each material also carries how many units the order(s) require and the
 *  resulting shortage against current stock, so the picker can suggest a
 *  purchase quantity instead of just narrowing the list. */
export async function getMaterialsForOrders(orderIds: string[]) {
  if (orderIds.length === 0) return []

  const supabase = createAdminClient()

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_variant, quantity")
    .in("order_id", orderIds)
  if (itemsError) throw new Error(itemsError.message)

  // Total ordered quantity per product across all linked orders/line items.
  const qtyByProduct = new Map<string, number>()
  for (const i of items ?? []) {
    if (!i.product_variant) continue
    qtyByProduct.set(i.product_variant, (qtyByProduct.get(i.product_variant) ?? 0) + i.quantity)
  }
  const productNames = [...qtyByProduct.keys()]
  if (productNames.length === 0) return []

  const { data: boms, error: bomError } = await supabase
    .from("bom_headers")
    .select("product_name, bom_items(qty_required, wastage_pct, material:materials(*, category:material_categories(id, name)))")
    .in("product_name", productNames)
    .eq("is_active", true)
  if (bomError) throw new Error(bomError.message)

  const byId = new Map()
  for (const bom of boms ?? []) {
    const orderedQty = qtyByProduct.get(bom.product_name) ?? 0
    for (const item of bom.bom_items ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mat = Array.isArray(item.material) ? item.material[0] : item.material as any
      if (!mat) continue
      const perUnit = item.qty_required * (1 + (item.wastage_pct ?? 0) / 100)
      const required = perUnit * orderedQty
      const existing = byId.get(mat.id)
      const requiredQty = (existing?.requiredQty ?? 0) + required
      const shortage = Math.max(0, requiredQty - (mat.current_stock ?? 0))
      byId.set(mat.id, { ...mat, requiredQty, shortage })
    }
  }

  return [...byId.values()]
    .map((m) => ({ ...m, requiredQty: Math.round(m.requiredQty * 100) / 100, shortage: Math.round(m.shortage * 100) / 100 }))
    .sort((a, b) => a.sku.localeCompare(b.sku))
}

export async function createMaterial(formData: MaterialFormData) {
  const validated = materialSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Strip the UI-only is_circle flag; clear circle fields if not a circle
  const { is_circle, ...rest } = validated
  const circleFields = is_circle
    ? { diameter_mm: rest.diameter_mm ?? null, thickness_mm: rest.thickness_mm ?? null, circle_type: rest.circle_type ?? null }
    : { diameter_mm: null, thickness_mm: null, circle_type: null }

  const cleaned = Object.fromEntries(
    Object.entries({ ...rest, ...circleFields }).map(([k, v]) => [k, v === "" ? null : v])
  )

  const { data, error } = await supabase
    .from("materials")
    .insert(cleaned)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidateTag("materials", {})
  revalidatePath("/inventory")
  return { data }
}

export async function updateMaterial(id: string, formData: MaterialFormData) {
  const validated = materialSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { is_circle, ...rest } = validated
  const circleFields = is_circle
    ? { diameter_mm: rest.diameter_mm ?? null, thickness_mm: rest.thickness_mm ?? null, circle_type: rest.circle_type ?? null }
    : { diameter_mm: null, thickness_mm: null, circle_type: null }

  const cleaned = Object.fromEntries(
    Object.entries({ ...rest, ...circleFields }).map(([k, v]) => [k, v === "" ? null : v])
  )

  const { data, error } = await supabase
    .from("materials")
    .update(cleaned)
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidateTag("materials", {})
  revalidatePath("/inventory")
  revalidatePath(`/inventory/${id}`)
  return { data }
}

export async function zeroAllMaterialStock(secret?: string) {
  if (secret !== process.env.CRON_SECRET) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }
  }

  const admin = createAdminClient()

  const { data: materials, error: fetchError } = await admin
    .from("materials")
    .select("id")
    .eq("is_active", true)

  if (fetchError) return { error: fetchError.message }
  if (!materials || materials.length === 0) return { success: true, updated: 0 }

  let updated = 0
  for (const mat of materials) {
    const { error } = await admin
      .from("materials")
      .update({ current_stock: 0 })
      .eq("id", mat.id)
    if (!error) updated++
  }

  revalidateTag("materials", {})
  revalidatePath("/inventory")
  revalidatePath("/master-inventory")
  return { success: true, updated }
}

/**
 * Parses diameter and thickness from "Alu Circle 263 X 3 MM" style names.
 * Finds the first "number X number" pattern in the name.
 */
function parseCircleDimensions(name: string): { dia: number; thick: number } | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/i)
  if (!m) return null
  const dia = parseFloat(m[1])
  const thick = parseFloat(m[2])
  return dia > 0 && thick > 0 ? { dia, thick } : null
}

export async function applyCirclePricing(aluPricePerKg: number) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  if (!aluPricePerKg || aluPricePerKg <= 0) return { error: "Price must be greater than 0" }

  // Detect circles by name — circle_type is null for existing records
  const { data: all, error: fetchError } = await admin
    .from("materials")
    .select("id, name, circle_type, diameter_mm, thickness_mm")
    .ilike("name", "Alu Circle %")
    .eq("is_active", true)

  if (fetchError) return { error: fetchError.message }
  if (!all || all.length === 0) return { error: 'No materials found with names starting "Alu Circle"' }

  const updates: {
    id: string
    cost_per_unit: number
    diameter_mm: number
    thickness_mm: number
    circle_type: string
  }[] = []
  let skipped = 0

  for (const c of all) {
    const parsed = parseCircleDimensions(c.name)
    if (!parsed) { skipped++; continue }
    const { dia, thick } = parsed
    const costPerPiece = Math.round(dia * dia * thick * 0.000002127 * aluPricePerKg * 100) / 100
    updates.push({
      id: c.id,
      cost_per_unit: costPerPiece,
      diameter_mm: dia,
      thickness_mm: thick,
      circle_type: c.circle_type ?? "non_ib",
    })
  }

  if (updates.length === 0) return { error: "Could not parse dimensions from any circle material names" }

  for (const { id, ...fields } of updates) {
    const { error: updateError } = await admin
      .from("materials")
      .update(fields)
      .eq("id", id)
    if (updateError) return { error: updateError.message }
  }

  revalidateTag("materials", {})
  revalidatePath("/master-inventory")
  revalidatePath("/inventory")
  return { success: true, updated: updates.length, skipped }
}

export async function deleteMaterial(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("materials")
    .update({ is_active: false })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidateTag("materials", {})
  revalidatePath("/inventory")
  return { success: true }
}

// ==================== Stock Transactions ====================

export async function getStockTransactions(materialId: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("stock_transactions")
        .select("*")
        .eq("material_id", materialId)
        .order("created_at", { ascending: false })

      if (error) throw new Error(error.message)
      return data
    },
    [`stock-transactions-${materialId}`],
    { tags: ["stock_transactions"], revalidate: 60 }
  )()
}

export async function createStockTransaction(formData: StockAdjustmentFormData) {
  const validated = stockAdjustmentSchema.parse(formData)
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const isOutbound = validated.type === "production_out"
  const quantity = isOutbound ? -Math.abs(validated.quantity) : Math.abs(validated.quantity)

  const { error } = await supabase.from("stock_transactions").insert({
    material_id: validated.material_id,
    type: validated.type,
    quantity,
    reference_type: "manual",
    notes: validated.notes || null,
  })

  if (error) return { error: error.message }

  // FIFO: consume oldest batches first on outbound movements
  if (isOutbound) {
    let remaining = Math.abs(validated.quantity)
    const { data: batches } = await admin
      .from("stock_batches")
      .select("id, quantity_remaining")
      .eq("material_id", validated.material_id)
      .gt("quantity_remaining", 0)
      .order("received_at", { ascending: true })

    for (const batch of batches ?? []) {
      if (remaining <= 0) break
      const consume = Math.min(remaining, batch.quantity_remaining)
      await admin
        .from("stock_batches")
        .update({ quantity_remaining: batch.quantity_remaining - consume })
        .eq("id", batch.id)
      remaining -= consume
    }
  }

  revalidateTag("materials", {})
  revalidateTag("stock_transactions", {})
  revalidateTag("dashboard", {})
  revalidatePath("/inventory")
  revalidatePath(`/inventory/${validated.material_id}`)
  return { success: true }
}

// ==================== Purchase Orders ====================

export async function getPurchaseOrders(filters?: { status?: string; approval_status?: string; search?: string }) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      let query = supabase
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false })

      if (filters?.status) query = query.eq("status", filters.status)
      if (filters?.approval_status) query = query.eq("approval_status", filters.approval_status)
      if (filters?.search) {
        const escaped = filters.search.replace(/%/g, "\\%").replace(/_/g, "\\_")
        query = query.or(`po_number.ilike.%${escaped}%,supplier_name.ilike.%${escaped}%`)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return data
    },
    [`purchase-orders-${filters?.status ?? "all"}-${filters?.approval_status ?? "all"}-${filters?.search ?? ""}`],
    { tags: ["purchase_orders"], revalidate: 60 }
  )()
}

export async function getPurchaseOrder(id: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          items:purchase_order_items(
            *,
            material:materials(id, name, sku, unit, diameter_mm, thickness_mm, circle_type),
            receipts:purchase_order_receipts(id, order_id, quantity, received_at, bill_no)
          ),
          linked_orders:purchase_order_orders(order:orders(id, order_number, product_variant))
        `)
        .eq("id", id)
        .single()

      if (error) throw new Error(error.message)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linkedOrders = ((data as any).linked_orders ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((l: any) => (Array.isArray(l.order) ? l.order[0] : l.order))
        .filter(Boolean)

      return { ...data, linked_orders: linkedOrders }
    },
    [`purchase-order-${id}`],
    { tags: ["purchase_orders"], revalidate: 60 }
  )()
}

export async function createPurchaseOrder(formData: PurchaseOrderFormData) {
  const validated = purchaseOrderSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Enforce master inventory price ceiling on all items. This is checked
  // against materials.max_price — an admin-set ceiling — never against
  // cost_per_unit, since cost_per_unit itself gets overwritten to the last
  // PO price below and would make the ceiling self-referential.
  const materialIds = validated.items.map((i) => i.material_id).filter(Boolean)
  if (materialIds.length > 0) {
    const { data: materials } = await supabase
      .from("materials")
      .select("id, name, max_price")
      .in("id", materialIds)

    for (const item of validated.items) {
      const mat = (materials ?? []).find((m) => m.id === item.material_id)
      if (mat && mat.max_price != null && mat.max_price > 0 && item.unit_price > mat.max_price) {
        return {
          error: `Unit price for "${mat.name}" (₹${item.unit_price}) exceeds the max purchase price of ₹${mat.max_price}.`,
        }
      }
    }
  }

  const { items, order_ids, ...poData } = validated
  const cleaned = Object.fromEntries(
    Object.entries(poData).map(([k, v]) => [k, v === "" ? null : v])
  ) as Record<string, unknown>

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .insert({
      ...cleaned,
      po_number: "", // trigger will set this
    })
    .select()
    .single()

  if (poError) return { error: poError.message }

  const poItems = items.map((item) => ({
    purchase_order_id: po.id,
    material_id: item.material_id,
    quantity_ordered: item.quantity_ordered,
    unit_price: item.unit_price,
  }))

  const { error: itemsError } = await supabase
    .from("purchase_order_items")
    .insert(poItems)

  if (itemsError) {
    await supabase.from("purchase_orders").delete().eq("id", po.id)
    return { error: itemsError.message }
  }

  if (order_ids && order_ids.length > 0) {
    const links = order_ids.map((orderId) => ({ purchase_order_id: po.id, order_id: orderId }))
    const { error: linkError } = await supabase.from("purchase_order_orders").insert(links)
    if (linkError) return { error: linkError.message }
  }

  // BOM/product costing reads materials.cost_per_unit, so keep it pinned to
  // the price of the last PO raised for each material. This is independent
  // of the max_price ceiling checked above.
  for (const item of items) {
    if (!item.material_id) continue
    await supabase.from("materials").update({ cost_per_unit: item.unit_price }).eq("id", item.material_id)
  }
  revalidateTag("materials", {})
  revalidateTag("bom", {})

  revalidateTag("dashboard", {})
  revalidateTag("purchase_orders", {})
  revalidatePath("/inventory/purchase-orders")
  return { data: po }
}

const VALID_PO_STATUSES = ["draft", "sent", "partial", "received", "cancelled"] as const

export async function updatePurchaseOrderStatus(id: string, status: string) {
  if (!VALID_PO_STATUSES.includes(status as typeof VALID_PO_STATUSES[number])) {
    return { error: "Invalid status" }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: before } = await supabase.from("purchase_orders").select("status").eq("id", id).single()

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidateTag("purchase_orders", {})
  revalidatePath("/inventory/purchase-orders")
  revalidatePath(`/inventory/purchase-orders/${id}`)

  if (status === "sent" && before?.status !== "sent") {
    import("@/lib/purchase-order-email")
      .then(({ emailPurchaseOrderCopy }) => emailPurchaseOrderCopy(id))
      .catch((err) => console.error("[po-email] failed:", err))
  }

  return { success: true }
}

export async function receivePurchaseOrderItem(
  itemId: string,
  quantityReceived: number,
  poId: string,
  receivedNow: number,
  orderId?: string | null,
  billNo?: string
) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  if (receivedNow > 0 && !billNo?.trim()) {
    return { error: "Enter the supplier's bill number before receiving stock." }
  }

  // Update the received quantity
  const { data: item, error: itemError } = await supabase
    .from("purchase_order_items")
    .update({ quantity_received: quantityReceived })
    .eq("id", itemId)
    .select("*, material:materials(id, current_stock, cost_per_unit)")
    .single()

  if (itemError) return { error: itemError.message }

  // Attribute this receipt to a linked customer order, if the caller specified one.
  if (receivedNow > 0) {
    const { error: receiptError } = await supabase.from("purchase_order_receipts").insert({
      purchase_order_item_id: itemId,
      order_id: orderId || null,
      quantity: receivedNow,
      bill_no: billNo!.trim(),
    })
    if (receiptError) return { error: receiptError.message }
  }

  if (receivedNow > 0) {
    const unitPrice: number = item.unit_price ?? 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat = Array.isArray(item.material) ? item.material[0] : item.material as any
    const existingStock: number = mat?.current_stock ?? 0
    const existingCost: number = mat?.cost_per_unit ?? 0

    // Weighted average cost — uses only what arrived in this receipt, not the cumulative total.
    const totalQty = existingStock + receivedNow
    const newAvgCost = totalQty > 0
      ? (existingStock * existingCost + receivedNow * unitPrice) / totalQty
      : unitPrice

    // 1. Stock transaction
    const { error: txnError } = await supabase
      .from("stock_transactions")
      .insert({
        material_id: item.material_id,
        type: "purchase_in",
        quantity: receivedNow,
        reference_type: "purchase_order",
        reference_id: poId,
        notes: `Received from PO`,
      })
    if (txnError) return { error: txnError.message }

    // 2. FIFO batch record
    await admin.from("stock_batches").insert({
      material_id: item.material_id,
      quantity_remaining: receivedNow,
      unit_cost: unitPrice,
      purchase_order_id: poId,
    })

    // 3. Update weighted average cost on the material
    await admin
      .from("materials")
      .update({ cost_per_unit: Math.round(newAvgCost * 100) / 100 })
      .eq("id", item.material_id)
  }

  // Check if all items are fully received
  const { data: allItems } = await supabase
    .from("purchase_order_items")
    .select("quantity_ordered, quantity_received")
    .eq("purchase_order_id", poId)

  if (allItems) {
    const allReceived = allItems.every(
      (i) => i.quantity_received >= i.quantity_ordered
    )
    const someReceived = allItems.some((i) => i.quantity_received > 0)

    if (allReceived) {
      await supabase
        .from("purchase_orders")
        .update({ status: "received" })
        .eq("id", poId)
    } else if (someReceived) {
      await supabase
        .from("purchase_orders")
        .update({ status: "partial" })
        .eq("id", poId)
    }
  }

  revalidateTag("materials", {})
  revalidateTag("dashboard", {})
  revalidateTag("purchase_orders", {})
  revalidatePath("/inventory/purchase-orders")
  revalidatePath(`/inventory/purchase-orders/${poId}`)
  revalidatePath("/inventory")
  return { success: true }
}

// ==================== PO Approval (admin only) ====================

export async function approvePurchaseOrder(id: string, notes?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("auth_id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: "Forbidden: admin only" }

  const { error } = await supabase
    .from("purchase_orders")
    .update({
      approval_status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: notes || null,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidateTag("purchase_orders", {})
  revalidatePath("/inventory/purchase-orders")
  revalidatePath(`/inventory/purchase-orders/${id}`)
  return { success: true }
}

export async function rejectPurchaseOrder(id: string, notes?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("auth_id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: "Forbidden: admin only" }

  const { error } = await supabase
    .from("purchase_orders")
    .update({
      approval_status: "rejected",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: notes || null,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidateTag("purchase_orders", {})
  revalidatePath("/inventory/purchase-orders")
  revalidatePath(`/inventory/purchase-orders/${id}`)
  return { success: true }
}

// ==================== Global Stock History ====================

export async function getAllStockTransactions(filters?: { type?: string; materialId?: string }) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      let query = supabase
        .from("stock_transactions")
        .select(`
          *,
          material:materials(id, name, sku, unit)
        `)
        .order("created_at", { ascending: false })
        .limit(200)

      if (filters?.type) query = query.eq("type", filters.type)
      if (filters?.materialId) query = query.eq("material_id", filters.materialId)

      const { data, error } = await query
      if (error) throw new Error(error.message)

      return (data ?? []).map((t: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        ...t,
        material: Array.isArray(t.material) ? t.material[0] ?? null : t.material,
      }))
    },
    [`all-stock-transactions-${filters?.type ?? "all"}-${filters?.materialId ?? "all"}`],
    { tags: ["stock_transactions"], revalidate: 60 }
  )()
}

export async function deletePurchaseOrder(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("purchase_orders").delete().eq("id", id)

  if (error) return { error: error.message }

  revalidateTag("purchase_orders", {})
  revalidatePath("/inventory/purchase-orders")
  return { success: true }
}
