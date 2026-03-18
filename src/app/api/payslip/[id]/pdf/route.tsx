export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { renderToBuffer } from "@react-pdf/renderer"
import { getPayroll } from "@/actions/hr"
import { getOrgSettings } from "@/app/(dashboard)/settings/actions"
import { createClient } from "@/lib/supabase/server"
import { PayslipPDFDocument } from "@/components/hr/payslip-pdf"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  let payroll
  try {
    payroll = await getPayroll(id)
  } catch {
    return new Response("Payroll record not found", { status: 404 })
  }

  const org = await getOrgSettings()

  const buffer = await renderToBuffer(
    <PayslipPDFDocument payroll={payroll} org={org} />
  )

  const workerName = (payroll.worker?.full_name ?? "payslip").replace(/\s+/g, "-").toLowerCase()
  const filename = `payslip-${workerName}-${payroll.period_start}.pdf`

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
