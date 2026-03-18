import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getTrialBalance } from "@/actions/accounting"
import { TrialBalanceTable } from "@/components/finance/trial-balance-table"
import { TrialBalanceFilters } from "./trial-balance-filters"
import { formatCurrency } from "@/lib/utils"
import { CheckCircle, AlertCircle } from "lucide-react"

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const { rows, totalDebits, totalCredits, balanced } = await getTrialBalance({
    from: params.from,
    to: params.to,
  })

  return (
    <>
      <PageHeader
        title="Trial Balance"
        description="Summary of all account balances — debits must equal credits"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Trial Balance" }]}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <TrialBalanceFilters />
          <div className="flex items-center gap-2">
            {balanced ? (
              <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Balanced
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-600/30 gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Not Balanced — Δ {formatCurrency(Math.abs(totalDebits - totalCredits))}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Debits</p>
              <p className="text-2xl font-bold font-mono">{formatCurrency(totalDebits)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Credits</p>
              <p className="text-2xl font-bold font-mono">{formatCurrency(totalCredits)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <TrialBalanceTable rows={rows} totalDebits={totalDebits} totalCredits={totalCredits} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
