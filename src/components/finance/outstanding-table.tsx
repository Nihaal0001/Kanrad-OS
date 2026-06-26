"use client"

import { useState } from "react"
import { ArrowUpDown, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OutstandingBill } from "@/lib/tally/outstanding"

type Filter = "all" | "incoming" | "outgoing"
type SortKey = "amount" | "due_date"

function status(due: string | null): { label: string; cls: string; rank: number } {
  if (!due) return { label: "Upcoming", cls: "border-muted-foreground/40 text-muted-foreground", rank: 2 }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((new Date(due).getTime() - today.getTime()) / 86400000)
  if (days < 0) return { label: "Overdue", cls: "border-red-500 text-red-600", rank: 0 }
  if (days <= 7) return { label: "Due Soon", cls: "border-amber-500 text-amber-600", rank: 1 }
  return { label: "Upcoming", cls: "border-emerald-500 text-emerald-600", rank: 2 }
}

export function OutstandingTable({ bills }: { bills: OutstandingBill[] }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [sortKey, setSortKey] = useState<SortKey>("due_date")
  const [asc, setAsc] = useState(true)

  const rows = bills
    .filter((b) => filter === "all" || b.type === filter)
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "amount") cmp = a.amount - b.amount
      else cmp = (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
      return asc ? cmp : -cmp
    })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc((v) => !v)
    else { setSortKey(key); setAsc(true) }
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Both" },
    { key: "incoming", label: "Incoming" },
    { key: "outgoing", label: "Outgoing" },
  ]

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-border p-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              filter === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Party</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead className="text-right">
                <button className="inline-flex items-center gap-1" onClick={() => toggleSort("amount")}>
                  Amount <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button className="inline-flex items-center gap-1" onClick={() => toggleSort("due_date")}>
                  Due Date <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  No bills.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((b, i) => {
                const st = status(b.due_date)
                return (
                  <TableRow key={i} className={cn(st.rank === 0 && "bg-red-500/5")}>
                    <TableCell className="font-medium">{b.party}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1 text-xs font-medium", b.type === "incoming" ? "text-cyan-600" : "text-amber-600")}>
                        {b.type === "incoming" ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                        {b.type === "incoming" ? "Incoming" : "Outgoing"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{b.bill_ref ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(b.amount)}</TableCell>
                    <TableCell className="text-sm">{b.due_date ? formatDate(b.due_date) : "—"}</TableCell>
                    <TableCell>
                      <span className={cn("rounded-full border bg-transparent px-2 py-0.5 text-xs font-medium", st.cls)}>{st.label}</span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
