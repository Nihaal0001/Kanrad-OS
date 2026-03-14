"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus } from "lucide-react"

import { toast } from "sonner"
import { leaveSchema, type LeaveFormData } from "@/lib/validators/hr"
import { createLeave } from "@/actions/hr"
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

interface Worker {
  id: string
  full_name: string
  department: string | null
}

interface LeaveFormProps {
  workers: Worker[]
  trigger?: React.ReactNode
}

export function LeaveForm({ workers, trigger }: LeaveFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LeaveFormData>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      worker_id: "",
      leave_type: "casual",
      from_date: today,
      to_date: today,
      reason: "",
    },
  })

  const leaveType = watch("leave_type")
  const workerId = watch("worker_id")

  async function onSubmit(data: LeaveFormData) {
    setLoading(true)
    setError(null)
    const result = await createLeave(data)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      toast.error(result.error)
      return
    }

    toast.success("Leave request submitted")
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
            New Leave Request
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Leave Request</DialogTitle>
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

          <div className="space-y-1.5">
            <Label>Leave Type *</Label>
            <Select
              value={leaveType}
              onValueChange={(v) => setValue("leave_type", v as LeaveFormData["leave_type"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="earned">Earned</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from_date">From *</Label>
              <Input id="from_date" type="date" {...register("from_date")} />
              {errors.from_date && (
                <p className="text-xs text-destructive">{errors.from_date.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to_date">To *</Label>
              <Input id="to_date" type="date" {...register("to_date")} />
              {errors.to_date && (
                <p className="text-xs text-destructive">{errors.to_date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" {...register("reason")} rows={2} placeholder="Reason for leave…" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
