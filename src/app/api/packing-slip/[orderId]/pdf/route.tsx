export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { renderToBuffer } from "@react-pdf/renderer"
import { getOrder } from "@/actions/orders"
import { getOrgSettings } from "@/app/(dashboard)/settings/actions"
import { createClient } from "@/lib/supabase/server"
import { PackingSlipPDFDocument } from "@/components/orders/packing-slip-pdf"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  let order
  try {
    order = await getOrder(orderId)
  } catch {
    return new Response("Order not found", { status: 404 })
  }

  const org = await getOrgSettings()

  const buffer = await renderToBuffer(
    <PackingSlipPDFDocument order={order} org={org} />
  )

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.order_number}-packing-slip.pdf"`,
    },
  })
}
