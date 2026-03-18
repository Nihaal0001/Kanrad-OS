import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import type { TrialBalanceRow } from "@/lib/supabase/types"

const TYPE_COLORS: Record<string, string> = {
  asset: "text-blue-600 border-blue-600/30",
  liability: "text-red-600 border-red-600/30",
  equity: "text-purple-600 border-purple-600/30",
  revenue: "text-emerald-600 border-emerald-600/30",
  cogs: "text-amber-600 border-amber-600/30",
  expense: "text-orange-600 border-orange-600/30",
}

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "cogs", "expense"]

interface TrialBalanceTableProps {
  rows: TrialBalanceRow[]
  totalDebits: number
  totalCredits: number
}

export function TrialBalanceTable({ rows, totalDebits, totalCredits }: TrialBalanceTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No journal entries recorded yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Entries are created automatically when invoices, payments, and expenses are recorded.
        </p>
      </div>
    )
  }

  // Group by type
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    rows: rows.filter((r) => r.type === type),
  })).filter((g) => g.rows.length > 0)

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40">
          <TableHead className="text-xs w-24">Code</TableHead>
          <TableHead className="text-xs">Account Name</TableHead>
          <TableHead className="text-xs">Type</TableHead>
          <TableHead className="text-xs text-right">Debit</TableHead>
          <TableHead className="text-xs text-right">Credit</TableHead>
          <TableHead className="text-xs text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grouped.map((group) => (
          <>
            {group.rows.map((row) => (
              <TableRow key={row.account_code}>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.account_code}</TableCell>
                <TableCell className="text-sm">{row.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs capitalize ${TYPE_COLORS[row.type] ?? ""}`}>
                    {row.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {row.total_debit > 0 ? formatCurrency(row.total_debit) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {row.total_credit > 0 ? formatCurrency(row.total_credit) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">
                  {formatCurrency(Math.abs(row.balance))}
                  {" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {row.balance >= 0
                      ? ["asset", "cogs", "expense"].includes(row.type) ? "Dr" : "Cr"
                      : ["asset", "cogs", "expense"].includes(row.type) ? "Cr" : "Dr"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </>
        ))}

        {/* Totals row */}
        <TableRow className="border-t-2 border-border bg-muted/30 font-bold">
          <TableCell colSpan={3} className="text-sm">Grand Total</TableCell>
          <TableCell className="text-right font-mono text-sm">{formatCurrency(totalDebits)}</TableCell>
          <TableCell className="text-right font-mono text-sm">{formatCurrency(totalCredits)}</TableCell>
          <TableCell className="text-right font-mono text-sm">
            {Math.abs(totalDebits - totalCredits) < 0.01
              ? <span className="text-emerald-600">Balanced ✓</span>
              : <span className="text-red-600">Δ {formatCurrency(Math.abs(totalDebits - totalCredits))}</span>
            }
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
