"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { setWorkerSalaries } from "@/actions/hr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const router = useRouter()
  const { workingDays, rows } = data
  const [filter, setFilter] = useState<Filter>("all")
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.monthly_salary ? String(r.monthly_salary) : ""]))
  )
  const [isPending, startTransition] = useTransition()

  const salaryOf = (id: string) => Math.max(0, Number(values[id]) || 0)
  const payableOf = (r: Row) => (workingDays > 0 ? Math.round((salaryOf(r.id) / workingDays) * r.days_present) : 0)

  const visible = rows.filter((r) => filter === "all" || r.role === filter)
  const changed = rows.filter((r) => salaryOf(r.id) !== r.monthly_salary)
  const totalPayable = visible.reduce((s, r) => s + payableOf(r), 0)

  function handleSave() {
    if (changed.length === 0) {
      toast.info("No changes to save")
      return
    }
    startTransition(async () => {
      const result = await setWorkerSalaries(changed.map((r) => ({ id: r.id, monthly_salary: salaryOf(r.id) })))
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Saved ${result.updated} salar${result.updated === 1 ? "y" : "ies"}`)
      router.refresh()
    })
  }

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
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{workingDays} working days · salary paid for days present</span>
          {changed.length > 0 && (
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : `Save ${changed.length}`}
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className={cn("grid gap-3 border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground", COLS)}>
          <span>No.</span>
          <span>Worker</span>
          <span className="text-right">Monthly Salary</span>
          <span className="text-right">Present</span>
          <span className="text-right">Absent</span>
          <span className="text-right">Payable</span>
        </div>
        <div className="divide-y divide-border">
          {visible.map((r) => (
            <div key={r.id} className={cn("grid items-center gap-3 px-4 py-2", COLS)}>
              <span className="text-sm tabular-nums text-muted-foreground">{r.roll_no ?? "—"}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.full_name}</p>
                {r.role && <p className="truncate text-xs text-muted-foreground">{r.role}</p>}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="h-9 pl-6 text-right"
                  placeholder="0"
                  value={values[r.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                />
              </div>
              <span className="text-right text-sm tabular-nums text-emerald-600">{r.days_present}</span>
              <span className="text-right text-sm tabular-nums text-muted-foreground">{r.days_absent}</span>
              <span className="text-right text-sm font-semibold tabular-nums">₹{fmt(payableOf(r))}</span>
            </div>
          ))}
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
