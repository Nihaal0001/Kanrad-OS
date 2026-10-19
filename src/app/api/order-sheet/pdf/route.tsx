export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { renderToBuffer } from "@react-pdf/renderer"
import { createClient } from "@/lib/supabase/server"
import { OrderSheetPDFDocument } from "@/components/orders/order-sheet-pdf"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const buffer = await renderToBuffer(<OrderSheetPDFDocument />)
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="order-sheet.pdf"',
    },
  })
}
