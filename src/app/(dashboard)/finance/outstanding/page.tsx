import nextDynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react"

import { getCashflowOutstanding } from "@/actions/finance-overview"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
const OutstandingChart = nextDynamic(() => import("@/components/finance/outstanding-chart").then((m) => m.OutstandingChart), {
  loading: () => <Skeleton className="h-72 w-full rounded-xl" />,
})
import { OutstandingTable } from "@/components/finance/outstanding-table"
import { formatCurrency, formatDateRelative, cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function OutstandingPage() {
  const { bills, totals, asOf } = await getCashflowOutstanding()
  const net = totals.net

  return (
    <>
      <PageHeader
        title="Cashflow — Receivables & Payables"
        description="Unpaid customer invoices and supplier bills"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Outstanding" }]}
      />

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
