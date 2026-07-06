import { RefreshCw, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from "lucide-react"

import { getTallySyncStatus, getBankLedgerSetting } from "@/actions/tally"
import { PageHeader } from "@/components/shared/page-header"
import { BankLedgerForm } from "@/components/finance/bank-ledger-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDateRelative } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function TallySyncPage() {
  const [status, bankLedger] = await Promise.all([getTallySyncStatus(), getBankLedgerSetting()])

  return (
    <>
      <PageHeader
        title="Tally Sync"
        description="Two-way sync with TallyPrime via the local connector"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Tally Sync" }]}
      />

      {/* Bank ledger — changes most months, so it's editable here instead of a redeploy */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bank Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <BankLedgerForm defaultName={bankLedger} />
          <p className="mt-2 text-xs text-muted-foreground">
            New receipts/payments pushed to Tally post against this ledger. Update it here whenever Tally opens a new one — no redeploy needed.
          </p>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <ArrowDownToLine className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Pulled from Tally</p>
              <p className="text-xl font-bold">{status.balances.length}<span className="ml-1 text-sm font-normal text-muted-foreground">ledgers</span></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <ArrowUpFromLine className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Pushed to Tally</p>
              <p className="text-xl font-bold">{status.push.synced}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  synced{status.push.pending ? ` · ${status.push.pending} pending` : ""}{status.push.error ? ` · ${status.push.error} error` : ""}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Last pull</p>
              <p className="text-xl font-bold">{status.lastPulledAt ? formatDateRelative(status.lastPulledAt) : "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Push errors */}
      {status.recentErrors.length > 0 && (
        <Card className="mb-6 border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Push errors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {status.recentErrors.map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{e.entity_type}</span> — {e.last_error}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Balances pulled from Tally */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ledger Balances from Tally</CardTitle>
        </CardHeader>
        <CardContent>
          {status.balances.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing pulled yet. Run the Tally connector — your Tally ledger balances will appear here.
            </p>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ledger</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Closing Balance</TableHead>
                    <TableHead>As of</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.balances.map((b) => (
                    <TableRow key={b.ledger_name}>
                      <TableCell className="font-medium">{b.ledger_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.parent ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(b.closing_balance)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.as_of ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
