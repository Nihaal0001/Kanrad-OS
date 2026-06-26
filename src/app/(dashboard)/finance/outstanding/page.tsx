import { ArrowDownLeft, ArrowUpRight, Scale, Info } from "lucide-react"

import { getCashflowOutstanding } from "@/actions/tally"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OutstandingChart } from "@/components/finance/outstanding-chart"
import { OutstandingTable } from "@/components/finance/outstanding-table"
import { formatCurrency, formatDateRelative, cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function OutstandingPage() {
  const { bills, totals, isSample, asOf } = await getCashflowOutstanding()
  const net = totals.net

  return (
    <>
      <PageHeader
        title="Cashflow — Receivables & Payables"
        description="Outstanding incoming and outgoing from Tally"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Outstanding" }]}
      />

      {isSample && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          <Info className="h-4 w-4 shrink-0" />
          Showing sample data. Run the Tally connector to pull your real receivables & payables.
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowDownLeft className="h-4 w-4 text-cyan-500" /> Total Incoming
            </div>
            <p className="text-2xl font-bold tabular-nums text-cyan-600">{formatCurrency(totals.incoming)}</p>
            <p className="text-xs text-muted-foreground">receivables</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowUpRight className="h-4 w-4 text-amber-500" /> Total Outgoing
            </div>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{formatCurrency(totals.outgoing)}</p>
            <p className="text-xs text-muted-foreground">payables</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Scale className="h-4 w-4 text-muted-foreground" /> Net Position
            </div>
            <p className={cn("text-2xl font-bold tabular-nums", net >= 0 ? "text-emerald-600" : "text-red-600")}>
              {net < 0 ? "−" : ""}{formatCurrency(Math.abs(net))}
            </p>
            <p className="text-xs text-muted-foreground">{net >= 0 ? "net receivable" : "net payable"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Incoming vs Outgoing</CardTitle>
          {asOf && <span className="text-xs text-muted-foreground">synced {formatDateRelative(asOf)}</span>}
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No outstanding bills.</p>
          ) : (
            <OutstandingChart bills={bills} />
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outstanding Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <OutstandingTable bills={bills} />
        </CardContent>
      </Card>
    </>
  )
}
