"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/actions/audit"
import { createInvoice } from "@/actions/finance"
import { billDueDateFromToday } from "@/lib/payment-terms"

const lineSchema = z.object({
  description: z.string().min(1, "Every line needs a description"),
  hsn: z.string().optional(),
  quantity: z.number().positive("Quantity must be above 0"),
  unit_price: z.number().min(0, "Rate cannot be negative"),
  // Purchase only: an existing material, or details for a new one (never both)
  material_id: z.string().optional(),
  // Existing material that had no circle type yet — the user classified it while reviewing
  set_circle_type: z.enum(["ib", "non_ib"]).optional(),
  new_material: z.object({
    sku: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    unit: z.string().min(1),
    category_id: z.string().optional(),
    min_stock_level: z.number().min(0).optional(),
    location: z.string().max(200).optional(),
    supplier_contact: z.string().max(200).optional(),
    circle: z.object({
      diameter_mm: z.number().positive(),
      thickness_mm: z.number().positive(),
      circle_type: z.enum(["ib", "non_ib"]),
    }).optional(),
  }).optional(),
})

const payloadSchema = z.object({
  direction: z.enum(["purchase", "sales"]),
  party_name: z.string().min(1, "Party name is required"),
  party_gst: z.string().optional(),
  party_address: z.string().optional(),
  place_of_supply: z.string().optional(),
  reverse_charge: z.boolean().optional(),
  due_date: z.string().optional(),
  notes: z.string().max(1000).optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().min(1, "Bill date is required"),
  tax_rate: z.number().min(0).max(100),
  is_igst: z.boolean(),
  customer_id: z.string().optional(),
  allowDuplicate: z.boolean().optional(),
  lines: z.array(lineSchema).min(1, "At least one line is required"),
})

export type ScannedBillPayload = z.infer<typeof payloadSchema>

const r2 = (n: number) => Math.round(n * 100) / 100

function bust(direction: "purchase" | "sales") {
  for (const tag of ["materials", "dashboard", "finance", "invoices", "stock_transactions"]) revalidateTag(tag, {})
  revalidatePath("/inventory")
  revalidatePath("/finance")
  revalidatePath(direction === "purchase" ? "/finance/payables" : "/finance/receivables")
  revalidatePath(direction === "purchase" ? "/finance/purchases" : "/finance/invoices")
  revalidatePath("/finance/upcoming")
}

/**
 * Book a reviewed, scanned bill. Purchase bill → stock received + average cost + payable.
 * Sales bill → receivable only (stock is not touched). Runs only after the user said yes.
 */
