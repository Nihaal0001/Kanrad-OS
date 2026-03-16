import {
  getProfitLoss,
  getGSTSummary,
  getReceivablesAging,
  getPayablesAging,
} from "@/actions/finance-reports"
import { PageHeader } from "@/components/shared/page-header"
import { ReportsDisplay } from "@/components/finance/reports-display"

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthParam } = await searchParams
  const now = new Date()
  const month =
    monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [pl, gst, receivables, payables] = await Promise.all([
    getProfitLoss(month),
    getGSTSummary(month),
    getReceivablesAging(),
    getPayablesAging(),
  ])

  return (
    <>
      <PageHeader
        title="Finance Reports"
        description="P&L, GST summary, receivables and payables aging"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Reports" }]}
      />
      <ReportsDisplay month={month} pl={pl} gst={gst} receivables={receivables} payables={payables} />
    </>
  )
}
