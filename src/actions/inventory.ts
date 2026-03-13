"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  materialSchema,
  stockAdjustmentSchema,
  purchaseOrderSchema,
  type MaterialFormData,
  type StockAdjustmentFormData,
  type PurchaseOrderFormData,
} from "@/lib/validators/inventory"

// ==================== Categories ====================

export async function getCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("material_categories")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return data
}

// ==================== Materials ====================

export async function getMaterials(filters?: {
  category_id?: string
  search?: string
  low_stock?: boolean
}) {
  const supabase = await createClient()
  let query = supabase
    .from("materials")
    .select("*, category:material_categories(id, name)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (filters?.category_id) {
    query = query.eq("category_id", filters.category_id)
  }
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`
    )
  }
  if (filters?.low_stock) {
    query = query.lte("current_stock", "min_stock_level" as unknown as number)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function getMaterial(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("materials")
    .select("*, category:material_categories(*)")
    .eq("id", id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createMaterial(formData: MaterialFormData) {
  const validated = materialSchema.parse(formData)
  const supabase = await createClient()

  const cleaned = Object.fromEntries(
    Object.entries(validated).map(([k, v]) => [k, v === "" ? null : v])
  )

  const { data, error } = await supabase
    .from("materials")
    .insert(cleaned)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/inventory")
  return { data }
}

export async function updateMaterial(id: string, formData: MaterialFormData) {
  const validated = materialSchema.parse(formData)
  const supabase = await createClient()

  const cleaned = Object.fromEntries(
    Object.entries(validated).map(([k, v]) => [k, v === "" ? null : v])
  )

  const { data, error } = await supabase
    .from("materials")
    .update(cleaned)
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/inventory")
  revalidatePath(`/inventory/${id}`)
  return { data }
}

export async function deleteMaterial(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("materials")
    .update({ is_active: false })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/inventory")
  return { success: true }
}

// ==================== Stock Transactions ====================

export async function getStockTransactions(materialId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("stock_transactions")
    .select("*")
    .eq("material_id", materialId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function createStockTransaction(formData: StockAdjustmentFormData) {
  const validated = stockAdjustmentSchema.parse(formData)
  const supabase = await createClient()

  // For production_out, quantity should be negative
  const quantity =
    validated.type === "production_out"
      ? -Math.abs(validated.quantity)
      : Math.abs(validated.quantity)

  const { error } = await supabase.from("stock_transactions").insert({
    material_id: validated.material_id,
    type: validated.type,
    quantity,
    reference_type: "manual",
    notes: validated.notes || null,
  })

  if (error) return { error: error.message }

  revalidatePath("/inventory")
  revalidatePath(`/inventory/${validated.material_id}`)
  return { success: true }
}

// ==================== Purchase Orders ====================

export async function getPurchaseOrders(filters?: {
  status?: string
  search?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from("purchase_orders")
    .select("*")
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.search) {
    query = query.or(
      `po_number.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function getPurchaseOrder(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, items:purchase_order_items(*, material:materials(id, name, sku, unit))")
    .eq("id", id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createPurchaseOrder(formData: PurchaseOrderFormData) {
  const validated = purchaseOrderSchema.parse(formData)
  const supabase = await createClient()

  const { items, ...poData } = validated
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

  revalidatePath("/inventory/purchase-orders")
  return { data: po }
}

export async function updatePurchaseOrderStatus(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/inventory/purchase-orders")
  revalidatePath(`/inventory/purchase-orders/${id}`)
  return { success: true }
}

export async function receivePurchaseOrderItem(
  itemId: string,
  quantityReceived: number,
  poId: string
) {
  const supabase = await createClient()

  // Update the received quantity
  const { data: item, error: itemError } = await supabase
    .from("purchase_order_items")
    .update({ quantity_received: quantityReceived })
    .eq("id", itemId)
    .select("*, material:materials(id, name)")
    .single()

  if (itemError) return { error: itemError.message }

  // Create stock transaction for received items
  if (quantityReceived > 0) {
    const { error: txnError } = await supabase
      .from("stock_transactions")
      .insert({
        material_id: item.material_id,
        type: "purchase_in",
        quantity: quantityReceived,
        reference_type: "purchase_order",
        reference_id: poId,
        notes: `Received from PO`,
      })

    if (txnError) return { error: txnError.message }
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

  revalidatePath("/inventory/purchase-orders")
  revalidatePath(`/inventory/purchase-orders/${poId}`)
  revalidatePath("/inventory")
  return { success: true }
}

export async function deletePurchaseOrder(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/inventory/purchase-orders")
  return { success: true }
}
