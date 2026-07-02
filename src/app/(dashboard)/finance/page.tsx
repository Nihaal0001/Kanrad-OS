import {
  IndianRupee,
  TrendingUp,
  Receipt,
  Wallet,
  Package,
  ShieldCheck,
  ShoppingCart,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"

import { getFinanceDashboard } from "@/actions/finance-reports"
import { getPOPipeline } from "@/actions/finance-reports"
import { getTallyFinanceDashboard } from "@/actions/tally"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { CashFlowChart } from "@/components/finance/cash-flow-chart"
import { TradeTrendChart } from "@/components/finance/trade-trend-chart"
import { ExpenseBreakdownChart } from "@/components/finance/expense-breakdown-chart"
import { TopPartiesCard } from "@/components/finance/top-parties-card"
import { TallySourceBadge } from "@/components/finance/tally-source-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

function fmt(n: number) {
  const sign = n < 0 ? "−" : ""
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`
  return `${sign}₹${abs.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

export default async function FinanceDashboardPage() {
  const [tally, dashboard, poPipeline] = await Promise.all([
    getTallyFinanceDashboard(),
    getFinanceDashboard(),
    getPOPipeline(),
  ])

  const { stats, outstanding } = tally
  const { inventoryValue, auditReadiness } = dashboard

  // Tally aging when synced; ERP aging as fallback for real (non-sample) gaps
  const hasTallyAging = Object.values(tally.receivablesAging).some((v) => v > 0) || Object.values(tally.payablesAging).some((v) => v > 0)
  const receivablesAging = hasTallyAging || tally.isSample ? tally.receivablesAging : dashboard.receivablesAging
  const payablesAging = hasTallyAging || tally.isSample ? tally.payablesAging : dashboard.payablesAging

  return (
    <>
      <PageHeader
        title="Finance Overview"
        description="Accounts from Tally — sales, purchases, expenses, and cash at a glance"
        breadcrumbs={[{ label: "Finance" }]}
      />

      <TallySourceBadge isSample={tally.isSample} lastSyncedAt={tally.lastSyncedAt} />

      {/* Top Stats — last 12 months from Tally vouchers */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Revenue"
          value={fmt(stats.revenue12m)}
          description="Sales, last 12 months"
          icon={IndianRupee}
          href="/finance/invoices"
        />
        <StatCard
          title="Money Received"
          value={fmt(stats.received12m)}
          description={`Receipts · ${fmt(outstanding.incoming)} still due`}
          icon={TrendingUp}
          href="/finance/outstanding"
        />
        <StatCard
          title="Purchases"
          value={fmt(stats.purchases12m)}
          description={`Last 12 months · ${fmt(outstanding.outgoing)} payable`}
          icon={Receipt}
          href="/finance/purchases"
        />
        <StatCard
          title="Net Cash"
          value={fmt(stats.netCash12m)}
          description="Received − paid, 12 months"
          icon={Wallet}
          href="/finance/cash-flow"
        />
      </div>

      {/* Money movement */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Money In vs Money Out</CardTitle>
            <Link
              href="/finance/cash-flow"
              className="flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Details <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={tally.monthlyFlow} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales vs Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <TradeTrendChart data={tally.monthlyTrade} />
          </CardContent>
        </Card>
      </div>

      {/* Where money goes + who it comes from */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by Group</CardTitle>
            <p className="text-xs text-muted-foreground">Tally ledger groups</p>
          </CardHeader>
          <CardContent>
            <ExpenseBreakdownChart data={tally.expenseBreakdown} />
          </CardContent>
        </Card>

        <TopPartiesCard
          title="Top Customers"
          description="By money received, last 12 months"
          entries={tally.topCustomers}
          variant="incoming"
        />
        <TopPartiesCard
          title="Top Suppliers"
          description="By payments made, last 12 months"
          entries={tally.topSuppliers}
          variant="outgoing"
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
              <AgingBucket label="60+ days" amount={receivablesAging.ninetyPlus} color="text-red-600" />
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
              <AgingBucket label="60+ days" amount={payablesAging.ninetyPlus} color="text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: PO Pipeline + Inventory Value + Audit Readiness */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 mb-6">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Purchase Orders</p>
                <p className="text-3xl font-bold">{poPipeline.openCount}</p>
                <p className="text-sm text-muted-foreground">
                  open · {fmt(poPipeline.committedAmount)} committed
                </p>
                <p className="text-xs text-muted-foreground">
                  {poPipeline.counts.draft} draft · {poPipeline.counts.sent} sent · {poPipeline.counts.partial} partial · {poPipeline.counts.received} received
                </p>
                <Link
                  href="/inventory/purchase-orders"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  View POs <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="rounded-lg bg-accent p-2.5">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <StatCard
          title="Inventory Value"
          value={fmt(inventoryValue)}
          description="Stock qty × unit cost"
          icon={Package}
          href="/inventory"
        />

        <Card>
          <CardContent className="p-5 sm:p-6">
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
