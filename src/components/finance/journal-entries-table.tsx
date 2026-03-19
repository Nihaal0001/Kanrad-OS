"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteJournalEntry } from "@/actions/accounting"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"

const REF_COLORS: Record<string, string> = {
  invoice: "text-blue-600 border-blue-600/30",
  payment: "text-emerald-600 border-emerald-600/30",
  expense: "text-amber-600 border-amber-600/30",
  purchase_invoice: "text-purple-600 border-purple-600/30",
  purchase_payment: "text-pink-600 border-pink-600/30",
  manual: "text-gray-600 border-gray-600/30",
}

const REF_LABELS: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment",
  expense: "Expense",
  purchase_invoice: "Purchase",
  purchase_payment: "Purch. Payment",
  manual: "Manual",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EntryRow({ entry, canDeleteEntries }: { entry: any; canDeleteEntries: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const lines = entry.journal_entry_lines ?? []
  const totalDebit = lines.reduce((s: number, l: { debit: number }) => s + Number(l.debit), 0)
  const totalCredit = lines.reduce((s: number, l: { credit: number }) => s + Number(l.credit), 0)

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteJournalEntry(entry.id)
    setDeleting(false)
    setConfirmOpen(false)

    if (result && "error" in result && result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Journal entry deleted")
  }

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => setExpanded((p) => !p)}>
        <TableCell className="w-8 pr-0">
          <Button variant="ghost" size="icon" className="h-6 w-6 pointer-events-none">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {entry.entry_date ? format(new Date(entry.entry_date), "dd MMM yyyy") : "—"}
        </TableCell>
        <TableCell className="text-sm max-w-[280px]">
          <span className="line-clamp-1">{entry.description}</span>
        </TableCell>
        <TableCell>
          {entry.reference_type && (
            <Badge variant="outline" className={`text-xs ${REF_COLORS[entry.reference_type] ?? ""}`}>
              {REF_LABELS[entry.reference_type] ?? entry.reference_type}
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-right text-sm font-mono">
          {formatCurrency(totalDebit)}
        </TableCell>
        <TableCell className="text-right text-sm font-mono">
          {formatCurrency(totalCredit)}
        </TableCell>
        {canDeleteEntries && (
          <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={deleting}
              onClick={() => setConfirmOpen(true)}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
            </Button>
          </TableCell>
        )}
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/20">
          <TableCell />
          <TableCell colSpan={canDeleteEntries ? 6 : 5} className="py-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left pb-1 pr-4 font-medium">Account</th>
                  <th className="text-left pb-1 pr-4 font-medium">Description</th>
                  <th className="text-right pb-1 pr-4 font-medium">Debit</th>
                  <th className="text-right pb-1 font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: { id: string; account_code: string; account: { name: string } | null; description: string | null; debit: number; credit: number }) => (
                  <tr key={line.id} className="border-t border-border/50">
                    <td className="py-1 pr-4 font-mono">
                      {line.account_code}
                      {line.account && <span className="ml-1.5 font-sans text-muted-foreground">{line.account.name}</span>}
                    </td>
                    <td className="py-1 pr-4 text-muted-foreground">{line.description ?? "—"}</td>
                    <td className="py-1 pr-4 text-right font-mono">
                      {Number(line.debit) > 0 ? formatCurrency(line.debit) : ""}
                    </td>
                    <td className="py-1 text-right font-mono">
                      {Number(line.credit) > 0 ? formatCurrency(line.credit) : ""}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="pt-1 pr-4 text-muted-foreground" colSpan={2}>Total</td>
                  <td className="pt-1 pr-4 text-right font-mono">{formatCurrency(totalDebit)}</td>
                  <td className="pt-1 text-right font-mono">{formatCurrency(totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </TableCell>
        </TableRow>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Journal Entry"
        description="Are you sure you want to delete this journal entry? This only removes the accounting entry and does not delete the original invoice, payment, or expense."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function JournalEntriesTable({ entries, canDeleteEntries = false }: { entries: any[]; canDeleteEntries?: boolean }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">No journal entries found.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Journal entries are created automatically when invoices are sent, payments are recorded, or expenses are logged.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-8" />
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs text-right">Debit</TableHead>
            <TableHead className="text-xs text-right">Credit</TableHead>
            {canDeleteEntries && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} canDeleteEntries={canDeleteEntries} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
