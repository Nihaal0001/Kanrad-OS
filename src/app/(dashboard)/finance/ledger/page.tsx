import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getChartOfAccounts, getLedger } from "@/actions/accounting"
import { LedgerDisplay } from "@/components/finance/ledger-display"
import { LedgerAccountSelector } from "./ledger-account-selector"

const TYPE_COLORS: Record<string, string> = {
  asset: "text-blue-600 border-blue-600/30",
  liability: "text-red-600 border-red-600/30",
  equity: "text-purple-600 border-purple-600/30",
  revenue: "text-emerald-600 border-emerald-600/30",
  cogs: "text-amber-600 border-amber-600/30",
  expense: "text-orange-600 border-orange-600/30",
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const accounts = await getChartOfAccounts()
  const nonHeaderAccounts = accounts.filter((a) => !a.is_header)

  const selectedCode = params.account ?? "1100"

  let ledgerData: Awaited<ReturnType<typeof getLedger>> | null = null
  try {
    ledgerData = await getLedger(selectedCode, { from: params.from, to: params.to })
  } catch {
    // Account not found or no data
  }

  return (
    <>
      <PageHeader
        title="Account Ledger"
        description="View all transactions for a specific account — running balance by date"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Ledger" }]}
      />

      <div className="space-y-4">
        <LedgerAccountSelector accounts={nonHeaderAccounts} />

        {ledgerData && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{ledgerData.account.account_code}</p>
                    <CardTitle className="text-lg">{ledgerData.account.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className={`capitalize ${TYPE_COLORS[ledgerData.account.type] ?? ""}`}>
                    {ledgerData.account.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <LedgerDisplay entries={ledgerData.entries} accountType={ledgerData.account.type} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
