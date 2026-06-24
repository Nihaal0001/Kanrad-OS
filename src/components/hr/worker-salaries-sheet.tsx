"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IndianRupee } from "lucide-react"
import { toast } from "sonner"

import { setWorkerSalaries } from "@/actions/hr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Worker {
  id: string
  full_name: string
  department: string | null
  monthly_salary?: number | string | null
}

export function WorkerSalariesSheet({ workers }: { workers: Worker[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function handleOpen(next: boolean) {
    if (next) {
      // seed inputs with current salaries
      setValues(Object.fromEntries(workers.map((w) => [w.id, String(Number(w.monthly_salary ?? 0) || "")])))
    }
    setOpen(next)
  }

  function handleSave() {
    const updates = workers
      .map((w) => ({ id: w.id, monthly_salary: Math.max(0, Number(values[w.id]) || 0) }))
      .filter((u) => u.monthly_salary !== Number(workers.find((w) => w.id === u.id)?.monthly_salary ?? 0))

    if (updates.length === 0) {
      toast.info("No changes to save")
      return
    }
    startTransition(async () => {
      const result = await setWorkerSalaries(updates)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Saved ${result.updated} salar${result.updated === 1 ? "y" : "ies"}`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <IndianRupee className="h-4 w-4" />
          Set Salaries
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle>Monthly Salaries</DialogTitle>
          <DialogDescription>
            Set each worker&apos;s fixed monthly salary. Payroll converts it to a daily rate
            (monthly ÷ working days) and pays for days present.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto divide-y divide-border">
          {workers.map((w) => (
            <div key={w.id} className="flex items-center gap-3 px-6 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{w.full_name}</p>
                {w.department && <p className="truncate text-xs text-muted-foreground">{w.department}</p>}
              </div>
              <div className="relative w-32 shrink-0">
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

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
