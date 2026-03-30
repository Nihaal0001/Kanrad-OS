"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  expenseImportDraftSchema,
  financeImportBatchItemSchema,
  purchaseInvoiceImportDraftSchema,
  type FinanceImportBatchItem,
} from "@/lib/validators/finance-import"
import { extractFinanceDocument, rankSuggestions } from "@/lib/ai/finance-import"
import { createImportedPurchaseInvoice } from "@/actions/purchase-invoices"
import { createImportedExpense } from "@/actions/expenses"

const FINANCE_DOC_BUCKET = "finance-documents"
const SUPPORTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
])
async function requireFinanceUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Not authenticated" as const }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_id", user.id)
    .maybeSingle()

  if (!profile) {
    return { error: "Profile not found" as const }
  }

  if (profile.role !== "admin") {
    const { data: perms } = await supabase
      .from("role_permissions")
      .select("permission")
      .eq("role", profile.role)

    const permissions = (perms ?? []).map((row) => row.permission)
    if (!permissions.includes("finance")) {
      return { error: "Forbidden: finance access required" as const }
    }
  }

  return { supabase, user, profile }
}

async function getExtractionContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [suppliersRes, posRes, categoriesRes, ordersRes] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase
      .from("purchase_orders")
      .select("id, po_number, supplier_name")
      .eq("approval_status", "approved")
      .in("status", ["received", "partial", "sent"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("orders").select("id, order_number, product_variant").order("created_at", { ascending: false }).limit(100),
  ])

  return {
    suppliers: suppliersRes.data ?? [],
    purchaseOrders: posRes.data ?? [],
    expenseCategories: categoriesRes.data ?? [],
    orders: ordersRes.data ?? [],
  }
}

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-")
}

function buildPurchaseDraft(params: {
  extracted: Awaited<ReturnType<typeof extractFinanceDocument>>
  fileUrl: string
  storagePath: string
  supplierSuggestions: Array<{ id: string; label: string; confidence?: number }>
  purchaseOrderSuggestions: Array<{ id: string; label: string; confidence?: number }>
  warnings: string[]
}): FinanceImportBatchItem {
  const purchase = params.extracted.purchase_invoice
  const topPo = params.purchaseOrderSuggestions[0]

  return purchaseInvoiceImportDraftSchema.parse({
    target_type: "purchase_invoice",
    purchase_order_id: topPo?.confidence && topPo.confidence > 0.8 ? topPo.id : "",
    supplier_name: purchase?.supplier_name || "",
    supplier_gst: purchase?.supplier_gst || "",
    invoice_number: purchase?.invoice_number || "",
    tax_rate: purchase?.tax_rate ?? 0,
    place_of_supply: purchase?.place_of_supply || "",
    is_igst: purchase?.is_igst ?? false,
    invoice_date: purchase?.invoice_date || "",
    due_date: purchase?.due_date || "",
    notes: purchase?.notes || "",
    document_path: params.storagePath,
    document_url: params.fileUrl,
    supplier_suggestions: params.supplierSuggestions,
    purchase_order_suggestions: params.purchaseOrderSuggestions,
    warnings: params.warnings,
    items:
      purchase?.items?.length
        ? purchase.items.map((item) => ({
            description: item.description || "Line item",
            quantity: item.quantity > 0 ? item.quantity : 1,
            unit_price: item.unit_price >= 0 ? item.unit_price : 0,
            hsn_code: item.hsn_code || "",
          }))
        : [{ description: "Line item", quantity: 1, unit_price: 0, hsn_code: "" }],
  })
}

function buildExpenseDraft(params: {
  extracted: Awaited<ReturnType<typeof extractFinanceDocument>>
  fileUrl: string
  categorySuggestions: Array<{ id: string; label: string; confidence?: number }>
  orderSuggestions: Array<{ id: string; label: string; confidence?: number }>
  warnings: string[]
}): FinanceImportBatchItem {
  const expense = params.extracted.expense
  const topCategory = params.categorySuggestions[0]
  const topOrder = params.orderSuggestions[0]

  return expenseImportDraftSchema.parse({
    target_type: "expense",
    category_id: topCategory?.confidence && topCategory.confidence > 0.8 ? topCategory.id : "",
    order_id: topOrder?.confidence && topOrder.confidence > 0.8 ? topOrder.id : "",
    amount: expense?.amount ?? 0,
    expense_date: expense?.expense_date || "",
    description: expense?.description || "",
    notes: expense?.notes || "",
    receipt_url: params.fileUrl,
    category_suggestions: params.categorySuggestions,
    order_suggestions: params.orderSuggestions,
    warnings: params.warnings,
  })
}

