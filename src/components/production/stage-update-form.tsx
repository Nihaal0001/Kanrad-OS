"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { toast } from "sonner"
import {
  stageUpdateSchema,
  type StageUpdateFormData,
} from "@/lib/validators/production"
import { updateProductionStage } from "@/actions/production"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Pencil } from "lucide-react"

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
] as const

interface StageUpdateFormProps {
  trackingId: string
  orderId: string
  stageName: string
  currentStatus: string
  currentQtyCompleted: number
  currentQtyRejected: number
  currentNotes: string | null
  totalQuantity: number
}

export function StageUpdateForm({
  trackingId,
  orderId,
  stageName,
  currentStatus,
  currentQtyCompleted,
  currentQtyRejected,
  currentNotes,
  totalQuantity,
}: StageUpdateFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<StageUpdateFormData>({
    resolver: zodResolver(stageUpdateSchema),
    defaultValues: {
      status: currentStatus as StageUpdateFormData["status"],
      quantity_completed: currentQtyCompleted,
      quantity_rejected: currentQtyRejected,
      notes: currentNotes ?? "",
    },
  })

  async function onSubmit(data: StageUpdateFormData) {
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await updateProductionStage(trackingId, orderId, data)
      if (result && "error" in result && result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      toast.success(`${stageName} updated`)
      setOpen(false)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" />
          Update
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Stage: {stageName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) =>
                form.setValue("status", v as StageUpdateFormData["status"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qty_completed">
                Completed (of {totalQuantity})
              </Label>
              <Input
                id="qty_completed"
                type="number"
                min={0}
                max={totalQuantity}
                {...form.register("quantity_completed", {
                  valueAsNumber: true,
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qty_rejected">Rejected</Label>
              <Input
                id="qty_rejected"
                type="number"
                min={0}
                {...form.register("quantity_rejected", {
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Any notes about this stage..."
              {...form.register("notes")}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
