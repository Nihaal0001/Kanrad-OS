"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Row {
  id: string
  roll_no: number | null
  full_name: string
  role: string | null
  monthly_salary: number
  days_present: number
  days_absent: number
  payable: number
}

interface RegisterData {
  month: string
  workingDays: number
  rows: Row[]
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
}

const COLS = "grid-cols-[44px_1.4fr_1fr_64px_64px_1fr]"
type Filter = "all" | "Operator" | "Helper"

export function WorkerPayrollList({ data }: { data: RegisterData }) {
  const { workingDays, rows } = data
  const [filter, setFilter] = useState<Filter>("all")

  const visible = rows.filter((r) => filter === "all" || r.role === filter)
  const totalPayable = visible.reduce((s, r) => s + r.payable, 0)

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "Operator", label: "Operators" },
    { key: "Helper", label: "Helpers" },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <span className="text-xs text-muted-foreground">
          {workingDays} working days · set salaries via “Set Salaries”
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        {/* Bounded height + its own scroll so the sticky header freezes
            reliably across browsers, instead of depending on page scroll. */}
        <div className="max-h-[calc(100vh-260px)] overflow-auto">
          <div className={cn("sticky top-0 z-10 grid gap-3 border-b bg-card px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground shadow-[0_1px_0_0] shadow-border", COLS)}>
            <span>No.</span>
            <span>Worker</span>
            <span className="text-right">Monthly Salary</span>
            <span className="text-right">Present</span>
            <span className="text-right">Absent</span>
            <span className="text-right">Payable</span>
          </div>
          <div className="divide-y divide-border">
            {visible.map((r) => (
              <div key={r.id} className={cn("grid items-center gap-3 px-4 py-2.5", COLS)}>
                <span className="text-sm tabular-nums text-muted-foreground">{r.roll_no ?? "—"}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.full_name}</p>
                  {r.role && <p className="truncate text-xs text-muted-foreground">{r.role}</p>}
                </div>
                <span className="text-right text-sm tabular-nums">
                  {r.monthly_salary > 0 ? `₹${fmt(r.monthly_salary)}` : <span className="text-muted-foreground">—</span>}
                </span>
                <span className="text-right text-sm tabular-nums text-emerald-600">{r.days_present}</span>
                <span className="text-right text-sm tabular-nums text-muted-foreground">{r.days_absent}</span>
                <span className="text-right text-sm font-semibold tabular-nums">₹{fmt(r.payable)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={cn("grid items-center gap-3 border-t bg-muted/40 px-4 py-2.5 text-sm font-semibold", COLS)}>
          <span />
          <span>Total ({visible.length})</span>
          <span />
          <span />
          <span />
          <span className="text-right tabular-nums">₹{fmt(totalPayable)}</span>
        </div>
      </Card>
    </div>
  )
}
