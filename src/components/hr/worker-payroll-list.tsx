"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { setWorkerSalaries } from "@/actions/hr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

interface Worker {
  id: string
  full_name: string
  department: string | null
  monthly_salary?: number | string | null
}

export function WorkerPayrollList({ workers }: { workers: Worker[] }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(workers.map((w) => [w.id, Number(w.monthly_salary ?? 0) ? String(Number(w.monthly_salary)) : ""]))
  )
  const [isPending, startTransition] = useTransition()

  const original = (id: string) => Number(workers.find((w) => w.id === id)?.monthly_salary ?? 0)
  const changed = workers.filter((w) => (Number(values[w.id]) || 0) !== original(w.id))

  function handleSave() {
    if (changed.length === 0) {
      toast.info("No changes to save")
      return
    }
    const updates = changed.map((w) => ({ id: w.id, monthly_salary: Math.max(0, Number(values[w.id]) || 0) }))
    startTransition(async () => {
      const result = await setWorkerSalaries(updates)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Saved ${result.updated} salar${result.updated === 1 ? "y" : "ies"}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          No payroll generated yet — set each worker&apos;s monthly salary below, then use{" "}
          <span className="font-medium text-foreground">Generate Payroll</span> or{" "}
          <span className="font-medium text-foreground">New Payroll</span>.
        </p>
        {changed.length > 0 && (
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : `Save ${changed.length}`}
          </Button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-[1.5fr_1fr_160px] gap-4 border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Worker</span>
          <span>Department</span>
          <span className="text-right">Monthly Salary</span>
        </div>
        <div className="divide-y divide-border">
          {workers.map((w) => (
            <div key={w.id} className="grid grid-cols-[1.5fr_1fr_160px] items-center gap-4 px-4 py-2.5">
              <p className="truncate text-sm font-medium">{w.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{w.department ?? "—"}</p>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="h-9 pl-6 text-right"
                  placeholder="0"
                  value={values[w.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [w.id]: e.target.value }))}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
