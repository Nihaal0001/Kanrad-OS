import {
  getProfitLoss,
  getGSTSummary,
  getReceivablesAging,
  getPayablesAging,
} from "@/actions/finance-reports"
import { PageHeader } from "@/components/shared/page-header"
import { ReportsDisplay } from "@/components/finance/reports-display"

function resolveDateRange(month?: string, fy?: string): { start: string; end: string; period: string; mode: "month" | "fy" } {
  if (fy) {
    // fy format: "2024-25"
    const [startYearStr] = fy.split("-")
    const startYear = parseInt(startYearStr)
    return {
      start: `${startYear}-04-01`,
      end: `${startYear + 1}-04-01`,
      period: `FY ${fy}`,
      mode: "fy",
    }
  }

  const now = new Date()
  const m = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const [year, mon] = m.split("-").map(Number)
  const nextMonth = new Date(year, mon, 1)
  const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`

  return {
    start: `${m}-01`,
    end,
    period: m,
    mode: "month",
  }
}

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; fy?: string }>
}) {
  const { month: monthParam, fy: fyParam } = await searchParams
  const { start, end, period, mode } = resolveDateRange(monthParam, fyParam)

  const [pl, gst, receivables, payables] = await Promise.all([
    getProfitLoss(start, end),
    getGSTSummary(start, end),
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
      <ReportsDisplay
        period={period}
        mode={mode}
        pl={pl}
        gst={gst}
        receivables={receivables}
        payables={payables}
      />
    </>
  )
}
