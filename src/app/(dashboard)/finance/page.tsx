import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  Package,
  ShieldCheck,
} from "lucide-react"

import { getFinanceDashboard, getCashFlowData } from "@/actions/finance-reports"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { CashFlowChart } from "@/components/finance/cash-flow-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

function fmtFull(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

export default async function FinanceDashboardPage() {
  const [dashboard, cashFlow] = await Promise.all([
    getFinanceDashboard(),
    getCashFlowData(),
  ])

  const { revenue, expenses, netProfit, receivablesAging, payablesAging, inventoryValue, auditReadiness } = dashboard

  return (
    <>
      <PageHeader
        title="Finance Overview"
        description="Revenue, expenses, cash flow, and compliance at a glance"
        breadcrumbs={[{ label: "Finance" }]}
      />

      {/* Top Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Revenue"
          value={fmt(revenue.invoiced)}
          description={`₹${fmtFull(revenue.received)} received`}
          icon={IndianRupee}
          href="/finance/invoices"
        />
        <StatCard
          title="Outstanding"
          value={fmt(revenue.outstanding)}
          description="Receivables pending"
          icon={TrendingUp}
          href="/finance/reports"
        />
        <StatCard
          title="Expenses"
          value={fmt(expenses.thisMonth)}
          description={`This month${expenses.changePercent !== 0 ? ` (${expenses.changePercent > 0 ? "+" : ""}${expenses.changePercent.toFixed(0)}%)` : ""}`}
          icon={expenses.changePercent > 10 ? TrendingDown : Receipt}
          trend={expenses.lastMonth > 0 ? {
            value: Math.abs(Math.round(expenses.changePercent)),
            positive: expenses.changePercent <= 0,
          } : undefined}
          href="/finance/expenses"
        />
        <StatCard
          title="Net Profit"
          value={fmt(netProfit)}
          description="Revenue − COGS − Expenses"
          icon={Wallet}
          href="/finance/reports"
        />
      </div>

      {/* Aging Summaries */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receivables Aging</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <AgingBucket label="Current" amount={receivablesAging.current} color="text-emerald-600" />
              <AgingBucket label="1-30 days" amount={receivablesAging.thirtyDays} color="text-amber-600" />
              <AgingBucket label="31-60 days" amount={receivablesAging.sixtyDays} color="text-orange-600" />
              <AgingBucket label="90+ days" amount={receivablesAging.ninetyPlus} color="text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payables Aging</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <AgingBucket label="Current" amount={payablesAging.current} color="text-emerald-600" />
              <AgingBucket label="1-30 days" amount={payablesAging.thirtyDays} color="text-amber-600" />
              <AgingBucket label="31-60 days" amount={payablesAging.sixtyDays} color="text-orange-600" />
              <AgingBucket label="90+ days" amount={payablesAging.ninetyPlus} color="text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Cash Flow — Last 6 Months</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={cashFlow} />
        </CardContent>
      </Card>

      {/* Bottom Row: Inventory Value + Audit Readiness */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-6">
        <StatCard
          title="Inventory Value"
          value={fmt(inventoryValue)}
          description="Stock qty × unit cost"
          icon={Package}
          href="/inventory"
        />

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Audit Readiness</p>
                <p className="text-3xl font-bold">
                  {auditReadiness.total > 0
                    ? `${Math.round((auditReadiness.withDocs / auditReadiness.total) * 100)}%`
                    : "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {auditReadiness.withDocs}/{auditReadiness.total} transactions have receipts
                </p>
                {auditReadiness.total > 0 && (
                  <div className="w-full bg-muted rounded-full h-2 mt-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.round((auditReadiness.withDocs / auditReadiness.total) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-accent p-2.5">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function AgingBucket({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>
        {amount > 0 ? fmt(amount) : "—"}
      </p>
    </div>
  )
}
