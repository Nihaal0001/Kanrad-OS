"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { attendanceSchema, type AttendanceFormData } from "@/lib/validators/hr"
import { upsertAttendance } from "@/actions/hr"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
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

interface Worker {
  id: string
  full_name: string
  department: string | null
}

interface AttendanceFormProps {
  workers: Worker[]
  defaultDate?: string
  defaultWorkerId?: string
  trigger?: React.ReactNode
}

export function AttendanceForm({ workers, defaultDate, defaultWorkerId, trigger }: AttendanceFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AttendanceFormData>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      worker_id: defaultWorkerId ?? "",
      date: defaultDate ?? today,
      status: "present",
      check_in: "",
      check_out: "",
      overtime_hours: 0,
      notes: "",
    },
  })

  const status = watch("status")
  const workerId = watch("worker_id")

  async function onSubmit(data: AttendanceFormData) {
    setLoading(true)
    setError(null)
    const result = await upsertAttendance(data)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      toast.error(result.error)
      return
    }

    toast.success("Attendance saved")
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
            Mark Attendance
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Attendance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Worker */}
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

          {/* Date + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    disableFuture
                  />
                )}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select
                value={status}
                onValueChange={(v) => setValue("status", v as AttendanceFormData["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Check In / Check Out */}
          {(status === "present" || status === "half_day") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Check In</Label>
                <Controller
                  control={control}
                  name="check_in"
                  render={({ field }) => (
                    <TimePicker value={field.value ?? ""} onChange={field.onChange} />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Check Out</Label>
                <Controller
                  control={control}
                  name="check_out"
                  render={({ field }) => (
                    <TimePicker value={field.value ?? ""} onChange={field.onChange} />
                  )}
                />
              </div>
            </div>
          )}

          {/* Overtime */}
          {status === "present" && (
            <div className="space-y-1.5">
              <Label htmlFor="overtime_hours">Overtime Hours</Label>
              <Input
                id="overtime_hours"
                type="number"
                min="0"
                step="0.5"
                max="24"
                {...register("overtime_hours", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
          )}

          {/* Notes */}
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
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
