"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus } from "lucide-react"

import { toast } from "sonner"
import { payrollSchema, type PayrollFormData } from "@/lib/validators/hr"
import { createPayroll, getAttendanceSummary } from "@/actions/hr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

interface Worker {
  id: string
  full_name: string
  department: string | null
}

interface PayrollFormProps {
  workers: Worker[]
  trigger?: React.ReactNode
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PayrollForm({ workers, trigger }: PayrollFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingAttendance, setLoadingAttendance] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PayrollFormData>({
    resolver: zodResolver(payrollSchema),
    defaultValues: {
      worker_id: "",
      period_start: "",
      period_end: "",
      working_days: 26,
      days_present: 0,
      overtime_hours: 0,
      daily_wage: 0,
      overtime_rate: 0,
      deductions: 0,
      bonus: 0,
      notes: "",
    },
  })

  const workerId = watch("worker_id")
  const periodStart = watch("period_start")
  const periodEnd = watch("period_end")
  const dailyWage = watch("daily_wage") ?? 0
  const overtimeRate = watch("overtime_rate") ?? 0
  const daysPresent = watch("days_present") ?? 0
  const overtimeHours = watch("overtime_hours") ?? 0
  const deductions = watch("deductions") ?? 0
  const bonus = watch("bonus") ?? 0

  const baseWage = Number(daysPresent) * Number(dailyWage)
  const overtimePay = Number(overtimeHours) * Number(overtimeRate)
  const totalWage = baseWage + overtimePay - Number(deductions) + Number(bonus)

  // Auto-fill attendance when worker + period is filled
  useEffect(() => {
    if (!workerId || !periodStart || !periodEnd || workerId === "none") return
    setLoadingAttendance(true)
    getAttendanceSummary(workerId, periodStart, periodEnd).then((summary) => {
      setValue("days_present", summary.days_present)
      setValue("overtime_hours", summary.overtime_hours)
      setLoadingAttendance(false)
    })
  }, [workerId, periodStart, periodEnd, setValue])

  async function onSubmit(data: PayrollFormData) {
    setLoading(true)
    setError(null)
    const result = await createPayroll(data)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      toast.error(result.error)
      return
    }

    toast.success("Payroll generated")
    reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Generate Payroll
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Payroll</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Worker *</Label>
            <Select
              value={workerId || "none"}
              onValueChange={(v) => setValue("worker_id", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select worker…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select worker —</SelectItem>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.full_name}
                    {w.department ? ` · ${w.department}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.worker_id && (
              <p className="text-xs text-destructive">{errors.worker_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="period_start">Period Start *</Label>
              <Input id="period_start" type="date" {...register("period_start")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period_end">Period End *</Label>
              <Input id="period_end" type="date" {...register("period_end")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="working_days">Working Days</Label>
              <Input
                id="working_days"
                type="number"
                min="0"
                {...register("working_days", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="days_present">
                Days Present
                {loadingAttendance && (
                  <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />
                )}
              </Label>
              <Input
                id="days_present"
                type="number"
                min="0"
                step="0.5"
                {...register("days_present", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="overtime_hours">OT Hours</Label>
              <Input
                id="overtime_hours"
                type="number"
                min="0"
                step="0.5"
                {...register("overtime_hours", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="daily_wage">Daily Wage (₹) *</Label>
              <Input
                id="daily_wage"
                type="number"
                min="0"
                step="0.01"
                {...register("daily_wage", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="overtime_rate">OT Rate/hr (₹)</Label>
              <Input
                id="overtime_rate"
                type="number"
                min="0"
                step="0.01"
                {...register("overtime_rate", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deductions">Deductions (₹)</Label>
              <Input
                id="deductions"
                type="number"
                min="0"
                step="0.01"
                {...register("deductions", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bonus">Bonus (₹)</Label>
              <Input
                id="bonus"
                type="number"
                min="0"
                step="0.01"
                {...register("bonus", { valueAsNumber: true })}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Base ({Number(daysPresent)} days × ₹{formatCurrency(Number(dailyWage))})</span>
              <span>₹{formatCurrency(baseWage)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Overtime ({Number(overtimeHours)} hrs × ₹{formatCurrency(Number(overtimeRate))})</span>
              <span>₹{formatCurrency(overtimePay)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-1 border-t border-border">
              <span>Net Wage</span>
              <span>₹{formatCurrency(totalWage)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} rows={2} placeholder="Optional notes" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
