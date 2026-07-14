import { renderToBuffer } from "@react-pdf/renderer"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrgSettings } from "@/app/(dashboard)/settings/actions"
import { getPurchaseOrder } from "@/actions/inventory"
import { PurchaseOrderPDFDocument } from "@/components/inventory/purchase-order-pdf"
import { sendPurchaseOrderCopy } from "@/lib/email"

/** Emails the PO PDF to Karthik, Savitha, and the supplier (if their email is on file). */
export async function emailPurchaseOrderCopy(id: string) {
  const admin = createAdminClient()
  const po = await getPurchaseOrder(id)
  const org = await getOrgSettings()

  const { data: settingsRow } = await admin.from("app_settings").select("value").eq("key", "po_notify_emails").maybeSingle()
  const notify = (settingsRow?.value as { karthik?: string; savitha?: string } | null) ?? {}

  let supplierEmail: string | null = null
  if (po.supplier_id) {
    const { data: supplier } = await admin.from("suppliers").select("email").eq("id", po.supplier_id).maybeSingle()
    supplierEmail = supplier?.email?.trim() || null
  }

  const to = [notify.karthik, notify.savitha, supplierEmail].filter((e): e is string => !!e)
  if (to.length === 0) return

  const pdfBuffer = await renderToBuffer(<PurchaseOrderPDFDocument po={po} org={org} />)

  await sendPurchaseOrderCopy({
    to,
    poNumber: po.po_number,
    supplierName: po.supplier_name,
    totalAmount: po.total_amount,
    expectedDate: po.expected_date,
    pdfBuffer: Buffer.from(pdfBuffer),
  })
}
