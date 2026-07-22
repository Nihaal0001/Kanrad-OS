import { RefreshCw, ArrowDownToLine } from "lucide-react"

import { getTallySyncStatus } from "@/actions/tally"
import { PageHeader } from "@/components/shared/page-header"
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
  const status = await getTallySyncStatus()

  return (
    <>
      <PageHeader
        title="Tally Sync"
        description="Read-only sync from TallyPrime via the local connector — Kanrad never writes back to Tally"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Tally Sync" }]}
      />

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
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
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Last pull</p>
              <p className="text-xl font-bold">{status.lastPulledAt ? formatDateRelative(status.lastPulledAt) : "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
