export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { renderToBuffer } from "@react-pdf/renderer"
import { getPurchaseOrder } from "@/actions/inventory"
import { getOrgSettings } from "@/app/(dashboard)/settings/actions"
import { createClient } from "@/lib/supabase/server"
import { PurchaseOrderPDFDocument } from "@/components/inventory/purchase-order-pdf"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  let po
  try {
    po = await getPurchaseOrder(id)
  } catch {
    return new Response("Purchase order not found", { status: 404 })
  }

  const org = await getOrgSettings()

  const buffer = await renderToBuffer(
    <PurchaseOrderPDFDocument po={po} org={org} />
  )

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${po.po_number}.pdf"`,
    },
  })
}