export async function confirmScannedBill(input: ScannedBillPayload) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const parsed = payloadSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid bill" }
  const p = parsed.data
  const admin = createAdminClient()

  if (p.direction === "sales") {
    const invNo = p.invoice_number?.trim()
    if (invNo && !p.allowDuplicate) {
      const { data: dupe } = await admin.from("invoices").select("invoice_number").ilike("notes", `%Scanned bill ${invNo}%`).limit(1)
      if (dupe?.[0]) return { duplicate: `Bill ${invNo} was already added as ${dupe[0].invoice_number}.` }
    }
    const res = await createInvoice({
      customer_id: p.customer_id ?? "",
      customer_name: p.party_name,
      customer_address: p.party_address ?? "",
      customer_gst: p.party_gst ?? "",
      tax_rate: p.tax_rate,
      place_of_supply: p.place_of_supply ?? "",
      reverse_charge: p.reverse_charge ?? false,
      is_igst: p.is_igst,
      issue_date: p.invoice_date,
      due_date: p.due_date ?? "",
      notes: [invNo ? `Scanned bill ${invNo}` : "Scanned bill", p.notes].filter(Boolean).join("\n"),
      items: p.lines.map((l) => ({ description: l.description, quantity: l.quantity, unit_price: l.unit_price, hsn_code: l.hsn ?? "" })),
    })
    if ("error" in res && res.error) return { error: res.error }
    // A bill that already exists is issued, not a draft
    await admin.from("invoices").update({ status: "sent" }).eq("id", res.data!.id)
    bust("sales")
    return { data: { kind: "sales" as const, id: res.data!.id as string, label: res.data!.invoice_number as string, stockLines: 0 } }
  }

  // ---------- Purchase ----------
  const invNo = p.invoice_number?.trim()
  if (!invNo) return { error: "Enter the supplier's bill number — it is how this payable is tracked." }
  if (p.lines.some((l) => !l.material_id && !l.new_material)) return { error: "Every line needs a material — pick one or create it." }
  if (!p.allowDuplicate) {
    const { data: dupe } = await admin
      .from("purchase_invoices").select("id").ilike("supplier_name", p.party_name).eq("invoice_number", invNo).neq("status", "cancelled").limit(1)
    if (dupe?.[0]) return { duplicate: `Bill ${invNo} from ${p.party_name} is already in Finance.` }
  }

  const createdMaterialIds: string[] = []
  const done: Array<{ materialId: string; qty: number; prevCost: number; batchId: string | null; txnId: string | null }> = []
  let invoiceId: string | null = null

  const rollback = async () => {
    for (const d of done.reverse()) {
      if (d.batchId) await admin.from("stock_batches").delete().eq("id", d.batchId)
      if (d.txnId) await admin.from("stock_transactions").insert({
        material_id: d.materialId, type: "adjustment", quantity: -d.qty, reference_type: "manual", notes: "Scanned bill rolled back",
      })
      await admin.from("materials").update({ cost_per_unit: d.prevCost }).eq("id", d.materialId)
    }
    if (invoiceId) await admin.from("purchase_invoices").delete().eq("id", invoiceId)
    // A material created for this bill is only removable while nothing else references it
    for (const id of createdMaterialIds) await admin.from("materials").delete().eq("id", id)
  }

  try {
    // 1. New materials the user approved. If the code or name is already in the item master — or two
    //    lines use the same new one — reuse that material so its stock stays together, never duplicate it.
    const { data: existing } = await admin.from("materials").select("id, sku, name")
    const bySku = new Map((existing ?? []).map((m) => [String(m.sku).trim().toLowerCase(), m.id as string]))
    const byName = new Map((existing ?? []).map((m) => [String(m.name).trim().toLowerCase(), m.id as string]))
    const resolved: string[] = []
    for (const l of p.lines) {
      if (l.material_id) { resolved.push(l.material_id); continue }
      const nm = l.new_material!
      const skuKey = nm.sku.trim().toLowerCase()
      const nameKey = nm.name.trim().toLowerCase()
      const found = bySku.get(skuKey) ?? byName.get(nameKey)
      if (found) { resolved.push(found); continue }
      const { data: created, error } = await admin
        .from("materials")
        .insert({
          sku: nm.sku.trim(), name: nm.name.trim(), unit: nm.unit, cost_per_unit: 0,
          min_stock_level: nm.min_stock_level ?? 0,
          category_id: nm.category_id || null,
          location: nm.location?.trim() || null,
          supplier_name: p.party_name,
          supplier_contact: nm.supplier_contact?.trim() || null,
          diameter_mm: nm.circle?.diameter_mm ?? null,
          thickness_mm: nm.circle?.thickness_mm ?? null,
          circle_type: nm.circle?.circle_type ?? null,
        })
        .select("id").single()
      if (error || !created) throw new Error(error?.message ?? "Could not create material")
      createdMaterialIds.push(created.id)
      bySku.set(skuKey, created.id)
      byName.set(nameKey, created.id)
      resolved.push(created.id)
    }

    // 2. The payable
    const { data: inv, error: invErr } = await admin
      .from("purchase_invoices")
      .insert({
        supplier_name: p.party_name,
        supplier_gst: p.party_gst || null,
        invoice_number: invNo,
        tax_rate: p.tax_rate,
        is_igst: p.is_igst,
        place_of_supply: p.place_of_supply || null,
        invoice_date: p.invoice_date,
        due_date: billDueDateFromToday(),
        status: "received",
        notes: ["Added by scanning the bill", p.notes].filter(Boolean).join("\n"),
      })
      .select("id").single()
    if (invErr || !inv) throw new Error(invErr?.message ?? "Could not create the bill")
    invoiceId = inv.id

    const { error: itemsErr } = await admin.from("purchase_invoice_items").insert(
      p.lines.map((l) => ({ purchase_invoice_id: inv.id, description: l.description, hsn_code: l.hsn || null, quantity: l.quantity, unit_price: l.unit_price }))
    )
    if (itemsErr) throw new Error(itemsErr.message)

    // 3. Stock in, one line at a time (a material can appear on two lines — re-read each time)
    for (let i = 0; i < p.lines.length; i++) {
      const l = p.lines[i]
      const materialId = resolved[i]
      const { data: mat, error: matErr } = await admin.from("materials").select("current_stock, cost_per_unit").eq("id", materialId).single()
      if (matErr || !mat) throw new Error(matErr?.message ?? "Material not found")
      const existingStock = Number(mat.current_stock) || 0
      const existingCost = Number(mat.cost_per_unit) || 0
      const total = existingStock + l.quantity
      // Weighted-average cost, same rule as a PO receipt
      const avg = total > 0 ? (existingStock * existingCost + l.quantity * l.unit_price) / total : l.unit_price

      const { data: txn, error: txnErr } = await admin
        .from("stock_transactions")
        .insert({ material_id: materialId, type: "purchase_in", quantity: l.quantity, reference_type: "purchase_invoice", reference_id: inv.id, notes: `Scanned bill ${invNo}` })
        .select("id").single()
      if (txnErr || !txn) throw new Error(txnErr?.message ?? "Could not record stock")
      const entry = { materialId, qty: l.quantity, prevCost: existingCost, batchId: null as string | null, txnId: txn.id as string }
      done.push(entry)

      const { data: batch, error: batchErr } = await admin
        .from("stock_batches").insert({ material_id: materialId, quantity_remaining: l.quantity, unit_cost: l.unit_price }).select("id").single()
      if (batchErr) throw new Error(batchErr.message)
      entry.batchId = batch.id

      const { error: costErr } = await admin.from("materials").update({ cost_per_unit: r2(avg) }).eq("id", materialId)
      if (costErr) throw new Error(costErr.message)
    }

    // 4. Classify any unclassified circle the user answered for (non-IB also gets its weight via the DB trigger)
    for (let i = 0; i < p.lines.length; i++) {
      const t = p.lines[i].set_circle_type
      if (!t || !p.lines[i].material_id) continue
      await admin.from("materials").update({ circle_type: t }).eq("id", resolved[i]).is("circle_type", null)
    }
  } catch (err) {
    await rollback()
    return { error: `Nothing was saved. ${err instanceof Error ? err.message : "Something went wrong"}` }
  }

  bust("purchase")
  await logAudit({
    entityType: "purchase_invoice", entityId: invoiceId!, entityLabel: invNo, action: "created",
    newValues: { source: "scan", supplier: p.party_name, lines: p.lines.length },
  })
  return { data: { kind: "purchase" as const, id: invoiceId!, label: invNo, stockLines: p.lines.length } }
}

/**
 * Typed (not scanned) stock entry: one material, one supplier bill. Same booking as a scanned
 * purchase bill — stock in, average cost, payable — but admin only.
 */
export async function addStockEntry(input: ScannedBillPayload) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data: profile } = await supabase.from("profiles").select("role").eq("auth_id", user.id).maybeSingle()
  if (profile?.role !== "admin") return { error: "Forbidden: admin only" }
  if (input.direction !== "purchase" || input.lines.length !== 1) return { error: "Add one material per entry." }
  return confirmScannedBill(input)
}
