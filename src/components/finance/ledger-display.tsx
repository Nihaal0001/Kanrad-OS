import { format } from "date-fns"
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
import type { LedgerEntry } from "@/lib/supabase/types"

const REF_LABELS: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment",
  expense: "Expense",
  purchase_invoice: "Purchase",
  purchase_payment: "Purch. Pay.",
  manual: "Manual",
}

const REF_COLORS: Record<string, string> = {
  invoice: "text-blue-600 border-blue-600/30",
  payment: "text-emerald-600 border-emerald-600/30",
  expense: "text-amber-600 border-amber-600/30",
  purchase_invoice: "text-purple-600 border-purple-600/30",
  purchase_payment: "text-pink-600 border-pink-600/30",
  manual: "text-gray-600 border-gray-600/30",
}

interface LedgerDisplayProps {
  entries: LedgerEntry[]
  accountType: string
}

export function LedgerDisplay({ entries, accountType }: LedgerDisplayProps) {
  const debitNormal = ["asset", "cogs", "expense"].includes(accountType)

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No transactions for this account yet.</p>
      </div>
    )
  }

  const finalBalance = entries[entries.length - 1]?.running_balance ?? 0

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs text-right">Debit</TableHead>
            <TableHead className="text-xs text-right">Credit</TableHead>
            <TableHead className="text-xs text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, i) => (
            <TableRow key={`${entry.journal_entry_id}-${i}`}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {entry.entry_date ? format(new Date(entry.entry_date), "dd MMM yyyy") : "—"}
              </TableCell>
              <TableCell className="text-sm max-w-[240px]">
                <span className="line-clamp-1">{entry.description}</span>
              </TableCell>
              <TableCell>
                {entry.reference_type && (
                  <Badge variant="outline" className={`text-xs ${REF_COLORS[entry.reference_type] ?? ""}`}>
                    {REF_LABELS[entry.reference_type] ?? entry.reference_type}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-medium">
                {formatCurrency(Math.abs(entry.running_balance))}
                {" "}
                <span className="text-xs text-muted-foreground">
                  {entry.running_balance >= 0 ? (debitNormal ? "Dr" : "Cr") : (debitNormal ? "Cr" : "Dr")}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end gap-2 border-t border-border px-4 py-3 bg-muted/20">
        <span className="text-sm text-muted-foreground">Closing Balance:</span>
        <span className="text-sm font-bold font-mono">
          {formatCurrency(Math.abs(finalBalance))}
          {" "}
          <span className="font-normal text-muted-foreground text-xs">
            {finalBalance >= 0 ? (debitNormal ? "Dr" : "Cr") : (debitNormal ? "Cr" : "Dr")}
          </span>
        </span>
      </div>
    </div>
  )
}
