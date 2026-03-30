"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { bomSchema, type BomFormData } from "@/lib/validators/bom"
import { logAudit } from "@/actions/audit"

export async function getProducts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("bom_headers")
    .select(`
      *,
      bom_items(
        id, material_id, qty_required, unit, wastage_pct,
        material:materials(id, name, sku, cost_per_unit, unit, current_stock)
      )
    `)
    .eq("is_active", true)
    .order("product_name", { ascending: true })

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((bom: any) => {
    const items = (bom.bom_items ?? []).map((item: any) => ({
      ...item,
      material: Array.isArray(item.material) ? item.material[0] ?? null : item.material,
    }))
    const materialCost = items.reduce((sum: number, item: any) => {
      const costPerUnit = item.material?.cost_per_unit ?? 0
      const effective = item.qty_required * (1 + (item.wastage_pct ?? 0) / 100)
      return sum + effective * costPerUnit
    }, 0)
    return { ...bom, bom_items: items, materialCost }
  })
}

export async function getProduct(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("bom_headers")
    .select(`
      *,
      bom_items(
        id, material_id, qty_required, unit, wastage_pct, notes,
        material:materials(id, name, sku, cost_per_unit, unit, current_stock)
      )
    `)
    .eq("id", id)
    .single()

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data.bom_items ?? []).map((item: any) => ({
    ...item,
    material: Array.isArray(item.material) ? item.material[0] ?? null : item.material,
  }))

  return { ...data, bom_items: items }
}

export async function createProduct(formData: BomFormData) {
  const validated = bomSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Check for duplicate SKU
  const { data: existing } = await supabase
    .from("bom_headers")
    .select("id")
    .eq("product_sku", validated.product_sku)
    .eq("is_active", true)
    .maybeSingle()

  if (existing) return { error: "A product with this SKU already exists" }

  // Get profile id
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle()

  // Insert BOM header
  const { data: bom, error: bomErr } = await supabase
    .from("bom_headers")
    .insert({
      product_sku: validated.product_sku,
      product_name: validated.product_name,
      category: validated.category || null,
      notes: validated.notes || null,
      created_by: profile?.id ?? null,
    })
    .select()
    .single()

  if (bomErr) return { error: bomErr.message }

  // Insert BOM items
  const items = validated.items.map((item) => ({
    bom_id: bom.id,
    material_id: item.material_id,
    qty_required: item.qty_required,
    unit: item.unit,
    wastage_pct: item.wastage_pct ?? 0,
    notes: item.notes || null,
  }))

  const { error: itemsErr } = await supabase.from("bom_items").insert(items)
  if (itemsErr) return { error: itemsErr.message }

  revalidatePath("/products")
  await logAudit({
    entityType: "product",
    entityId: bom.id,
    entityLabel: `${bom.product_sku} — ${bom.product_name}`,
    action: "created",
  })
  return { data: bom }
}

export async function updateProduct(id: string, formData: BomFormData) {
  const validated = bomSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Check for duplicate SKU (exclude self)
  const { data: existing } = await supabase
    .from("bom_headers")
    .select("id")
    .eq("product_sku", validated.product_sku)
    .eq("is_active", true)
    .neq("id", id)
    .maybeSingle()

  if (existing) return { error: "A product with this SKU already exists" }

  // Update header
  const { error: headerErr } = await supabase
    .from("bom_headers")
    .update({
      product_sku: validated.product_sku,
      product_name: validated.product_name,
      category: validated.category || null,
      notes: validated.notes || null,
    })
    .eq("id", id)

  if (headerErr) return { error: headerErr.message }

  // Delete existing items and re-insert
  const { error: deleteErr } = await supabase
    .from("bom_items")
    .delete()
    .eq("bom_id", id)

  if (deleteErr) return { error: deleteErr.message }

  const items = validated.items.map((item) => ({
    bom_id: id,
    material_id: item.material_id,
    qty_required: item.qty_required,
    unit: item.unit,
    wastage_pct: item.wastage_pct ?? 0,
    notes: item.notes || null,
  }))

  const { error: itemsErr } = await supabase.from("bom_items").insert(items)
  if (itemsErr) return { error: itemsErr.message }

  revalidatePath("/products")
  revalidatePath(`/products/${id}`)
  await logAudit({
    entityType: "product",
    entityId: id,
    entityLabel: `${validated.product_sku} — ${validated.product_name}`,
    action: "updated",
  })
  return { success: true }
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Soft delete — mark as inactive
  const { error } = await supabase
    .from("bom_headers")
    .update({ is_active: false })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/products")
  await logAudit({ entityType: "product", entityId: id, action: "deleted" })
  return { success: true }
}

export async function getProductByCostForOrder(bomId: string, quantity: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("bom_headers")
    .select(`
      id, product_sku, product_name,
      bom_items(
        id, material_id, qty_required, unit, wastage_pct,
        material:materials(id, name, cost_per_unit, unit)
      )
    `)
    .eq("id", bomId)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data.bom_items ?? []).map((item: any) => ({
    ...item,
    material: Array.isArray(item.material) ? item.material[0] ?? null : item.material,
  }))

  let totalMaterialCost = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breakdown = items.map((item: any) => {
    const costPerUnit = item.material?.cost_per_unit ?? 0
    const effectiveQty = item.qty_required * (1 + (item.wastage_pct ?? 0) / 100)
    const lineCost = effectiveQty * costPerUnit * quantity
    totalMaterialCost += lineCost
    return {
      materialName: item.material?.name ?? "Unknown",
      qtyPerUnit: item.qty_required,
      wastage: item.wastage_pct,
      effectiveQty,
      costPerUnit,
      totalQty: effectiveQty * quantity,
      lineCost,
    }
  })

  return {
    product: data,
    perUnitMaterialCost: totalMaterialCost / (quantity || 1),
    totalMaterialCost,
    breakdown,
  }
}
