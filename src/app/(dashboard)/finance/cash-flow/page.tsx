import { TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react"

import { getCashFlowStatement } from "@/actions/finance-reports"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { CashFlowChart } from "@/components/finance/cash-flow-chart"
import { CashFlowTable } from "@/components/finance/cash-flow-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function fmt(n: number) {
  if (Math.abs(n) >= 100000) return `₹${(Math.abs(n) / 100000).toFixed(2)}L`
  if (Math.abs(n) >= 1000) return `₹${(Math.abs(n) / 1000).toFixed(1)}K`
  return `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

export default async function CashFlowPage() {
  const rows = await getCashFlowStatement()

  const totalInflow = rows.reduce((s, r) => s + r.inflow, 0)
  const totalOutflow = rows.reduce((s, r) => s + r.outflow, 0)
  const netCashFlow = totalInflow - totalOutflow

  const chartData = rows.map((r) => ({ month: r.month, inflow: r.inflow, outflow: r.outflow }))

  return (
    <>
      <PageHeader
        title="Cash Flow"
        description="12-month statement of cash inflows and outflows"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Cash Flow" }]}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-6">
        <StatCard
          title="Total Inflow"
          value={fmt(totalInflow)}
          description="Sales receipts (last 12 months)"
          icon={TrendingUp}
          href="/finance/payments"
        />
        <StatCard
          title="Total Outflow"
          value={fmt(totalOutflow)}
          description="Purchases + expenses (last 12 months)"
          icon={TrendingDown}
          href="/finance/expenses"
        />
        <StatCard
          title="Net Cash Flow"
          value={(netCashFlow < 0 ? "−" : "") + fmt(netCashFlow)}
          description="Inflow minus outflow"
          icon={ArrowLeftRight}
          href="/finance/reports"
        />
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Monthly Cash Flow — Last 12 Months</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={chartData} />
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowTable rows={rows} />
        </CardContent>
      </Card>
    </>
  )
}