async function refreshBatchStatus(admin: ReturnType<typeof createAdminClient>, batchId: string) {
  const { data: items } = await admin
    .from("finance_import_items")
    .select("status")
    .eq("batch_id", batchId)

  const total = items?.length ?? 0
  const submitted = items?.filter((item) => item.status === "submitted").length ?? 0
  const failed = items?.filter((item) => item.status === "failed").length ?? 0
  const reviewed = items?.filter((item) => item.status === "reviewed").length ?? 0

  let status: "processing" | "ready" | "partially_submitted" | "submitted" | "failed" = "processing"
  if (submitted === total && total > 0) {
    status = "submitted"
  } else if (submitted > 0) {
    status = "partially_submitted"
  } else if (failed === total && total > 0) {
    status = "failed"
  } else if (reviewed > 0 || failed > 0 || total > 0) {
    status = "ready"
  }

  await admin
    .from("finance_import_batches")
    .update({
      status,
      item_count: total,
      submitted_count: submitted,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
}

export async function uploadFinanceImportBatch(formData: FormData) {
  const auth = await requireFinanceUser()
  if ("error" in auth) return auth

  const files = formData.getAll("files").filter((file): file is File => file instanceof File && file.size > 0)
  const targetHint = formData.get("target_hint")
  const existingBatchId = formData.get("existing_batch_id")
  const parsedTargetHint =
    targetHint === "purchase_invoice" || targetHint === "expense"
      ? targetHint
      : null
  const parsedExistingBatchId = typeof existingBatchId === "string" && existingBatchId ? existingBatchId : null

  if (files.length === 0) {
    return { error: "Please upload at least one file" }
  }

  if (files.length > 10) {
    return { error: "Bulk import is limited to 10 files at a time" }
  }

  const invalidFile = files.find((file) => !SUPPORTED_TYPES.has(file.type))
  if (invalidFile) {
    return { error: `Unsupported file type: ${invalidFile.name}` }
  }

  const context = await getExtractionContext(auth.supabase)
  const admin = createAdminClient()

  let batch: { id: string } | null = null
  let batchError: { message?: string } | null = null

  if (parsedExistingBatchId) {
    const { data, error } = await admin
      .from("finance_import_batches")
      .select("id")
      .eq("id", parsedExistingBatchId)
      .single()
    batch = data
    batchError = error
  } else {
    const { data, error } = await admin
      .from("finance_import_batches")
      .insert({
        created_by: auth.profile.id,
        target_hint: parsedTargetHint,
        item_count: files.length,
      })
      .select("id")
      .single()
    batch = data
    batchError = error
  }

  if (batchError || !batch) {
    return { error: batchError?.message ?? "Failed to create import batch" }
  }

  for (const file of files) {
    const storagePath = `${batch.id}/${Date.now()}-${cleanFileName(file.name)}`
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin
      .storage
      .from(FINANCE_DOC_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      await admin.from("finance_import_items").insert({
        batch_id: batch.id,
        created_by: auth.profile.id,
        target_type: parsedTargetHint ?? "expense",
        status: "failed",
        file_name: file.name,
        file_type: file.type,
        storage_path: storagePath,
        extraction_error: uploadError.message,
      })
      continue
    }

    const fileUrl = admin.storage.from(FINANCE_DOC_BUCKET).getPublicUrl(storagePath).data.publicUrl

    try {
      const extracted = await extractFinanceDocument(file, context)
      const warnings = [...extracted.warnings]

      if (parsedTargetHint && extracted.target_type !== parsedTargetHint) {
        warnings.push(`Gemini classified this as ${extracted.target_type.replace("_", " ")}, but the upload flow was opened from ${parsedTargetHint.replace("_", " ")}.`)
      }

      let reviewData: FinanceImportBatchItem
      if (extracted.target_type === "purchase_invoice") {
        const supplierSuggestions = rankSuggestions(
          extracted.purchase_invoice?.supplier_name_hint || extracted.purchase_invoice?.supplier_name || "",
          context.suppliers.map((supplier) => ({
            id: supplier.id,
            label: supplier.name,
          }))
        )

        const purchaseOrderSuggestions = rankSuggestions(
          extracted.purchase_invoice?.purchase_order_hint || extracted.purchase_invoice?.invoice_number || "",
          context.purchaseOrders.map((po) => ({
            id: po.id,
            label: `${po.po_number} — ${po.supplier_name}`,
          }))
        )

        if (extracted.purchase_invoice?.invoice_number) {
          const { data: duplicates } = await auth.supabase
            .from("purchase_invoices")
            .select("id")
            .eq("invoice_number", extracted.purchase_invoice.invoice_number)
            .limit(1)

          if (duplicates?.length) {
            warnings.push("Possible duplicate purchase invoice number found.")
          }
        }

        reviewData = buildPurchaseDraft({
          extracted,
          fileUrl,
          storagePath,
          supplierSuggestions,
          purchaseOrderSuggestions,
          warnings,
        })
      } else {
        const categorySuggestions = rankSuggestions(
          extracted.expense?.category_name_hint || extracted.expense?.description || "",
          context.expenseCategories.map((category) => ({
            id: category.id,
            label: category.name,
          }))
        )

        const orderSuggestions = rankSuggestions(
          extracted.expense?.order_number_hint || "",
          context.orders.map((order) => ({
            id: order.id,
            label: `${order.order_number} — ${order.product_variant}`,
          }))
        )

        reviewData = buildExpenseDraft({
          extracted,
          fileUrl,
          categorySuggestions,
          orderSuggestions,
          warnings,
        })
      }

      await admin.from("finance_import_items").insert({
        batch_id: batch.id,
        created_by: auth.profile.id,
        target_type: reviewData.target_type,
        status: "pending",
        file_name: file.name,
        file_type: file.type,
        storage_path: storagePath,
        file_url: fileUrl,
        extraction_confidence: extracted.confidence,
        extraction_warnings: warnings,
        extracted_data: extracted,
        review_data: reviewData,
      })
    } catch (error) {
      await admin.from("finance_import_items").insert({
        batch_id: batch.id,
        created_by: auth.profile.id,
        target_type: parsedTargetHint ?? "expense",
        status: "failed",
        file_name: file.name,
        file_type: file.type,
        storage_path: storagePath,
        file_url: fileUrl,
        extraction_error: error instanceof Error ? error.message : "Extraction failed",
      })
    }
  }

  await refreshBatchStatus(admin, batch.id)
  revalidatePath("/finance/import")
  revalidatePath("/finance/purchases")
  revalidatePath("/finance/expenses")

  return { data: { batchId: batch.id } }
}

export async function getFinanceImportBatch(batchId: string) {
  const auth = await requireFinanceUser()
  if ("error" in auth) throw new Error(auth.error)

  const { data: batch, error } = await auth.supabase
    .from("finance_import_batches")
    .select("*, finance_import_items(*)")
    .eq("id", batchId)
    .single()

  if (error) throw new Error(error.message)
  return batch
}

export async function updateFinanceImportItem(
  itemId: string,
  payload: FinanceImportBatchItem
) {
  const auth = await requireFinanceUser()
  if ("error" in auth) return auth

  const parsed = financeImportBatchItemSchema.parse(payload)
  const admin = createAdminClient()

  const { data: item, error: itemError } = await admin
    .from("finance_import_items")
    .select("batch_id")
    .eq("id", itemId)
    .single()

  if (itemError || !item) {
    return { error: itemError?.message ?? "Import item not found" }
  }

  const warnings = parsed.warnings

  const { error } = await admin
    .from("finance_import_items")
    .update({
      target_type: parsed.target_type,
      status: "reviewed",
      review_data: parsed,
      extraction_warnings: warnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)

  if (error) {
    return { error: error.message }
  }

  await refreshBatchStatus(admin, item.batch_id)
  revalidatePath("/finance/import")
  return { success: true }
}

export async function submitFinanceImportItem(itemId: string) {
  const auth = await requireFinanceUser()
  if ("error" in auth) return auth

  const admin = createAdminClient()
  const { data: item, error: itemError } = await admin
    .from("finance_import_items")
    .select("*")
    .eq("id", itemId)
    .single()

  if (itemError || !item) {
    return { error: itemError?.message ?? "Import item not found" }
  }

  const raw = item.review_data || item.extracted_data

  try {
    if (item.target_type === "purchase_invoice") {
      const parsed = purchaseInvoiceImportDraftSchema.parse(raw)
      const result = await createImportedPurchaseInvoice(parsed)
      if ("error" in result && result.error) {
        throw new Error(result.error)
      }

      await admin
        .from("finance_import_items")
        .update({
          status: "submitted",
          created_record_type: "purchase_invoice",
          created_record_id: result.data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
    } else {
      const parsed = expenseImportDraftSchema.parse(raw)
      const result = await createImportedExpense(parsed)
      if ("error" in result && result.error) {
        throw new Error(result.error)
      }

      await admin
        .from("finance_import_items")
        .update({
          status: "submitted",
          created_record_type: "expense",
          created_record_id: result.data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
    }
  } catch (error) {
    await admin
      .from("finance_import_items")
      .update({
        status: "failed",
        extraction_error: error instanceof Error ? error.message : "Submission failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)

    await refreshBatchStatus(admin, item.batch_id)
    revalidatePath("/finance/import")
    return { error: error instanceof Error ? error.message : "Submission failed" }
  }

  await refreshBatchStatus(admin, item.batch_id)
  revalidatePath("/finance/import")
  revalidatePath("/finance/purchases")
  revalidatePath("/finance/expenses")
  return { success: true }
}

export async function submitFinanceImportBatch(batchId: string) {
  const auth = await requireFinanceUser()
  if ("error" in auth) return auth

  const { data: items, error } = await auth.supabase
    .from("finance_import_items")
    .select("id, status")
    .eq("batch_id", batchId)
    .in("status", ["reviewed", "pending"])

  if (error) return { error: error.message }

  const pendingIds = (items ?? [])
    .filter((item) => item.status === "reviewed")
    .map((item) => item.id)

  if (pendingIds.length === 0) {
    return { error: "No reviewed items are ready for submission" }
  }

  for (const itemId of pendingIds) {
    const result = await submitFinanceImportItem(itemId)
    if ("error" in result && result.error) {
      continue
    }
  }

  revalidatePath("/finance/import")
  revalidatePath("/finance/purchases")
  revalidatePath("/finance/expenses")
  return { success: true }
}
