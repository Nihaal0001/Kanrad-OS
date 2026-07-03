"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IndianRupee } from "lucide-react"
import { toast } from "sonner"

import { setWorkerSalaries, setWorkerGenderAndOT } from "@/actions/hr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"

type Gender = "male" | "female" | null

interface Worker {
  id: string
  full_name: string
  department: string | null
  monthly_salary?: number | string | null
  gender?: string | null
  ot_rate?: number | string | null
}

export function WorkerSalariesSheet({ workers }: { workers: Worker[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [genders, setGenders] = useState<Record<string, Gender>>({})
  const [otRates, setOtRates] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function handleOpen(next: boolean) {
    if (next) {
      // seed inputs with current values
      setValues(Object.fromEntries(workers.map((w) => [w.id, String(Number(w.monthly_salary ?? 0) || "")])))
      setGenders(Object.fromEntries(workers.map((w) => [w.id, (w.gender as Gender) ?? null])))
      setOtRates(Object.fromEntries(workers.map((w) => [w.id, String(Number(w.ot_rate ?? 0) || "")])))
    }
    setOpen(next)
  }

  function handleSave() {
    const salaryUpdates = workers
      .map((w) => ({ id: w.id, monthly_salary: Math.max(0, Number(values[w.id]) || 0) }))
      .filter((u) => u.monthly_salary !== Number(workers.find((w) => w.id === u.id)?.monthly_salary ?? 0))

    const genderOtUpdates = workers
      .map((w) => ({
        id: w.id,
        gender: genders[w.id] ?? null,
        ot_rate: Math.max(0, Number(otRates[w.id]) || 0),
      }))
      .filter((u) => {
        const orig = workers.find((w) => w.id === u.id)
        return u.gender !== ((orig?.gender as Gender) ?? null) || u.ot_rate !== Number(orig?.ot_rate ?? 0)
      })

    if (salaryUpdates.length === 0 && genderOtUpdates.length === 0) {
      toast.info("No changes to save")
      return
    }
    startTransition(async () => {
      const results = await Promise.all([
        salaryUpdates.length > 0 ? setWorkerSalaries(salaryUpdates) : Promise.resolve({ updated: 0 }),
        genderOtUpdates.length > 0 ? setWorkerGenderAndOT(genderOtUpdates) : Promise.resolve({ updated: 0 }),
      ])
      const errored = results.find((r) => "error" in r)
      if (errored && "error" in errored) {
        toast.error(errored.error)
        return
      }
      const totalUpdated = Math.max(salaryUpdates.length, genderOtUpdates.length)
      toast.success(`Saved ${totalUpdated} worker${totalUpdated === 1 ? "" : "s"}`)
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
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle>Salary, Gender & Overtime</DialogTitle>
          <DialogDescription>
            Monthly salary converts to a daily rate (monthly ÷ working days) and pays for days
            present. Shift window is 8am-6pm for men and 8am-5pm for women — time worked outside
            that window counts as overtime, paid at each worker&apos;s ₹/hour OT rate.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {workers.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-3 px-6 py-2.5">
              <div className="min-w-0 flex-1 basis-32">
                <p className="truncate text-sm font-medium">{w.full_name}</p>
                {w.department && <p className="truncate text-xs text-muted-foreground">{w.department}</p>}
              </div>

              <div className="relative w-28 shrink-0">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="h-9 pl-6 text-right"
                  placeholder="Salary"
                  value={values[w.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [w.id]: e.target.value }))}
                />
              </div>

              <div className="flex shrink-0 rounded-lg border border-border overflow-hidden">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenders((v) => ({ ...v, [w.id]: g }))}
                    className={cn(
                      "px-2.5 py-1.5 text-xs font-medium transition-colors",
                      genders[w.id] === g ? "bg-primary text-primary-foreground" : "bg-muted/20 text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {g === "male" ? "M" : "F"}
                  </button>
                ))}
              </div>

              <div className="relative w-24 shrink-0">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="h-9 pl-6 text-right"
                  placeholder="OT/hr"
                  value={otRates[w.id] ?? ""}
                  onChange={(e) => setOtRates((v) => ({ ...v, [w.id]: e.target.value }))}
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
