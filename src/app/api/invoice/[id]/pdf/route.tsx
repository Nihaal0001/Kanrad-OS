export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { renderToBuffer } from "@react-pdf/renderer"
import { getInvoice } from "@/actions/finance"
import { getOrgSettings } from "@/app/(dashboard)/settings/actions"
import { createClient } from "@/lib/supabase/server"
import { InvoicePDFDocument } from "@/components/finance/invoice-pdf"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  let invoice
  try {
    invoice = await getInvoice(id)
  } catch {
    return new Response("Invoice not found", { status: 404 })
  }

  const org = await getOrgSettings()

  const buffer = await renderToBuffer(
    <InvoicePDFDocument invoice={invoice} org={org} />
  )

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  })
}
